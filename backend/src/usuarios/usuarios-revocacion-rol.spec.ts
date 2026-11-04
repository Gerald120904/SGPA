import { ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PermisoCarrera } from '../permisos/entities/permiso-carrera.entity';
import { AsignacionAcademica } from '../estructura-academica/entities/asignacion-academica.entity';
import { TipoAsignacionAcademica } from '../estructura-academica/constants/tipo-asignacion-academica.constant';
import { DependenciaUsuario } from './entities/dependencia-usuario.entity';
import { AuditoriaJerarquia } from './entities/auditoria-jerarquia.entity';
import { SolicitudCambio } from './entities/solicitud-cambio.entity';
import { Usuario } from './entities/usuario.entity';
import { UsuarioRol } from './entities/usuario-rol.entity';
import { Rol } from '../roles/entities/rol.entity';
import { ProfesorCarrera } from '../profesores/entities/profesor-carrera.entity';
import { Carrera } from '../carreras/entities/carrera.entity';
import { UsuariosService } from './usuarios.service';

describe('revocación del rol coordinador con asistentes', () => {
  const permiso = PermisoSistema.ESTUDIANTES_GESTIONAR;
  const rol = { id: 2, nombre: RolSistema.COORDINADOR, activo: true };
  const cuentas = new Map<number, any>();
  const dependencias: any[] = [];
  const permisos: any[] = [];
  const asignaciones: any[] = [];
  const solicitudes: any[] = [];
  const versiones: number[][] = [];
  const auditorias: any[] = [];
  let service: UsuariosService;
  let datasource: any;

  const ids = (valor: any): number[] => typeof valor === 'number' ? [valor] : valor?._value ?? [];

  beforeEach(() => {
    cuentas.clear(); dependencias.length = 0; permisos.length = 0;
    asignaciones.length = 0; solicitudes.length = 0; versiones.length = 0; auditorias.length = 0;
    cuentas.set(10, { id: 10, nombres: 'Carlos', apellido1: 'Coordinador', activo: true,
      versionAutenticacion: 1, usuarioRoles: [{ usuarioId: 10, rolId: 2, rol }] });
    for (const [id, activo] of [[20, true], [21, true], [22, true], [23, false]] as const) {
      cuentas.set(id, { id, nombres: `Asistente ${id}`, apellido1: 'Prueba', activo,
        versionAutenticacion: 1, usuarioRoles: [{ rol: {
          nombre: RolSistema.ASISTENTE_ESTUDIANTIL, activo: true } }] });
    }
    dependencias.push(
      { id: 1, coordinadorId: 10, asistenteId: 20, activo: true },
      { id: 2, coordinadorId: 10, asistenteId: 21, activo: true },
      { id: 3, coordinadorId: 10, asistenteId: 22, activo: false },
      { id: 4, coordinadorId: 10, asistenteId: 23, activo: true },
    );
    permisos.push(
      { usuarioId: 10, carreraId: 1, permiso, activo: true },
      { usuarioId: 20, carreraId: 1, permiso, activo: true },
      { usuarioId: 22, carreraId: 1, permiso, activo: true },
      { usuarioId: 23, carreraId: 1, permiso, activo: true },
    );
    for (const usuarioId of [10, 20, 22, 23]) asignaciones.push({ usuarioId, carreraId: 1,
      tipo: usuarioId === 10 ? TipoAsignacionAcademica.COORDINADOR_CARRERA :
        TipoAsignacionAcademica.ASISTENTE_CARRERA, activo: true,
      fechaInicio: '2020-01-01', fechaFin: null });
    solicitudes.push({ id: 5, coordinadorId: 10, solicitanteId: 20,
      estado: 'PENDIENTE', modulo: 'ESTUDIANTES', carreraId: 1 });

    const manager = { getRepository: (entity: any): any => {
      if (entity === Usuario) return {
        find: async ({ where }: any) => [...cuentas.values()].filter((u) => ids(where.id).includes(u.id)),
        findOne: async ({ where }: any) => cuentas.get(where.id) ?? null,
        update: async ({ id }: any, cambio: any) => {
          const afectados = ids(id); versiones.push(afectados);
          for (const usuarioId of afectados) {
            const cuenta = cuentas.get(usuarioId);
            if (cuenta && cambio.versionAutenticacion) cuenta.versionAutenticacion += 1;
          }
        },
      };
      if (entity === UsuarioRol) return {
        findOne: async ({ where }: any) => where.usuarioId === 10 && where.rolId === 2
          ? { usuarioId: 10, rolId: 2, rol } : null,
        delete: async () => undefined,
      };
      if (entity === DependenciaUsuario) return {
        find: async ({ where }: any) => dependencias.filter((d) => d.coordinadorId === where.coordinadorId &&
          (where.activo === undefined || d.activo === where.activo)),
        save: async () => undefined,
      };
      if (entity === PermisoCarrera) return {
        find: async ({ where }: any) => permisos.filter((p) => ids(where.usuarioId).includes(p.usuarioId) &&
          (where.activo === undefined || p.activo === where.activo)),
        update: async ({ usuarioId }: any) => {
          for (const p of permisos) if (p.usuarioId === usuarioId) p.activo = false;
        },
      };
      if (entity === AsignacionAcademica) return {
        find: async ({ where }: any) => asignaciones.filter((a) => ids(where.usuarioId).includes(a.usuarioId) &&
          a.tipo === where.tipo && a.activo === where.activo),
      };
      if (entity === SolicitudCambio) return {
        find: async () => solicitudes.filter((s) => s.estado === 'PENDIENTE'),
        update: async (id: number, cambio: any) => Object.assign(solicitudes.find((s) => s.id === id), cambio),
      };
      if (entity === AuditoriaJerarquia) return { save: async (item: any) => auditorias.push(item) };
      if (entity === ProfesorCarrera) return { delete: async () => undefined };
      throw new Error(`Repositorio inesperado: ${entity?.name}`);
    } };
    datasource = { manager, transaction: jest.fn(async (callback: any) => callback(manager)) };
    const usuarioRepo = { findOne: async ({ where }: any) => cuentas.get(where.id) ?? null };
    const usuarioRolRepo = { findOne: async ({ where }: any) => where.usuarioId === 10 && where.rolId === 2
      ? { usuarioId: 10, rolId: 2, rol } : null };
    service = new UsuariosService(usuarioRepo as unknown as Repository<Usuario>,
      usuarioRolRepo as unknown as Repository<UsuarioRol>, {} as Repository<Rol>,
      {} as Repository<ProfesorCarrera>, {} as Repository<Carrera>, datasource as DataSource);
  });

  it('previsualiza identidades, delegaciones y sesiones sin modificar datos al cancelar', async () => {
    const impacto = await service.previsualizarRevocacionRol(10, 2);
    expect(impacto.totalAsistentes).toBe(3);
    expect(impacto.totalAsistentesActivos).toBe(2);
    expect(impacto.asistentesAfectados.map((a) => a.id)).toEqual([20, 21, 23]);
    expect(impacto.asistentesAfectados[0].delegaciones).toEqual([{ carreraId: 1, permiso }]);
    expect(impacto.sesionesInvalidadas).toEqual([20]);
    expect(impacto.totalSolicitudes).toBe(1);
    expect(datasource.transaction).not.toHaveBeenCalled();
    expect(versiones).toEqual([]);
    expect(solicitudes[0].estado).toBe('PENDIENTE');
  });

  it('mantiene activas las cuentas y solo invalida sesiones con acceso efectivo', async () => {
    const impacto = await service.previsualizarRevocacionRol(10, 2);
    await service.revocarRol(10, 2, 1, impacto.firma);
    expect([...cuentas.values()].filter((u) => [20, 21, 22, 23].includes(u.id)).map((u) => u.activo))
      .toEqual([true, true, true, false]);
    expect(dependencias.filter((d) => d.activo).map((d) => d.asistenteId)).toEqual([]);
    expect(versiones).toEqual([[10, 20]]);
    expect(cuentas.get(22).versionAutenticacion).toBe(1);
    expect(solicitudes[0]).toMatchObject({ estado: 'RECHAZADA', resueltoPorUsuarioId: 1 });
    expect(auditorias[0]).toMatchObject({ accion: 'REVOCAR_COORDINADOR',
      detalle: { asistentesDesvinculados: expect.arrayContaining([expect.objectContaining({ id: 20 })]),
        solicitudesRechazadas: [5] } });
  });

  it('rechaza firma obsoleta si aparece otra dependencia activa antes de confirmar', async () => {
    const impacto = await service.previsualizarRevocacionRol(10, 2);
    dependencias.push({ id: 6, coordinadorId: 10, asistenteId: 22, activo: true });
    await expect(service.revocarRol(10, 2, 1, impacto.firma)).rejects.toThrow(ConflictException);
    expect(versiones).toEqual([]);
    expect(dependencias.filter((d) => d.activo)).toHaveLength(4);
    expect(auditorias).toEqual([]);
  });
});
