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
});

