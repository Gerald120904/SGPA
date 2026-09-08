import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolSistema } from '../../auth/constants/roles.constants';
import { PermisoSistema } from '../constants/permisos.constant';
import { PermisosGuard } from './permisos.guard';
import { PermisosService } from '../permisos.service';

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

  function crearContexto(user: any): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('permite acceso si no hay permisos requeridos', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = crearContexto({ sub: 1, roles: [RolSistema.COORDINADOR] });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
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
    ]);
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
});
