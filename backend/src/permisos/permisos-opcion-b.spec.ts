import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  PermisoSistema,
  PERMISOS_SISTEMA,
} from './constants/permisos.constant';
import { PERMISOS_PREDETERMINADOS_POR_ROL } from './constants/plantillas-permisos.constant';
import { UsuarioPermiso } from './entities/usuario-permiso.entity';
import {
  TipoExcepcion,
  UsuarioPermisoExcepcion,
} from './entities/usuario-permiso-excepcion.entity';
import { PermisosService } from './permisos.service';

/**
 * SGPA - QA-003: Suite Automatizada de Pruebas de la Política Opción B
 *
 * Cobertura requerida:
 * 1. Revocación de COORDINADOR y ADMIN_GLOBAL.
 * 2. Conservación de PROFESOR y permisos compartidos.
 * 3. Bloqueo de permisos residuales de roles revocados.
 * 4. Concesiones legítimas (CONCEDER) y prevalencia de denegaciones explícitas (DENEGAR).
 * 5. Doble escritura transaccional simultánea en ambas tablas.
 * 6. Manejo de errores y transacciones fallidas (atomicidad y rollback).
 * 7. Demostración empírica de reversibilidad sin pérdida de datos posteriores.
 */
describe('SGPA-QA-003: Implementación y Pruebas Automatizadas de la Opción B', () => {
  let service: PermisosService;

  let usuarioPermisoRepository: {
    find: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let usuarioPermisoExcepcionRepository: {
    find: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let usuarioRepository: {
    findOne: jest.Mock;
  };

  let txRepoPermiso: {
    find: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let txRepoExcepcion: {
    find: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let manager: {
    getRepository: jest.Mock;
  };

  let dataSource: {
    transaction: jest.Mock;
  };

  beforeEach(() => {
    usuarioPermisoRepository = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((datos) => datos),
      save: jest.fn(async (datos) => datos),
    };

    usuarioPermisoExcepcionRepository = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((datos) => datos),
      save: jest.fn(async (datos) => datos),
    };

    usuarioRepository = {
      findOne: jest.fn(),
    };

    txRepoPermiso = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((datos) => datos),
      save: jest.fn(async (datos) => datos),
    };

    txRepoExcepcion = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((datos) => datos),
      save: jest.fn(async (datos) => datos),
    };

    manager = {
      getRepository: jest.fn((entity) => {
        if (entity === UsuarioPermiso) return txRepoPermiso;
        if (entity === UsuarioPermisoExcepcion) return txRepoExcepcion;
        if (entity === Usuario) return usuarioRepository;
        return null;
      }),
    };

    dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    service = new PermisosService(
      usuarioPermisoRepository as unknown as Repository<UsuarioPermiso>,
      usuarioRepository as unknown as Repository<Usuario>,
      dataSource as unknown as DataSource,
      usuarioPermisoExcepcionRepository as unknown as Repository<UsuarioPermisoExcepcion>,
    );

    // Por defecto la política Opción B permanece desactivada
    expect(service.esPoliticaOpcionBActiva()).toBe(false);
  });

  describe('1. Activación controlada y conservación del modo Legacy', () => {
    it('mantiene la política Opción B desactivada por defecto', () => {
      expect(service.esPoliticaOpcionBActiva()).toBe(false);
    });

    it('permite activar la política Opción B mediante toggle programático', () => {
      service.activarPoliticaOpcionB(true);
      expect(service.esPoliticaOpcionBActiva()).toBe(true);

      service.activarPoliticaOpcionB(false);
      expect(service.esPoliticaOpcionBActiva()).toBe(false);
    });
  });

  describe('2. Resolución Opción B: Revocación de Roles y Bloqueo de Residuos', () => {
    const usuarioId = 20;

    beforeEach(() => {
      service.activarPoliticaOpcionB(true);
    });

    it('bloquea permisos de coordinación al revocar COORDINADOR conservando PROFESOR', async () => {
      // Estado en MySQL tras revocar COORDINADOR: solo PROFESOR está activo
      usuarioRepository.findOne.mockResolvedValue({
        id: usuarioId,
        activo: true,
        usuarioRoles: [
          {
            rol: { id: 3, nombre: RolSistema.PROFESOR, activo: true },
          },
        ],
      });
      usuarioPermisoExcepcionRepository.find.mockResolvedValue([]);

      // 1. Debe autorizar los permisos de PROFESOR
      const tienePeriodosVer = await service.usuarioTienePermisos(usuarioId, [
        PermisoSistema.PERIODOS_VER,
      ]);
      const tieneAulasVer = await service.usuarioTienePermisos(usuarioId, [
        PermisoSistema.AULAS_VER,
      ]);
      expect(tienePeriodosVer).toBe(true);
      expect(tieneAulasVer).toBe(true);

      // 2. Debe BLOQUEAR los permisos residuales exclusivos de COORDINADOR
      const tieneEstudiantesVer = await service.usuarioTienePermisos(usuarioId, [
        PermisoSistema.ESTUDIANTES_VER,
      ]);
      const tienePeriodosGestionar = await service.usuarioTienePermisos(
        usuarioId,
        [PermisoSistema.PERIODOS_GESTIONAR],
      );
      const tieneCarrerasGestionar = await service.usuarioTienePermisos(
        usuarioId,
        [PermisoSistema.CARRERAS_GESTIONAR],
      );

      expect(tieneEstudiantesVer).toBe(false);
      expect(tienePeriodosGestionar).toBe(false);
      expect(tieneCarrerasGestionar).toBe(false);
    });

    it('revoca superusuario inmediatamente cuando ADMIN_GLOBAL es retirado de MySQL', async () => {
      // Degradado a PROFESOR
      usuarioRepository.findOne.mockResolvedValue({
        id: 1,
        activo: true,
        usuarioRoles: [
          {
            rol: { id: 3, nombre: RolSistema.PROFESOR, activo: true },
          },
        ],
      });
      usuarioPermisoExcepcionRepository.find.mockResolvedValue([]);

      const tieneAccesoCarreras = await service.usuarioTienePermisos(1, [
        PermisoSistema.CARRERAS_GESTIONAR,
      ]);
      const tieneAccesoDocente = await service.usuarioTienePermisos(1, [
        PermisoSistema.AULAS_VER,
      ]);

      expect(tieneAccesoCarreras).toBe(false);
      expect(tieneAccesoDocente).toBe(true);
    });

    it('bloquea todo acceso si la cuenta es desactivada en MySQL (QA-002)', async () => {
      usuarioRepository.findOne.mockResolvedValue({
        id: 1,
        activo: false, // Usuario inactivo
        usuarioRoles: [
          {
            rol: { id: 1, nombre: RolSistema.ADMIN_GLOBAL, activo: true },
          },
        ],
      });

      const tiene = await service.usuarioTienePermisos(1, [
        PermisoSistema.AULAS_VER,
      ]);
      expect(tiene).toBe(false);
    });
  });

  describe('3. Excepciones individuales: CONCEDER y prevalencia de DENEGAR', () => {
    const usuarioId = 30;

    beforeEach(() => {
      service.activarPoliticaOpcionB(true);
    });

    it('no usa otros roles ni excepciones si el rol activo solicitado fue revocado', async () => {
      usuarioRepository.findOne.mockResolvedValue({ id: usuarioId, activo: true,
        usuarioRoles: [{ rol: { nombre: RolSistema.PROFESOR, activo: true } }] });
      usuarioPermisoExcepcionRepository.find.mockResolvedValue([
        { usuarioId, permiso: PermisoSistema.AULAS_GESTIONAR, tipo: 'CONCEDER' },
      ]);
      await expect(service.usuarioTienePermisos(usuarioId,
        [PermisoSistema.AULAS_GESTIONAR], RolSistema.COORDINADOR)).resolves.toBe(false);
      expect(await service.obtenerPermisosEfectivos(usuarioId,
        [RolSistema.PROFESOR, RolSistema.COORDINADOR], RolSistema.COORDINADOR)).toEqual([]);
    });

    it('respeta excepciones legítimas CONCEDER fuera de la plantilla del rol', async () => {
      usuarioRepository.findOne.mockResolvedValue({
        id: usuarioId,
        activo: true,
        usuarioRoles: [
          {
            rol: { id: 3, nombre: RolSistema.PROFESOR, activo: true },
          },
        ],
      });

      // Excepción CONCEDER para AULAS_GESTIONAR (delegación docente)
      usuarioPermisoExcepcionRepository.find.mockResolvedValue([
        {
          usuarioId,
          permiso: PermisoSistema.AULAS_GESTIONAR,
          tipo: 'CONCEDER' as TipoExcepcion,
        },
      ]);

      const tieneGestionAulas = await service.usuarioTienePermisos(usuarioId, [
        PermisoSistema.AULAS_GESTIONAR,
      ]);
      const tieneAulasVer = await service.usuarioTienePermisos(usuarioId, [
        PermisoSistema.AULAS_VER,
      ]);
      expect(tieneGestionAulas).toBe(true);
      expect(tieneAulasVer).toBe(true);
    });

    it('hace prevalecer estrictamente DENEGAR sobre los permisos de plantilla', async () => {
      usuarioRepository.findOne.mockResolvedValue({
        id: usuarioId,
        activo: true,
        usuarioRoles: [
          {
            rol: { id: 2, nombre: RolSistema.COORDINADOR, activo: true },
          },
        ],
      });

      // Excepción DENEGAR sobre PERIODOS_GESTIONAR
      usuarioPermisoExcepcionRepository.find.mockResolvedValue([
        {
          usuarioId,
          permiso: PermisoSistema.PERIODOS_GESTIONAR,
          tipo: 'DENEGAR' as TipoExcepcion,
        },
      ]);

      const tieneGestionPeriodos = await service.usuarioTienePermisos(
        usuarioId,
        [PermisoSistema.PERIODOS_GESTIONAR],
      );
      const tieneVerPeriodos = await service.usuarioTienePermisos(usuarioId, [
        PermisoSistema.PERIODOS_VER,
      ]);

      // DENEGAR bloquea PERIODOS_GESTIONAR a pesar de ser COORDINADOR
      expect(tieneGestionPeriodos).toBe(false);
      // El resto de la plantilla sigue intacto
      expect(tieneVerPeriodos).toBe(true);
    });

    it('falla cerrada si no puede leer las excepciones de permisos', async () => {
      usuarioRepository.findOne.mockResolvedValue({
        id: usuarioId,
        activo: true,
        usuarioRoles: [
          {
            rol: { id: 2, nombre: RolSistema.COORDINADOR, activo: true },
          },
        ],
      });
      usuarioPermisoExcepcionRepository.find.mockRejectedValue(
        new Error('tabla de excepciones no disponible'),
      );

      await expect(
        service.usuarioTienePermisos(usuarioId, [
          PermisoSistema.PERIODOS_GESTIONAR,
        ]),
      ).rejects.toThrow('tabla de excepciones no disponible');
    });
  });

  describe('4. Doble Escritura Transaccional y Consistencia ACID', () => {
    const usuarioId = 40;

    beforeEach(() => {
      usuarioRepository.findOne.mockResolvedValue({
        id: usuarioId,
        activo: true,
        usuarioRoles: [
          {
            rol: { id: 3, nombre: RolSistema.PROFESOR, activo: true },
          },
        ],
      });
    });

    it('ejecuta doble escritura simultánea en usuario_permiso_excepciones y usuario_permisos', async () => {
      // El admin otorga AULAS_VER, PERIODOS_VER y añade CONCEDER para AULAS_GESTIONAR
      const permisosDeseados = [
        PermisoSistema.PERIODOS_VER,
        PermisoSistema.AULAS_VER,
        PermisoSistema.AULAS_GESTIONAR,
      ];

      txRepoPermiso.find.mockResolvedValue(
        permisosDeseados.map((p) => ({
          usuarioId,
          permiso: p,
          activo: true,
        })),
      );

      const resultado = await service.reemplazarPermisos(
        usuarioId,
        permisosDeseados,
        1,
      );

      // 1. Verificó usuario
      expect(usuarioRepository.findOne).toHaveBeenCalledWith({
        where: { id: usuarioId },
        relations: { usuarioRoles: { rol: true } },
      });

      // 2. Transacción iniciada
      expect(dataSource.transaction).toHaveBeenCalled();

      // 3. Escribió excepciones calculadas (CONCEDER para AULAS_GESTIONAR)
      expect(txRepoExcepcion.delete).toHaveBeenCalledWith({ usuarioId });
      expect(txRepoExcepcion.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            usuarioId,
            permiso: PermisoSistema.AULAS_GESTIONAR,
            tipo: 'CONCEDER',
          }),
        ]),
      );

      // 4. Doble escritura: Escribió en caliente en la tabla legacy usuario_permisos
      expect(txRepoPermiso.delete).toHaveBeenCalledWith({ usuarioId });
      expect(txRepoPermiso.save).toHaveBeenCalled();
      expect(resultado).toHaveLength(3);
    });

    it('ejecuta rollback total si falla la escritura en usuario_permiso_excepciones', async () => {
      txRepoExcepcion.save.mockRejectedValue(
        new Error('Fallo simulado de MySQL en tabla excepciones'),
      );

      await expect(
        service.reemplazarPermisos(usuarioId, [PermisoSistema.AULAS_VER]),
      ).rejects.toThrow('Fallo simulado de MySQL en tabla excepciones');

      // Se comprueba que el error aborta la transacción y no llega a consultar el estado final
      expect(txRepoPermiso.find).not.toHaveBeenCalled();
    });

    it('ejecuta rollback total si falla la escritura en la tabla legacy usuario_permisos', async () => {
      txRepoPermiso.save.mockRejectedValue(
        new Error('Fallo simulado de MySQL en tabla legacy'),
      );

      await expect(
        service.reemplazarPermisos(usuarioId, [PermisoSistema.AULAS_VER]),
      ).rejects.toThrow('Fallo simulado de MySQL en tabla legacy');

      expect(txRepoPermiso.find).not.toHaveBeenCalled();
    });
  });

  describe('5. Demostración Empírica de Reversión (Rollback sin Pérdida de Datos)', () => {
    const usuarioId = 50;

    it('demuestra que desactivar la Opción B conserva el 100% de los cambios posteriores en modo legacy', async () => {
      // T1: Fase activa de la Opción B
      service.activarPoliticaOpcionB(true);
      expect(service.esPoliticaOpcionBActiva()).toBe(true);

      usuarioRepository.findOne.mockResolvedValue({
        id: usuarioId,
        activo: true,
        usuarioRoles: [
          {
            rol: { id: 3, nombre: RolSistema.PROFESOR, activo: true },
          },
        ],
      });

      // Modificación realizada durante la vigencia de la Opción B:
      // Se agregó una delegación de aulas
      const permisosModificados = [
        PermisoSistema.PERIODOS_VER,
        PermisoSistema.AULAS_VER,
        PermisoSistema.AULAS_GESTIONAR,
      ];

      txRepoPermiso.find.mockResolvedValue(
        permisosModificados.map((p) => ({
          usuarioId,
          permiso: p,
          activo: true,
        })),
      );

      await service.reemplazarPermisos(usuarioId, permisosModificados, 1);

      // Verificamos que la tabla legacy recibió la proyección en caliente
      expect(txRepoPermiso.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            usuarioId,
            permiso: PermisoSistema.AULAS_GESTIONAR,
            activo: true,
          }),
        ]),
      );

      // T2: Evento de Reversión / Contingencia: Se desactiva la nueva política
      service.activarPoliticaOpcionB(false);
      expect(service.esPoliticaOpcionBActiva()).toBe(false);

      // T3: El backend legacy vuelve a consultar directamente usuario_permisos
      usuarioPermisoRepository.find.mockResolvedValue(
        permisosModificados.map((p) => ({
          usuarioId,
          permiso: p,
          activo: true,
        })),
      );

      // Comprobación de integridad: El sistema legacy autoriza exactamente
      // los permisos configurados durante la vigencia de la Opción B
      const tienePeriodosVer = await service.usuarioTienePermisos(usuarioId, [
        PermisoSistema.PERIODOS_VER,
      ]);
      const tieneAulasGestionar = await service.usuarioTienePermisos(usuarioId, [
        PermisoSistema.AULAS_GESTIONAR,
      ]);

      expect(tienePeriodosVer).toBe(true);
      expect(tieneAulasGestionar).toBe(true);
      // No hubo pérdida de datos posteriores
      expect(usuarioPermisoRepository.find).toHaveBeenCalledWith({
        where: {
          usuarioId,
          activo: true,
          permiso: In([PermisoSistema.AULAS_GESTIONAR]),
        },
      });
    });
  });
});
