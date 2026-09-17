import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { TipoRequisito } from '../planes-estudio/constants/tipo-requisito.constant';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { PlanRequisito } from '../planes-estudio/entities/plan-requisito.entity';
import { EstadoEstudiante } from './constants/estado-estudiante.constant';
import { OrigenAcademico } from './constants/origen-academico.constant';
import { ResultadoAcademico } from './constants/resultado-academico.constant';
import { Estudiante } from './entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from './entities/historial-academico-estudiante.entity';
import { HistorialPlanEstudiante } from './entities/historial-plan-estudiante.entity';
import { EstudiantesService } from './estudiantes.service';

describe('EstudiantesService', () => {
  const repo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((datos) => datos),
    save: jest.fn(async (datos) => datos),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  });
  let estudiantes: ReturnType<typeof repo>;
  let historialAcademico: ReturnType<typeof repo>;
  let historialPlanes: ReturnType<typeof repo>;
  let carreras: ReturnType<typeof repo>;
  let planes: ReturnType<typeof repo>;
  let asignaturas: ReturnType<typeof repo>;
  let requisitos: ReturnType<typeof repo>;
  let periodos: ReturnType<typeof repo>;
  let alcance: {
    tieneAlcanceSobreCarrera: jest.Mock;
    obtenerCarreraIdsConAlcance: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let service: EstudiantesService;

  const periodoIngreso = { id: 1, anio: 2025, ciclo: 1 } as PeriodoAcademico;
  const estudiante = {
    id: 7,
    cedula: '001-002',
    nombres: 'Ana',
    apellido1: 'Mora',
    apellido2: null,
    correoInstitucional: 'ana@una.cr',
    telefono: null,
    carreraId: 1,
    planEstudioId: 10,
    periodoIngresoId: 1,
    estado: EstadoEstudiante.ACTIVO,
    periodoIngreso,
  } as Estudiante;

  beforeEach(() => {
    estudiante.planEstudioId = 10;
    estudiantes = repo();
    historialAcademico = repo();
    historialPlanes = repo();
    carreras = repo();
    planes = repo();
    asignaturas = repo();
    requisitos = repo();
    periodos = repo();
    alcance = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
      obtenerCarreraIdsConAlcance: jest.fn().mockResolvedValue([1]),
    };
    dataSource = {
      transaction: jest.fn(async (callback) =>
        callback({
          getRepository: (entidad: unknown) =>
            entidad === Estudiante ? estudiantes : historialPlanes,
        }),
      ),
    };
    service = new EstudiantesService(
      estudiantes as unknown as Repository<Estudiante>,
      historialAcademico as unknown as Repository<HistorialAcademicoEstudiante>,
      historialPlanes as unknown as Repository<HistorialPlanEstudiante>,
      carreras as unknown as Repository<Carrera>,
      planes as unknown as Repository<PlanEstudio>,
      asignaturas as unknown as Repository<PlanAsignatura>,
      requisitos as unknown as Repository<PlanRequisito>,
      periodos as unknown as Repository<PeriodoAcademico>,
      alcance as unknown as EstructuraAcademicaService,
      dataSource as unknown as DataSource,
    );
  });

  it('crea y normaliza un estudiante válido', async () => {
    carreras.findOne.mockResolvedValue({ id: 1, activo: true });
    planes.findOne.mockResolvedValue({ id: 10, carreraId: 1, activo: true });
    periodos.findOne.mockResolvedValue(periodoIngreso);
    estudiantes.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(estudiante);
    estudiantes.save.mockResolvedValue(estudiante);

    await service.crear(3, {
      cedula: ' 001-002 ',
      nombres: ' Ana ',
      apellido1: ' Mora ',
      apellido2: ' ',
      correoInstitucional: ' ANA@UNA.CR ',
      telefono: ' ',
      carreraId: 1,
      planEstudioId: 10,
      periodoIngresoId: 1,
    });

    expect(estudiantes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cedula: '001-002',
        nombres: 'Ana',
        correoInstitucional: 'ana@una.cr',
        apellido2: null,
        telefono: null,
      }),
    );
  });

  it('rechaza duplicados y un plan de otra carrera', async () => {
    carreras.findOne.mockResolvedValue({ id: 1, activo: true });
    planes.findOne.mockResolvedValue({ id: 10, carreraId: 2, activo: true });
    periodos.findOne.mockResolvedValue(periodoIngreso);
    await expect(
      service.crear(3, {
        cedula: '1',
        nombres: 'Ana',
        apellido1: 'Mora',
        correoInstitucional: 'ana@una.cr',
        carreraId: 1,
        planEstudioId: 10,
        periodoIngresoId: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    planes.findOne.mockResolvedValue({ id: 10, carreraId: 1, activo: true });
    estudiantes.findOne.mockResolvedValue({ id: 99 });
    await expect(
      service.crear(3, {
        cedula: '1',
        nombres: 'Ana',
        apellido1: 'Mora',
        correoInstitucional: 'ana@una.cr',
        carreraId: 1,
        planEstudioId: 10,
        periodoIngresoId: 1,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('aplica alcance por carrera', async () => {
    estudiantes.findOne.mockResolvedValue(estudiante);
    alcance.tieneAlcanceSobreCarrera.mockResolvedValue(false);
    await expect(service.obtenerPorId(3, 7)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rechaza campos requeridos compuestos únicamente por espacios', async () => {
    await expect(
      service.crear(3, {
        cedula: '   ',
        nombres: 'Ana',
        apellido1: 'Mora',
        correoInstitucional: 'ana@una.cr',
        carreraId: 1,
        planEstudioId: 10,
        periodoIngresoId: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    estudiantes.findOne.mockResolvedValue(estudiante);
    await expect(service.actualizar(3, 7, { nombres: '    ' })).rejects.toThrow(
      'Los nombres no puede quedar vacío.',
    );
    expect(estudiantes.save).not.toHaveBeenCalled();
  });

  it('devuelve responsables sin campos sensibles en ambos historiales', async () => {
    estudiantes.findOne.mockResolvedValue(estudiante);
    const usuario = {
      id: 3,
      nombres: 'Gerald',
      apellido1: 'Mora',
      apellido2: null,
      correo: 'gerald@una.cr',
      passwordHash: 'secreto',
      passwordResetTokenHash: 'token',
      passwordResetExpiresAt: new Date(),
    };
    historialAcademico.find.mockResolvedValue([
      {
        id: 1,
        estudianteId: 7,
        planAsignaturaId: 20,
        periodoId: null,
        periodo: null,
        registradoPorUsuarioId: 3,
        registradoPor: usuario,
      },
    ]);
    historialPlanes.find.mockResolvedValue([
      {
        id: 2,
        estudianteId: 7,
        planAnteriorId: 10,
        planNuevoId: 11,
        periodoCambioId: 1,
        cambiadoPorUsuarioId: 3,
        cambiadoPor: usuario,
      },
    ]);

    const academico = await service.listarHistorialAcademico(3, 7);
    const planesResultado = await service.listarHistorialPlanes(3, 7);
    const respuesta = JSON.stringify({ academico, planesResultado });

    expect(respuesta).not.toContain('passwordHash');
    expect(respuesta).not.toContain('passwordResetTokenHash');
    expect(academico[0].periodoId).toBeNull();
    expect(academico[0].periodo).toBeNull();
    expect(academico[0].registradoPor).toEqual({
      id: 3,
      nombres: 'Gerald',
      apellido1: 'Mora',
      apellido2: null,
      correo: 'gerald@una.cr',
    });
  });

  it('conserva intentos académicos independientes', async () => {
    estudiantes.findOne.mockResolvedValue(estudiante);
    asignaturas.findOne.mockResolvedValue({ id: 20, planEstudioId: 10 });
    periodos.findOne.mockResolvedValue(periodoIngreso);

    await service.registrarResultado(3, 7, {
      planAsignaturaId: 20,
      periodoId: 1,
      resultado: ResultadoAcademico.REPROBADO,
      origenAcademico: OrigenAcademico.CURSADO,
    });
    await service.registrarResultado(3, 7, {
      planAsignaturaId: 20,
      periodoId: 1,
      resultado: ResultadoAcademico.APROBADO,
      origenAcademico: OrigenAcademico.CURSADO,
    });

    expect(historialAcademico.save).toHaveBeenCalledTimes(2);
    expect(historialAcademico.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ fuenteRegistro: 'MANUAL' }),
    );
  });

  it('rechaza un resultado académico anterior al período de ingreso', async () => {
    estudiantes.findOne.mockResolvedValue(estudiante);
    asignaturas.findOne.mockResolvedValue({ id: 20, planEstudioId: 10 });
    periodos.findOne.mockResolvedValue({ id: 9, anio: 2024, ciclo: 2 });

    await expect(
      service.registrarResultado(3, 7, {
        planAsignaturaId: 20,
        periodoId: 9,
        resultado: ResultadoAcademico.APROBADO,
        origenAcademico: OrigenAcademico.CURSADO,
      }),
    ).rejects.toThrow(
      'El período del resultado académico no puede ser anterior al período de ingreso.',
    );
    expect(historialAcademico.save).not.toHaveBeenCalled();
  });

  it('calcula aprobadas, requisitos, correquisitos y rezago', async () => {
    estudiantes.findOne.mockResolvedValue(estudiante);
    periodos.findOne.mockResolvedValue({ id: 4, anio: 2026, ciclo: 2 });
    const materia = (
      id: number,
      nivel: number,
      ciclo: number,
      codigo: string,
    ) =>
      ({
        id,
        planEstudioId: 10,
        activo: true,
        nivel,
        ciclo,
        orden: id,
        creditos: 4,
        codigoReferencia: codigo,
        nombreReferencia: codigo,
        cursoId: null,
        curso: null,
      }) as PlanAsignatura;
    const a = materia(1, 1, 1, 'A');
    const b = materia(2, 1, 2, 'B');
    const c = materia(3, 2, 2, 'C');
    asignaturas.find.mockResolvedValue([a, b, c]);
    historialAcademico.find.mockResolvedValue([
      { planAsignaturaId: 1, resultado: ResultadoAcademico.REPROBADO },
      { planAsignaturaId: 1, resultado: ResultadoAcademico.APROBADO },
      { planAsignaturaId: 2, resultado: ResultadoAcademico.REPROBADO },
    ]);
    requisitos.find.mockResolvedValue([
      {
        asignaturaId: 2,
        requisitoAsignaturaId: 1,
        tipo: TipoRequisito.REQUISITO,
        requisitoAsignatura: a,
      },
      {
        asignaturaId: 3,
        requisitoAsignaturaId: 2,
        tipo: TipoRequisito.CORREQUISITO,
        requisitoAsignatura: b,
      },
    ]);

    const progreso = await service.obtenerProgreso(3, 7, 4);

    expect(progreso.resumen).toEqual({
      totalPlan: 3,
      aprobadas: 1,
      pendientes: 2,
      rezagadas: 1,
    });
    expect(progreso.reprobadas).toHaveLength(1);
    expect(progreso.habilitadas[0]).toMatchObject({
      planAsignaturaId: 2,
      habilitada: true,
    });
    expect(progreso.habilitadas[1]).toMatchObject({
      planAsignaturaId: 3,
      habilitada: true,
      correquisitos: [{ planAsignaturaId: 2, aprobado: false }],
    });
  });

  it('reconoce aprobaciones de planes anteriores por cursoId, pero no por referencias sin curso', async () => {
    estudiantes.findOne.mockResolvedValue(estudiante);
    periodos.findOne.mockResolvedValue({ id: 4, anio: 2026, ciclo: 1 });
    const actualConCurso = {
      id: 93,
      planEstudioId: 10,
      cursoId: 7,
      curso: { id: 7, codigo: 'EIF201', nombre: 'Programación II' },
      activo: true,
      nivel: 1,
      ciclo: 1,
      orden: 1,
      creditos: 4,
    } as PlanAsignatura;
    const actualSinCurso = {
      id: 94,
      planEstudioId: 10,
      cursoId: null,
      curso: null,
      codigoReferencia: 'EG-I',
      nombreReferencia: 'Estudios Generales I',
      activo: true,
      nivel: 1,
      ciclo: 1,
      orden: 2,
      creditos: 3,
    } as PlanAsignatura;
    asignaturas.find.mockResolvedValue([actualConCurso, actualSinCurso]);
    historialAcademico.find.mockResolvedValue([
      {
        planAsignaturaId: 18,
        resultado: ResultadoAcademico.REPROBADO,
        planAsignatura: { id: 18, cursoId: 7 },
      },
      {
        planAsignaturaId: 18,
        resultado: ResultadoAcademico.APROBADO,
        planAsignatura: { id: 18, cursoId: 7 },
      },
      {
        planAsignaturaId: 19,
        resultado: ResultadoAcademico.APROBADO,
        planAsignatura: { id: 19, cursoId: null },
      },
    ]);
    requisitos.find.mockResolvedValue([]);

    const progreso = await service.obtenerProgreso(3, 7, 4);

    expect(progreso.aprobadas).toEqual([
      expect.objectContaining({ planAsignaturaId: 93, codigo: 'EIF201' }),
    ]);
    expect(progreso.pendientes).toEqual([
      expect.objectContaining({ planAsignaturaId: 94, codigo: 'EG-I' }),
    ]);
    expect(progreso.reprobadas).toEqual([]);
  });

  it('rechaza progreso para un período anterior al ingreso y permite el período de ingreso', async () => {
    estudiantes.findOne.mockResolvedValue(estudiante);
    periodos.findOne.mockResolvedValueOnce({ id: 9, anio: 2024, ciclo: 2 });

    await expect(service.obtenerProgreso(3, 7, 9)).rejects.toThrow(
      'El período de referencia no puede ser anterior al período de ingreso.',
    );
    expect(asignaturas.find).not.toHaveBeenCalled();

    periodos.findOne.mockResolvedValueOnce(periodoIngreso);
    asignaturas.find.mockResolvedValue([]);
    historialAcademico.find.mockResolvedValue([]);
    await expect(service.obtenerProgreso(3, 7, 1)).resolves.toMatchObject({
      resumen: { totalPlan: 0, rezagadas: 0 },
    });
  });

  it('cambia el plan y su historial en una sola transacción', async () => {
    estudiantes.findOne.mockResolvedValue(estudiante);
    planes.findOne.mockResolvedValue({ id: 11, carreraId: 1, activo: true });
    periodos.findOne.mockResolvedValue({ id: 4 });

    await service.cambiarPlan(3, 7, { planNuevoId: 11, periodoCambioId: 4 });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(historialPlanes.save).toHaveBeenCalledWith(
      expect.objectContaining({ planAnteriorId: 10, planNuevoId: 11 }),
    );
    expect(estudiantes.update).toHaveBeenCalledWith(7, {
      planEstudioId: 11,
    });
  });

  it('rechaza un cambio de plan anterior al período de ingreso', async () => {
    estudiantes.findOne.mockResolvedValue(estudiante);
    planes.findOne.mockResolvedValue({ id: 11, carreraId: 1, activo: true });
    periodos.findOne.mockResolvedValue({ id: 9, anio: 2024, ciclo: 2 });

    await expect(
      service.cambiarPlan(3, 7, { planNuevoId: 11, periodoCambioId: 9 }),
    ).rejects.toThrow(
      'El período del cambio de plan no puede ser anterior al período de ingreso.',
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('propaga el error transaccional sin dejar una actualización posterior', async () => {
    estudiantes.findOne.mockResolvedValue(estudiante);
    planes.findOne.mockResolvedValue({ id: 11, carreraId: 1, activo: true });
    periodos.findOne.mockResolvedValue({ id: 4 });
    dataSource.transaction.mockRejectedValue(new Error('rollback'));

    await expect(
      service.cambiarPlan(3, 7, { planNuevoId: 11, periodoCambioId: 4 }),
    ).rejects.toThrow('rollback');
    expect(estudiantes.findOne).toHaveBeenCalledTimes(1);
  });

  describe('contarPorCarrera', () => {
    it('retorna conteos de estudiantes agrupados por carrera permitida', async () => {
      alcance.obtenerCarreraIdsConAlcance.mockResolvedValue([1, 2]);
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { carreraId: '1', total: '15' },
          { carreraId: '2', total: '30' },
        ]),
      };
      estudiantes.createQueryBuilder.mockReturnValue(mockQb);

      const resultado = await service.contarPorCarrera(3);

      expect(resultado).toEqual([
        { carreraId: 1, total: 15 },
        { carreraId: 2, total: 30 },
      ]);
      expect(mockQb.where).toHaveBeenCalledWith(
        'estudiante.carreraId IN (:...carreraIds)',
        { carreraIds: [1, 2] },
      );
    });

    it('retorna arreglo vacío si no hay carreras en alcance', async () => {
      alcance.obtenerCarreraIdsConAlcance.mockResolvedValue([]);

      const resultado = await service.contarPorCarrera(3);

      expect(resultado).toEqual([]);
      expect(estudiantes.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('contarPorPlan', () => {
    it('retorna conteos de estudiantes agrupados por plan para una carrera con alcance', async () => {
      alcance.tieneAlcanceSobreCarrera.mockResolvedValue(true);
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { planEstudioId: '10', total: '8' },
          { planEstudioId: '11', total: '12' },
        ]),
      };
      estudiantes.createQueryBuilder.mockReturnValue(mockQb);

      const resultado = await service.contarPorPlan(3, 1);

      expect(resultado).toEqual([
        { planEstudioId: 10, total: 8 },
        { planEstudioId: 11, total: 12 },
      ]);
      expect(mockQb.where).toHaveBeenCalledWith(
        'estudiante.carreraId = :carreraId',
        { carreraId: 1 },
      );
    });

    it('lanza ForbiddenException si el usuario no tiene alcance sobre la carrera', async () => {
      alcance.tieneAlcanceSobreCarrera.mockResolvedValue(false);

      await expect(service.contarPorPlan(3, 99)).rejects.toThrow(
        ForbiddenException,
      );
      expect(estudiantes.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
