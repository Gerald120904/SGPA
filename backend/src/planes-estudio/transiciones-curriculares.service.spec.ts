import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TransicionesCurricularesService } from './transiciones-curriculares.service';
import { EstadoEstudiante } from '../estudiantes/constants/estado-estudiante.constant';
import { ResultadoAcademico } from '../estudiantes/constants/resultado-academico.constant';
import { TipoPlanAsignatura } from './constants/tipo-plan-asignatura.constant';
import { iniciarContextoRolActivo, establecerRolActivo } from '../auth/active-role-context';
import { RolSistema } from '../auth/constants/roles.constants';

describe('TransicionesCurricularesService', () => {
  let service: TransicionesCurricularesService;
  let planRepo: any;
  let carreraRepo: any;
  let usuarioRepo: any;
  let planAsignaturaRepo: any;
  let estudianteRepo: any;
  let historialRepo: any;
  let equivalenciaRepo: any;
  let reglaOptativaRepo: any;
  let alcance: any;
  let dataSource: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    planRepo = {
      findOne: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({ id: where?.id || 1, carreraId: 10, activo: true, estado: 'VIGENTE' }),
      ),
      find: jest.fn(),
    };
    carreraRepo = { findOne: jest.fn().mockResolvedValue({ id: 10, activo: true }) };
    usuarioRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, activo: true }) };
    planAsignaturaRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    estudianteRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((e) => Promise.resolve(e)),
    };
    historialRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn((h) => Promise.resolve(h)),
      create: jest.fn((d) => d),
    };
    equivalenciaRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    reglaOptativaRepo = { findOne: jest.fn().mockResolvedValue(null) };
    alcance = {
      tipoCuentaJerarquica: jest.fn().mockResolvedValue('COORDINADOR'),
      puedeEjecutar: jest.fn().mockResolvedValue(true),
      obtenerCarrerasAutorizadas: jest.fn().mockResolvedValue([10]),
    };
    dataSource = {
      transaction: jest.fn((cb) => cb(crearManagerPrueba())),
      query: jest.fn().mockResolvedValue([]),
    };

    service = new TransicionesCurricularesService(
      planRepo,
      planAsignaturaRepo,
      estudianteRepo,
      historialRepo,
      equivalenciaRepo,
      reglaOptativaRepo,
      alcance,
      dataSource,
    );
  });

  function crearManagerPrueba(overrides: any = {}) {
    return {
      getRepository: jest.fn((entity) => {
        const repos: Record<string, any> = {
          Estudiante: estudianteRepo,
          HistorialAcademicoEstudiante: historialRepo,
          PlanEstudio: planRepo,
          PlanAsignatura: planAsignaturaRepo,
          EquivalenciaPlan: equivalenciaRepo,
          ReglaOptativaPlan: reglaOptativaRepo,
          Carrera: carreraRepo,
          Usuario: usuarioRepo,
        };
        return repos[entity.name];
      }),
      query: jest.fn((sql: string) => {
        if (sql.includes('SELECT r.nombre')) return Promise.resolve([{ nombre: RolSistema.COORDINADOR }]);
        if (sql.includes('SELECT id FROM permisos_carrera')) return Promise.resolve([{ id: 1 }]);
        return Promise.resolve([]);
      }),
      ...overrides,
    };
  }

  function ejecutarComoCoordinador<T>(operacion: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => iniciarContextoRolActivo({} as any, {} as any, () => {
      establecerRolActivo(1, RolSistema.COORDINADOR);
      operacion().then(resolve, reject);
    }));
  }

  describe('listarLotesAuditoria', () => {
    it('limita carreras aunque no se envie filtro y aplica origen y destino', async () => {
      alcance.obtenerCarrerasAutorizadas.mockResolvedValue([10, 11]);
      await service.listarLotesAuditoria(1, undefined, 2, 3);
      const [sql, params] = dataSource.query.mock.calls[0];
      expect(sql).toContain('p.carrera_id IN (?, ?)');
      expect(sql).toContain('a.plan_estudio_id = ?');
      expect(sql).toContain('planDestinoId');
      expect(params).toEqual([10, 11, 2, 3, 'Plan #3']);
    });

    it('bloquea carreras ajenas y usuarios sin alcance', async () => {
      await expect(service.listarLotesAuditoria(1, 99)).rejects.toThrow(ForbiddenException);
      alcance.obtenerCarrerasAutorizadas.mockResolvedValue([]);
      await expect(service.listarLotesAuditoria(1)).rejects.toThrow(ForbiddenException);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('permite al administrador consultar todas las carreras', async () => {
      await new Promise<void>((resolve, reject) => iniciarContextoRolActivo({} as any, {} as any, async () => {
        try {
          establecerRolActivo(1, RolSistema.ADMIN_GLOBAL);
          await service.listarLotesAuditoria(1);
          resolve();
        } catch (error) { reject(error); }
      }));
      expect(dataSource.query.mock.calls[0][0]).not.toContain('p.carrera_id IN');
      expect(alcance.obtenerCarrerasAutorizadas).not.toHaveBeenCalled();
    });
  });

  describe('consultarPoblacionEstudiantil', () => {
    it('retorna estudiantes activos del plan de origen', async () => {
      mockQueryBuilder.getMany.mockResolvedValueOnce([
        {
          id: 101,
          cedula: '111111111',
          nombres: 'Carlos',
          apellido1: 'Pérez',
          apellido2: 'Gómez',
          correoInstitucional: 'carlos@est.ac.cr',
          telefono: '88888888',
          estado: EstadoEstudiante.ACTIVO,
          carreraId: 10,
          planEstudioId: 1,
        },
      ]);

      const res = await service.consultarPoblacionEstudiantil(1, 1, 10);
      expect(res).toHaveLength(1);
      expect(res[0].nombreCompleto).toBe('Carlos Pérez Gómez');
      expect(res[0].cedula).toBe('111111111');
    });

    it('bloquea si el usuario no tiene permisos de lectura', async () => {
      alcance.puedeEjecutar.mockResolvedValue(false);
      await expect(
        service.consultarPoblacionEstudiantil(1, 1, 10),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('simularTransicion', () => {
    it('reconoce una optativa aprobada en un espacio de igual categoria con creditos del plan destino', async () => {
      planAsignaturaRepo.find.mockResolvedValueOnce([{ id: 111, planEstudioId: 1, tipo: TipoPlanAsignatura.OPTATIVA,
        tipoOptativa: 'ABIERTA', creditos: 3 }]).mockResolvedValueOnce([
        { id: 211, planEstudioId: 2, tipo: TipoPlanAsignatura.OPTATIVA,
          tipoOptativa: 'ABIERTA', creditos: 4, activo: true, codigoReferencia: 'OPT-DEST' },
      ]);
      reglaOptativaRepo.findOne.mockResolvedValue({ cantidadDisciplinarias: 0, cantidadAbiertas: 1, cantidadSede: 0 });
      mockQueryBuilder.getMany.mockResolvedValueOnce([{ id: 101, cedula: 'QA', nombres: 'Ana', apellido1: 'Rojas',
        estado: EstadoEstudiante.ACTIVO, planEstudioId: 1, carreraId: 10 }]);
      historialRepo.find.mockResolvedValueOnce([{ id: 900, estudianteId: 101, planAsignaturaId: 111,
        planEstudioContextoId: 1, cursoOptativoId: 77, tipoOptativaReal: 'ABIERTA',
        codigoOptativaReal: 'OPT-REAL', nombreOptativaReal: 'Optativa real', creditosOptativaReal: 3,
        resultado: ResultadoAcademico.APROBADO, reconocimientoOptativo: 'RECONOCIDO',
        planAsignatura: { id: 111, planEstudioId: 1, tipo: TipoPlanAsignatura.OPTATIVA,
          tipoOptativa: 'ABIERTA', creditos: 3 },
      }]);

      const resultado = await service.simularTransicion(1, { carreraId: 10, planOrigenId: 1, planDestinoId: 2 });
      expect(resultado.estudiantes[0].puedeMigrar).toBe(true);
      expect(resultado.estudiantes[0].asignaturasReconocidas).toEqual([
        expect.objectContaining({ asignaturaDestinoId: 211, creditos: 4, tipoEquivalencia: 'OPTATIVA',
          historialOrigenId: 900, cursoOptativoId: 77 }),
      ]);
      expect(historialRepo.save).not.toHaveBeenCalled();
    });

    it('no duplica creditos si dos registros representan la misma optativa real', async () => {
      planAsignaturaRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([
        { id: 211, tipo: TipoPlanAsignatura.OPTATIVA, tipoOptativa: 'ABIERTA', creditos: 4, activo: true },
        { id: 212, tipo: TipoPlanAsignatura.OPTATIVA, tipoOptativa: 'ABIERTA', creditos: 4, activo: true },
      ]);
      reglaOptativaRepo.findOne.mockResolvedValue({ cantidadDisciplinarias: 0, cantidadAbiertas: 2, cantidadSede: 0 });
      mockQueryBuilder.getMany.mockResolvedValueOnce([{ id: 101, cedula: 'QA', nombres: 'Ana', apellido1: 'Rojas',
        estado: EstadoEstudiante.ACTIVO, planEstudioId: 1, carreraId: 10 }]);
      historialRepo.find.mockResolvedValueOnce([900, 901].map((id) => ({
        id, estudianteId: 101, planAsignaturaId: 111, planEstudioContextoId: 1,
        cursoOptativoId: 77, tipoOptativaReal: 'ABIERTA', resultado: ResultadoAcademico.APROBADO,
        reconocimientoOptativo: 'RECONOCIDO',
        planAsignatura: { id: 111, planEstudioId: 1, tipo: TipoPlanAsignatura.OPTATIVA },
      })));

      const resultado = await service.simularTransicion(1, { carreraId: 10, planOrigenId: 1, planDestinoId: 2 });
      expect(resultado.estudiantes[0].asignaturasReconocidas).toHaveLength(1);
      expect(resultado.estudiantes[0].asignaturasReconocidas[0].creditos).toBe(4);
      expect(resultado.estudiantes[0].observacionesAcademicas?.join(' ')).toContain('no se duplican créditos');
    });

    it('conserva la optativa aprobada solo en historial cuando la categoria destino no tiene cupo', async () => {
      planAsignaturaRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([
        { id: 211, tipo: TipoPlanAsignatura.OPTATIVA, tipoOptativa: 'DISCIPLINARIA', creditos: 4, activo: true },
      ]);
      reglaOptativaRepo.findOne.mockResolvedValue({ cantidadDisciplinarias: 1, cantidadAbiertas: 0, cantidadSede: 0 });
      mockQueryBuilder.getMany.mockResolvedValueOnce([{ id: 101, cedula: 'QA', nombres: 'Ana', apellido1: 'Rojas',
        estado: EstadoEstudiante.ACTIVO, planEstudioId: 1, carreraId: 10 }]);
      historialRepo.find.mockResolvedValueOnce([{
        id: 900, estudianteId: 101, planAsignaturaId: 111, planEstudioContextoId: 1,
        cursoOptativoId: 77, tipoOptativaReal: 'ABIERTA', resultado: ResultadoAcademico.APROBADO,
        reconocimientoOptativo: 'RECONOCIDO',
        planAsignatura: { id: 111, planEstudioId: 1, tipo: TipoPlanAsignatura.OPTATIVA },
      }]);

      const resultado = await service.simularTransicion(1, { carreraId: 10, planOrigenId: 1, planDestinoId: 2 });
      expect(resultado.estudiantes[0].puedeMigrar).toBe(true);
      expect(resultado.estudiantes[0].asignaturasReconocidas).toHaveLength(0);
      expect(resultado.estudiantes[0].asignaturasSinEquivalencia).toHaveLength(1);
      expect(resultado.estudiantes[0].observacionesAcademicas?.join(' ')).toContain('sin espacio disponible');
    });

    it('rechaza una seleccion vacia para no simular inadvertidamente a toda la poblacion', async () => {
      await expect(service.simularTransicion(1, {
        carreraId: 10, planOrigenId: 1, planDestinoId: 2, estudianteIds: [],
      })).rejects.toThrow(BadRequestException);
      expect(estudianteRepo.find).not.toHaveBeenCalled();
      expect(estudianteRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('marca pendiente la optativa real aprobada sin decidir su reconocimiento en el destino', async () => {
      mockQueryBuilder.getMany.mockResolvedValueOnce([{
        id: 101, cedula: 'QA', nombres: 'Prueba', apellido1: 'Optativa',
        estado: EstadoEstudiante.ACTIVO, planEstudioId: 1, carreraId: 10,
      }]);
      historialRepo.find.mockResolvedValueOnce([{
        estudianteId: 101, planAsignaturaId: 111, cursoOptativoId: 77,
        resultado: ResultadoAcademico.APROBADO, reconocimientoOptativo: 'RECONOCIDO',
        planAsignatura: { id: 111, tipo: TipoPlanAsignatura.OPTATIVA, creditos: 3 },
      }]);

      const resultado = await service.simularTransicion(1, {
        carreraId: 10, planOrigenId: 1, planDestinoId: 2,
      });

      expect(resultado.estudiantes[0].puedeMigrar).toBe(false);
      expect(resultado.estudiantes[0].conflictos).toContain(
        'Las optativas reales aprobadas requieren una decisión de reconocimiento en el plan de destino.',
      );
      expect(resultado.estudiantes[0].asignaturasReconocidas).toHaveLength(0);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('restringe estudiantes seleccionados a la carrera y plan de origen', async () => {
      estudianteRepo.find.mockResolvedValue([]);

      await service.simularTransicion(1, {
        carreraId: 10,
        planOrigenId: 1,
        planDestinoId: 2,
        estudianteIds: [101, 202],
      });

      expect(estudianteRepo.find).toHaveBeenCalledWith({
        where: {
          id: expect.anything(),
          carreraId: 10,
          planEstudioId: 1,
        },
      });
      expect(estudianteRepo.find.mock.calls[0][0].where.id.value).toEqual([101, 202]);
    });

    it('simula transición identificando equivalencias y asignaturas sin equivalencia', async () => {
      planAsignaturaRepo.find
        .mockResolvedValueOnce([
          { id: 101, cursoId: 40, creditos: 4, curso: { codigo: 'MAT100', nombre: 'Intro Mate' } },
        ])
        .mockResolvedValueOnce([
          { id: 201, cursoId: 50, creditos: 4, curso: { codigo: 'MAT101', nombre: 'Cálculo I' } },
        ]);

      mockQueryBuilder.getMany.mockResolvedValueOnce([
        {
          id: 101,
          cedula: '111111111',
          nombres: 'Carlos',
          apellido1: 'Pérez',
          apellido2: null,
          estado: EstadoEstudiante.ACTIVO,
          planEstudioId: 1,
          carreraId: 10,
        },
      ]);

      historialRepo.find.mockResolvedValue([
        {
          estudianteId: 101,
          planAsignaturaId: 101,
          resultado: ResultadoAcademico.APROBADO,
          planAsignatura: { id: 101, cursoId: 40, creditos: 4, curso: { codigo: 'MAT100', nombre: 'Intro Mate' } },
        },
      ]);

      equivalenciaRepo.find.mockResolvedValue([
        {
          id: 1,
          carreraOrigenId: 10, carreraDestinoId: 10, autorizadoPorUsuarioId: 7,
          planOrigenId: 1,
          asignaturaOrigenId: 101,
          planDestinoId: 2,
          asignaturaDestinoId: 201,
          activo: true,
          asignaturaDestino: { id: 201, cursoId: 50, creditos: 4, curso: { codigo: 'MAT101', nombre: 'Cálculo I' } },
        },
      ]);

      const simulacion = await service.simularTransicion(1, {
        carreraId: 10,
        planOrigenId: 1,
        planDestinoId: 2,
      });

      expect(simulacion.totalAnalizados).toBe(1);
      expect(simulacion.totalMigrables).toBe(1);
      expect(simulacion.totalConflictos).toBe(0);
      expect(simulacion.estudiantes[0].asignaturasReconocidas).toHaveLength(1);
      expect(simulacion.estudiantes[0].asignaturasReconocidas[0].codigo).toBe('MAT101');
    });

    it('no bloquea la migración ante equivalencia N a 1 incompleta, conserva la materia en historial y la destino queda pendiente', async () => {
      planAsignaturaRepo.find
        .mockResolvedValueOnce([
          { id: 101, cursoId: 41, creditos: 3, curso: { codigo: 'P1', nombre: 'Progra 1' } },
          { id: 102, cursoId: 42, creditos: 3, curso: { codigo: 'P2', nombre: 'Progra 2' } },
        ])
        .mockResolvedValueOnce([
          { id: 201, cursoId: 50, creditos: 4, curso: { codigo: 'PROG_AV', nombre: 'Progra Avanzada' } },
        ]);

      mockQueryBuilder.getMany.mockResolvedValueOnce([
        {
          id: 102,
          cedula: '222222222',
          nombres: 'Ana',
          apellido1: 'Rojas',
          estado: EstadoEstudiante.ACTIVO,
          planEstudioId: 1,
          carreraId: 10,
        },
      ]);

      historialRepo.find.mockResolvedValue([
        {
          estudianteId: 102,
          planAsignaturaId: 101,
          resultado: ResultadoAcademico.APROBADO,
          planAsignatura: { id: 101, cursoId: 41, creditos: 3, curso: { codigo: 'P1', nombre: 'Progra 1' } },
        },
      ]);

      equivalenciaRepo.find.mockResolvedValue([
        {
          id: 5,
          carreraOrigenId: 10, carreraDestinoId: 10, autorizadoPorUsuarioId: 7,
          planOrigenId: 1,
          asignaturaOrigenId: 101,
          planDestinoId: 2,
          asignaturaDestinoId: 201,
          activo: true,
          justificacion: '[COMPUESTA_N1:GRP1:1:2:[101,102]] Fusión de asignaturas',
          asignaturaDestino: { id: 201, cursoId: 50, creditos: 4, curso: { codigo: 'PROG_AV', nombre: 'Progra Avanzada' } },
        },
        {
          id: 6, carreraOrigenId: 10, carreraDestinoId: 10, autorizadoPorUsuarioId: 7,
          planOrigenId: 1, asignaturaOrigenId: 102,
          planDestinoId: 2, asignaturaDestinoId: 201, activo: true,
          justificacion: '[COMPUESTA_N1:GRP1:2:2:[101,102]] Fusión de asignaturas',
        },
      ]);

      const simulacion = await service.simularTransicion(1, {
        carreraId: 10,
        planOrigenId: 1,
        planDestinoId: 2,
      });

      expect(simulacion.totalConflictos).toBe(0);
      expect(simulacion.totalMigrables).toBe(1);
      expect(simulacion.estudiantes[0].puedeMigrar).toBe(true);
      expect(simulacion.estudiantes[0].conflictos).toHaveLength(0);
      expect(simulacion.estudiantes[0].observacionesAcademicas?.[0]).toContain('incompleta');
      expect(simulacion.estudiantes[0].asignaturasSinEquivalencia).toHaveLength(1);
      expect(simulacion.estudiantes[0].asignaturasReconocidas).toHaveLength(0);
    });
  });

  it('no reconoce N:1 si falta una rama oficial aunque todas las materias estén aprobadas', async () => {
    planAsignaturaRepo.find
      .mockResolvedValueOnce([{ id: 101, creditos: 3 }, { id: 102, creditos: 4 }])
      .mockResolvedValueOnce([{ id: 201, creditos: 5, curso: { codigo: 'DEST', nombre: 'Destino' } }]);
    mockQueryBuilder.getMany.mockResolvedValueOnce([{
      id: 10, cedula: '10', nombres: 'Ana', apellido1: 'Mora',
      estado: EstadoEstudiante.ACTIVO, planEstudioId: 1, carreraId: 10,
    }]);
    historialRepo.find.mockResolvedValue([
      { estudianteId: 10, planAsignaturaId: 101, resultado: ResultadoAcademico.APROBADO },
      { estudianteId: 10, planAsignaturaId: 102, resultado: ResultadoAcademico.APROBADO },
    ]);
    equivalenciaRepo.find.mockResolvedValue([{
      id: 1, carreraOrigenId: 10, carreraDestinoId: 10, autorizadoPorUsuarioId: 7,
      planOrigenId: 1, asignaturaOrigenId: 101, planDestinoId: 2,
      asignaturaDestinoId: 201, activo: true,
      justificacion: '[COMPUESTA_N1:GRP:1:2:[101,102]] Aprobada',
    }]);

    const resultado = await service.simularTransicion(1, {
      carreraId: 10, planOrigenId: 1, planDestinoId: 2,
    });
    expect(resultado.estudiantes[0].asignaturasReconocidas).toHaveLength(0);
    expect(resultado.estudiantes[0].puedeMigrar).toBe(false);
    expect(resultado.estudiantes[0].conflictos.join(' ')).toContain('incompleta');
  });

  describe('ejecutarTransicion', () => {
    it.each(['historial', 'auditoria'])('revierte la transicion si falla %s', async (paso) => {
      const expediente = { id: 101, carreraId: 10, planEstudioId: 1, estado: EstadoEstudiante.ACTIVO, periodoIngresoId: 1 };
      estudianteRepo.find.mockResolvedValue([expediente]);
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const copia = { ...expediente };
        const manager = crearManagerPrueba({ query: jest.fn((sql: string) => {
          if (sql.includes('SELECT r.nombre')) return Promise.resolve([{ nombre: RolSistema.COORDINADOR }]);
          if (sql.includes('SELECT id FROM permisos_carrera')) return Promise.resolve([{ id: 1 }]);
          return sql.includes(paso === 'historial' ? 'historial_planes_estudiantes' : 'auditoria_planes_estudio')
            ? Promise.reject(new Error('fallo de escritura')) : Promise.resolve([]);
        }) });
        const repoOriginal = manager.getRepository;
        manager.getRepository = jest.fn((entity: any) => entity.name === 'Estudiante'
          ? { find: jest.fn().mockResolvedValue([copia]), findOne: jest.fn().mockResolvedValue(copia), save: jest.fn().mockResolvedValue(copia) }
          : repoOriginal(entity));
        const resultado = await cb(manager);
        Object.assign(expediente, copia);
        return resultado;
      });
      const res = await ejecutarComoCoordinador(() => service.ejecutarTransicion(1, { carreraId: 10, planOrigenId: 1,
        planDestinoId: 2, estudianteIds: [101], motivo: 'Cambio curricular oficial' }));
      expect(res.migrados).toBe(0);
      expect(res.fallidos).toEqual([{ estudianteId: 101, error: 'fallo de escritura' }]);
      expect(expediente.planEstudioId).toBe(1);
    });

    it('revalida el plan bajo bloqueo si otro proceso lo cambio tras la simulacion', async () => {
      estudianteRepo.findOne.mockResolvedValue({ id: 101, carreraId: 10, planEstudioId: 3, estado: EstadoEstudiante.ACTIVO });
      const res = await ejecutarComoCoordinador(() => service.ejecutarTransicion(1, { carreraId: 10, planOrigenId: 1,
        planDestinoId: 2, estudianteIds: [101], motivo: 'Cambio curricular oficial' }));
      expect(res.migrados).toBe(0);
      expect(estudianteRepo.save).not.toHaveBeenCalled();
    });

    it('ejecuta la transición de forma atómica para los estudiantes seleccionados', async () => {
      planAsignaturaRepo.find
        .mockResolvedValueOnce([
          { id: 101, cursoId: 40, creditos: 4, curso: { codigo: 'MAT100', nombre: 'Intro Mate' } },
        ])
        .mockResolvedValueOnce([
          { id: 201, cursoId: 50, creditos: 4, curso: { codigo: 'MAT101', nombre: 'Cálculo I' } },
        ]);

      estudianteRepo.find.mockResolvedValue([
        {
          id: 101,
          cedula: '111111111',
          nombres: 'Carlos',
          apellido1: 'Pérez',
          estado: EstadoEstudiante.ACTIVO,
          planEstudioId: 1,
          carreraId: 10,
        },
      ]);

      mockQueryBuilder.getMany.mockResolvedValue([
        {
          id: 101,
          cedula: '111111111',
          nombres: 'Carlos',
          apellido1: 'Pérez',
          estado: EstadoEstudiante.ACTIVO,
          planEstudioId: 1,
          carreraId: 10,
        },
      ]);

      estudianteRepo.findOne.mockResolvedValue({
        id: 101,
        cedula: '111111111',
        nombres: 'Carlos',
        apellido1: 'Pérez',
        estado: EstadoEstudiante.ACTIVO,
        planEstudioId: 1,
        carreraId: 10,
      });

      historialRepo.find.mockResolvedValue([
        {
          estudianteId: 101,
          planAsignaturaId: 101,
          resultado: ResultadoAcademico.APROBADO,
          planAsignatura: { id: 101, cursoId: 40, creditos: 4, curso: { codigo: 'MAT100', nombre: 'Intro Mate' } },
        },
      ]);

      equivalenciaRepo.find.mockResolvedValue([
        {
          id: 1,
          carreraOrigenId: 10, carreraDestinoId: 10, autorizadoPorUsuarioId: 7,
          planOrigenId: 1,
          asignaturaOrigenId: 101,
          planDestinoId: 2,
          asignaturaDestinoId: 201,
          activo: true,
          asignaturaDestino: { id: 201, cursoId: 50, creditos: 4, curso: { codigo: 'MAT101', nombre: 'Cálculo I' } },
        },
      ]);

      historialRepo.findOne.mockResolvedValue(null);

      const res = await ejecutarComoCoordinador(() => service.ejecutarTransicion(1, {
        carreraId: 10,
        planOrigenId: 1,
        planDestinoId: 2,
        estudianteIds: [101],
        motivo: 'Migración oficial al nuevo plan de estudios 2026',
      }));

      expect(res.solicitados).toBe(1);
      expect(res.migrados).toBe(1);
      expect(res.fallidos).toHaveLength(0);
    });

    it('rechaza ejecución si un asistente intenta ejecutar sin propuesta', async () => {
      alcance.tipoCuentaJerarquica.mockResolvedValue('ASISTENTE_ESTUDIANTIL');
      await new Promise<void>((resolve, reject) => iniciarContextoRolActivo({} as any, {} as any, () => {
        establecerRolActivo(1, RolSistema.ASISTENTE_ESTUDIANTIL);
        expect(service.ejecutarTransicion(1, {
          carreraId: 10,
          planOrigenId: 1,
          planDestinoId: 2,
          estudianteIds: [101],
          motivo: 'Migración no autorizada directa',
        })).rejects.toThrow(ForbiddenException).then(resolve, reject);
      }));
    });

    it('escenario PO 47/3: migra 47 expedientes válidos y conserva intactos los 3 conflictivos con causa individual', async () => {
      // 50 estudiantes en total
      const ids50 = Array.from({ length: 50 }, (_, i) => i + 1);

      planAsignaturaRepo.find.mockImplementation(({ where }: any) => Promise.resolve(
        where.planEstudioId === 1
          ? [
            { id: 101, planEstudioId: 1, cursoId: 40, creditos: 4, curso: { codigo: 'MAT100', nombre: 'Intro Mate' } },
            { id: 102, planEstudioId: 1, cursoId: 41, creditos: 4, curso: { codigo: 'MAT101', nombre: 'Álgebra I' } },
          ]
          : [{ id: 201, planEstudioId: 2, cursoId: 50, creditos: 8, curso: { codigo: 'MAT200', nombre: 'Matemática Integrada' } }],
      ));

      // Mapeo de estudiantes con 3 conflictos reales (no requisitos académicos pendientes):
      // - Estudiante 48: pertenencia incorrecta al plan de origen (plan 99 != 1)
      // - Estudiante 49: estado RETIRADO no migrable sin trámite de reingreso formal
      // - Estudiante 50: incompatibilidad de carrera (carrera 999 != 10)
      const listaEstudiantes = ids50.map((id) => ({
        id,
        cedula: `CED-${id}`,
        nombres: `Estudiante ${id}`,
        apellido1: 'Prueba',
        estado: id === 49 ? EstadoEstudiante.RETIRADO : EstadoEstudiante.ACTIVO,
        planEstudioId: id === 48 ? 99 : 1,
        carreraId: id === 50 ? 999 : 10,
      }));

      estudianteRepo.find.mockResolvedValue(listaEstudiantes);
      mockQueryBuilder.getMany.mockResolvedValue(listaEstudiantes);

      // findOne para cada estudiante individual durante la transacción
      estudianteRepo.findOne.mockImplementation(({ where }: any) => {
        const est = listaEstudiantes.find((e) => e.id === where.id);
        return Promise.resolve(est ? { ...est } : null);
      });

      // Historiales:
      // - Estudiantes 1 a 46: aprobaron 101 y 102 (ambas requeridas para convalidar 201) -> Válidos
      // - Estudiante 47: aprobó solo 101 (equivalencia N:1 incompleta -> requisito académico pendiente, NO conflicto bloqueante) -> Válido
      // - Estudiantes 48, 49, 50: presentan conflictos reales institucionales
      historialRepo.find.mockImplementation(({ where }: any) => {
        const estId = where.estudianteId;
        if (estId >= 1 && estId <= 46) {
          return Promise.resolve([
            { estudianteId: estId, planAsignaturaId: 101, resultado: ResultadoAcademico.APROBADO },
            { estudianteId: estId, planAsignaturaId: 102, resultado: ResultadoAcademico.APROBADO },
          ]);
        }
        if (estId === 47) {
          // Incompleta: solo tiene 101 aprobada. Debe migrar exitosamente con 201 pendiente y 101 en historial.
          return Promise.resolve([
            { estudianteId: 47, planAsignaturaId: 101, resultado: ResultadoAcademico.APROBADO },
          ]);
        }
        return Promise.resolve([]);
      });

      // Equivalencia compuesta N:1 (101 + 102 equivalen a 201)
      equivalenciaRepo.find.mockResolvedValue([
        {
          id: 1,
          carreraOrigenId: 10, carreraDestinoId: 10, autorizadoPorUsuarioId: 7,
          planOrigenId: 1,
          asignaturaOrigenId: 101,
          planDestinoId: 2,
          asignaturaDestinoId: 201,
          activo: true,
          justificacion: '[COMPUESTA_N1:GRP_MATE:1:2:[101,102]] Fusión',
          asignaturaDestino: { id: 201, cursoId: 50, creditos: 8, curso: { codigo: 'MAT200', nombre: 'Matemática Integrada' } },
        },
        {
          id: 2,
          carreraOrigenId: 10, carreraDestinoId: 10, autorizadoPorUsuarioId: 7,
          planOrigenId: 1,
          asignaturaOrigenId: 102,
          planDestinoId: 2,
          asignaturaDestinoId: 201,
          activo: true,
          justificacion: '[COMPUESTA_N1:GRP_MATE:2:2:[101,102]] Fusión',
          asignaturaDestino: { id: 201, cursoId: 50, creditos: 8, curso: { codigo: 'MAT200', nombre: 'Matemática Integrada' } },
        },
      ]);

      historialRepo.findOne.mockResolvedValue(null);

      const resultado = await ejecutarComoCoordinador(() => service.ejecutarTransicion(1, {
        carreraId: 10,
        planOrigenId: 1,
        planDestinoId: 2,
        estudianteIds: ids50,
        motivo: 'Transición institucional masiva cohorte 2026',
      }));

      // Verificaciones estrictas
      expect(resultado.solicitados).toBe(50);
      expect(resultado.migrados).toBe(47);
      expect(resultado.fallidos).toHaveLength(3);

      const fallidosIds = resultado.fallidos.map((f) => f.estudianteId);
      expect(fallidosIds).toContain(48);
      expect(fallidosIds).toContain(49);
      expect(fallidosIds).toContain(50);

      // Causa individual del conflicto real registrada
      const err48 = resultado.fallidos.find((f) => f.estudianteId === 48);
      expect(err48?.error).toContain('no pertenece al plan de origen');

      const err49 = resultado.fallidos.find((f) => f.estudianteId === 49);
      expect(err49?.error).toContain('RETIRADO');

      const err50 = resultado.fallidos.find((f) => f.estudianteId === 50);
      expect(err50?.error).toContain('Incompatibilidad de carrera');

      // Los 3 expedientes con conflicto real permanecieron en su estado y plan original intactos
      expect(listaEstudiantes.find((e) => e.id === 48)?.planEstudioId).toBe(99);
      expect(listaEstudiantes.find((e) => e.id === 49)?.planEstudioId).toBe(1);
      expect(listaEstudiantes.find((e) => e.id === 50)?.planEstudioId).toBe(1);
    });
  });
});
