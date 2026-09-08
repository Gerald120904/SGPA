import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TipoPlanAsignatura } from './constants/tipo-plan-asignatura.constant';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { ReglaOptativaPlan } from './entities/regla-optativa-plan.entity';
import { PlanReglasOptativasService } from './plan-reglas-optativas.service';

describe('PlanReglasOptativasService', () => {
  let service: PlanReglasOptativasService;
  let reglaRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let planRepository: {
    findOne: jest.Mock;
  };
  let asignaturaRepository: {
    count: jest.Mock;
  };

  const planActivo = {
    id: 1,
    codigo: 'PLAN-INF-2026',
    nombre: 'Bachillerato en Informática',
    activo: true,
  } as PlanEstudio;

  const crearRegla = (
    cambios: Partial<ReglaOptativaPlan> = {},
  ): ReglaOptativaPlan => ({
    id: 1,
    planEstudioId: 1,
    minimoDisciplinariasPropias: 2,
    maximoOtrasAreas: 2,
    planEstudio: planActivo,
    ...cambios,
  });

  beforeEach(() => {
    reglaRepository = {
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<ReglaOptativaPlan>) => datos),
      save: jest.fn(),
      remove: jest.fn(),
    };
    planRepository = {
      findOne: jest.fn(),
    };
    asignaturaRepository = {
      count: jest.fn(),
    };

    service = new PlanReglasOptativasService(
      reglaRepository as unknown as Repository<ReglaOptativaPlan>,
      planRepository as unknown as Repository<PlanEstudio>,
      asignaturaRepository as unknown as Repository<PlanAsignatura>,
    );

    jest.clearAllMocks();
  });

  it('guarda una regla válida para un plan con 4 espacios OPT (mínimo 2, máximo 2)', async () => {
    const regla = crearRegla();
    planRepository.findOne.mockResolvedValue(planActivo);
    asignaturaRepository.count.mockResolvedValue(4);
    reglaRepository.findOne.mockResolvedValue(null);
    reglaRepository.save.mockResolvedValue(regla);

    const resultado = await service.guardar(1, {
      minimoDisciplinariasPropias: 2,
      maximoOtrasAreas: 2,
    });

    expect(asignaturaRepository.count).toHaveBeenCalledWith({
      where: {
        planEstudioId: 1,
        tipo: TipoPlanAsignatura.OPTATIVA,
        activo: true,
      },
    });
    expect(reglaRepository.create).toHaveBeenCalledWith({
      planEstudioId: 1,
      minimoDisciplinariasPropias: 2,
      maximoOtrasAreas: 2,
    });
    expect(resultado).toEqual(regla);
  });

  it('rechaza configurar regla si el plan no tiene espacios OPT activos', async () => {
    planRepository.findOne.mockResolvedValue(planActivo);
    asignaturaRepository.count.mockResolvedValue(0);

    await expect(
      service.guardar(1, {
        minimoDisciplinariasPropias: 2,
        maximoOtrasAreas: 2,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(reglaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza si el mínimo de disciplinarias propias (5) supera los espacios OPT (4)', async () => {
    planRepository.findOne.mockResolvedValue(planActivo);
    asignaturaRepository.count.mockResolvedValue(4);

    await expect(
      service.guardar(1, {
        minimoDisciplinariasPropias: 5,
        maximoOtrasAreas: 2,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(reglaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza si el máximo de otras áreas (7) supera los espacios OPT (4)', async () => {
    planRepository.findOne.mockResolvedValue(planActivo);
    asignaturaRepository.count.mockResolvedValue(4);

    await expect(
      service.guardar(1, {
        minimoDisciplinariasPropias: 2,
        maximoOtrasAreas: 7,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(reglaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza si el plan no existe o está inactivo', async () => {
    planRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      service.guardar(999, {
        minimoDisciplinariasPropias: 2,
      }),
    ).rejects.toThrow(NotFoundException);

    planRepository.findOne.mockResolvedValueOnce({
      ...planActivo,
      activo: false,
    });

    await expect(
      service.guardar(1, {
        minimoDisciplinariasPropias: 2,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('obtiene la regla del plan junto a la cantidad derivada de espacios optativos', async () => {
    const regla = crearRegla();
    planRepository.findOne.mockResolvedValue(planActivo);
    reglaRepository.findOne.mockResolvedValue(regla);
    asignaturaRepository.count.mockResolvedValue(4);

    const resultado = await service.obtener(1);

    expect(resultado).toEqual({
      regla,
      cantidadEspaciosOptativos: 4,
    });
  });

  it('elimina la regla de optativas del plan', async () => {
    const regla = crearRegla();
    planRepository.findOne.mockResolvedValue(planActivo);
    reglaRepository.findOne.mockResolvedValue(regla);
    reglaRepository.remove.mockResolvedValue(regla);

    await service.eliminar(1);

    expect(reglaRepository.remove).toHaveBeenCalledWith(regla);
  });

  it('rechaza eliminar regla si no existe para el plan', async () => {
    planRepository.findOne.mockResolvedValue(planActivo);
    reglaRepository.findOne.mockResolvedValue(null);

    await expect(service.eliminar(1)).rejects.toThrow(NotFoundException);
  });
});
