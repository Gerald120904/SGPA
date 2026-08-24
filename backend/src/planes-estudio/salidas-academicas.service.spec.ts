import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import {
  SalidaAcademica,
  TipoSalidaAcademica,
} from './entities/salida-academica.entity';
import { SalidasAcademicasService } from './salidas-academicas.service';

describe('SalidasAcademicasService', () => {
  let service: SalidasAcademicasService;
  let salidaRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let planRepository: { findOne: jest.Mock };
  let asignaturaRepository: { find: jest.Mock };

  const plan = {
    id: 1,
    activo: true,
  } as PlanEstudio;

  const asignatura = (id: number, activo = true) =>
    ({
      id,
      planEstudioId: 1,
      activo,
      curso: null,
      bloque: null,
    }) as PlanAsignatura;

  const salida = (cambios: Partial<SalidaAcademica> = {}) =>
    ({
      id: 1,
      planEstudioId: 1,
      codigo: 'DIP',
      nombre: 'Diplomado',
      tipo: TipoSalidaAcademica.DIPLOMADO,
      creditosRequeridos: 88,
      orden: 1,
      descripcion: null,
      activo: true,
      asignaturas: [],
      planEstudio: plan,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...cambios,
    }) as SalidaAcademica;

  beforeEach(() => {
    salidaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos) => datos),
      save: jest.fn(),
    };
    planRepository = {
      findOne: jest.fn(),
    };
    asignaturaRepository = {
      find: jest.fn(),
    };

    service = new SalidasAcademicasService(
      salidaRepository as unknown as Repository<SalidaAcademica>,
      planRepository as unknown as Repository<PlanEstudio>,
      asignaturaRepository as unknown as Repository<PlanAsignatura>,
    );
  });

  it('lista las salidas ordenadas con sus asignaturas', async () => {
    const salidas = [salida()];
    planRepository.findOne.mockResolvedValue(plan);
    salidaRepository.find.mockResolvedValue(salidas);

    await expect(service.listar(1)).resolves.toEqual(salidas);
    expect(salidaRepository.find).toHaveBeenCalledWith({
      where: { planEstudioId: 1 },
      relations: {
        asignaturas: {
          curso: true,
          bloque: true,
        },
      },
      order: {
        orden: 'ASC',
        nombre: 'ASC',
      },
    });
  });

  it('rechaza listar salidas de un plan inexistente', async () => {
    planRepository.findOne.mockResolvedValue(null);

    await expect(service.listar(999)).rejects.toThrow(NotFoundException);
    expect(salidaRepository.find).not.toHaveBeenCalled();
  });

  it('crea una salida normalizando código, nombre y descripción', async () => {
    const guardada = salida({ descripcion: 'Título intermedio' });
    planRepository.findOne.mockResolvedValue(plan);
    salidaRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(guardada);
    salidaRepository.save.mockResolvedValue({ id: 1 });

    const resultado = await service.crear(1, {
      codigo: ' dip ',
      nombre: ' Diplomado ',
      tipo: TipoSalidaAcademica.DIPLOMADO,
      creditosRequeridos: 88,
      orden: 1,
      descripcion: ' Título intermedio ',
    });

    expect(salidaRepository.create).toHaveBeenCalledWith({
      planEstudioId: 1,
      codigo: 'DIP',
      nombre: 'Diplomado',
      tipo: TipoSalidaAcademica.DIPLOMADO,
      creditosRequeridos: 88,
      orden: 1,
      descripcion: 'Título intermedio',
      activo: true,
      asignaturas: [],
    });
    expect(resultado).toEqual(guardada);
  });

  it('rechaza un código repetido dentro del mismo plan', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    salidaRepository.findOne.mockResolvedValue(salida());

    await expect(
      service.crear(1, {
        codigo: 'DIP',
        nombre: 'Otro diplomado',
        tipo: TipoSalidaAcademica.DIPLOMADO,
        creditosRequeridos: 80,
        orden: 2,
      }),
    ).rejects.toThrow(ConflictException);
    expect(salidaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza crear una salida en un plan inactivo', async () => {
    planRepository.findOne.mockResolvedValue({ ...plan, activo: false });

    await expect(
      service.crear(1, {
        codigo: 'DIP',
        nombre: 'Diplomado',
        tipo: TipoSalidaAcademica.DIPLOMADO,
        creditosRequeridos: 88,
        orden: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(salidaRepository.save).not.toHaveBeenCalled();
  });

  it('permite reemplazar las asignaturas de una salida', async () => {
    const inicial = salida();
    const asignaturas = [asignatura(10), asignatura(11)];
    const actualizada = salida({ asignaturas });
    planRepository.findOne.mockResolvedValue(plan);
    salidaRepository.findOne
      .mockResolvedValueOnce(inicial)
      .mockResolvedValueOnce(actualizada);
    asignaturaRepository.find.mockResolvedValue(asignaturas);

    const resultado = await service.reemplazarAsignaturas(1, 1, {
      asignaturaIds: [10, 11],
    });

    expect(salidaRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ asignaturas }),
    );
    expect(resultado.asignaturas).toEqual(asignaturas);
  });

  it('permite limpiar todas las asignaturas de una salida', async () => {
    const inicial = salida({ asignaturas: [asignatura(10)] });
    planRepository.findOne.mockResolvedValue(plan);
    salidaRepository.findOne
      .mockResolvedValueOnce(inicial)
      .mockResolvedValueOnce(salida());

    await service.reemplazarAsignaturas(1, 1, { asignaturaIds: [] });

    expect(asignaturaRepository.find).not.toHaveBeenCalled();
    expect(salidaRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ asignaturas: [] }),
    );
  });

  it('rechaza asignaturas ajenas al plan o inexistentes', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    salidaRepository.findOne.mockResolvedValue(salida());
    asignaturaRepository.find.mockResolvedValue([asignatura(10)]);

    await expect(
      service.reemplazarAsignaturas(1, 1, {
        asignaturaIds: [10, 99],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(salidaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza asignaturas inactivas', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    salidaRepository.findOne.mockResolvedValue(salida());
    asignaturaRepository.find.mockResolvedValue([asignatura(10, false)]);

    await expect(
      service.reemplazarAsignaturas(1, 1, {
        asignaturaIds: [10],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('cambia el estado de una salida', async () => {
    const inicial = salida();
    const desactivada = salida({ activo: false });
    planRepository.findOne.mockResolvedValue(plan);
    salidaRepository.findOne
      .mockResolvedValueOnce(inicial)
      .mockResolvedValueOnce(desactivada);

    const resultado = await service.cambiarEstado(1, 1, false);

    expect(salidaRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ activo: false }),
    );
    expect(resultado.activo).toBe(false);
  });

  it('devuelve 404 para una salida fuera del plan', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    salidaRepository.findOne.mockResolvedValue(null);

    await expect(service.obtenerPorId(1, 999)).rejects.toThrow(
      NotFoundException,
    );
  });
});
