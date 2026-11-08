import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolSistema } from '../../auth/constants/roles.constants';
import { PermisoSistema } from '../constants/permisos.constant';
import { PermisosGuard } from './permisos.guard';
import { PermisosService } from '../permisos.service';
import { AlcanceJerarquicoService } from '../alcance-jerarquico.service';

describe('PermisosGuard', () => {
  let guard: PermisosGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let permisosService: { usuarioTienePermisos: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    permisosService = { usuarioTienePermisos: jest.fn() };
    guard = new PermisosGuard(
      reflector as unknown as Reflector,
      permisosService as unknown as PermisosService,
    );
  });

  function crearContexto(user: any, method?: string, clase?: string, params?: Record<string, string>, handler?: string): ExecutionContext {
    if (user && !user.rolActivo && user.roles?.length === 1) user.rolActivo = user.roles[0];
    return {
      getHandler: jest.fn().mockReturnValue(handler ? { name: handler } : undefined),
      getClass: jest.fn().mockReturnValue(clase ? { name: clase } : undefined),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user, method, params }),
      }),
    } as unknown as ExecutionContext;
  }

  it('permite acceso si no hay permisos requeridos', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = crearContexto({ sub: 1, roles: [RolSistema.COORDINADOR] });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('bloquea permisos legacy de un asistente sin responsable vigente', async () => {
    reflector.getAllAndOverride.mockReturnValue([PermisoSistema.CURSOS_VER]);
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    const contexto = crearContexto({ sub: 20, roles: [RolSistema.ASISTENTE_ESTUDIANTIL],
      jerarquiaConfigurada: true, accesoJerarquicoVigente: false }, 'GET', 'CursosController');
    await expect(guard.canActivate(contexto)).rejects.toThrow(ForbiddenException);
    expect(permisosService.usuarioTienePermisos).not.toHaveBeenCalled();
  });

  it('cierra rutas sin decorador de permiso a cuentas jerarquicas', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = crearContexto({
      sub: 2, roles: [RolSistema.COORDINADOR], jerarquiaConfigurada: true,
    });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('deniega una carrera concreta si falta el proveedor de alcance', async () => {
    reflector.getAllAndOverride.mockReturnValue([PermisoSistema.CARRERAS_VER]);
    const context = crearContexto(
      { sub: 2, roles: [RolSistema.COORDINADOR], jerarquiaConfigurada: true },
      'GET', 'CarrerasController', { id: '99' },
    );
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(permisosService.usuarioTienePermisos).not.toHaveBeenCalled();
  });

  it('lanza ForbiddenException si no hay usuario en request', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      PermisoSistema.PROFESORES_VER,
    ]);
    const context = crearContexto(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('permite acceso irrestricto a ADMIN_GLOBAL sin consultar base de datos', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      PermisoSistema.PERFILES_DOCENTES_VALIDAR,
    ]);
    const context = crearContexto({
      sub: 1,
      roles: [RolSistema.ADMIN_GLOBAL],
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(permisosService.usuarioTienePermisos).not.toHaveBeenCalled();
  });

  it('permite acceso si usuario posee los permisos requeridos', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      PermisoSistema.ATESTADOS_VALIDAR,
    ]);
    permisosService.usuarioTienePermisos.mockResolvedValue(true);

    const context = crearContexto({
      sub: 10,
      roles: [RolSistema.COORDINADOR],
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(permisosService.usuarioTienePermisos).toHaveBeenCalledWith(10, [
      PermisoSistema.ATESTADOS_VALIDAR,
    ], RolSistema.COORDINADOR);
  });

  it('gestionar Cursos permite su lectura jerárquica, sin habilitar escritura del asistente', async () => {
    reflector.getAllAndOverride.mockReturnValue([PermisoSistema.CURSOS_VER]);
    permisosService.usuarioTienePermisos.mockImplementation(async (_id, permisos) =>
      permisos[0] === PermisoSistema.CURSOS_GESTIONAR);
    const user = { sub: 3, roles: [RolSistema.ASISTENTE_ESTUDIANTIL], jerarquiaConfigurada: true };
    await expect(guard.canActivate(crearContexto(user, 'GET', 'CursosController'))).resolves.toBe(true);
    reflector.getAllAndOverride.mockReturnValue([PermisoSistema.CURSOS_GESTIONAR]);
    await expect(guard.canActivate(crearContexto(user, 'POST', 'CursosController'))).rejects.toThrow(ForbiddenException);
  });

  it('autoriza controladores nuevos al coordinador con permiso y bloquea escritura del asistente', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    const coordinador = { sub: 3, roles: [RolSistema.COORDINADOR], jerarquiaConfigurada: true };
    const asistente = { sub: 4, roles: [RolSistema.ASISTENTE_ESTUDIANTIL], jerarquiaConfigurada: true };
    for (const [clase, permiso] of [
      ['BandejaRevisionEstudiantesController', PermisoSistema.ESTUDIANTES_GESTIONAR],
      ['TransicionesCurricularesController', PermisoSistema.PLANES_ESTUDIO_GESTIONAR],
    ] as const) {
      reflector.getAllAndOverride.mockReturnValue([permiso]);
      await expect(guard.canActivate(crearContexto(coordinador, 'POST', clase))).resolves.toBe(true);
      await expect(guard.canActivate(crearContexto(asistente, 'POST', clase))).rejects.toThrow(ForbiddenException);
    }
    permisosService.usuarioTienePermisos.mockResolvedValue(false);
    reflector.getAllAndOverride.mockReturnValue([PermisoSistema.ESTUDIANTES_GESTIONAR]);
    await expect(guard.canActivate(crearContexto(coordinador, 'POST', 'BandejaRevisionEstudiantesController'))).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(crearContexto({ sub: 1, roles: [RolSistema.ADMIN_GLOBAL] }, 'POST', 'BandejaRevisionEstudiantesController'))).resolves.toBe(true);
  });

  it('limita al coordinador las revisiones docentes con permiso y bloquea otras rutas', async () => {
    reflector.getAllAndOverride.mockReturnValue([PermisoSistema.PERFILES_DOCENTES_VALIDAR]);
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    const coordinador = { sub: 3, roles: [RolSistema.COORDINADOR], jerarquiaConfigurada: true };
    await expect(guard.canActivate(crearContexto(coordinador, 'PATCH', 'ProfesoresController', {},
      'revisarPerfilProfesor'))).resolves.toBe(true);
    await expect(guard.canActivate(crearContexto(coordinador, 'PATCH', 'ProfesoresController', {},
      'revisarRequisitoPerfilProfesor'))).resolves.toBe(true);
    await expect(guard.canActivate(crearContexto(coordinador, 'PATCH', 'ProfesoresController', {},
      'listar'))).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(crearContexto({ sub: 5, roles: [RolSistema.ASISTENTE_ESTUDIANTIL],
      jerarquiaConfigurada: true }, 'PATCH', 'ProfesoresController', {},
    'revisarPerfilProfesor'))).rejects.toThrow(ForbiddenException);
  });

  it('limita la gestión de aulas del coordinador por rol activo, permisos y carrera autorizada', async () => {
    const mockAlcance = {
      obtenerCarrerasAutorizadas: jest.fn().mockResolvedValue([1]),
      puedeEjecutar: jest.fn().mockResolvedValue(true),
    };
    const guardConAlcance = new PermisosGuard(
      reflector as unknown as Reflector,
      permisosService as unknown as PermisosService,
      mockAlcance as unknown as AlcanceJerarquicoService,
    );
    reflector.getAllAndOverride.mockReturnValue([PermisoSistema.AULAS_GESTIONAR]);
    permisosService.usuarioTienePermisos.mockResolvedValue(true);

    const coord = { sub: 3, roles: [RolSistema.COORDINADOR], jerarquiaConfigurada: false };
    await expect(guardConAlcance.canActivate(crearContexto(coord, 'POST', 'AulasController'))).resolves.toBe(true);
    expect(mockAlcance.obtenerCarrerasAutorizadas).toHaveBeenCalledWith(coord.sub);
    expect(permisosService.usuarioTienePermisos).toHaveBeenCalledWith(
      coord.sub, [PermisoSistema.AULAS_GESTIONAR], RolSistema.COORDINADOR,
    );

    mockAlcance.obtenerCarrerasAutorizadas.mockResolvedValue([]);
    await expect(guardConAlcance.canActivate(crearContexto(coord, 'POST', 'AulasController')))
      .rejects.toThrow(ForbiddenException);

    mockAlcance.obtenerCarrerasAutorizadas.mockResolvedValue([1]);
    permisosService.usuarioTienePermisos.mockResolvedValue(false);
    await expect(guardConAlcance.canActivate(crearContexto(coord, 'POST', 'AulasController')))
      .rejects.toThrow(ForbiddenException);

    await expect(guardConAlcance.canActivate(crearContexto({
      sub: 5, roles: [RolSistema.COORDINADOR, RolSistema.PROFESOR],
    }, 'POST', 'AulasController'))).rejects.toThrow(ForbiddenException);

    permisosService.usuarioTienePermisos.mockResolvedValue(false);
    const profesor = { sub: 6, roles: [RolSistema.PROFESOR] };
    await expect(guard.canActivate(crearContexto(profesor, 'POST', 'AulasController')))
      .rejects.toThrow(ForbiddenException);
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    await expect(guard.canActivate(crearContexto(profesor, 'POST', 'AulasController'))).resolves.toBe(true);

    const asistente = { sub: 7, roles: [RolSistema.ASISTENTE_ESTUDIANTIL], jerarquiaConfigurada: true };
    await expect(guardConAlcance.canActivate(crearContexto(asistente, 'POST', 'AulasController')))
      .rejects.toThrow(ForbiddenException);
  });

  it('lanza ForbiddenException si el usuario no posee los permisos requeridos', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      PermisoSistema.ATESTADOS_VALIDAR,
    ]);
    permisosService.usuarioTienePermisos.mockResolvedValue(false);

    const context = crearContexto({
      sub: 10,
      roles: [RolSistema.COORDINADOR],
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('no otorga bypass si ADMIN_GLOBAL fue revocado y solo conserva rol PROFESOR', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      PermisoSistema.PERFILES_DOCENTES_VALIDAR,
    ]);
    // ADMIN_GLOBAL ya no está en los roles activos tras ser sincronizado por AuthGuard
    permisosService.usuarioTienePermisos.mockResolvedValue(false);

    const context = crearContexto({
      sub: 1,
      roles: [RolSistema.PROFESOR],
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(permisosService.usuarioTienePermisos).toHaveBeenCalledWith(1, [
      PermisoSistema.PERFILES_DOCENTES_VALIDAR,
    ], RolSistema.PROFESOR);
  });

  it('permite acceso si ADMIN_GLOBAL fue revocado pero el usuario posee permisos específicos asignados', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      PermisoSistema.PROFESORES_VER,
    ]);
    permisosService.usuarioTienePermisos.mockResolvedValue(true);

    const context = crearContexto({
      sub: 1,
      roles: [RolSistema.PROFESOR],
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(permisosService.usuarioTienePermisos).toHaveBeenCalledWith(1, [
      PermisoSistema.PROFESORES_VER,
    ], RolSistema.PROFESOR);
  });
});
