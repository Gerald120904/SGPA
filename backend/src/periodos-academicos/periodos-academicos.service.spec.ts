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

    jest
      .spyOn(service as any, 'obtenerFechaActualLocal')
      .mockReturnValue('2027-01-20');

    const resultado = await service.listar();

    expect(periodoRepository.find).toHaveBeenCalledWith({
      order: {
        anio: 'DESC',
        ciclo: 'DESC',
      },
    });

    expect(resultado).toEqual(
      periodos.map((periodo) => ({
        ...periodo,
        transicionesEstado: [
          {
            estado: EstadoPeriodoAcademico.EN_PREPARACION,
            disponible: true,
            motivo: null,
          },
          {
            estado: EstadoPeriodoAcademico.CANCELADO,
            disponible: true,
            motivo: null,
          },
        ],
      })),
    );
  });

  it('informa que preparar está bloqueado cuando venció la fecha límite', async () => {
    periodoRepository.find.mockResolvedValue([
      crearPeriodo({ estado: EstadoPeriodoAcademico.BORRADOR }),
    ]);

    jest
      .spyOn(service as any, 'obtenerFechaActualLocal')
      .mockReturnValue('2027-01-21');

    const [resultado] = await service.listar();

    expect(resultado.transicionesEstado).toEqual([
      {
        estado: EstadoPeriodoAcademico.EN_PREPARACION,
        disponible: false,
        motivo: 'La fecha límite de disponibilidad docente ya venció.',
      },
      {
        estado: EstadoPeriodoAcademico.CANCELADO,
        disponible: true,
        motivo: null,
      },
    ]);
  });

  it('informa que iniciar está bloqueado antes de la fecha de inicio', async () => {
    periodoRepository.find.mockResolvedValue([
      crearPeriodo({ estado: EstadoPeriodoAcademico.EN_PREPARACION }),
    ]);

    jest
      .spyOn(service as any, 'obtenerFechaActualLocal')
      .mockReturnValue('2027-02-14');

    const [resultado] = await service.listar();

    expect(resultado.transicionesEstado).toEqual([
      {
        estado: EstadoPeriodoAcademico.EN_CURSO,
        disponible: false,
        motivo: 'El periodo podrá iniciarse a partir del 2027-02-15.',
      },
      {
        estado: EstadoPeriodoAcademico.CANCELADO,
        disponible: true,
        motivo: null,
      },
    ]);
  });

  it('informa que cerrar está bloqueado antes de la fecha de finalización', async () => {
    periodoRepository.find.mockResolvedValue([
      crearPeriodo({ estado: EstadoPeriodoAcademico.EN_CURSO }),
    ]);

    jest
      .spyOn(service as any, 'obtenerFechaActualLocal')
      .mockReturnValue('2027-06-24');

    const [resultado] = await service.listar();

    expect(resultado.transicionesEstado).toEqual([
      {
        estado: EstadoPeriodoAcademico.CERRADO,
        disponible: false,
        motivo: 'El periodo podrá cerrarse a partir del 2027-06-25.',
      },
    ]);
  });

  it.each([
    EstadoPeriodoAcademico.CERRADO,
    EstadoPeriodoAcademico.CANCELADO,
  ])('no ofrece transiciones para un periodo %s', async (estado) => {
    periodoRepository.find.mockResolvedValue([crearPeriodo({ estado })]);

    const [resultado] = await service.listar();

    expect(resultado.transicionesEstado).toEqual([]);
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

  it('genera correctamente el nombre y código para Verano (ciclo 3) con fechas que cruzan de año', async () => {
    const guardado = crearPeriodo({
      codigo: '2027-C3',
      nombre: 'Verano 2027',
      ciclo: 3,
      fechaInicio: '2027-12-01',
      fechaFin: '2028-02-05',
      fechaLimiteDisponibilidad: '2027-11-15',
    });

    periodoRepository.findOne.mockResolvedValue(null);
    periodoRepository.save.mockResolvedValue(guardado);

    const resultado = await service.crear({
      anio: 2027,
      ciclo: 3,
      fechaInicio: '2027-12-01',
      fechaFin: '2028-02-05',
      fechaLimiteDisponibilidad: '2027-11-15',
    });

    expect(periodoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: '2027-C3',
        nombre: 'Verano 2027',
        anio: 2027,
        ciclo: 3,
        fechaInicio: '2027-12-01',
        fechaFin: '2028-02-05',
        fechaLimiteDisponibilidad: '2027-11-15',
      }),
    );
    expect(resultado.nombre).toBe('Verano 2027');
    expect(resultado.codigo).toBe('2027-C3');
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
    ).rejects.toThrow('Ya existe el I Ciclo del año 2027.');

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza crear un periodo Verano duplicado con mensaje correspondiente', async () => {
    periodoRepository.findOne.mockResolvedValue(
      crearPeriodo({ ciclo: 3, codigo: '2027-C3', nombre: 'Verano 2027' }),
    );

    await expect(
      service.crear({
        anio: 2027,
        ciclo: 3,
        fechaInicio: '2027-12-01',
        fechaFin: '2028-02-05',
        fechaLimiteDisponibilidad: '2027-11-15',
      }),
    ).rejects.toThrow('Ya existe el Verano del año 2027.');

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

  it.each([
    ['año', { anio: 2028 }],
    ['ciclo', { ciclo: 2 }],
    ['fecha de inicio', { fechaInicio: '2027-02-20' }],
    ['fecha de finalización', { fechaFin: '2027-06-30' }],
    [
      'fecha límite de disponibilidad',
      { fechaLimiteDisponibilidad: '2027-01-25' },
    ],
  ])(
    'rechaza modificar %s cuando el periodo está EN_PREPARACION',
    async (_campo, cambios) => {
      const periodo = crearPeriodo({
        estado: EstadoPeriodoAcademico.EN_PREPARACION,
      });

      periodoRepository.findOne.mockResolvedValue(periodo);

      await expect(service.actualizar(1, cambios)).rejects.toThrow(
        'Cuando el periodo académico está en preparación únicamente pueden modificarse las observaciones.',
      );

      expect(periodoRepository.save).not.toHaveBeenCalled();
    },
  );

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

    jest
      .spyOn(service as any, 'obtenerFechaActualLocal')
      .mockReturnValue('2027-01-20');

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

    jest
      .spyOn(service as any, 'obtenerFechaActualLocal')
      .mockReturnValue('2027-02-15');

    const resultado = await service.cambiarEstado(
      1,
      EstadoPeriodoAcademico.EN_CURSO,
    );

    expect(resultado.estado).toBe(EstadoPeriodoAcademico.EN_CURSO);
  });

  it('rechaza iniciar un segundo periodo EN_CURSO', async () => {
    const periodoNuevo = crearPeriodo({
      id: 2,
      codigo: '2027-C2',
      nombre: 'II Ciclo 2027',
      ciclo: 2,
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
    });

    const periodoEnCurso = crearPeriodo({
      id: 1,
      codigo: '2027-C1',
      nombre: 'I Ciclo 2027',
      ciclo: 1,
      estado: EstadoPeriodoAcademico.EN_CURSO,
    });

    periodoRepository.findOne
      .mockResolvedValueOnce(periodoNuevo)
      .mockResolvedValueOnce(periodoEnCurso);

    await expect(
      service.cambiarEstado(2, EstadoPeriodoAcademico.EN_CURSO),
    ).rejects.toThrow(
      'Ya existe un periodo académico en curso: 2027-C1.',
    );

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('permite iniciar un periodo si no existe otro EN_CURSO', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
    });

    periodoRepository.findOne
      .mockResolvedValueOnce(periodo)
      .mockResolvedValueOnce(null);

    periodoRepository.save.mockImplementation(async (entidad) => entidad);

    jest
      .spyOn(service as any, 'obtenerFechaActualLocal')
      .mockReturnValue('2027-02-15');

    const resultado = await service.cambiarEstado(
      1,
      EstadoPeriodoAcademico.EN_CURSO,
    );

    expect(resultado.estado).toBe(EstadoPeriodoAcademico.EN_CURSO);
    expect(periodoRepository.save).toHaveBeenCalledTimes(1);
  });

  it('permite cambiar EN_CURSO a CERRADO', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.EN_CURSO,
    });

    periodoRepository.findOne.mockResolvedValue(periodo);
    periodoRepository.save.mockImplementation(async (entidad) => entidad);

    jest
      .spyOn(service as any, 'obtenerFechaActualLocal')
      .mockReturnValue('2027-06-25');

    const resultado = await service.cambiarEstado(
      1,
      EstadoPeriodoAcademico.CERRADO,
    );

    expect(resultado.estado).toBe(EstadoPeriodoAcademico.CERRADO);
  });

  it('rechaza pasar a EN_PREPARACION si la fecha límite de disponibilidad ya venció', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.BORRADOR,
      fechaLimiteDisponibilidad: '2027-01-20',
    });

    periodoRepository.findOne
      .mockResolvedValueOnce(periodo)
      .mockResolvedValueOnce(null);

    jest
      .spyOn(service as any, 'obtenerFechaActualLocal')
      .mockReturnValue('2027-01-21');

    await expect(
      service.cambiarEstado(1, EstadoPeriodoAcademico.EN_PREPARACION),
    ).rejects.toThrow(
      'No se puede pasar el periodo a preparación porque la fecha límite de disponibilidad docente ya venció.',
    );

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza iniciar un periodo antes de su fecha de inicio', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
      fechaInicio: '2027-02-15',
    });

    periodoRepository.findOne
      .mockResolvedValueOnce(periodo)
      .mockResolvedValueOnce(null);

    jest
      .spyOn(service as any, 'obtenerFechaActualLocal')
      .mockReturnValue('2027-02-14');

    await expect(
      service.cambiarEstado(1, EstadoPeriodoAcademico.EN_CURSO),
    ).rejects.toThrow(
      'No se puede iniciar el periodo académico antes de su fecha de inicio.',
    );

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza cerrar un periodo antes de su fecha de finalización', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.EN_CURSO,
      fechaFin: '2027-06-25',
    });

    periodoRepository.findOne.mockResolvedValue(periodo);

    jest
      .spyOn(service as any, 'obtenerFechaActualLocal')
      .mockReturnValue('2027-06-24');

    await expect(
      service.cambiarEstado(1, EstadoPeriodoAcademico.CERRADO),
    ).rejects.toThrow(
      'No se puede cerrar el periodo académico antes de su fecha de finalización.',
    );

    expect(periodoRepository.save).not.toHaveBeenCalled();
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

  it('rechaza abrir un segundo periodo EN_PREPARACION', async () => {
    const periodoNuevo = crearPeriodo({
      id: 2,
      codigo: '2027-C2',
      nombre: 'II Ciclo 2027',
      ciclo: 2,
      estado: EstadoPeriodoAcademico.BORRADOR,
    });

    const periodoYaAbierto = crearPeriodo({
      id: 1,
      codigo: '2027-C1',
      nombre: 'I Ciclo 2027',
      ciclo: 1,
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
    });

    periodoRepository.findOne
      .mockResolvedValueOnce(periodoNuevo)
      .mockResolvedValueOnce(periodoYaAbierto);

    await expect(
      service.cambiarEstado(2, EstadoPeriodoAcademico.EN_PREPARACION),
    ).rejects.toThrow(ConflictException);

    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it('permite cambiar a EN_PREPARACION si no existe otro periodo abierto', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.BORRADOR,
    });

    periodoRepository.findOne
      .mockResolvedValueOnce(periodo)
      .mockResolvedValueOnce(null);

    periodoRepository.save.mockImplementation(async (entidad) => entidad);

    jest
      .spyOn(service as any, 'obtenerFechaActualLocal')
      .mockReturnValue('2027-01-20');

    const resultado = await service.cambiarEstado(
      1,
      EstadoPeriodoAcademico.EN_PREPARACION,
    );

    expect(resultado.estado).toBe(EstadoPeriodoAcademico.EN_PREPARACION);

    expect(periodoRepository.save).toHaveBeenCalledTimes(1);
  });

  it('mantiene EN_PREPARACION del mismo periodo sin buscar otro periodo', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
    });

    periodoRepository.findOne.mockResolvedValue(periodo);

    periodoRepository.save.mockImplementation(async (entidad) => entidad);

    const resultado = await service.cambiarEstado(
      1,
      EstadoPeriodoAcademico.EN_PREPARACION,
    );

    expect(resultado.estado).toBe(EstadoPeriodoAcademico.EN_PREPARACION);

    expect(periodoRepository.findOne).toHaveBeenCalledTimes(1);
  });

  it('ejecuta transiciones automáticas cerrando períodos vencidos e iniciando en preparación', async () => {
    jest.spyOn(service as any, 'obtenerFechaActualLocal').mockReturnValue('2027-07-01');

    const periodoCurso = crearPeriodo({
      codigo: '2027-C1',
      estado: EstadoPeriodoAcademico.EN_CURSO,
      fechaFin: '2027-06-25',
    });
    const periodoPrep = crearPeriodo({
      codigo: '2027-C2',
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
      fechaInicio: '2027-07-01',
      fechaFin: '2027-12-01',
    });

    periodoRepository.findOne
      .mockResolvedValueOnce(periodoCurso) // 1. find EN_CURSO
      .mockResolvedValueOnce(null)          // 2. find EN_CURSO after closing
      .mockResolvedValueOnce(periodoPrep);  // 3. find EN_PREPARACION

    periodoRepository.save.mockImplementation(async (entidad) => entidad);

    const resultado = await service.ejecutarTransicionesAutomaticas();
    expect(resultado.cerrados).toContain('2027-C1');
    expect(resultado.iniciados).toContain('2027-C2');
    expect(periodoCurso.estado).toBe(EstadoPeriodoAcademico.CERRADO);
    expect(periodoPrep.estado).toBe(EstadoPeriodoAcademico.EN_CURSO);
  });

  it('no inicia un período en preparación cuya fecha de fin ya pasó', async () => {
    jest.spyOn(service as any, 'obtenerFechaActualLocal').mockReturnValue('2027-07-01');
    periodoRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(crearPeriodo({
        estado: EstadoPeriodoAcademico.EN_PREPARACION,
        fechaInicio: '2027-02-15',
        fechaFin: '2027-06-25',
      }));

    await expect(service.ejecutarTransicionesAutomaticas()).resolves.toEqual({ cerrados: [], iniciados: [] });
    expect(periodoRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    { SGPA_TEST_MODE: 'true', NODE_ENV: 'development', DB_DATABASE: 'sgpa_test' },
    { SGPA_TEST_MODE: ' TRUE ', NODE_ENV: 'development', DB_DATABASE: 'sgpa_test' },
    { SGPA_TEST_MODE: 'false', NODE_ENV: 'test', DB_DATABASE: 'sgpa' },
    { SGPA_TEST_MODE: 'false', NODE_ENV: 'development', DB_DATABASE: 'sgpa_isolated_audit' },
  ])('no consulta ni escribe períodos al arrancar en entorno de pruebas %j', async (entorno) => {
    const anteriores = {
      SGPA_TEST_MODE: process.env.SGPA_TEST_MODE,
      NODE_ENV: process.env.NODE_ENV,
      DB_DATABASE: process.env.DB_DATABASE,
    };
    Object.assign(process.env, entorno);
    try {
      const spy = jest.spyOn(service, 'ejecutarTransicionesAutomaticas');
      await service.onApplicationBootstrap();
      expect(spy).not.toHaveBeenCalled();
      expect(periodoRepository.findOne).not.toHaveBeenCalled();
      expect(periodoRepository.save).not.toHaveBeenCalled();
      expect((service as any).timerTransiciones).toBeNull();
    } finally {
      for (const [clave, valor] of Object.entries(anteriores)) {
        if (valor === undefined) delete process.env[clave];
        else process.env[clave] = valor;
      }
      service.onModuleDestroy();
    }
  });

  it('ejecuta transiciones institucionales en onApplicationBootstrap y limpia el temporizador', async () => {
    const anteriores = {
      SGPA_TEST_MODE: process.env.SGPA_TEST_MODE,
      NODE_ENV: process.env.NODE_ENV,
      DB_DATABASE: process.env.DB_DATABASE,
    };
    Object.assign(process.env, { SGPA_TEST_MODE: 'false', NODE_ENV: 'production', DB_DATABASE: 'sgpa' });
    try {
      const spy = jest.spyOn(service, 'ejecutarTransicionesAutomaticas').mockResolvedValue({ cerrados: [], iniciados: [] });
      await service.onApplicationBootstrap();
      expect(spy).toHaveBeenCalledTimes(1);
      expect((service as any).timerTransiciones).not.toBeNull();
    } finally {
      service.onModuleDestroy();
      for (const [clave, valor] of Object.entries(anteriores)) {
        if (valor === undefined) delete process.env[clave];
        else process.env[clave] = valor;
      }
    }
    expect((service as any).timerTransiciones).toBeNull();
  });
});
