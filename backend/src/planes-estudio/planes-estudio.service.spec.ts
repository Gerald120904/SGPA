import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { GradoAcademico } from '../carreras/constants/grado-academico.constant';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanesEstudioService } from './planes-estudio.service';

describe('PlanesEstudioService', () => {
  let service: PlanesEstudioService;
  let planRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let carreraRepository: {
    findOne: jest.Mock;
  };

  const carrera = {
    id: 1,
    codigo: 'EIF',
    nombre: 'Ingeniería en Sistemas',
    grado: GradoAcademico.BACHILLERATO,
    descripcion: null,
    activo: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as Carrera;

  const crearPlan = (cambios: Partial<PlanEstudio> = {}): PlanEstudio => ({
    id: 1,
    carreraId: 1,
    codigo: 'BA-INFORM 2012-10',
    nombre: 'Plan de Bachillerato 2012-10',
    descripcion: 'Plan de estudios',
    activo: true,
    carrera,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...cambios,
  });

  beforeEach(() => {
    planRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<PlanEstudio>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };
    carreraRepository = {
      findOne: jest.fn(),
    };

    service = new PlanesEstudioService(
      planRepository as unknown as Repository<PlanEstudio>,
      carreraRepository as unknown as Repository<Carrera>,
    );
  });

  it('lista los planes con su carrera', async () => {
    const planes = [crearPlan()];
    planRepository.find.mockResolvedValue(planes);

    await expect(service.listar()).resolves.toEqual(planes);
    expect(planRepository.find).toHaveBeenCalledWith({
      relations: { carrera: true },
      order: {
        carreraId: 'ASC',
        codigo: 'ASC',
      },
    });
  });

  it('obtiene un plan por id con su carrera', async () => {
    const plan = crearPlan();
    planRepository.findOne.mockResolvedValue(plan);

    const resultado = await service.obtenerPorId(1);

    expect(planRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      relations: { carrera: true },
    });
    expect(resultado).toEqual(plan);
  });

  it('devuelve 404 si el plan no existe', async () => {
    planRepository.findOne.mockResolvedValue(null);

    await expect(service.obtenerPorId(999)).rejects.toThrow(NotFoundException);
  });

  it('crea un plan normalizado para una carrera activa', async () => {
    const guardado = crearPlan();
    carreraRepository.findOne.mockResolvedValue(carrera);
    planRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(guardado);
    planRepository.save.mockResolvedValue(guardado);

    const resultado = await service.crear({
      carreraId: 1,
      codigo: ' ba-inform 2012-10 ',
      nombre: ' Plan de Bachillerato 2012-10 ',
      descripcion: ' Plan de estudios ',
    });

    expect(planRepository.create).toHaveBeenCalledWith({
      carreraId: 1,
      codigo: 'BA-INFORM 2012-10',
      nombre: 'Plan de Bachillerato 2012-10',
      descripcion: 'Plan de estudios',
      activo: true,
    });
    expect(resultado).toEqual(guardado);
  });

  it('rechaza una carrera inexistente', async () => {
    carreraRepository.findOne.mockResolvedValue(null);

    await expect(
      service.crear({
        carreraId: 999,
        codigo: 'PLAN-1',
        nombre: 'Plan uno',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza una carrera inactiva', async () => {
    carreraRepository.findOne.mockResolvedValue({
      ...carrera,
      activo: false,
    });

    await expect(
      service.crear({
        carreraId: 1,
        codigo: 'PLAN-1',
        nombre: 'Plan uno',
      }),
    ).rejects.toThrow('No se puede crear un plan para una carrera inactiva.');
  });

  it('rechaza un código duplicado dentro de la misma carrera', async () => {
    carreraRepository.findOne.mockResolvedValue(carrera);
    planRepository.findOne.mockResolvedValue(crearPlan());

    await expect(
      service.crear({
        carreraId: 1,
        codigo: 'BA-INFORM 2012-10',
        nombre: 'Otro plan',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('actualiza el plan sin cambiar su carrera', async () => {
    const existente = crearPlan();
    const actualizado = crearPlan({
      codigo: 'BA-INFORM 2026',
      nombre: 'Plan actualizado',
    });
    planRepository.findOne
      .mockResolvedValueOnce(existente)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(actualizado);

    const resultado = await service.actualizar(1, {
      codigo: ' ba-inform 2026 ',
      nombre: ' Plan actualizado ',
    });

    expect(planRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        carreraId: 1,
        codigo: 'BA-INFORM 2026',
        nombre: 'Plan actualizado',
      }),
    );
    expect(resultado).toEqual(actualizado);
  });

  it('permite dejar la descripción en null', async () => {
    planRepository.findOne
      .mockResolvedValueOnce(crearPlan())
      .mockResolvedValueOnce(crearPlan({ descripcion: null }));
    planRepository.save.mockResolvedValue(crearPlan());

    const resultado = await service.actualizar(1, {
      descripcion: '',
    });

    expect(planRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        descripcion: null,
      }),
    );
    expect(resultado.descripcion).toBeNull();
  });

  it('cambia el estado del plan', async () => {
    planRepository.findOne
      .mockResolvedValueOnce(crearPlan())
      .mockResolvedValueOnce(crearPlan({ activo: false }));

    const resultado = await service.cambiarEstado(1, false);

    expect(planRepository.update).toHaveBeenCalledWith(1, { activo: false });
    expect(resultado.activo).toBe(false);
  });

  it('convierte un duplicado de MySQL en conflicto', async () => {
    carreraRepository.findOne.mockResolvedValue(carrera);
    planRepository.findOne.mockResolvedValue(null);
    planRepository.save.mockRejectedValue({
      code: 'ER_DUP_ENTRY',
    });

    await expect(
      service.crear({
        carreraId: 1,
        codigo: 'BA-INFORM 2012-10',
        nombre: 'Plan de Bachillerato',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
