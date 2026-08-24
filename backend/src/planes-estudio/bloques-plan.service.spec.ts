import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { TipoBloquePlan } from './constants/tipo-bloque-plan.constant';
import { BloquePlan } from './entities/bloque-plan.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { BloquesPlanService } from './bloques-plan.service';

describe('BloquesPlanService', () => {
  let service: BloquesPlanService;
  let bloqueRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let planRepository: { findOne: jest.Mock };

  const plan = {
    id: 1,
    carreraId: 10,
    codigo: 'PLAN-1',
    nombre: 'Plan 1',
    activo: true,
  } as PlanEstudio;
  const bloque = {
    id: 5,
    planEstudioId: 1,
    codigo: 'TC',
    nombre: 'Tronco común',
    tipo: TipoBloquePlan.TRONCO_COMUN,
    orden: 1,
    descripcion: null,
    activo: true,
  } as BloquePlan;
  const datos = {
    codigo: 'TC',
    nombre: 'Tronco común',
    tipo: TipoBloquePlan.TRONCO_COMUN,
    orden: 1,
  };

  beforeEach(() => {
    bloqueRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((valor) => valor),
      save: jest.fn(),
      update: jest.fn(),
    };
    planRepository = { findOne: jest.fn() };
    service = new BloquesPlanService(
      bloqueRepository as unknown as Repository<BloquePlan>,
      planRepository as unknown as Repository<PlanEstudio>,
    );
  });

  it('lista los bloques del plan ordenados', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    bloqueRepository.find.mockResolvedValue([bloque]);
    await expect(service.listar(1)).resolves.toEqual([bloque]);
    expect(bloqueRepository.find).toHaveBeenCalledWith({
      where: { planEstudioId: 1 },
      order: { orden: 'ASC', nombre: 'ASC' },
    });
  });

  it('rechaza consultar bloques de un plan inexistente', async () => {
    planRepository.findOne.mockResolvedValue(null);
    await expect(service.listar(999)).rejects.toThrow(NotFoundException);
    expect(bloqueRepository.find).not.toHaveBeenCalled();
  });

  it('crea un bloque normalizando código, nombre y descripción', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    bloqueRepository.findOne.mockResolvedValue(null);
    bloqueRepository.save.mockImplementation(async (entidad) => ({
      id: 5,
      ...entidad,
    }));
    const resultado = await service.crear(1, {
      ...datos,
      codigo: ' tc ',
      nombre: ' Tronco común ',
      descripcion: ' Bloque principal ',
    });
    expect(bloqueRepository.create).toHaveBeenCalledWith({
      planEstudioId: 1,
      codigo: 'TC',
      nombre: 'Tronco común',
      tipo: TipoBloquePlan.TRONCO_COMUN,
      orden: 1,
      descripcion: 'Bloque principal',
      activo: true,
    });
    expect(resultado).toEqual(
      expect.objectContaining({ id: 5, codigo: 'TC', activo: true }),
    );
  });

  it('rechaza crear bloques en un plan inactivo', async () => {
    planRepository.findOne.mockResolvedValue({ ...plan, activo: false });
    await expect(service.crear(1, datos)).rejects.toThrow(BadRequestException);
    expect(bloqueRepository.create).not.toHaveBeenCalled();
  });

  it('rechaza un código duplicado dentro del mismo plan', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    bloqueRepository.findOne.mockResolvedValue(bloque);
    await expect(
      service.crear(1, { ...datos, nombre: 'Otro bloque' }),
    ).rejects.toThrow(ConflictException);
    expect(bloqueRepository.save).not.toHaveBeenCalled();
  });

  it('actualiza un bloque y normaliza sus campos', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    bloqueRepository.findOne
      .mockResolvedValueOnce({ ...bloque })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...bloque,
        codigo: 'ENF',
        nombre: 'Énfasis',
        descripcion: 'Especialidad',
        orden: 2,
      });
    bloqueRepository.save.mockResolvedValue(bloque);
    const resultado = await service.actualizar(1, 5, {
      codigo: ' enf ',
      nombre: ' Énfasis ',
      descripcion: ' Especialidad ',
      orden: 2,
    });
    expect(bloqueRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 5,
        codigo: 'ENF',
        nombre: 'Énfasis',
        descripcion: 'Especialidad',
        orden: 2,
      }),
    );
    expect(resultado.codigo).toBe('ENF');
  });

  it('cambia el estado de un bloque', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    bloqueRepository.findOne
      .mockResolvedValueOnce({ ...bloque })
      .mockResolvedValueOnce({ ...bloque, activo: false });
    bloqueRepository.update.mockResolvedValue({ affected: 1 });
    await expect(service.cambiarEstado(1, 5, false)).resolves.toMatchObject({
      activo: false,
    });
    expect(bloqueRepository.update).toHaveBeenCalledWith(5, { activo: false });
  });

  it('convierte ER_DUP_ENTRY en ConflictException', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    bloqueRepository.findOne.mockResolvedValue(null);
    bloqueRepository.save.mockRejectedValue({ code: 'ER_DUP_ENTRY' });
    await expect(service.crear(1, datos)).rejects.toThrow(ConflictException);
  });
});
