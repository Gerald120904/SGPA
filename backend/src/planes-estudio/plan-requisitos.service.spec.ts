import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TipoPlanAsignatura } from './constants/tipo-plan-asignatura.constant';
import { TipoRequisito } from './constants/tipo-requisito.constant';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanRequisito } from './entities/plan-requisito.entity';
import { PlanRequisitosService } from './plan-requisitos.service';

describe('PlanRequisitosService', () => {
  let service: PlanRequisitosService;
  let requisitoRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let asignaturaRepository: { find: jest.Mock; findOne: jest.Mock };
  let planRepository: { findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let transactionRepository: { save: jest.Mock };

  const plan = {
    id: 1,
    carreraId: 1,
    codigo: 'BA-INFORM 2012-10',
    nombre: 'Plan de Bachillerato',
    descripcion: null,
    activo: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as PlanEstudio;

  const crearAsignatura = (
    id: number,
    cambios: Partial<PlanAsignatura> = {},
  ): PlanAsignatura => ({
    id,
    planEstudioId: 1,
    bloqueId: null,
    cursoId: null,
    nivel: 1,
    ciclo: 1,
    orden: id,
    creditos: 3,
    tipo: TipoPlanAsignatura.OBLIGATORIA,
    codigoReferencia: `REF-${id}`,
    nombreReferencia: `Asignatura ${id}`,
    activo: true,
    planEstudio: plan,
    bloque: null,
    curso: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...cambios,
  });

  const asignatura = crearAsignatura(20);
  const requisitoAsignatura = crearAsignatura(10);

  const crearRelacion = (
    cambios: Partial<PlanRequisito> = {},
  ): PlanRequisito => ({
    id: 5,
    asignaturaId: 20,
    requisitoAsignaturaId: 10,
    tipo: TipoRequisito.REQUISITO,
    asignatura,
    requisitoAsignatura,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...cambios,
  });

  beforeEach(() => {
    requisitoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<PlanRequisito>) => datos),
      save: jest.fn(),
      delete: jest.fn(),
    };
    requisitoRepository.find.mockResolvedValue([]);
    asignaturaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    planRepository = { findOne: jest.fn() };
    transactionRepository = {
      save: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(async (callback) =>
        callback({
          getRepository: jest.fn().mockReturnValue(transactionRepository),
        }),
      ),
    };

    service = new PlanRequisitosService(
      requisitoRepository as unknown as Repository<PlanRequisito>,
      asignaturaRepository as unknown as Repository<PlanAsignatura>,
      planRepository as unknown as Repository<PlanEstudio>,
      dataSource as unknown as DataSource,
    );
  });

  it('lista las relaciones del plan con ambas asignaturas', async () => {
    const relaciones = [crearRelacion()];
    planRepository.findOne.mockResolvedValue(plan);
    requisitoRepository.find.mockResolvedValue(relaciones);

    const resultado = await service.listar(1);

    expect(requisitoRepository.find).toHaveBeenCalledWith({
      where: {
        asignatura: {
          planEstudioId: 1,
        },
      },
      relations: {
        asignatura: { curso: true },
        requisitoAsignatura: { curso: true },
      },
      order: { id: 'ASC' },
    });
    expect(resultado).toEqual(relaciones);
  });

  it('devuelve 404 al listar un plan inexistente', async () => {
    planRepository.findOne.mockResolvedValue(null);

    await expect(service.listar(999)).rejects.toThrow(NotFoundException);
    expect(requisitoRepository.find).not.toHaveBeenCalled();
  });

  it('rechaza crear relaciones en un plan inactivo', async () => {
    planRepository.findOne.mockResolvedValue({ ...plan, activo: false });

    await expect(
      service.crear(1, {
        asignaturaId: 20,
        requisitoAsignaturaId: 10,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza que una asignatura sea requisito de sí misma', async () => {
    planRepository.findOne.mockResolvedValue(plan);

    await expect(
      service.crear(1, {
        asignaturaId: 20,
        requisitoAsignaturaId: 20,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow('Una asignatura no puede ser requisito de sí misma.');
    expect(asignaturaRepository.findOne).not.toHaveBeenCalled();
  });

  it('rechaza una asignatura que no pertenece al plan', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(asignatura)
      .mockResolvedValueOnce(null);

    await expect(
      service.crear(1, {
        asignaturaId: 20,
        requisitoAsignaturaId: 99,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow(
      'Una de las asignaturas seleccionadas no pertenece al plan.',
    );
  });

  it('rechaza asignaturas inactivas', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne.mockResolvedValue(
      crearAsignatura(20, { activo: false }),
    );

    await expect(
      service.crear(1, {
        asignaturaId: 20,
        requisitoAsignaturaId: 10,
        tipo: TipoRequisito.CORREQUISITO,
      }),
    ).rejects.toThrow(
      'No se pueden utilizar asignaturas inactivas en una relación de requisitos.',
    );
  });

  it('rechaza una relación académica duplicada', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(asignatura)
      .mockResolvedValueOnce(requisitoAsignatura);
    requisitoRepository.findOne.mockResolvedValue(crearRelacion());

    await expect(
      service.crear(1, {
        asignaturaId: 20,
        requisitoAsignaturaId: 10,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow(ConflictException);
    expect(requisitoRepository.save).not.toHaveBeenCalled();
  });

  it('crea y devuelve una relación con su detalle', async () => {
    const relacion = crearRelacion();
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(asignatura)
      .mockResolvedValueOnce(requisitoAsignatura);
    requisitoRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(relacion);
    requisitoRepository.save.mockResolvedValue({ id: 5 });

    const resultado = await service.crear(1, {
      asignaturaId: 20,
      requisitoAsignaturaId: 10,
      tipo: TipoRequisito.REQUISITO,
    });

    expect(requisitoRepository.create).toHaveBeenCalledWith({
      asignaturaId: 20,
      requisitoAsignaturaId: 10,
      tipo: TipoRequisito.REQUISITO,
    });
    expect(resultado).toEqual(relacion);
  });

  it('permite crear un correquisito', async () => {
    const correquisito = crearRelacion({
      id: 6,
      tipo: TipoRequisito.CORREQUISITO,
    });
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(asignatura)
      .mockResolvedValueOnce(requisitoAsignatura);
    requisitoRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(correquisito);
    requisitoRepository.save.mockResolvedValue({ id: 6 });

    const resultado = await service.crear(1, {
      asignaturaId: 20,
      requisitoAsignaturaId: 10,
      tipo: TipoRequisito.CORREQUISITO,
    });

    expect(requisitoRepository.create).toHaveBeenCalledWith({
      asignaturaId: 20,
      requisitoAsignaturaId: 10,
      tipo: TipoRequisito.CORREQUISITO,
    });
    expect(resultado.tipo).toBe(TipoRequisito.CORREQUISITO);
  });

  it('convierte un duplicado de MySQL en conflicto', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(asignatura)
      .mockResolvedValueOnce(requisitoAsignatura);
    requisitoRepository.findOne.mockResolvedValue(null);
    requisitoRepository.save.mockRejectedValue({
      driverError: { code: 'ER_DUP_ENTRY' },
    });

    await expect(
      service.crear(1, {
        asignaturaId: 20,
        requisitoAsignaturaId: 10,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('convierte un duplicado directo de MySQL en conflicto', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(asignatura)
      .mockResolvedValueOnce(requisitoAsignatura);
    requisitoRepository.findOne.mockResolvedValue(null);
    requisitoRepository.save.mockRejectedValue({
      code: 'ER_DUP_ENTRY',
    });

    await expect(
      service.crear(1, {
        asignaturaId: 20,
        requisitoAsignaturaId: 10,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza un requisito que genera un ciclo', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(crearAsignatura(12))
      .mockResolvedValueOnce(crearAsignatura(10));
    requisitoRepository.findOne.mockResolvedValue(null);
    requisitoRepository.find.mockResolvedValue([
      crearRelacion({
        id: 1,
        asignaturaId: 10,
        requisitoAsignaturaId: 11,
      }),
      crearRelacion({
        id: 2,
        asignaturaId: 11,
        requisitoAsignaturaId: 12,
      }),
    ]);

    await expect(
      service.crear(1, {
        asignaturaId: 12,
        requisitoAsignaturaId: 10,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(requisitoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza ciclos creados completamente dentro de una carga masiva', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.find.mockResolvedValue([
      crearAsignatura(10),
      crearAsignatura(11),
      crearAsignatura(12),
    ]);
    requisitoRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(
      service.cargaMasiva(1, {
        requisitos: [
          {
            asignaturaId: 10,
            requisitoAsignaturaId: 11,
            tipo: TipoRequisito.REQUISITO,
          },
          {
            asignaturaId: 11,
            requisitoAsignaturaId: 12,
            tipo: TipoRequisito.REQUISITO,
          },
          {
            asignaturaId: 12,
            requisitoAsignaturaId: 10,
            tipo: TipoRequisito.REQUISITO,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('permite una cadena de requisitos sin ciclos', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.find.mockResolvedValue([
      crearAsignatura(10),
      crearAsignatura(11),
      crearAsignatura(12),
    ]);
    requisitoRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    transactionRepository.save.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const resultado = await service.cargaMasiva(1, {
      requisitos: [
        {
          asignaturaId: 11,
          requisitoAsignaturaId: 10,
          tipo: TipoRequisito.REQUISITO,
        },
        {
          asignaturaId: 12,
          requisitoAsignaturaId: 11,
          tipo: TipoRequisito.REQUISITO,
        },
      ],
    });

    expect(resultado.total).toBe(2);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('no devuelve una relación que pertenece a otro plan', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    requisitoRepository.findOne.mockResolvedValue(
      crearRelacion({
        asignatura: crearAsignatura(20, { planEstudioId: 2 }),
      }),
    );

    await expect(service.eliminar(1, 5)).rejects.toThrow(NotFoundException);
    expect(requisitoRepository.delete).not.toHaveBeenCalled();
  });

  it('elimina una relación configurable del plan', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    requisitoRepository.findOne.mockResolvedValue(crearRelacion());

    const resultado = await service.eliminar(1, 5);

    expect(requisitoRepository.delete).toHaveBeenCalledWith(5);
    expect(resultado).toEqual({
      message: 'Relación académica eliminada correctamente.',
    });
  });

  it('rechaza eliminar una relación inexistente', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    requisitoRepository.findOne.mockResolvedValue(null);

    await expect(service.eliminar(1, 999)).rejects.toThrow(NotFoundException);
    expect(requisitoRepository.delete).not.toHaveBeenCalled();
  });
});
