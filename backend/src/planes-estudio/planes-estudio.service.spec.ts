import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { GradoAcademico } from '../carreras/constants/grado-academico.constant';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { EstadoPlanEstudio } from './constants/estado-plan-estudio.constant';
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
  const alcance = {
    tipoCuentaJerarquica: jest.fn().mockResolvedValue(null),
    obtenerCarrerasAutorizadas: jest.fn(),
    puedeEjecutar: jest.fn(),
  };

  const carrera = {
    id: 1,
    codigo: 'EIF',
    nombre: 'Ingeniería en Sistemas',
    descripcion: null,
    activo: true,
    estado: EstadoPlanEstudio.VIGENTE,
    motivoUltimoCambio: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as Carrera;

  const crearPlan = (cambios: Partial<PlanEstudio> = {}): PlanEstudio => ({
    id: 1,
    carreraId: 1,
    grado: GradoAcademico.BACHILLERATO,
    codigo: 'BA-INFORM 2012-10',
    nombre: 'Plan de Bachillerato 2012-10',
    descripcion: 'Plan de estudios',
    activo: true,
    carrera,
    estado: EstadoPlanEstudio.VIGENTE,
    motivoUltimoCambio: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...cambios,
    versionAnteriorId: cambios.versionAnteriorId ?? null,
    numeroVersion: cambios.numeroVersion ?? 1,
    versionAnterior: cambios.versionAnterior ?? null,
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
      alcance as never,
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

  it('filtra el listado en SQL para una cuenta jerÃ¡rquica', async () => {
    alcance.tipoCuentaJerarquica.mockResolvedValueOnce('COORDINADOR');
    alcance.obtenerCarrerasAutorizadas.mockResolvedValueOnce([1, 2]);
    alcance.puedeEjecutar.mockImplementation(async (_u: number, _p: string, carreraId: number) => carreraId === 1);
    planRepository.find.mockResolvedValue([crearPlan()]);
    await service.listar(9);
    expect(planRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { carreraId: expect.anything() },
    }));
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
      grado: GradoAcademico.BACHILLERATO,
      codigo: ' ba-inform 2012-10 ',
      nombre: ' Plan de Bachillerato 2012-10 ',
      descripcion: ' Plan de estudios ',
    });

    expect(planRepository.create).toHaveBeenCalledWith({
      carreraId: 1,
      grado: GradoAcademico.BACHILLERATO,
      codigo: 'BA-INFORM 2012-10',
      nombre: 'Plan de Bachillerato 2012-10',
      descripcion: 'Plan de estudios',
      activo: true,
      estado: EstadoPlanEstudio.BORRADOR,
      numeroVersion: 1,
      versionAnteriorId: null,
    });
    expect(resultado).toEqual(guardado);
  });

  it('rechaza una carrera inexistente', async () => {
    carreraRepository.findOne.mockResolvedValue(null);

    await expect(
      service.crear({
        carreraId: 999,
        grado: GradoAcademico.BACHILLERATO,
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
        grado: GradoAcademico.BACHILLERATO,
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
        grado: GradoAcademico.BACHILLERATO,
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
        grado: GradoAcademico.BACHILLERATO,
        codigo: 'BA-INFORM 2026',
        nombre: 'Plan actualizado',
      }),
    );
    expect(resultado).toEqual(actualizado);
  });

  it('bloquea el cambio de grado sobre una versión existente', async () => {
    planRepository.findOne.mockResolvedValue(crearPlan());
    await expect(service.actualizar(1, { grado: GradoAcademico.LICENCIATURA }))
      .rejects.toThrow('nueva versión');
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it('audita de forma transaccional una edición menor realizada por un usuario', async () => {
    const plan = crearPlan();
    const repoTx = { findOne: jest.fn().mockResolvedValueOnce(plan).mockResolvedValueOnce(null),
      save: jest.fn().mockResolvedValue(plan) };
    const manager = { getRepository: jest.fn().mockReturnValue(repoTx), query: jest.fn().mockResolvedValue([]) };
    const dataSource = { transaction: jest.fn(async (callback) => callback(manager)) };
    planRepository.findOne.mockResolvedValue(crearPlan({ nombre: 'Nombre corregido' }));
    service = new PlanesEstudioService(planRepository as unknown as Repository<PlanEstudio>,
      carreraRepository as unknown as Repository<Carrera>, alcance as never, undefined, dataSource as never);

    await service.actualizar(1, { nombre: 'Nombre corregido' }, 9);

    expect(repoTx.save).toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('EDICION_MENOR'),
      expect.arrayContaining([1, 9]));
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

  it('cierra nuevos ingresos sin impedir que los estudiantes actuales sigan en el plan', async () => {
    const original = crearPlan();
    const resultante = crearPlan({ estado: EstadoPlanEstudio.EN_TRANSICION, activo: true });
    planRepository.findOne.mockResolvedValueOnce(original).mockResolvedValueOnce(resultante);
    const repoEnTransaccion = {
      findOne: jest.fn().mockResolvedValue(original),
      save: jest.fn().mockResolvedValue(resultante),
    };
    const manager = { getRepository: jest.fn().mockReturnValue(repoEnTransaccion), query: jest.fn() };
    const dataSource = { transaction: jest.fn(async (callback) => callback(manager)) };
    service = new PlanesEstudioService(
      planRepository as unknown as Repository<PlanEstudio>,
      carreraRepository as unknown as Repository<Carrera>,
      alcance as never, undefined, dataSource as never,
    );

    const resultado = await service.cambiarEstado(1, {
      activo: false, motivo: 'Cierre de admisiones 2027',
    }, 27);

    expect(resultado.estado).toBe(EstadoPlanEstudio.EN_TRANSICION);
    expect(repoEnTransaccion.save).toHaveBeenCalledWith(expect.objectContaining({
      estado: EstadoPlanEstudio.EN_TRANSICION, activo: true,
    }));
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO auditoria_planes_estudio'),
      [1, 'CAMBIO_ESTADO', 'VIGENTE', 'EN_TRANSICION', 'Cierre de admisiones 2027', 27],
    );
    expect(planRepository.update).not.toHaveBeenCalled();
  });

  it('impide archivo definitivo con estudiantes activos (no impide EN_TRANSICION)', async () => {
    planRepository.findOne.mockResolvedValue(crearPlan());
    const repoEnTransaccion = { findOne: jest.fn().mockResolvedValue(crearPlan()), save: jest.fn() };
    const manager = { getRepository: jest.fn().mockReturnValue(repoEnTransaccion),
      query: jest.fn().mockResolvedValue([{ total: 2 }]) };
    const dataSource = { transaction: jest.fn(async (callback) => callback(manager)) };
    service = new PlanesEstudioService(
      planRepository as unknown as Repository<PlanEstudio>,
      carreraRepository as unknown as Repository<Carrera>,
      alcance as never, undefined, dataSource as never,
    );
    await expect(service.cambiarEstado(1, {
      estado: EstadoPlanEstudio.CERRADO, motivo: 'Archivo definitivo autorizado',
    }, 27)).rejects.toThrow('Use EN_TRANSICION');
    expect(repoEnTransaccion.save).not.toHaveBeenCalled();
  });

  it('no oculta fallos de auditoria y no hace escrituras fuera de transaccion', async () => {
    planRepository.findOne.mockResolvedValue(crearPlan());
    const repoEnTransaccion = { findOne: jest.fn().mockResolvedValue(crearPlan()),
      save: jest.fn().mockResolvedValue({}) };
    const manager = { getRepository: jest.fn().mockReturnValue(repoEnTransaccion),
      query: jest.fn().mockRejectedValue(new Error('DB sin tabla de auditoria')) };
    const dataSource = { transaction: jest.fn(async (callback) => callback(manager)) };
    service = new PlanesEstudioService(
      planRepository as unknown as Repository<PlanEstudio>,
      carreraRepository as unknown as Repository<Carrera>,
      alcance as never, undefined, dataSource as never,
    );
    await expect(service.cambiarEstado(1, {
      activo: false, motivo: 'Cierre de admisiones 2027',
    }, 27)).rejects.toThrow('DB sin tabla de auditoria');
    expect(planRepository.update).not.toHaveBeenCalled();
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
        grado: GradoAcademico.BACHILLERATO,
        codigo: 'BA-INFORM 2012-10',
        nombre: 'Plan de Bachillerato',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('audita una edicion propuesta por asistente dentro de la transaccion', async () => {
    const plan = crearPlan();
    const repoTx = { findOne: jest.fn().mockResolvedValue(plan), save: jest.fn().mockResolvedValue(plan) };
    const manager = { getRepository: jest.fn().mockReturnValue(repoTx), query: jest.fn().mockResolvedValue([]) };
    alcance.puedeEjecutar.mockResolvedValueOnce(true);

    await service.actualizarDesdeSolicitud(9, 12, 1, { nombre: 'Nombre corregido' },
      service.huellaPlan(plan), manager as never);

    expect(repoTx.save).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('EDICION_MENOR'),
      expect.arrayContaining([1, 9, expect.stringContaining('"propuestaPorUsuarioId":12')]));
  });

  it('impide cambiar el grado mediante una solicitud de asistente', async () => {
    const plan = crearPlan();
    const repoTx = { findOne: jest.fn().mockResolvedValue(plan), save: jest.fn() };
    const manager = { getRepository: jest.fn().mockReturnValue(repoTx), query: jest.fn() };
    alcance.puedeEjecutar.mockResolvedValueOnce(true);

    await expect(service.actualizarDesdeSolicitud(9, 12, 1,
      { grado: GradoAcademico.LICENCIATURA }, service.huellaPlan(plan), manager as never))
      .rejects.toThrow(ConflictException);
    expect(repoTx.save).not.toHaveBeenCalled();
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('impide activar por solicitud un borrador derivado y saltarse la activación auditada', async () => {
    const draft = crearPlan({ estado: EstadoPlanEstudio.BORRADOR, versionAnteriorId: 1, numeroVersion: 2 });
    const repoTx = { findOne: jest.fn().mockResolvedValue(draft), save: jest.fn() };
    const manager = { getRepository: jest.fn().mockReturnValue(repoTx), query: jest.fn() };
    await expect(service.cambiarEstadoDesdeSolicitud(9, 12, draft.id, true,
      service.huellaPlan(draft), manager as never, 'Activar por solicitud'))
      .rejects.toThrow('El estado de una versión derivada debe cambiarse mediante el flujo auditado de activación.');
    expect(repoTx.save).not.toHaveBeenCalled();
    expect(manager.query).not.toHaveBeenCalled();
  });
});
