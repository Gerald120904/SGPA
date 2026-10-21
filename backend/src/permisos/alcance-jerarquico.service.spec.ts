import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { Carrera } from '../carreras/entities/carrera.entity';
import { TipoAsignacionAcademica } from '../estructura-academica/constants/tipo-asignacion-academica.constant';
import { AsignacionAcademica } from '../estructura-academica/entities/asignacion-academica.entity';
import { DependenciaUsuario } from '../usuarios/entities/dependencia-usuario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AlcanceJerarquicoService } from './alcance-jerarquico.service';
import { PermisoSistema } from './constants/permisos.constant';
import { PermisoCarrera } from './entities/permiso-carrera.entity';

describe('AlcanceJerarquicoService', () => {
  const usuarios = new Map<number, { activo: boolean; roles: RolSistema[] }>([
    [1, { activo: true, roles: [RolSistema.COORDINADOR] }],
    [2, { activo: true, roles: [RolSistema.COORDINADOR] }],
    [3, { activo: true, roles: [RolSistema.ASISTENTE_ESTUDIANTIL] }],
  ]);
  let asignaciones: Array<Partial<AsignacionAcademica>>;
  let permisos: Array<Partial<PermisoCarrera>>;
  let dependencia: Partial<DependenciaUsuario>;
  let service: AlcanceJerarquicoService;

  beforeEach(() => {
    usuarios.get(1)!.activo = true;
    usuarios.get(3)!.activo = true;
    asignaciones = [
      { usuarioId: 1, carreraId: 10, tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA, activo: true, fechaInicio: '2020-01-01' },
      { usuarioId: 1, carreraId: 20, tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA, activo: true, fechaInicio: '2020-01-01' },
      { usuarioId: 2, carreraId: 10, tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA, activo: true, fechaInicio: '2020-01-01' },
      { usuarioId: 3, carreraId: 10, tipo: TipoAsignacionAcademica.ASISTENTE_CARRERA, activo: true, fechaInicio: '2020-01-01' },
      { usuarioId: 1, carreraId: null, tipo: TipoAsignacionAcademica.DIRECCION_ACADEMICA, activo: true, fechaInicio: '2020-01-01' },
    ];
    permisos = [
      { usuarioId: 1, carreraId: 10, permiso: PermisoSistema.ESTUDIANTES_VER, activo: true },
      { usuarioId: 1, carreraId: 10, permiso: PermisoSistema.ESTUDIANTES_GESTIONAR, activo: true },
      { usuarioId: 3, carreraId: 10, permiso: PermisoSistema.ESTUDIANTES_VER, activo: true },
      { usuarioId: 3, carreraId: 10, permiso: PermisoSistema.ESTUDIANTES_GESTIONAR, activo: true },
    ];
    dependencia = { coordinadorId: 1, asistenteId: 3, activo: true };
    const repoUsuarios = { findOne: jest.fn(async ({ where }: { where: { id: number; activo: boolean } }) => {
      const u = usuarios.get(where.id);
      return u?.activo ? { id: where.id, activo: true, usuarioRoles: u.roles.map((nombre) => ({ rol: { nombre, activo: true } })) } : null;
    }) };
    const repoCarreras = { find: jest.fn(async ({ where }: { where: { id?: unknown; activo: boolean } }) => {
      const ids = where.id ? (where.id as { value: number[] }).value : [10, 20, 30];
      return ids.map((id) => ({ id, activo: true }));
    }) };
    const repoAsignaciones = { find: jest.fn(async ({ where }: { where: { usuarioId: number; tipo: TipoAsignacionAcademica; activo: boolean } }) =>
      asignaciones.filter((a) => a.usuarioId === where.usuarioId && a.tipo === where.tipo && a.activo)) };
    const repoPermisos = {
      findOne: jest.fn(async ({ where }: { where: Partial<PermisoCarrera> }) =>
        permisos.find((p) => Object.entries(where).every(([k, v]) => p[k as keyof PermisoCarrera] === v)) ?? null),
      find: jest.fn(async ({ where }: { where: Partial<PermisoCarrera> }) =>
        permisos.filter((p) => Object.entries(where).every(([k, v]) => p[k as keyof PermisoCarrera] === v))),
    };
    const repoDependencias = { findOne: jest.fn(async ({ where }: { where: Partial<DependenciaUsuario> }) =>
      Object.entries(where).every(([k, v]) => dependencia[k as keyof DependenciaUsuario] === v) ? dependencia : null) };
    service = new AlcanceJerarquicoService(
      repoUsuarios as unknown as Repository<Usuario>,
      repoCarreras as unknown as Repository<Carrera>,
      repoAsignaciones as unknown as Repository<AsignacionAcademica>,
      repoPermisos as unknown as Repository<PermisoCarrera>,
      repoDependencias as unknown as Repository<DependenciaUsuario>,
    );
  });

  it('limita carreras a las asignaciones directas, sin interpretar Dirección como acceso universal', async () => {
    expect(await service.obtenerCarrerasAutorizadas(1)).toEqual([10, 20]);
    expect(await service.puedeEjecutar(1, PermisoSistema.ESTUDIANTES_VER, 30)).toBe(false);
  });

  it('exige permiso propio y vigente del coordinador en la misma carrera', async () => {
    expect(await service.puedeEjecutar(3, PermisoSistema.ESTUDIANTES_VER, 10)).toBe(true);
    expect(await service.puedeEjecutar(3, PermisoSistema.PLANES_ESTUDIO_GESTIONAR, 10)).toBe(false);
    permisos[0].activo = false;
    expect(await service.puedeEjecutar(3, PermisoSistema.ESTUDIANTES_VER, 10)).toBe(false);
  });

  it('revoca el alcance del asistente al retirar carrera o desactivar coordinador', async () => {
    asignaciones[0].activo = false;
    expect(await service.obtenerCarrerasAutorizadas(3)).toEqual([]);
    asignaciones[0].activo = true;
    usuarios.get(1)!.activo = false;
    expect(await service.puedeEjecutar(3, PermisoSistema.ESTUDIANTES_VER, 10)).toBe(false);
  });

  it('impide que otro coordinador administre o reciba delegaciones de un asistente ajeno', async () => {
    expect(await service.puedeAdministrarAsistente(2, 3)).toBe(false);
    await expect(service.validarDelegacion(2, 3, 10, [PermisoSistema.ESTUDIANTES_VER]))
      .rejects.toThrow(ForbiddenException);
    await expect(service.validarDelegacion(1, 3, 10, [PermisoSistema.PLANES_ESTUDIO_GESTIONAR]))
      .rejects.toThrow(ForbiddenException);
  });
});
