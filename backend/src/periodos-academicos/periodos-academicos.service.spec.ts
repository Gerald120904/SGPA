import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { EstadoPeriodoAcademico } from './constants/estado-periodo-academico.constant';
import { PeriodoAcademico } from './entities/periodo-academico.entity';
import { PeriodosAcademicosService } from './periodos-academicos.service';

describe('PeriodosAcademicosService', () => {
  let service: PeriodosAcademicosService;

  let periodoRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const crearPeriodo = (
    cambios: Partial<PeriodoAcademico> = {},
  ): PeriodoAcademico => ({
    id: 1,
    codigo: '2027-C1',
    nombre: 'I Ciclo 2027',
    anio: 2027,
    ciclo: 1,
    fechaInicio: '2027-02-15',
    fechaFin: '2027-06-25',
    fechaLimiteDisponibilidad: '2027-01-20',
    estado: EstadoPeriodoAcademico.BORRADOR,
    observaciones: null,
    createdAt: new Date('2026-09-02T00:00:00.000Z'),
    updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    ...cambios,
  });

  beforeEach(() => {
    periodoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<PeriodoAcademico>) => datos),
      save: jest.fn(),
    };

    service = new PeriodosAcademicosService(
      periodoRepository as unknown as Repository<PeriodoAcademico>,
    );

    jest.clearAllMocks();
  });

  it('lista los periodos ordenados por año y ciclo descendente', async () => {
    const periodos = [
      crearPeriodo({
        id: 2,
        codigo: '2027-C2',
        nombre: 'II Ciclo 2027',
        ciclo: 2,
      }),
      crearPeriodo(),
    ];

    periodoRepository.find.mockResolvedValue(periodos);

    const resultado = await service.listar();

    expect(periodoRepository.find).toHaveBeenCalledWith({
      order: {
        anio: 'DESC',
        ciclo: 'DESC',
      },
    });

    expect(resultado).toEqual(periodos);
  });

  it('obtiene un periodo por id', async () => {
    const periodo = crearPeriodo();

    periodoRepository.findOne.mockResolvedValue(periodo);

    const resultado = await service.obtenerPorId(1);

    expect(periodoRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 1,
      },
    });

    expect(resultado).toEqual(periodo);
  });

  it('devuelve 404 si el periodo no existe', async () => {
    periodoRepository.findOne.mockResolvedValue(null);

    await expect(service.obtenerPorId(999)).rejects.toThrow(NotFoundException);
  });

  it('crea un periodo y genera código, nombre y estado automáticamente', async () => {
    const guardado = crearPeriodo({
      observaciones: 'Primer ciclo',
    });

    periodoRepository.findOne.mockResolvedValue(null);
    periodoRepository.save.mockResolvedValue(guardado);

    const resultado = await service.crear({
      anio: 2027,
      ciclo: 1,
      fechaInicio: '2027-02-15',
      fechaFin: '2027-06-25',
      fechaLimiteDisponibilidad: '2027-01-20',
      observaciones: ' Primer ciclo ',
    });

    expect(periodoRepository.create).toHaveBeenCalledWith({
      codigo: '2027-C1',
      nombre: 'I Ciclo 2027',
      anio: 2027,
      ciclo: 1,
      fechaInicio: '2027-02-15',
      fechaFin: '2027-06-25',
      fechaLimiteDisponibilidad: '2027-01-20',
      estado: EstadoPeriodoAcademico.BORRADOR,
      observaciones: 'Primer ciclo',
    });

    expect(periodoRepository.save).toHaveBeenCalled();
    expect(resultado).toEqual(guardado);
  });

  it('genera correctamente el nombre del segundo ciclo', async () => {
    const guardado = crearPeriodo({
      codigo: '2027-C2',
      nombre: 'II Ciclo 2027',
      ciclo: 2,
    });

    periodoRepository.findOne.mockResolvedValue(null);
    periodoRepository.save.mockResolvedValue(guardado);

    await service.crear({
      anio: 2027,
      ciclo: 2,
      fechaInicio: '2027-07-15',
      fechaFin: '2027-11-25',
      fechaLimiteDisponibilidad: '2027-06-20',
    });

    expect(periodoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: '2027-C2',
        nombre: 'II Ciclo 2027',
        ciclo: 2,
      }),
    );
  });

  it('convierte observaciones vacías en null', async () => {
    periodoRepository.findOne.mockResolvedValue(null);
    periodoRepository.save.mockResolvedValue(crearPeriodo());

    await service.crear({
      anio: 2027,
      ciclo: 1,
      fechaInicio: '2027-02-15',
      fechaFin: '2027-06-25',
      fechaLimiteDisponibilidad: '2027-01-20',
      observaciones: '   ',
    });

    expect(periodoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        observaciones: null,
      }),
    );
  });

  it('rechaza crear un periodo duplicado por año y ciclo', async () => {
    periodoRepository.findOne.mockResolvedValue(crearPeriodo());

    await expect(
      service.crear({
        anio: 2027,
        ciclo: 1,
        fechaInicio: '2027-02-15',
        fechaFin: '2027-06-25',
        fechaLimiteDisponibilidad: '2027-01-20',
      }),
    ).rejects.toThrow(ConflictException);

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza una fecha final igual a la fecha inicial', async () => {
    periodoRepository.findOne.mockResolvedValue(null);

    await expect(
      service.crear({
        anio: 2027,
        ciclo: 1,
        fechaInicio: '2027-02-15',
        fechaFin: '2027-02-15',
        fechaLimiteDisponibilidad: '2027-01-20',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza una fecha final anterior a la fecha inicial', async () => {
    periodoRepository.findOne.mockResolvedValue(null);

    await expect(
      service.crear({
        anio: 2027,
        ciclo: 1,
        fechaInicio: '2027-02-15',
        fechaFin: '2027-01-30',
        fechaLimiteDisponibilidad: '2027-01-20',
      }),
    ).rejects.toThrow(
      'La fecha de finalización debe ser posterior a la fecha de inicio.',
    );

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza una fecha límite docente igual al inicio', async () => {
    periodoRepository.findOne.mockResolvedValue(null);

    await expect(
      service.crear({
        anio: 2027,
        ciclo: 1,
        fechaInicio: '2027-02-15',
        fechaFin: '2027-06-25',
        fechaLimiteDisponibilidad: '2027-02-15',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza una fecha límite docente posterior al inicio', async () => {
    periodoRepository.findOne.mockResolvedValue(null);

    await expect(
      service.crear({
        anio: 2027,
        ciclo: 1,
        fechaInicio: '2027-02-15',
        fechaFin: '2027-06-25',
        fechaLimiteDisponibilidad: '2027-02-20',
      }),
    ).rejects.toThrow(
      'La fecha límite de disponibilidad docente debe ser anterior al inicio del periodo académico.',
    );
  });

  it('actualiza un periodo en borrador y regenera código y nombre', async () => {
    const periodo = crearPeriodo();

    periodoRepository.findOne
      .mockResolvedValueOnce(periodo)
      .mockResolvedValueOnce(null);
    periodoRepository.save.mockImplementation(async (entidad) => entidad);

    const resultado = await service.actualizar(1, {
      anio: 2028,
      ciclo: 2,
      fechaInicio: '2028-07-15',
      fechaFin: '2028-11-20',
      fechaLimiteDisponibilidad: '2028-06-15',
      observaciones: ' Segundo ciclo ',
    });

    expect(periodoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        codigo: '2028-C2',
        nombre: 'II Ciclo 2028',
        anio: 2028,
        ciclo: 2,
        fechaInicio: '2028-07-15',
        fechaFin: '2028-11-20',
        fechaLimiteDisponibilidad: '2028-06-15',
        observaciones: 'Segundo ciclo',
      }),
    );

    expect(resultado.codigo).toBe('2028-C2');
    expect(resultado.nombre).toBe('II Ciclo 2028');
  });

  it('permite actualizar un periodo en preparación', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
    });

    periodoRepository.findOne
      .mockResolvedValueOnce(periodo)
      .mockResolvedValueOnce(null);
    periodoRepository.save.mockImplementation(async (entidad) => entidad);

    const resultado = await service.actualizar(1, {
      observaciones: 'Actualizado',
    });

    expect(resultado.observaciones).toBe('Actualizado');
  });

  it('impide modificar un periodo en curso', async () => {
    periodoRepository.findOne.mockResolvedValue(
      crearPeriodo({ estado: EstadoPeriodoAcademico.EN_CURSO }),
    );

    await expect(
      service.actualizar(1, { observaciones: 'Intento de cambio' }),
    ).rejects.toThrow(
      'No se puede modificar un periodo académico que ya está en curso.',
    );

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('impide modificar un periodo cerrado', async () => {
    periodoRepository.findOne.mockResolvedValue(
      crearPeriodo({ estado: EstadoPeriodoAcademico.CERRADO }),
    );

    await expect(
      service.actualizar(1, { observaciones: 'Intento de cambio' }),
    ).rejects.toThrow('No se puede modificar un periodo académico cerrado.');

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('impide modificar un periodo cancelado', async () => {
    periodoRepository.findOne.mockResolvedValue(
      crearPeriodo({ estado: EstadoPeriodoAcademico.CANCELADO }),
    );

    await expect(
      service.actualizar(1, { observaciones: 'Intento de cambio' }),
    ).rejects.toThrow('No se puede modificar un periodo académico cancelado.');

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('permite cambiar BORRADOR a EN_PREPARACION', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.BORRADOR,
    });

    periodoRepository.findOne.mockResolvedValue(periodo);
    periodoRepository.save.mockImplementation(async (entidad) => entidad);

    const resultado = await service.cambiarEstado(
      1,
      EstadoPeriodoAcademico.EN_PREPARACION,
    );

    expect(resultado.estado).toBe(EstadoPeriodoAcademico.EN_PREPARACION);
  });

  it('permite cancelar un periodo en borrador', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.BORRADOR,
    });

    periodoRepository.findOne.mockResolvedValue(periodo);
    periodoRepository.save.mockImplementation(async (entidad) => entidad);

    const resultado = await service.cambiarEstado(
      1,
      EstadoPeriodoAcademico.CANCELADO,
    );

    expect(resultado.estado).toBe(EstadoPeriodoAcademico.CANCELADO);
  });

  it('permite cambiar EN_PREPARACION a EN_CURSO', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
    });

    periodoRepository.findOne.mockResolvedValue(periodo);
    periodoRepository.save.mockImplementation(async (entidad) => entidad);

    const resultado = await service.cambiarEstado(
      1,
      EstadoPeriodoAcademico.EN_CURSO,
    );

    expect(resultado.estado).toBe(EstadoPeriodoAcademico.EN_CURSO);
  });

  it('permite cambiar EN_CURSO a CERRADO', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.EN_CURSO,
    });

    periodoRepository.findOne.mockResolvedValue(periodo);
    periodoRepository.save.mockImplementation(async (entidad) => entidad);

    const resultado = await service.cambiarEstado(
      1,
      EstadoPeriodoAcademico.CERRADO,
    );

    expect(resultado.estado).toBe(EstadoPeriodoAcademico.CERRADO);
  });

  it('rechaza cambiar directamente BORRADOR a CERRADO', async () => {
    periodoRepository.findOne.mockResolvedValue(
      crearPeriodo({ estado: EstadoPeriodoAcademico.BORRADOR }),
    );

    await expect(
      service.cambiarEstado(1, EstadoPeriodoAcademico.CERRADO),
    ).rejects.toThrow(BadRequestException);

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza regresar EN_CURSO a EN_PREPARACION', async () => {
    periodoRepository.findOne.mockResolvedValue(
      crearPeriodo({ estado: EstadoPeriodoAcademico.EN_CURSO }),
    );

    await expect(
      service.cambiarEstado(1, EstadoPeriodoAcademico.EN_PREPARACION),
    ).rejects.toThrow(BadRequestException);

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza cambiar el estado de un periodo cerrado', async () => {
    periodoRepository.findOne.mockResolvedValue(
      crearPeriodo({ estado: EstadoPeriodoAcademico.CERRADO }),
    );

    await expect(
      service.cambiarEstado(1, EstadoPeriodoAcademico.EN_CURSO),
    ).rejects.toThrow(BadRequestException);

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('permite conservar el mismo estado', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.BORRADOR,
    });

    periodoRepository.findOne.mockResolvedValue(periodo);
    periodoRepository.save.mockImplementation(async (entidad) => entidad);

    const resultado = await service.cambiarEstado(
      1,
      EstadoPeriodoAcademico.BORRADOR,
    );

    expect(resultado.estado).toBe(EstadoPeriodoAcademico.BORRADOR);
  });

  it('convierte ER_DUP_ENTRY de MySQL en ConflictException al crear', async () => {
    periodoRepository.findOne.mockResolvedValue(null);
    periodoRepository.save.mockRejectedValue({
      code: 'ER_DUP_ENTRY',
    });

    await expect(
      service.crear({
        anio: 2027,
        ciclo: 1,
        fechaInicio: '2027-02-15',
        fechaFin: '2027-06-25',
        fechaLimiteDisponibilidad: '2027-01-20',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
