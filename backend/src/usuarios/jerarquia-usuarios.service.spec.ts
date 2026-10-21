import { ForbiddenException } from '@nestjs/common';
import { RolSistema } from '../auth/constants/roles.constants';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Carrera } from '../carreras/entities/carrera.entity';
import { AsignacionAcademica } from '../estructura-academica/entities/asignacion-academica.entity';
import { PermisoCarrera } from '../permisos/entities/permiso-carrera.entity';
import { UsuarioPermisoExcepcion } from '../permisos/entities/usuario-permiso-excepcion.entity';
import { UsuarioPermiso } from '../permisos/entities/usuario-permiso.entity';
import { AuditoriaJerarquia } from './entities/auditoria-jerarquia.entity';
import { DependenciaUsuario } from './entities/dependencia-usuario.entity';
import { SolicitudCambio } from './entities/solicitud-cambio.entity';
import { Usuario } from './entities/usuario.entity';
import { JerarquiaUsuariosService } from './jerarquia-usuarios.service';

const cuenta = (id: number, rol: RolSistema, activo = true) => ({
  id, activo, usuarioRoles: [{ rol: { nombre: rol, activo: true } }],
});

describe('JerarquiaUsuariosService', () => {
  const permiso = PermisoSistema.ESTUDIANTES_VER;
  const carreras = [{ carreraId: 2, permisos: [permiso] }];
  let service: JerarquiaUsuariosService;
  let usuarios: { findOne: jest.Mock };
  let scope: { obtenerCarrerasAutorizadas: jest.Mock; obtenerPermisosDelegables: jest.Mock };
  let tx: jest.Mock;

  beforeEach(() => {
    usuarios = { findOne: jest.fn(async ({ where }) => {
      if (where.id === 1) return cuenta(1, RolSistema.ADMIN_GLOBAL);
      if (where.id === 2) return cuenta(2, RolSistema.COORDINADOR);
      if (where.id === 3) return cuenta(3, RolSistema.COORDINADOR);
      if (where.id === 4) return cuenta(4, RolSistema.ASISTENTE_ESTUDIANTIL);
      return null;
    }) };
    scope = {
      obtenerCarrerasAutorizadas: jest.fn().mockResolvedValue([2]),
      obtenerPermisosDelegables: jest.fn().mockResolvedValue([permiso]),
    };
    tx = jest.fn();
    service = new JerarquiaUsuariosService(
      { transaction: tx } as any, usuarios as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, {} as any, {} as any,
      scope as any, {} as any,
    );
  });

  it('solo permite al administrador configurar coordinadores', async () => {
    await expect(service.configurarCoordinador(3, 2, carreras)).rejects.toThrow(ForbiddenException);
    expect(tx).not.toHaveBeenCalled();
  });

  it('rechaza permisos de modulos sin alcance comprobado', async () => {
    await expect(service.configurarCoordinador(1, 2, [{
      carreraId: 2, permisos: [PermisoSistema.PROFESORES_VER],
    }])).rejects.toThrow();
    expect(tx).not.toHaveBeenCalled();
  });

  it('rechaza delegar una carrera ajena antes de crear la cuenta', async () => {
    await expect(service.crearAsistente(2, {
      cedula: '123', nombres: 'Alex', apellido1: 'Prueba', correo: 'alex@example.com',
      carreras: [{ carreraId: 9, permisos: [permiso] }],
    } as any)).rejects.toThrow(ForbiddenException);
    expect(tx).not.toHaveBeenCalled();
  });

  it('rechaza que un coordinador edite al asistente de otro', async () => {
    const alcance = { ...scope, puedeAdministrarAsistente: jest.fn().mockResolvedValue(false) };
    service = new JerarquiaUsuariosService(
      { transaction: tx } as any, usuarios as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, {} as any, {} as any,
      alcance as any, {} as any,
    );
    await expect(service.obtenerAsistente(3, 4)).rejects.toThrow(ForbiddenException);
  });

  it('revoca la ultima carrera y permiso del coordinador sin dejar acceso activo', async () => {
    const asignacion = { usuarioId: 2, carreraId: 2, activo: true, fechaInicio: '2026-01-01', fechaFin: null };
    const permisoCarrera = { usuarioId: 2, carreraId: 2, permiso, activo: true };
    const asignaciones = {
      find: jest.fn(async () => asignacion.activo ? [asignacion] : []),
      save: jest.fn(async (value) => value), create: jest.fn((value) => value),
    };
    const permisos = {
      find: jest.fn(async (options) => options.where.activo && !permisoCarrera.activo ? [] : [permisoCarrera]),
      save: jest.fn(async (value) => value), create: jest.fn((value) => value),
    };
    const auditoria = { save: jest.fn() };
    const vacio = { find: jest.fn().mockResolvedValue([]) };
    const excepciones = { delete: jest.fn(), create: jest.fn((value) => value), save: jest.fn() };
    const legacy = { delete: jest.fn(), create: jest.fn((value) => value), save: jest.fn() };
    const manager = { getRepository: jest.fn((entity) => {
      if (entity === Usuario) return { findOne: jest.fn(async () => cuenta(2, RolSistema.COORDINADOR)) };
      if (entity === Carrera) return vacio;
      if (entity === AsignacionAcademica) return asignaciones;
      if (entity === PermisoCarrera) return permisos;
      if (entity === DependenciaUsuario || entity === SolicitudCambio) return vacio;
      if (entity === AuditoriaJerarquia) return auditoria;
      if (entity === UsuarioPermisoExcepcion) return excepciones;
      if (entity === UsuarioPermiso) return legacy;
      throw new Error('Repositorio inesperado');
    }) };
    tx.mockImplementation((callback) => callback(manager));
    const resultado = await service.configurarCoordinador(1, 2, []);
    expect(resultado.carreras).toEqual([]);
    expect(asignacion.activo).toBe(false);
    expect(permisoCarrera.activo).toBe(false);
    expect(auditoria.save).toHaveBeenCalled();
  });
});
