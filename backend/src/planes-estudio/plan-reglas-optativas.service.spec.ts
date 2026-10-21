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
    cantidadDisciplinarias: 2,
    cantidadAbiertas: 1,
    cantidadSede: 1,
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

  it('guarda cantidades exactas por tipo de optativa', async () => {
    const regla = crearRegla();
    planRepository.findOne.mockResolvedValue(planActivo);
    asignaturaRepository.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    reglaRepository.findOne.mockResolvedValue(null);
    reglaRepository.save.mockResolvedValue(regla);

    const resultado = await service.guardar(1, {
      cantidadDisciplinarias: 2,
      cantidadAbiertas: 1,
      cantidadSede: 1,
    });

    expect(asignaturaRepository.count).toHaveBeenCalledTimes(4);
    expect(reglaRepository.create).toHaveBeenCalledWith({
      planEstudioId: 1,
      cantidadDisciplinarias: 2,
      cantidadAbiertas: 1,
      cantidadSede: 1,
      minimoDisciplinariasPropias: 2,
      maximoOtrasAreas: 2,
    });
    expect(resultado).toEqual(regla);
  });

  it('rechaza configurar regla si hay optativas sin clasificar', async () => {
    planRepository.findOne.mockResolvedValue(planActivo);
    asignaturaRepository.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    await expect(
      service.guardar(1, {
        cantidadDisciplinarias: 2,
        cantidadAbiertas: 1,
        cantidadSede: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(reglaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza si la suma configurada supera 200 espacios', async () => {
    planRepository.findOne.mockResolvedValue(planActivo);

    await expect(
      service.guardar(1, {
        cantidadDisciplinarias: 100,
        cantidadAbiertas: 100,
        cantidadSede: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(reglaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza reducir disciplinarias por debajo de las ya registradas', async () => {
    planRepository.findOne.mockResolvedValue(planActivo);
    asignaturaRepository.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await expect(
      service.guardar(1, {
        cantidadDisciplinarias: 2,
        cantidadAbiertas: 0,
        cantidadSede: 0,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(reglaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza reducir abiertas por debajo de las ya registradas', async () => {
    planRepository.findOne.mockResolvedValue(planActivo);
    asignaturaRepository.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await expect(
      service.guardar(1, {
        cantidadDisciplinarias: 0,
        cantidadAbiertas: 2,
        cantidadSede: 0,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(reglaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza si el plan no existe o está inactivo', async () => {
    planRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      service.guardar(999, {
        cantidadDisciplinarias: 2,
        cantidadAbiertas: 1,
        cantidadSede: 1,
      }),
    ).rejects.toThrow(NotFoundException);

    planRepository.findOne.mockResolvedValueOnce({
      ...planActivo,
      activo: false,
    });

    await expect(
      service.guardar(1, {
        cantidadDisciplinarias: 2,
        cantidadAbiertas: 1,
        cantidadSede: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('obtiene la regla del plan junto a la cantidad derivada de espacios optativos', async () => {
    const regla = crearRegla();
    planRepository.findOne.mockResolvedValue(planActivo);
    reglaRepository.findOne.mockResolvedValue(regla);
    asignaturaRepository.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const resultado = await service.obtener(1);

    expect(resultado).toEqual({
      regla,
      cantidadEspaciosOptativos: 4,
      cantidadEspaciosConfigurados: 4,
      conteoActual: {
        disciplinarias: 2,
        abiertas: 1,
        sede: 1,
        sinClasificar: 0,
        total: 4,
      },
    });
  });

  it('elimina la regla de optativas del plan', async () => {
    const regla = crearRegla();
    planRepository.findOne.mockResolvedValue(planActivo);
    reglaRepository.findOne.mockResolvedValue(regla);
    asignaturaRepository.count.mockResolvedValue(0);
    reglaRepository.remove.mockResolvedValue(regla);

    await service.eliminar(1);

    expect(asignaturaRepository.count).toHaveBeenCalledWith({
      where: {
        planEstudioId: 1,
        tipo: TipoPlanAsignatura.OPTATIVA,
        activo: true,
      },
    });
    expect(reglaRepository.remove).toHaveBeenCalledWith(regla);
  });

  it('rechaza eliminar la regla mientras hay optativas activas', async () => {
    planRepository.findOne.mockResolvedValue(planActivo);
    reglaRepository.findOne.mockResolvedValue(crearRegla());
    asignaturaRepository.count.mockResolvedValue(1);

    await expect(service.eliminar(1)).rejects.toThrow(
      'No se puede eliminar la regla mientras existan asignaturas optativas activas',
    );

    expect(reglaRepository.remove).not.toHaveBeenCalled();
  });

  it('rechaza eliminar regla si no existe para el plan', async () => {
    planRepository.findOne.mockResolvedValue(planActivo);
    reglaRepository.findOne.mockResolvedValue(null);

    await expect(service.eliminar(1)).rejects.toThrow(NotFoundException);
  });
});
