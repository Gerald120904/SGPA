import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EquivalenciasService } from './equivalencias.service';
import { OrigenAcademico } from '../estudiantes/constants/origen-academico.constant';
import { ResultadoAcademico } from '../estudiantes/constants/resultado-academico.constant';

describe('EquivalenciasService', () => {
  let service: EquivalenciasService;
  let equivalenciaRepo: any;
  let planRepo: any;
  let planAsignaturaRepo: any;
  let estudianteRepo: any;
  let historialRepo: any;
  let alcance: any;
  let dataSource: any;

  beforeEach(() => {
    equivalenciaRepo = {
      create: jest.fn((dto) => ({ ...dto, id: 1 })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: e.id || 1 })),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    planRepo = {
      findOne: jest.fn(),
    };
    planAsignaturaRepo = {
      findOne: jest.fn(),
    };
    estudianteRepo = {
      findOne: jest.fn(),
    };
    historialRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((dto) => Promise.resolve(dto)),
    };
    alcance = {
      puedeEjecutar: jest.fn().mockResolvedValue(true),
    };
    dataSource = {
      transaction: jest.fn((cb) => cb({
        getRepository: jest.fn().mockReturnValue(historialRepo),
      })),
    };

    service = new EquivalenciasService(
      equivalenciaRepo,
      planRepo,
      planAsignaturaRepo,
      estudianteRepo,
      historialRepo,
      alcance,
      dataSource,
    );
  });

  it('rechaza crear equivalencia si el usuario no tiene permisos sobre la carrera destino', async () => {
    alcance.puedeEjecutar.mockResolvedValue(false);
    await expect(
      service.crear(1, {
        carreraOrigenId: 10,
        planOrigenId: 1,
        asignaturaOrigenId: 101,
        carreraDestinoId: 20,
        planDestinoId: 2,
        asignaturaDestinoId: 201,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('crea exitosamente una equivalencia válida entre planes', async () => {
    planAsignaturaRepo.findOne
      .mockResolvedValueOnce({ id: 101, planEstudioId: 1 })
      .mockResolvedValueOnce({ id: 201, planEstudioId: 2 });
    equivalenciaRepo.findOne.mockResolvedValue(null);

    const res = await service.crear(1, {
      carreraOrigenId: 10,
      planOrigenId: 1,
      asignaturaOrigenId: 101,
      carreraDestinoId: 20,
      planDestinoId: 2,
      asignaturaDestinoId: 201,
      justificacion: 'Contenidos equivalentes',
    });

    expect(res).toBeDefined();
    expect(res.id).toBe(1);
    expect(equivalenciaRepo.save).toHaveBeenCalled();
  });

  it('sugiere equivalencias para un estudiante basándose en asignaturas aprobadas', async () => {
    estudianteRepo.findOne.mockResolvedValue({
      id: 42,
      carreraId: 10,
      planEstudioId: 1,
    });
    planRepo.findOne.mockResolvedValue({ id: 2, codigo: 'P-NUEVO' });
    historialRepo.find.mockResolvedValue([
      { estudianteId: 42, planAsignaturaId: 101, resultado: ResultadoAcademico.APROBADO, planAsignatura: { cursoId: 50 } },
    ]);
    equivalenciaRepo.find.mockResolvedValue([
      {
        id: 99,
        planOrigenId: 1,
        asignaturaOrigenId: 101,
        planDestinoId: 2,
        asignaturaDestinoId: 201,
        justificacion: 'Aprobada institucionalmente',
        asignaturaOrigen: { id: 101, cursoId: 50, curso: { codigo: 'EIF101', nombre: 'Intro Progra', creditos: 4 } },
        asignaturaDestino: { id: 201, cursoId: 60, curso: { codigo: 'INF101', nombre: 'Programación I', creditos: 4 } },
      },
    ]);

    const res = await service.sugerirEquivalenciasParaEstudiante(1, 42, 2);
    expect(res.totalSugeridas).toBe(1);
    expect(res.sugerencias[0].equivalenciaId).toBe(99);
    expect(res.sugerencias[0].destino.codigo).toBe('INF101');
  });

  it('aplica equivalencias aprobadas al historial del estudiante evitando duplicados', async () => {
    estudianteRepo.findOne.mockResolvedValue({ id: 42, carreraId: 10 });
    equivalenciaRepo.find.mockResolvedValue([
      {
        id: 99,
        asignaturaOrigenId: 101,
        asignaturaDestinoId: 201,
      },
    ]);
    historialRepo.findOne.mockResolvedValue(null); // not already approved

    const res = await service.aplicarEquivalenciasEstudiante(1, {
      estudianteId: 42,
      equivalenciaIds: [99],
    });

    expect(res.aplicadas).toBe(1);
    expect(historialRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        estudianteId: 42,
        planAsignaturaId: 201,
        resultado: ResultadoAcademico.APROBADO,
        origenAcademico: OrigenAcademico.EQUIVALENCIA,
      }),
    );
  });
});
