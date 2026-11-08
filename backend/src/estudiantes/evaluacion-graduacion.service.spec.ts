import { EvaluacionGraduacionService } from './evaluacion-graduacion.service';
import { EstadoEstudiante } from './constants/estado-estudiante.constant';
import { DictamenGraduacion } from './constants/dictamen-graduacion.constant';
import { CondicionAcademica } from './constants/condicion-academica.constant';
import { TipoPlanAsignatura } from '../planes-estudio/constants/tipo-plan-asignatura.constant';
import { TipoOptativa } from '../optativas/constants/tipo-optativa.constant';
import { ResultadoAcademico } from './constants/resultado-academico.constant';
import { ConflictException } from '@nestjs/common';

describe('EvaluacionGraduacionService', () => {
  let service: EvaluacionGraduacionService;
  let estudianteRepo: any;
  let historialRepo: any;
  let planRepo: any;
  let planAsignaturaRepo: any;
  let planRequisitoRepo: any;
  let reglaOptativaRepo: any;
  let equivalenciaRepo: any;
  let estructuraAcademicaService: any;
  let alcanceJerarquico: any;
  let dataSource: any;

  beforeEach(() => {
    estudianteRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    historialRepo = {
      find: jest.fn(),
    };
    planRepo = {
      findOne: jest.fn(),
    };
    planAsignaturaRepo = {
      find: jest.fn(),
    };
    planRequisitoRepo = {
      find: jest.fn(),
    };
    reglaOptativaRepo = {
      findOne: jest.fn(),
    };
    equivalenciaRepo = {
      find: jest.fn(),
    };
    estructuraAcademicaService = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
    };
    alcanceJerarquico = {
      tipoCuentaJerarquica: jest.fn().mockResolvedValue('COORDINADOR'),
      puedeEjecutar: jest.fn().mockResolvedValue(true),
    };
    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb({
        getRepository: () => ({
          findOne: jest.fn().mockResolvedValue({ id: 1, estado: EstadoEstudiante.ACTIVO }),
          save: jest.fn().mockResolvedValue({ id: 1, estado: EstadoEstudiante.GRADUADO }),
        }),
      })),
    };

    service = new EvaluacionGraduacionService(
      estudianteRepo,
      historialRepo,
      planRepo,
      planAsignaturaRepo,
      planRequisitoRepo,
      reglaOptativaRepo,
      equivalenciaRepo,
      estructuraAcademicaService,
      dataSource,
      alcanceJerarquico,
    );
  });

  it('determina condición EGRESADO cuando cumple todas las asignaturas y créditos pero no está graduado', async () => {
    const estudianteMock = {
      id: 1,
      cedula: '11111111',
      nombres: 'Estudiante',
      apellido1: 'Egresado',
      apellido2: null,
      correoInstitucional: 'egresado@una.ac.cr',
      carreraId: 10,
      planEstudioId: 20,
      estado: EstadoEstudiante.ACTIVO,
    };
    estudianteRepo.findOne.mockResolvedValue(estudianteMock);

    planRepo.findOne.mockResolvedValue({
      id: 20,
      codigo: 'P20',
      nombre: 'Plan 20',
      activo: true,
      carrera: { id: 10, codigo: 'C10', nombre: 'Carrera 10' },
    });

    const obligatoriasMock = [
      { id: 101, cursoId: 501, tipo: TipoPlanAsignatura.OBLIGATORIA, creditos: 4, activo: true, curso: { codigo: 'MAT1' } },
      { id: 102, cursoId: 502, tipo: TipoPlanAsignatura.OBLIGATORIA, creditos: 4, activo: true, curso: { codigo: 'PROG1' } },
    ];
    const optativasMock = [
      { id: 103, cursoId: 503, tipo: TipoPlanAsignatura.OPTATIVA, tipoOptativa: TipoOptativa.DISCIPLINARIA, creditos: 3, activo: true, curso: { codigo: 'OPT-DISC' } },
    ];
    planAsignaturaRepo.find.mockResolvedValue([...obligatoriasMock, ...optativasMock]);
    planRequisitoRepo.find.mockResolvedValue([]);
    reglaOptativaRepo.findOne.mockResolvedValue({
      planEstudioId: 20,
      cantidadDisciplinarias: 1,
      cantidadAbiertas: 0,
      cantidadSede: 0,
    });

    historialRepo.find.mockResolvedValue([
      { planAsignaturaId: 101, planAsignatura: obligatoriasMock[0], resultado: ResultadoAcademico.APROBADO },
      { planAsignaturaId: 102, planAsignatura: obligatoriasMock[1], resultado: ResultadoAcademico.APROBADO },
      { planAsignaturaId: 103, planAsignatura: optativasMock[0], resultado: ResultadoAcademico.APROBADO },
    ]);

    const resultado = await service.evaluarGraduacion(1, 1);

    expect(resultado.dictamen).toBe(DictamenGraduacion.APTO);
    expect(resultado.condicionAcademica).toBe(CondicionAcademica.EGRESADO);
    expect(resultado.estudiante.estadoAdministrativo).toBe(EstadoEstudiante.ACTIVO);
    expect(resultado.motivosBloqueo).toHaveLength(0);
    expect(resultado.obligatorias.pendientesCount).toBe(0);
  });

  it('declara NO_APTO cuando falta una optativa exigida por la regla', async () => {
    estudianteRepo.findOne.mockResolvedValue({
      id: 2,
      carreraId: 10,
      planEstudioId: 20,
      estado: EstadoEstudiante.ACTIVO,
    });
    planRepo.findOne.mockResolvedValue({
      id: 20,
      carrera: { id: 10 },
    });
    const obligatoriasMock = [
      { id: 101, tipo: TipoPlanAsignatura.OBLIGATORIA, creditos: 4, activo: true },
    ];
    const optativasMock = [
      { id: 103, tipo: TipoPlanAsignatura.OPTATIVA, tipoOptativa: TipoOptativa.DISCIPLINARIA, creditos: 3, activo: true },
    ];
    planAsignaturaRepo.find.mockResolvedValue([...obligatoriasMock, ...optativasMock]);
    planRequisitoRepo.find.mockResolvedValue([]);
    reglaOptativaRepo.findOne.mockResolvedValue({
      planEstudioId: 20,
      cantidadDisciplinarias: 1,
      cantidadAbiertas: 0,
      cantidadSede: 0,
    });
    // Solo tiene aprobada la obligatoria, no la optativa
    historialRepo.find.mockResolvedValue([
      { planAsignaturaId: 101, planAsignatura: obligatoriasMock[0], resultado: ResultadoAcademico.APROBADO },
    ]);

    const resultado = await service.evaluarGraduacion(1, 2);

    expect(resultado.dictamen).toBe(DictamenGraduacion.NO_APTO);
    expect(resultado.condicionAcademica).toBe(CondicionAcademica.REGULAR);
    expect(resultado.motivosBloqueo.some((m) => m.includes('Optativas disciplinarias insuficientes'))).toBe(true);
  });

  it('no suma dos veces los créditos de una misma asignatura aprobada repetidamente', async () => {
    estudianteRepo.findOne.mockResolvedValue({
      id: 3,
      carreraId: 10,
      planEstudioId: 20,
      estado: EstadoEstudiante.ACTIVO,
    });
    planRepo.findOne.mockResolvedValue({
      id: 20,
      carrera: { id: 10 },
    });
    const asig = { id: 101, cursoId: 501, tipo: TipoPlanAsignatura.OBLIGATORIA, creditos: 4, activo: true };
    planAsignaturaRepo.find.mockResolvedValue([asig]);
    planRequisitoRepo.find.mockResolvedValue([]);
    reglaOptativaRepo.findOne.mockResolvedValue(null);

    // Mismo curso aprobado dos veces en diferentes períodos
    historialRepo.find.mockResolvedValue([
      { planAsignaturaId: 101, planAsignatura: asig, resultado: ResultadoAcademico.APROBADO },
      { planAsignaturaId: 101, planAsignatura: asig, resultado: ResultadoAcademico.APROBADO },
    ]);

    const resultado = await service.evaluarGraduacion(1, 3);
    expect(resultado.creditos.obligatoriosAprobados).toBe(4); // No 8
  });

  it('bloquea la confirmación de graduación si el estudiante no es APTO', async () => {
    estudianteRepo.findOne.mockResolvedValue({
      id: 4,
      carreraId: 10,
      planEstudioId: 20,
      estado: EstadoEstudiante.ACTIVO,
    });
    planRepo.findOne.mockResolvedValue({ id: 20, carrera: { id: 10 } });
    planAsignaturaRepo.find.mockResolvedValue([
      { id: 101, tipo: TipoPlanAsignatura.OBLIGATORIA, creditos: 4, activo: true },
    ]);
    planRequisitoRepo.find.mockResolvedValue([]);
    reglaOptativaRepo.findOne.mockResolvedValue(null);
    historialRepo.find.mockResolvedValue([]); // Ninguna aprobada

    await expect(service.confirmarGraduacion(1, 4, 'Intento')).rejects.toThrow(ConflictException);
  });

  it('evalúa correctamente la elegibilidad para una Salida Académica específica (salida lateral/diplomado)', async () => {
    const estudianteMock = {
      id: 5,
      cedula: '55555555',
      nombres: 'Estudiante',
      apellido1: 'SalidaLateral',
      apellido2: null,
      correoInstitucional: 'lateral@una.ac.cr',
      carreraId: 10,
      planEstudioId: 20,
      estado: EstadoEstudiante.ACTIVO,
    };
    estudianteRepo.findOne.mockResolvedValue(estudianteMock);
    planRepo.findOne.mockResolvedValue({
      id: 20,
      codigo: 'P20',
      nombre: 'Bachillerato y Licenciatura en Informática',
      activo: true,
      carrera: { id: 10, codigo: 'INF', nombre: 'Informática' },
    });

    const asig1 = { id: 201, cursoId: 601, tipo: TipoPlanAsignatura.OBLIGATORIA, creditos: 4, activo: true, curso: { codigo: 'EIF201' } };
    const asig2 = { id: 202, cursoId: 602, tipo: TipoPlanAsignatura.OBLIGATORIA, creditos: 4, activo: true, curso: { codigo: 'EIF202' } };
    const asigPlanCompleto = { id: 203, cursoId: 603, tipo: TipoPlanAsignatura.OBLIGATORIA, creditos: 4, activo: true, curso: { codigo: 'EIF401' } };

    planAsignaturaRepo.find.mockResolvedValue([asig1, asig2, asigPlanCompleto]);
    planRequisitoRepo.find.mockResolvedValue([]);

    const salidaMock = {
      id: 7,
      planEstudioId: 20,
      codigo: 'DIP-APP',
      nombre: 'Diplomado en Aplicaciones Informáticas',
      tipo: 'SALIDA_LATERAL',
      creditosRequeridos: 8,
      activo: true,
      asignaturas: [asig1, asig2],
    };

    dataSource.getRepository = jest.fn().mockImplementation((entity) => {
      return {
        findOne: jest.fn().mockResolvedValue(salidaMock),
      };
    });
    dataSource.query = jest.fn().mockResolvedValue([]);

    historialRepo.find.mockResolvedValue([
      { planAsignaturaId: 201, planAsignatura: asig1, resultado: ResultadoAcademico.APROBADO },
      { planAsignaturaId: 202, planAsignatura: asig2, resultado: ResultadoAcademico.APROBADO },
    ]);

    const resultado = await service.evaluarGraduacion(1, 5, 7);

    expect(resultado.dictamen).toBe(DictamenGraduacion.APTO);
    expect(resultado.condicionAcademica).toBe(CondicionAcademica.EGRESADO);
    expect(resultado.salidaAcademica).toBeDefined();
    expect(resultado.salidaAcademica?.codigo).toBe('DIP-APP');
    expect(resultado.obligatorias.pendientesCount).toBe(0);
    expect(resultado.cumpleTodosLosRequisitos).toBe(true);
  });

  it('impide la confirmación de graduación si las calificaciones cambiaron concurrentemente y dejan al estudiante sin requisitos', async () => {
    const estudianteMock = {
      id: 6,
      carreraId: 10,
      planEstudioId: 20,
      estado: EstadoEstudiante.ACTIVO,
      planEstudio: { id: 20, grado: 'BACHILLERATO', nombre: 'Bachillerato' },
    };
    estudianteRepo.findOne.mockResolvedValue(estudianteMock);
    planRepo.findOne.mockResolvedValue({ id: 20, carrera: { id: 10 } });

    const asig1 = { id: 301, cursoId: 701, tipo: TipoPlanAsignatura.OBLIGATORIA, creditos: 4, activo: true, curso: { codigo: 'MAT' } };
    planAsignaturaRepo.find.mockResolvedValue([asig1]);
    planRequisitoRepo.find.mockResolvedValue([]);
    reglaOptativaRepo.findOne.mockResolvedValue(null);

    // En la evaluación inicial aparece como aprobado
    historialRepo.find.mockResolvedValue([
      { planAsignaturaId: 301, planAsignatura: asig1, resultado: ResultadoAcademico.APROBADO },
    ]);

    // Dentro de la transacción, simular que otra transacción concurrente modificó las notas
    // y el historial actual bajo bloqueo ya no tiene aprobada la asignatura
    dataSource.transaction = jest.fn().mockImplementation(async (cb) => {
      return cb({
        getRepository: (entity: any) => ({
          findOne: jest.fn().mockResolvedValue({ ...estudianteMock }),
          find: jest.fn().mockResolvedValue([]), // Vacío: nota revocada concurrentemente
          save: jest.fn(),
        }),
        query: jest.fn().mockResolvedValue([]),
      });
    });

    await expect(service.confirmarGraduacion(1, 6, 'Aprobación concurrente')).rejects.toThrow(
      'Las calificaciones o requisitos académicos cambiaron concurrentemente durante la aprobación. Operación cancelada.',
    );
  });

  it('rechaza la confirmación si el usuario es un ASISTENTE_ESTUDIANTIL o no posee permisos sobre la carrera', async () => {
    estudianteRepo.findOne.mockResolvedValue({ id: 7, carreraId: 10, planEstudioId: 20 });

    // Asistente estudiantil rechazado
    alcanceJerarquico.tipoCuentaJerarquica.mockResolvedValue('ASISTENTE_ESTUDIANTIL');
    await expect(service.confirmarGraduacion(99, 7)).rejects.toThrow(
      'El asistente estudiantil no está autorizado para confirmar graduaciones.',
    );

    // Coordinador sin permiso sobre la carrera
    alcanceJerarquico.tipoCuentaJerarquica.mockResolvedValue('COORDINADOR');
    alcanceJerarquico.puedeEjecutar.mockResolvedValue(false);
    await expect(service.confirmarGraduacion(99, 7)).rejects.toThrow(
      'No posee permiso para confirmar graduaciones en esta carrera.',
    );
  });

  it('permite a un ADMIN_GLOBAL confirmar graduaciones sobre cualquier carrera', async () => {
    const estudianteMock = {
      id: 8,
      carreraId: 10,
      planEstudioId: 20,
      estado: EstadoEstudiante.ACTIVO,
      planEstudio: { id: 20, grado: 'BACHILLERATO', nombre: 'Bachillerato' },
    };
    estudianteRepo.findOne.mockResolvedValue(estudianteMock);
    planRepo.findOne.mockResolvedValue({ id: 20, carrera: { id: 10 } });

    const asig1 = { id: 401, cursoId: 801, tipo: TipoPlanAsignatura.OBLIGATORIA, creditos: 4, activo: true, curso: { codigo: 'ADM1' } };
    planAsignaturaRepo.find.mockResolvedValue([asig1]);
    planRequisitoRepo.find.mockResolvedValue([]);
    reglaOptativaRepo.findOne.mockResolvedValue(null);

    historialRepo.find.mockResolvedValue([
      { planAsignaturaId: 401, planAsignatura: asig1, resultado: ResultadoAcademico.APROBADO },
    ]);

    // Admin global tiene tipoCuentaJerarquica null pero tieneAlcanceSobreCarrera true
    alcanceJerarquico.tipoCuentaJerarquica.mockResolvedValue(null);
    estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(true);

    let transaccionConfirmada = false;
    const managerTransaccional = {
        getRepository: () => ({
          findOne: jest.fn().mockResolvedValue({ ...estudianteMock }),
          find: jest.fn().mockResolvedValue([
            { planAsignaturaId: 401, planAsignatura: asig1, resultado: ResultadoAcademico.APROBADO },
          ]),
          save: jest.fn().mockResolvedValue({ ...estudianteMock, estado: EstadoEstudiante.GRADUADO }),
        }),
        query: jest.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT') && sql.includes('titulos_estudiantes')) {
            return []; // No previous title
          }
          return { insertId: 100 };
        }),
    };
    const notificacionesService = {
      crear: jest.fn(async (_dto, manager) => {
        expect(transaccionConfirmada).toBe(false);
        expect(manager).toBe(managerTransaccional);
        return {};
      }),
    };
    (service as any).notificacionesService = notificacionesService;
    jest.spyOn(service as any, 'obtenerDestinatariosNotificacionCarrera').mockResolvedValue([22]);
    dataSource.transaction = jest.fn().mockImplementation(async (cb) => {
      const resultado = await cb(managerTransaccional);
      transaccionConfirmada = true;
      return resultado;
    });

    const res = await service.confirmarGraduacion(1, 8, 'Aprobado por Admin');
    expect(res).toBeDefined();
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(notificacionesService.crear).toHaveBeenCalledWith(expect.objectContaining({
      claveIdempotencia: 'notif:graduacion:100:22',
    }), managerTransaccional);
  });
});

