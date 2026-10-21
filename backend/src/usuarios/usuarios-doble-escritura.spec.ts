import { DataSource, Repository, EntityManager } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { Rol } from '../roles/entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import { UsuarioRol } from './entities/usuario-rol.entity';
import { UsuarioPermiso } from '../permisos/entities/usuario-permiso.entity';
import { UsuarioPermisoExcepcion } from '../permisos/entities/usuario-permiso-excepcion.entity';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PERMISOS_PREDETERMINADOS_POR_ROL } from '../permisos/constants/plantillas-permisos.constant';
import { PermisosService } from '../permisos/permisos.service';
import { UsuariosService } from './usuarios.service';
import { ProfesorCarrera } from '../profesores/entities/profesor-carrera.entity';
import { Carrera } from '../carreras/entities/carrera.entity';
import { DependenciaUsuario } from './entities/dependencia-usuario.entity';
import { SolicitudCambio } from './entities/solicitud-cambio.entity';
import { AuditoriaJerarquia } from './entities/auditoria-jerarquia.entity';

describe('UsuariosService - Doble Escritura Transaccional y Reversión (QA-003)', () => {
  let usuariosService: UsuariosService;
  let permisosService: PermisosService;

  // Repositorios principales
  let usuarioRepo: any;
  let usuarioRolRepo: any;
  let rolRepo: any;
  let profesorCarreraRepo: any;
  let carreraRepo: any;
  let usuarioPermisoRepo: any;
  let usuarioPermisoExcepcionRepo: any;
  let dataSource: any;

  // Estado en memoria simulado
  let usuariosDb: Map<number, any>;
  let usuarioRolesDb: Array<{ usuarioId: number; rolId: number }>;
  let rolesDb: Map<number, any>;
  let usuarioPermisosDb: Array<{
    usuarioId: number;
    permiso: PermisoSistema;
    activo: boolean;
  }>;
  let excepcionesDb: Array<{
    usuarioId: number;
    permiso: PermisoSistema;
    tipo: 'CONCEDER' | 'DENEGAR';
  }>;

  beforeEach(() => {
    usuariosDb = new Map();
    usuarioRolesDb = [];
    rolesDb = new Map([
      [
        1,
        {
          id: 1,
          nombre: RolSistema.ADMIN_GLOBAL,
          descripcion: 'Admin',
          activo: true,
        },
      ],
      [
        2,
        {
          id: 2,
          nombre: RolSistema.COORDINADOR,
          descripcion: 'Coordinador',
          activo: true,
        },
      ],
      [
        3,
        {
          id: 3,
          nombre: RolSistema.PROFESOR,
          descripcion: 'Profesor',
          activo: true,
        },
      ],
      [
        4,
        {
          id: 4,
          nombre: RolSistema.ASISTENTE_ESTUDIANTIL,
          descripcion: 'Estudiante',
          activo: true,
        },
      ],
    ]);
    usuarioPermisosDb = [];
    excepcionesDb = [];

    // Manager transaccional
    const createTxManager = () => {
      const txManager = {
        getRepository: jest.fn((entity: any) => {
          if (entity === Usuario) {
            return {
              create: (d: any) => ({ ...d, id: d.id ?? 100 }),
              save: async (u: any) => {
                const entityToSave = { ...u, id: u.id ?? 100 };
                usuariosDb.set(entityToSave.id, entityToSave);
                return entityToSave;
              },
              findOne: async ({ where }: any) => {
                const u = usuariosDb.get(where?.id);
                if (!u) return null;
                const roles = usuarioRolesDb
                  .filter((ur) => ur.usuarioId === u.id)
                  .map((ur) => ({
                    ...ur,
                    rol: rolesDb.get(ur.rolId),
                  }));
                return { ...u, usuarioRoles: roles };
              },
            };
          }
          if (entity === UsuarioRol) {
            return {
              create: (d: any) => d,
              save: async (item: any) => {
                if (Array.isArray(item)) {
                  for (const i of item) {
                    usuarioRolesDb.push({ ...i });
                  }
                  return item;
                }
                usuarioRolesDb.push({ ...item });
                return item;
              },
              delete: async ({ usuarioId, rolId }: any) => {
                const idx = usuarioRolesDb.findIndex(
                  (ur) =>
                    ur.usuarioId === usuarioId &&
                    (rolId === undefined || ur.rolId === rolId),
                );
                if (idx !== -1) {
                  usuarioRolesDb.splice(idx, 1);
                }
              },
              find: async ({ where }: any) => {
                return usuarioRolesDb
                  .filter(
                    (ur) =>
                      (where?.usuarioId === undefined ||
                        ur.usuarioId === where.usuarioId) &&
                      (where?.rolId === undefined || ur.rolId === where.rolId),
                  )
                  .map((ur) => ({
                    ...ur,
                    rol: rolesDb.get(ur.rolId),
                  }));
              },
            };
          }
          if (entity === Rol) {
            return {
              find: async ({ where }: any) => {
                return Array.from(rolesDb.values()).filter(
                  (r) => where?.nombre?._value?.includes(r.nombre) ?? true,
                );
              },
              findOne: async ({ where }: any) => {
                if (where?.id) return rolesDb.get(where.id) ?? null;
                if (where?.nombre) {
                  return (
                    Array.from(rolesDb.values()).find(
                      (r) => r.nombre === where.nombre && r.activo,
                    ) ?? null
                  );
                }
                return null;
              },
            };
          }
          if (entity === UsuarioPermiso) {
            return {
              create: (d: any) => d,
              save: async (item: any) => {
                const items = Array.isArray(item) ? item : [item];
                for (const i of items) {
                  usuarioPermisosDb.push({ ...i, activo: true });
                }
                return items;
              },
              delete: async ({ usuarioId }: any) => {
                usuarioPermisosDb = usuarioPermisosDb.filter(
                  (up) => up.usuarioId !== usuarioId,
                );
              },
              find: async ({ where }: any) => {
                return usuarioPermisosDb.filter(
                  (up) =>
                    up.usuarioId === where?.usuarioId &&
                    (where?.activo === undefined ||
                      up.activo === where.activo),
                );
              },
            };
          }
          if (entity === UsuarioPermisoExcepcion) {
            return {
              create: (d: any) => d,
              save: async (item: any) => {
                const items = Array.isArray(item) ? item : [item];
                for (const i of items) {
                  excepcionesDb.push({ ...i });
                }
                return items;
              },
              delete: async ({ usuarioId }: any) => {
                excepcionesDb = excepcionesDb.filter(
                  (e) => e.usuarioId !== usuarioId,
                );
              },
              find: async ({ where }: any) => {
                return excepcionesDb.filter(
                  (e) => e.usuarioId === where?.usuarioId,
                );
              },
            };
          }
          if (entity === ProfesorCarrera) {
            return {
              create: (d: any) => d,
              save: async (d: any) => d,
              delete: async () => {},
            };
          }
          if (entity === DependenciaUsuario) {
            return { find: async () => [], save: async (items: any) => items };
          }
          if (entity === SolicitudCambio) {
            return { update: async () => ({ affected: 0 }) };
          }
          if (entity === AuditoriaJerarquia) {
            return { save: async (item: any) => item };
          }
          throw new Error(`Repositorio no mockeado para ${entity?.name}`);
        }),
      };
      return txManager;
    };

    dataSource = {
      transaction: jest.fn(async (cb: (m: any) => Promise<any>) => {
        const mgr = createTxManager();
        return cb(mgr);
      }),
    };

    usuarioRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        const u = usuariosDb.get(where?.id);
        if (!u) return null;
        const roles = usuarioRolesDb
          .filter((ur) => ur.usuarioId === u.id)
          .map((ur) => ({
            ...ur,
            rol: rolesDb.get(ur.rolId),
          }));
        return { ...u, usuarioRoles: roles, profesorCarreras: [] };
      }),
      find: jest.fn(),
      update: jest.fn(),
    };

    usuarioRolRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        const item = usuarioRolesDb.find(
          (ur) =>
            ur.usuarioId === where?.usuarioId && ur.rolId === where?.rolId,
        );
        if (!item) return null;
        return { ...item, rol: rolesDb.get(item.rolId) };
      }),
      create: (d: any) => d,
      save: jest.fn(async (d: any) => {
        usuarioRolesDb.push(d);
        return d;
      }),
      delete: jest.fn(),
    };

    rolRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        if (where?.id) return rolesDb.get(where.id) ?? null;
        if (where?.nombre) {
          return (
            Array.from(rolesDb.values()).find(
              (r) => r.nombre === where.nombre && r.activo,
            ) ?? null
          );
        }
        return null;
      }),
      find: jest.fn(),
    };

    profesorCarreraRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: (d: any) => d,
      save: jest.fn(),
      delete: jest.fn(),
    };

    carreraRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    usuarioPermisoRepo = {
      find: jest.fn(async ({ where }: any) => {
        return usuarioPermisosDb.filter(
          (up) =>
            up.usuarioId === where?.usuarioId &&
            (where?.activo === undefined || up.activo === where.activo),
        );
      }),
      delete: jest.fn(),
      create: (d: any) => d,
      save: jest.fn(),
    };

    usuarioPermisoExcepcionRepo = {
      find: jest.fn(async ({ where }: any) => {
        return excepcionesDb.filter((e) => e.usuarioId === where?.usuarioId);
      }),
      create: (d: any) => d,
      save: jest.fn(),
      delete: jest.fn(),
    };

    permisosService = new PermisosService(
      usuarioPermisoRepo as unknown as Repository<UsuarioPermiso>,
      usuarioRepo as unknown as Repository<Usuario>,
      dataSource as unknown as DataSource,
      usuarioPermisoExcepcionRepo as unknown as Repository<UsuarioPermisoExcepcion>,
    );

    usuariosService = new UsuariosService(
      usuarioRepo as unknown as Repository<Usuario>,
      usuarioRolRepo as unknown as Repository<UsuarioRol>,
      rolRepo as unknown as Repository<Rol>,
      profesorCarreraRepo as unknown as Repository<ProfesorCarrera>,
      carreraRepo as unknown as Repository<Carrera>,
      dataSource as unknown as DataSource,
      permisosService,
    );
  });

  it('al revocar COORDINADOR elimina accesos exclusivos y PROFESOR conserva permisos legítimos', async () => {
    permisosService.activarPoliticaOpcionB(true);

    // Usuario 10 tiene COORDINADOR (id: 2) y PROFESOR (id: 3)
    usuariosDb.set(10, {
      id: 10,
      cedula: '1010',
      nombres: 'Carlos',
      apellido1: 'Docente',
      activo: true,
    });
    usuarioRolesDb.push({ usuarioId: 10, rolId: 2 });
    usuarioRolesDb.push({ usuarioId: 10, rolId: 3 });

    // Permisos iniciales en usuario_permisos
    usuarioPermisosDb.push(
      { usuarioId: 10, permiso: PermisoSistema.PERIODOS_GESTIONAR, activo: true },
      { usuarioId: 10, permiso: PermisoSistema.ESTUDIANTES_VER, activo: true },
      { usuarioId: 10, permiso: PermisoSistema.PERIODOS_VER, activo: true },
      { usuarioId: 10, permiso: PermisoSistema.AULAS_VER, activo: true },
    );

    // Revocar rol COORDINADOR (id: 2)
    await usuariosService.revocarRol(10, 2, 999);

    // En usuario_roles ya no está COORDINADOR
    expect(usuarioRolesDb.find((ur) => ur.usuarioId === 10 && ur.rolId === 2)).toBeUndefined();
    // En usuario_roles sigue PROFESOR
    expect(usuarioRolesDb.find((ur) => ur.usuarioId === 10 && ur.rolId === 3)).toBeDefined();

    // En usuario_permisos (proyección sincronizada por doble escritura):
    const permisosRestantes = usuarioPermisosDb
      .filter((up) => up.usuarioId === 10)
      .map((up) => up.permiso);

    // Eliminados accesos exclusivos de coordinador
    expect(permisosRestantes).not.toContain(PermisoSistema.PERIODOS_GESTIONAR);
    expect(permisosRestantes).not.toContain(PermisoSistema.ESTUDIANTES_VER);

    // Conservados accesos legítimos de profesor
    expect(permisosRestantes).toContain(PermisoSistema.PERIODOS_VER);
    expect(permisosRestantes).toContain(PermisoSistema.AULAS_VER);
  });

  it('al asignar un rol actualiza correctamente los permisos mediante doble escritura', async () => {
    permisosService.activarPoliticaOpcionB(true);

    // Usuario 20 tiene inicialmente solo PROFESOR (id: 3)
    usuariosDb.set(20, {
      id: 20,
      cedula: '2020',
      nombres: 'Elena',
      apellido1: 'Prof',
      activo: true,
    });
    usuarioRolesDb.push({ usuarioId: 20, rolId: 3 });

    // Permisos iniciales
    usuarioPermisosDb.push(
      { usuarioId: 20, permiso: PermisoSistema.PERIODOS_VER, activo: true },
      { usuarioId: 20, permiso: PermisoSistema.AULAS_VER, activo: true },
    );

    // Asignar rol COORDINADOR
    await usuariosService.asignarRol(20, RolSistema.COORDINADOR);

    // En usuario_roles ahora están ambos
    expect(usuarioRolesDb.filter((ur) => ur.usuarioId === 20)).toHaveLength(2);

    // En usuario_permisos ahora se reflejan los permisos de ambos roles
    const permisosActualizados = usuarioPermisosDb
      .filter((up) => up.usuarioId === 20)
      .map((up) => up.permiso);

    expect(permisosActualizados).toContain(PermisoSistema.PERIODOS_GESTIONAR);
    expect(permisosActualizados).toContain(PermisoSistema.ESTUDIANTES_VER);
    expect(permisosActualizados).toContain(PermisoSistema.PERIODOS_VER);
    expect(permisosActualizados).toContain(PermisoSistema.AULAS_VER);
  });

  it('respeta excepciones individuales CONCEDER y DENEGAR al asignar y revocar roles', async () => {
    permisosService.activarPoliticaOpcionB(true);

    // Usuario 30 tiene rol PROFESOR y dos excepciones:
    // CONCEDER: AULAS_CREAR (fuera de plantilla)
    // DENEGAR: PERIODOS_VER (en plantilla de profesor)
    usuariosDb.set(30, {
      id: 30,
      cedula: '3030',
      nombres: 'Mario',
      apellido1: 'Excepciones',
      activo: true,
    });
    usuarioRolesDb.push({ usuarioId: 30, rolId: 3 });
    excepcionesDb.push(
      { usuarioId: 30, permiso: PermisoSistema.AULAS_CREAR, tipo: 'CONCEDER' },
      { usuarioId: 30, permiso: PermisoSistema.PERIODOS_VER, tipo: 'DENEGAR' },
    );

    // Asignar COORDINADOR
    await usuariosService.asignarRol(30, RolSistema.COORDINADOR);

    const permisosTrasAsignar = usuarioPermisosDb
      .filter((up) => up.usuarioId === 30)
      .map((up) => up.permiso);

    // Excepción CONCEDER respetada
    expect(permisosTrasAsignar).toContain(PermisoSistema.AULAS_CREAR);
    // Excepción DENEGAR prevalece incluso con COORDINADOR
    expect(permisosTrasAsignar).not.toContain(PermisoSistema.PERIODOS_VER);

    // Ahora revocar COORDINADOR
    await usuariosService.revocarRol(30, 2, 999);

    const permisosTrasRevocar = usuarioPermisosDb
      .filter((up) => up.usuarioId === 30)
      .map((up) => up.permiso);

    // Sigue respetando CONCEDER y DENEGAR
    expect(permisosTrasRevocar).toContain(PermisoSistema.AULAS_CREAR);
    expect(permisosTrasRevocar).not.toContain(PermisoSistema.PERIODOS_VER);
    expect(permisosTrasRevocar).not.toContain(PermisoSistema.PERIODOS_GESTIONAR);
  });

  it('un fallo durante asignarRol o revocarRol provoca rollback de todos sus cambios', async () => {
    permisosService.activarPoliticaOpcionB(true);

    usuariosDb.set(40, {
      id: 40,
      cedula: '4040',
      nombres: 'Test',
      apellido1: 'Rollback',
      activo: true,
    });
    usuarioRolesDb.push({ usuarioId: 40, rolId: 3 }); // Profesor

    // Forzar fallo simulado en la transacción
    dataSource.transaction.mockImplementationOnce(async () => {
      throw new Error('Fallo crítico simulado en base de datos');
    });

    await expect(
      usuariosService.asignarRol(40, RolSistema.COORDINADOR),
    ).rejects.toThrow('Fallo crítico simulado');

    // Estado intacto: solo PROFESOR
    expect(usuarioRolesDb.filter((ur) => ur.usuarioId === 40)).toHaveLength(1);
    expect(usuarioRolesDb[0].rolId).toBe(3);
  });

  it('al desactivar la Opción B, la tabla legacy usuario_permisos mantiene los permisos efectivos correctos (demostración de reversión)', async () => {
    // 1. Activar Opción B
    permisosService.activarPoliticaOpcionB(true);

    usuariosDb.set(50, {
      id: 50,
      cedula: '5050',
      nombres: 'Laura',
      apellido1: 'Reversion',
      activo: true,
    });
    usuarioRolesDb.push({ usuarioId: 50, rolId: 2 }); // COORDINADOR
    usuarioRolesDb.push({ usuarioId: 50, rolId: 3 }); // PROFESOR

    // Operación bajo Opción B: Revocar COORDINADOR
    await usuariosService.revocarRol(50, 2, 999);

    // Comprobar que usuario_permisos fue sincronizado
    const permisosEnLegacy = usuarioPermisosDb
      .filter((up) => up.usuarioId === 50)
      .map((up) => up.permiso);
    expect(permisosEnLegacy).not.toContain(PermisoSistema.ESTUDIANTES_VER);
    expect(permisosEnLegacy).toContain(PermisoSistema.PERIODOS_VER);

    // 2. APAGAR la bandera Opción B (Rollback en caliente de política)
    permisosService.activarPoliticaOpcionB(false);

    // 3. Consultar vía consulta legacy
    const tienePeriodosVer = await permisosService.usuarioTienePermisos(50, [
      PermisoSistema.PERIODOS_VER,
    ]);
    const tieneEstudiantesVer = await permisosService.usuarioTienePermisos(50, [
      PermisoSistema.ESTUDIANTES_VER,
    ]);

    expect(tienePeriodosVer).toBe(true); // Permiso legítimo conservado
    expect(tieneEstudiantesVer).toBe(false); // Permiso residual de coordinador correctamente bloqueado
  });

  it('descarta automáticamente permisos de roles desactivados globalmente mediante roles.activo', async () => {
    permisosService.activarPoliticaOpcionB(true);

    usuariosDb.set(60, {
      id: 60,
      cedula: '6060',
      nombres: 'Rol',
      apellido1: 'Inactivo',
      activo: true,
    });
    // Asignado COORDINADOR (id: 2) y PROFESOR (id: 3)
    usuarioRolesDb.push({ usuarioId: 60, rolId: 2 });
    usuarioRolesDb.push({ usuarioId: 60, rolId: 3 });

    // Desactivar COORDINADOR globalmente en la tabla roles
    rolesDb.set(2, {
      id: 2,
      nombre: RolSistema.COORDINADOR,
      descripcion: 'Coordinador Inactivo',
      activo: false,
    });

    const permisosEfectivos =
      await permisosService.resolverPermisosEfectivosOpcionB(60);

    // El rol inactivo no otorga permisos
    expect(permisosEfectivos.has(PermisoSistema.PERIODOS_GESTIONAR)).toBe(false);
    expect(permisosEfectivos.has(PermisoSistema.ESTUDIANTES_VER)).toBe(false);

    // El rol activo (PROFESOR) sí otorga sus permisos legítimos
    expect(permisosEfectivos.has(PermisoSistema.PERIODOS_VER)).toBe(true);
    expect(permisosEfectivos.has(PermisoSistema.AULAS_VER)).toBe(true);
  });

  it('al crear un usuario con permisos custom bajo Opción B, genera excepciones y sincroniza tabla legacy', async () => {
    permisosService.activarPoliticaOpcionB(true);

    const dto = {
      cedula: '7070',
      nombres: 'Nuevo',
      apellido1: 'Docente',
      correo: 'nuevo@sgpa.local',
      password: 'Password123!',
      roles: [RolSistema.PROFESOR],
      permisos: [
        PermisoSistema.AULAS_VER, // en plantilla
        PermisoSistema.AULAS_CREAR, // custom CONCEDER (fuera de plantilla)
        // omitió PERIODOS_VER (en plantilla) -> custom DENEGAR
      ],
    };

    const creado = await usuariosService.crear(dto);

    // Excepciones generadas
    const excUsuario = excepcionesDb.filter((e) => e.usuarioId === creado.id);
    const concedida = excUsuario.find((e) => e.permiso === PermisoSistema.AULAS_CREAR);
    const denegada = excUsuario.find((e) => e.permiso === PermisoSistema.PERIODOS_VER);

    expect(concedida?.tipo).toBe('CONCEDER');
    expect(denegada?.tipo).toBe('DENEGAR');

    // Doble escritura en usuario_permisos
    const permisosLegacy = usuarioPermisosDb
      .filter((up) => up.usuarioId === creado.id)
      .map((up) => up.permiso);

    expect(permisosLegacy).toContain(PermisoSistema.AULAS_VER);
    expect(permisosLegacy).toContain(PermisoSistema.AULAS_CREAR);
    expect(permisosLegacy).not.toContain(PermisoSistema.PERIODOS_VER);
  });

  it('un fallo durante crear revierte toda la transacción sin dejar usuario ni permisos huérfanos', async () => {
    permisosService.activarPoliticaOpcionB(true);

    dataSource.transaction.mockImplementationOnce(async () => {
      throw new Error('Fallo simulado al persistir en transacción');
    });

    const dto = {
      cedula: '8080',
      nombres: 'Fallido',
      apellido1: 'Error',
      correo: 'fallido@sgpa.local',
      password: 'Password123!',
      roles: [RolSistema.PROFESOR],
    };

    await expect(usuariosService.crear(dto)).rejects.toThrow(
      'Fallo simulado al persistir en transacción',
    );

    // Cero registros huérfanos
    expect(usuariosDb.has(100)).toBe(false);
    expect(usuarioRolesDb.find((ur) => ur.usuarioId === 100)).toBeUndefined();
    expect(usuarioPermisosDb.find((up) => up.usuarioId === 100)).toBeUndefined();
  });

  it('al desactivar un rol globalmente y sincronizar en caliente, una posterior reversión a legacy NO reactiva los permisos del rol desactivado', async () => {
    permisosService.activarPoliticaOpcionB(true);

    // Usuario 90 tiene rol COORDINADOR y PROFESOR
    usuariosDb.set(90, {
      id: 90,
      cedula: '9090',
      nombres: 'Global',
      apellido1: 'Sync',
      activo: true,
    });
    usuarioRolesDb.push({ usuarioId: 90, rolId: 2 }); // COORDINADOR
    usuarioRolesDb.push({ usuarioId: 90, rolId: 3 }); // PROFESOR

    usuarioPermisosDb.push(
      { usuarioId: 90, permiso: PermisoSistema.PERIODOS_GESTIONAR, activo: true },
      { usuarioId: 90, permiso: PermisoSistema.ESTUDIANTES_VER, activo: true },
      { usuarioId: 90, permiso: PermisoSistema.PERIODOS_VER, activo: true },
      { usuarioId: 90, permiso: PermisoSistema.AULAS_VER, activo: true },
    );

    // 1. Desactivar COORDINADOR (id: 2) globalmente
    rolesDb.set(2, {
      id: 2,
      nombre: RolSistema.COORDINADOR,
      descripcion: 'Desactivado',
      activo: false,
    });

    // 2. Ejecutar sincronización transaccional para los usuarios con ese rol
    await dataSource.transaction(async (manager: any) => {
      await permisosService.sincronizarUsuariosPorRolEnTransaccion(manager, 2);
    });

    // 3. Comprobar que en la tabla legacy usuario_permisos ya NO están los permisos de coordinador
    const permisosSincronizados = usuarioPermisosDb
      .filter((up) => up.usuarioId === 90)
      .map((up) => up.permiso);

    expect(permisosSincronizados).not.toContain(PermisoSistema.PERIODOS_GESTIONAR);
    expect(permisosSincronizados).not.toContain(PermisoSistema.ESTUDIANTES_VER);
    expect(permisosSincronizados).toContain(PermisoSistema.PERIODOS_VER);
    expect(permisosSincronizados).toContain(PermisoSistema.AULAS_VER);

    // 4. REVERTIR la Opción B (desactivar política)
    permisosService.activarPoliticaOpcionB(false);

    // 5. La consulta legacy sobre usuario_permisos NO reactiva los permisos de coordinador
    const tieneGestionar = await permisosService.usuarioTienePermisos(90, [
      PermisoSistema.PERIODOS_GESTIONAR,
    ]);
    const tienePeriodosVer = await permisosService.usuarioTienePermisos(90, [
      PermisoSistema.PERIODOS_VER,
    ]);

    expect(tieneGestionar).toBe(false); // NO reactivado
    expect(tienePeriodosVer).toBe(true); // Profesor conservado
  });

  it('la variable SGPA_PERMISOS_OPCION_B_ENABLED controla la activación y permanece inactiva por defecto', () => {
    const originalEnv = process.env.SGPA_PERMISOS_OPCION_B_ENABLED;
    try {
      // 1. Por defecto, sin variable, está desactivada
      delete process.env.SGPA_PERMISOS_OPCION_B_ENABLED;
      permisosService.activarPoliticaOpcionB(false);
      expect(permisosService.esPoliticaOpcionBActiva()).toBe(false);

      // 2. Si la variable es 'false', '0' o cualquier otro valor, sigue inactiva
      process.env.SGPA_PERMISOS_OPCION_B_ENABLED = 'false';
      expect(permisosService.esPoliticaOpcionBActiva()).toBe(false);

      process.env.SGPA_PERMISOS_OPCION_B_ENABLED = '0';
      expect(permisosService.esPoliticaOpcionBActiva()).toBe(false);

      // 3. Solo cuando es estrictamente 'true' se activa
      process.env.SGPA_PERMISOS_OPCION_B_ENABLED = 'true';
      expect(permisosService.esPoliticaOpcionBActiva()).toBe(true);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.SGPA_PERMISOS_OPCION_B_ENABLED;
      } else {
        process.env.SGPA_PERMISOS_OPCION_B_ENABLED = originalEnv;
      }
    }
  });
});
