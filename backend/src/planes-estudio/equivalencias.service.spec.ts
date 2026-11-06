import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EquivalenciasService } from './equivalencias.service';
import { OrigenAcademico } from '../estudiantes/constants/origen-academico.constant';
import { ResultadoAcademico } from '../estudiantes/constants/resultado-academico.constant';
import { EquivalenciaPlan } from './entities/equivalencia-plan.entity';

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
        getRepository: jest.fn((entity) => entity === EquivalenciaPlan ? equivalenciaRepo : historialRepo),
        query: jest.fn().mockResolvedValue([{ id: 2 }]),
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

  it('no guarda una N a 1 si una rama de origen no pertenece al plan', async () => {
    planAsignaturaRepo.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(where.id === 102 ? null : { id: where.id }));

    await expect(service.crear(1, {
      carreraOrigenId: 10, planOrigenId: 1, carreraDestinoId: 10, planDestinoId: 2,
      asignaturasOrigenIds: [101, 102], asignaturaDestinoId: 201, tipoEquivalencia: 'N_A_1',
    })).rejects.toThrow(BadRequestException);
    expect(equivalenciaRepo.save).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('guarda todas las ramas de una N a 1 dentro de una transacción', async () => {
    planAsignaturaRepo.findOne.mockImplementation(({ where }: any) => Promise.resolve({ id: where.id }));
    equivalenciaRepo.save.mockImplementation((rows) => Promise.resolve(rows));

    await service.crear(1, {
      carreraOrigenId: 10, planOrigenId: 1, carreraDestinoId: 10, planDestinoId: 2,
      asignaturasOrigenIds: [101, 102], asignaturaDestinoId: 201, tipoEquivalencia: 'N_A_1',
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(equivalenciaRepo.save).toHaveBeenCalledTimes(2);
    expect(equivalenciaRepo.save).toHaveBeenNthCalledWith(1, expect.objectContaining({ asignaturaOrigenId: 101 }));
    expect(equivalenciaRepo.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ asignaturaOrigenId: 102 }));
  });

  it('no guarda una 1 a N si un destino no pertenece al plan', async () => {
    planAsignaturaRepo.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(where.id === 202 ? null : { id: where.id }));

    await expect(service.crear(1, {
      carreraOrigenId: 10, planOrigenId: 1, asignaturaOrigenId: 101,
      carreraDestinoId: 10, planDestinoId: 2,
      asignaturasDestinoIds: [201, 202], tipoEquivalencia: '1_A_N',
    })).rejects.toThrow(BadRequestException);
    expect(equivalenciaRepo.save).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('desactiva el grupo completo en una transacción', async () => {
    const ramas = [1, 2].map((id) => ({
      id, carreraDestinoId: 10, planOrigenId: 1, planDestinoId: 2,
      activo: true, justificacion: `[COMPUESTA_N1:GRUPO:${id}:2:[101,102]]`,
    }));
    equivalenciaRepo.findOne.mockResolvedValue(ramas[0]);
    equivalenciaRepo.find.mockResolvedValue(ramas);
    equivalenciaRepo.save.mockImplementation((rows) => Promise.resolve(rows));

    const resultado = await service.eliminar(1, 1);
    expect(resultado.eliminadas).toBe(2);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(equivalenciaRepo.save).toHaveBeenCalledTimes(2);
    expect(equivalenciaRepo.save).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 1, activo: false }));
    expect(equivalenciaRepo.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 2, activo: false }));
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
    historialRepo.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(where.planAsignaturaId === 101 ? { resultado: ResultadoAcademico.APROBADO } : null));

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

  it('rechaza aplicar una equivalencia si no existe una aprobación de la materia de origen', async () => {
    estudianteRepo.findOne.mockResolvedValue({ id: 42, carreraId: 10, planEstudioId: 2 });
    equivalenciaRepo.find.mockResolvedValue([{
      id: 99,
      planOrigenId: 1,
      asignaturaOrigenId: 101,
      planDestinoId: 2,
      asignaturaDestinoId: 201,
      asignaturaOrigen: { id: 101, tipo: 'DISCIPLINARIA' },
      asignaturaDestino: { id: 201, tipo: 'DISCIPLINARIA' },
    }]);
    historialRepo.findOne.mockResolvedValue(null);

    await expect(service.aplicarEquivalenciasEstudiante(1, {
      estudianteId: 42,
      equivalenciaIds: [99],
    })).rejects.toThrow(BadRequestException);
    expect(historialRepo.save).not.toHaveBeenCalled();
  });

  it('rechaza una N a 1 incompleta aunque una rama de origen esté aprobada', async () => {
    estudianteRepo.findOne.mockResolvedValue({ id: 42, carreraId: 10, planEstudioId: 2 });
    const ramas = [101, 102].map((origenId, indice) => ({
      id: indice + 1,
      planOrigenId: 1,
      asignaturaOrigenId: origenId,
      planDestinoId: 2,
      asignaturaDestinoId: 201,
      activo: true,
      justificacion: `[COMPUESTA_N1:GRUPO:1:2:[101,102]]`,
      asignaturaOrigen: { tipo: 'DISCIPLINARIA' },
      asignaturaDestino: { tipo: 'DISCIPLINARIA' },
    }));
    equivalenciaRepo.find.mockResolvedValueOnce([ramas[0]]).mockResolvedValueOnce(ramas);
    historialRepo.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(where.planAsignaturaId === 101 ? { resultado: ResultadoAcademico.APROBADO } : null));

    await expect(service.aplicarEquivalenciasEstudiante(1, {
      estudianteId: 42,
      equivalenciaIds: [1],
    })).rejects.toThrow('Faltan asignaturas de origen aprobadas');
    expect(historialRepo.save).not.toHaveBeenCalled();
  });
});
