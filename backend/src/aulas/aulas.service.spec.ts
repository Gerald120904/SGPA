import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { OrigenAula } from './constants/origen-aula.constant';
import { TipoAula } from './constants/tipo-aula.constant';
import { TipoMobiliarioAula } from './constants/tipo-mobiliario-aula.constant';
import { TipoIndisponibilidadAula } from './constants/tipo-indisponibilidad-aula.constant';
import { TipoReservaAula } from './constants/tipo-reserva-aula.constant';
import { Aula } from './entities/aula.entity';
import { AulaEquipamiento } from './entities/aula-equipamiento.entity';
import { Equipamiento } from './entities/equipamiento.entity';
import { IndisponibilidadAula } from './entities/indisponibilidad-aula.entity';
import { ReservaAula } from './entities/reserva-aula.entity';
import { AuditoriaAula } from './entities/auditoria-aula.entity';
import { DisponibilidadAula } from './entities/disponibilidad-aula.entity';
import { PeriodosAcademicosService } from '../periodos-academicos/periodos-academicos.service';
import { EstadoPeriodoAcademico } from '../periodos-academicos/constants/estado-periodo-academico.constant';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { AulasService } from './aulas.service';

describe('AulasService', () => {
  let service: AulasService;

  let aulaRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let equipamientoRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let aulaEquipamientoRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let indisponibilidadAulaRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let reservaAulaRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let auditoriaAulaRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let disponibilidadAulaRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let periodosAcademicosService: {
    obtenerPorId: jest.Mock;
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
    estado: EstadoPeriodoAcademico.EN_PREPARACION,
    observaciones: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...cambios,
  });

  const crearAula = (cambios: Partial<Aula> = {}): Aula => ({
    id: 1,
    codigo: 'AULA-01',
    nombre: 'Aula 1',
    ubicacion: 'Edificio principal',
    capacidad: 40,
    tipo: TipoAula.AULA,
    tipoMobiliario: TipoMobiliarioAula.PUPITRE,
    origen: OrigenAula.UNA,
    activo: true,
    equipamientos: [],
    createdAt: new Date('2026-09-03T00:00:00-06:00'),
    updatedAt: new Date('2026-09-03T00:00:00-06:00'),
    ...cambios,
  });

  const crearDisponibilidad = (
    cambios: Partial<DisponibilidadAula> = {},
  ): DisponibilidadAula => ({
    id: 1,
    aulaId: 1,
    periodoId: 1,
    diaSemana: 1,
    horaInicio: '07:00:00',
    horaFin: '12:00:00',
    aula: crearAula(),
    periodo: crearPeriodo(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...cambios,
  });

  const crearEquipamiento = (
    cambios: Partial<Equipamiento> = {},
  ): Equipamiento => ({
    id: 1,
    nombre: 'Proyector',
    descripcion: 'Proyector multimedia',
    activo: true,
    createdAt: new Date('2026-09-03T00:00:00-06:00'),
    updatedAt: new Date('2026-09-03T00:00:00-06:00'),
    ...cambios,
  });

  const crearAulaEquipamiento = (
    cambios: Partial<AulaEquipamiento> = {},
  ): AulaEquipamiento => ({
    id: 1,
    aulaId: 1,
    equipamientoId: 1,
    cantidadTotal: 1,
    cantidadDisponible: 1,
    observaciones: null,
    activo: true,
    aula: crearAula(),
    equipamiento: crearEquipamiento(),
    createdAt: new Date('2026-09-03T00:00:00-06:00'),
    updatedAt: new Date('2026-09-03T00:00:00-06:00'),
    ...cambios,
  });

  const crearIndisponibilidad = (
    cambios: Partial<IndisponibilidadAula> = {},
  ): IndisponibilidadAula => ({
    id: 1,
    aulaId: 1,
    tipo: TipoIndisponibilidadAula.MANTENIMIENTO,
    fechaHoraInicio: new Date('2027-10-10T08:00:00-06:00'),
    fechaHoraFin: new Date('2027-10-10T10:00:00-06:00'),
    motivo: 'Mantenimiento preventivo',
    activo: true,
    aula: crearAula(),
    createdAt: new Date('2026-09-03T00:00:00-06:00'),
    updatedAt: new Date('2026-09-03T00:00:00-06:00'),
    ...cambios,
  });

  const crearReserva = (cambios: Partial<ReservaAula> = {}): ReservaAula => ({
    id: 1,
    aulaId: 1,
    tipo: TipoReservaAula.EXAMEN,
    titulo: 'Examen final',
    descripcion: null,
    fechaHoraInicio: new Date('2027-10-10T12:00:00-06:00'),
    fechaHoraFin: new Date('2027-10-10T14:00:00-06:00'),
    activo: true,
    aula: crearAula(),
    createdAt: new Date('2026-09-03T00:00:00-06:00'),
    updatedAt: new Date('2026-09-03T00:00:00-06:00'),
    ...cambios,
  });

  beforeEach(() => {
    aulaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<Aula>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };
    equipamientoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<Equipamiento>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };
    aulaEquipamientoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<AulaEquipamiento>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };
    indisponibilidadAulaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<IndisponibilidadAula>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };
    reservaAulaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<ReservaAula>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };
    auditoriaAulaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<AuditoriaAula>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };
    disponibilidadAulaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<DisponibilidadAula>) => datos),
      save: jest.fn(),
      delete: jest.fn(),
    };
    periodosAcademicosService = {
      obtenerPorId: jest.fn(),
    };
    periodosAcademicosService.obtenerPorId.mockResolvedValue(crearPeriodo());
    disponibilidadAulaRepository.find.mockResolvedValue([
      crearDisponibilidad({
        aulaId: 1,
        periodoId: 1,
        diaSemana: 1,
        horaInicio: '07:00:00',
        horaFin: '22:00:00',
      }),
    ]);

    indisponibilidadAulaRepository.find.mockResolvedValue([]);
    reservaAulaRepository.find.mockResolvedValue([]);

    service = new AulasService(
      aulaRepository as unknown as Repository<Aula>,
      equipamientoRepository as unknown as Repository<Equipamiento>,
      aulaEquipamientoRepository as unknown as Repository<AulaEquipamiento>,
      indisponibilidadAulaRepository as unknown as Repository<IndisponibilidadAula>,
      reservaAulaRepository as unknown as Repository<ReservaAula>,
      auditoriaAulaRepository as unknown as Repository<AuditoriaAula>,
      disponibilidadAulaRepository as unknown as Repository<DisponibilidadAula>,
      periodosAcademicosService as unknown as PeriodosAcademicosService,
    );

    jest.clearAllMocks();
  });

  it('lista las aulas ordenadas por nombre', async () => {
    const aulas = [
      crearAula(),
      crearAula({
        id: 2,
        codigo: 'LAB-01',
        nombre: 'Laboratorio 1',
        tipo: TipoAula.LABORATORIO,
      }),
    ];

    aulaRepository.find.mockResolvedValue(aulas);

    const resultado = await service.listar();

    expect(aulaRepository.find).toHaveBeenCalledWith({
      where: {},
      order: {
        nombre: 'ASC',
      },
    });

    expect(resultado).toEqual(aulas);
  });

  it('filtra aulas por tipo de mobiliario', async () => {
    aulaRepository.find.mockResolvedValue([]);

    await service.listar({
      tipoMobiliario: TipoMobiliarioAula.MESA_COMPUTADORA,
    });

    expect(aulaRepository.find).toHaveBeenCalledWith({
      where: {
        tipoMobiliario: TipoMobiliarioAula.MESA_COMPUTADORA,
      },
      order: {
        nombre: 'ASC',
      },
    });
  });

  it('obtiene un aula por id', async () => {
    const aula = crearAula();

    aulaRepository.findOne.mockResolvedValue(aula);

    const resultado = await service.obtenerPorId(1);

    expect(aulaRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 1,
      },
    });

    expect(resultado).toEqual(aula);
  });

  it('devuelve 404 si el aula no existe', async () => {
    aulaRepository.findOne.mockResolvedValue(null);

    await expect(service.obtenerPorId(999)).rejects.toThrow(NotFoundException);
  });

  it('crea un aula normalizando código, nombre y ubicación', async () => {
    aulaRepository.findOne.mockResolvedValue(null);

    const aulaGuardada = crearAula();

    aulaRepository.save.mockResolvedValue(aulaGuardada);

    const resultado = await service.crear({
      codigo: ' aula-01 ',
      nombre: ' Aula 1 ',
      ubicacion: ' Edificio principal ',
      capacidad: 40,
      tipo: TipoAula.AULA,
      tipoMobiliario: TipoMobiliarioAula.PUPITRE,
      origen: OrigenAula.UNA,
    });

    expect(aulaRepository.create).toHaveBeenCalledWith({
      codigo: 'AULA-01',
      nombre: 'Aula 1',
      ubicacion: 'Edificio principal',
      capacidad: 40,
      tipo: TipoAula.AULA,
      tipoMobiliario: TipoMobiliarioAula.PUPITRE,
      origen: OrigenAula.UNA,
      activo: true,
    });

    expect(resultado).toEqual(aulaGuardada);
  });

  it('convierte ubicación vacía en null al crear', async () => {
    aulaRepository.findOne.mockResolvedValue(null);

    aulaRepository.save.mockResolvedValue(
      crearAula({
        ubicacion: null,
      }),
    );

    await service.crear({
      codigo: 'AULA-01',
      nombre: 'Aula 1',
      ubicacion: '   ',
      capacidad: 40,
      tipo: TipoAula.AULA,
      tipoMobiliario: TipoMobiliarioAula.PUPITRE,
      origen: OrigenAula.UNA,
    });

    expect(aulaRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ubicacion: null,
      }),
    );
  });

  it('rechaza un código duplicado', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula());

    await expect(
      service.crear({
        codigo: 'AULA-01',
        nombre: 'Otra aula',
        capacidad: 30,
        tipo: TipoAula.AULA,
        tipoMobiliario: TipoMobiliarioAula.PUPITRE,
        origen: OrigenAula.UNA,
      }),
    ).rejects.toThrow(ConflictException);

    expect(aulaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza un código vacío después de normalizar', async () => {
    await expect(
      service.crear({
        codigo: '   ',
        nombre: 'Aula prueba',
        capacidad: 30,
        tipo: TipoAula.AULA,
        tipoMobiliario: TipoMobiliarioAula.PUPITRE,
        origen: OrigenAula.UNA,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(aulaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza un nombre vacío después de normalizar', async () => {
    await expect(
      service.crear({
        codigo: 'AULA-02',
        nombre: '   ',
        capacidad: 30,
        tipo: TipoAula.AULA,
        tipoMobiliario: TipoMobiliarioAula.PUPITRE,
        origen: OrigenAula.UNA,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(aulaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza una capacidad menor o igual a cero', async () => {
    await expect(
      service.crear({
        codigo: 'AULA-02',
        nombre: 'Aula 2',
        capacidad: 0,
        tipo: TipoAula.AULA,
        tipoMobiliario: TipoMobiliarioAula.PUPITRE,
        origen: OrigenAula.UNA,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(aulaRepository.save).not.toHaveBeenCalled();
  });

  it('actualiza un aula y normaliza sus datos', async () => {
    const aula = crearAula();

    aulaRepository.findOne
      .mockResolvedValueOnce({ ...aula })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...aula,
        codigo: 'LAB-01',
        nombre: 'Laboratorio 1',
        capacidad: 30,
        tipo: TipoAula.LABORATORIO,
      });

    aulaRepository.save.mockImplementation(async (entidad) => entidad);

    const resultado = await service.actualizar(1, {
      codigo: ' lab-01 ',
      nombre: ' Laboratorio 1 ',
      ubicacion: ' Segundo piso ',
      capacidad: 30,
      tipo: TipoAula.LABORATORIO,
      origen: OrigenAula.UNA,
      confirmarReduccionCapacidad: true,
    });

    expect(aulaRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        codigo: 'LAB-01',
        nombre: 'Laboratorio 1',
        ubicacion: 'Segundo piso',
        capacidad: 30,
        tipo: TipoAula.LABORATORIO,
        origen: OrigenAula.UNA,
      }),
    );

    expect(resultado).toMatchObject({
      codigo: 'LAB-01',
      nombre: 'Laboratorio 1',
      capacidad: 30,
      tipo: TipoAula.LABORATORIO,
    });
  });

  it('permite dejar la ubicación en null', async () => {
    const aula = crearAula();

    aulaRepository.findOne
      .mockResolvedValueOnce({ ...aula })
      .mockResolvedValueOnce({
        ...aula,
        ubicacion: null,
      });

    aulaRepository.save.mockImplementation(async (entidad) => entidad);

    const resultado = await service.actualizar(1, {
      ubicacion: '',
    });

    expect(aulaRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ubicacion: null,
      }),
    );

    expect(resultado.ubicacion).toBeNull();
  });

  it('actualiza el tipo de mobiliario de un aula', async () => {
    const aula = crearAula({
      tipoMobiliario: TipoMobiliarioAula.PUPITRE,
    });

    aulaRepository.findOne
      .mockResolvedValueOnce({ ...aula })
      .mockResolvedValueOnce({
        ...aula,
        tipoMobiliario: TipoMobiliarioAula.MESA_GRUPAL,
      });

    aulaRepository.save.mockImplementation(async (entidad) => entidad);

    const resultado = await service.actualizar(1, {
      tipoMobiliario: TipoMobiliarioAula.MESA_GRUPAL,
    });

    expect(aulaRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoMobiliario: TipoMobiliarioAula.MESA_GRUPAL,
      }),
    );

    expect(resultado.tipoMobiliario).toBe(TipoMobiliarioAula.MESA_GRUPAL);
  });

  it('rechaza cambiar el código por uno existente', async () => {
    const aula = crearAula();

    aulaRepository.findOne.mockResolvedValueOnce(aula).mockResolvedValueOnce(
      crearAula({
        id: 2,
        codigo: 'AULA-02',
      }),
    );

    await expect(
      service.actualizar(1, {
        codigo: 'AULA-02',
      }),
    ).rejects.toThrow(ConflictException);

    expect(aulaRepository.save).not.toHaveBeenCalled();
  });

  it('exige confirmación al reducir capacidad', async () => {
    aulaRepository.findOne.mockResolvedValue(
      crearAula({
        capacidad: 45,
      }),
    );

    await expect(
      service.actualizar(
        1,
        {
          capacidad: 35,
        },
        7,
      ),
    ).rejects.toThrow(ConflictException);

    expect(aulaRepository.save).not.toHaveBeenCalled();
  });

  it('cambia el estado de un aula', async () => {
    const aula = crearAula();

    aulaRepository.findOne.mockResolvedValueOnce(aula).mockResolvedValueOnce({
      ...aula,
      activo: false,
    });

    aulaRepository.update.mockResolvedValue({
      affected: 1,
    });

    const resultado = await service.cambiarEstado(1, false);

    expect(aulaRepository.update).toHaveBeenCalledWith(1, {
      activo: false,
    });

    expect(resultado.activo).toBe(false);
  });

  it('bloquea inactivar un aula con reservas futuras', async () => {
    aulaRepository.findOne.mockResolvedValue(
      crearAula({
        activo: true,
      }),
    );

    reservaAulaRepository.findOne.mockResolvedValue(
      crearReserva({
        activo: true,
        fechaHoraInicio: new Date('2099-01-10T08:00:00-06:00'),
        fechaHoraFin: new Date('2099-01-10T10:00:00-06:00'),
      }),
    );

    await expect(service.cambiarEstado(1, false, 7)).rejects.toThrow(
      ConflictException,
    );
  });

  it('convierte ER_DUP_ENTRY de MySQL en ConflictException', async () => {
    aulaRepository.findOne.mockResolvedValue(null);

    aulaRepository.save.mockRejectedValue({
      code: 'ER_DUP_ENTRY',
    });

    await expect(
      service.crear({
        codigo: 'AULA-01',
        nombre: 'Aula 1',
        capacidad: 40,
        tipo: TipoAula.AULA,
        tipoMobiliario: TipoMobiliarioAula.PUPITRE,
        origen: OrigenAula.UNA,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('crea equipamiento normalizando nombre y descripción', async () => {
    equipamientoRepository.findOne.mockResolvedValue(null);
    equipamientoRepository.save.mockImplementation(async (entidad) => ({
      id: 1,
      ...entidad,
    }));

    await expect(
      service.crearEquipamiento({
        nombre: ' Proyector ',
        descripcion: ' Equipo multimedia ',
      }),
    ).resolves.toMatchObject({
      id: 1,
      nombre: 'Proyector',
      descripcion: 'Equipo multimedia',
      activo: true,
    });
  });

  it('impide inactivar equipamiento asignado activamente', async () => {
    equipamientoRepository.findOne.mockResolvedValue({
      id: 1,
      nombre: 'Proyector',
      activo: true,
    });
    aulaEquipamientoRepository.findOne.mockResolvedValue({
      id: 10,
      equipamientoId: 1,
      activo: true,
    });

    await expect(service.cambiarEstadoEquipamiento(1, false)).rejects.toThrow(
      ConflictException,
    );
    expect(equipamientoRepository.update).not.toHaveBeenCalled();
  });

  it('rechaza cantidades disponibles mayores al total', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula());
    equipamientoRepository.findOne.mockResolvedValue({
      id: 1,
      nombre: 'Computadora',
      activo: true,
    });

    await expect(
      service.asignarEquipamientoAula(1, {
        equipamientoId: 1,
        cantidadTotal: 25,
        cantidadDisponible: 30,
      }),
    ).rejects.toThrow(
      'La cantidad disponible no puede superar la cantidad total.',
    );
    expect(aulaEquipamientoRepository.save).not.toHaveBeenCalled();
  });

  it('reactiva una asignación inactiva conservando su historial', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula());
    equipamientoRepository.findOne.mockResolvedValue({
      id: 1,
      nombre: 'Computadora',
      activo: true,
    });
    aulaEquipamientoRepository.findOne.mockResolvedValue({
      id: 10,
      aulaId: 1,
      equipamientoId: 1,
      cantidadTotal: 10,
      cantidadDisponible: 8,
      observaciones: null,
      activo: false,
    });
    aulaEquipamientoRepository.save.mockImplementation(
      async (entidad) => entidad,
    );

    const resultado = await service.asignarEquipamientoAula(1, {
      equipamientoId: 1,
      cantidadTotal: 25,
      cantidadDisponible: 22,
      observaciones: ' Tres dañadas ',
    });

    expect(aulaEquipamientoRepository.create).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({
      id: 10,
      cantidadTotal: 25,
      cantidadDisponible: 22,
      observaciones: 'Tres dañadas',
      activo: true,
    });
  });

  it('permite cero equipos disponibles sin inactivar la relación', async () => {
    const relacion = {
      id: 10,
      aulaId: 1,
      equipamientoId: 1,
      cantidadTotal: 1,
      cantidadDisponible: 1,
      observaciones: null,
      activo: true,
      equipamiento: { id: 1, nombre: 'Proyector', activo: true },
    };
    aulaEquipamientoRepository.findOne
      .mockResolvedValueOnce(relacion)
      .mockResolvedValueOnce({ ...relacion, cantidadDisponible: 0 });
    aulaEquipamientoRepository.save.mockImplementation(
      async (entidad) => entidad,
    );

    const resultado = await service.actualizarEquipamientoAula(1, 1, {
      cantidadDisponible: 0,
    });

    expect(aulaEquipamientoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ cantidadDisponible: 0, activo: true }),
    );
    expect(resultado.cantidadDisponible).toBe(0);
    expect(resultado.activo).toBe(true);
  });

  it('lista el catálogo de equipamientos por nombre', async () => {
    const equipamientos = [
      crearEquipamiento(),
      crearEquipamiento({ id: 2, nombre: 'Televisor' }),
    ];
    equipamientoRepository.find.mockResolvedValue(equipamientos);

    await expect(service.listarEquipamientos()).resolves.toEqual(equipamientos);
    expect(equipamientoRepository.find).toHaveBeenCalledWith({
      order: { nombre: 'ASC' },
    });
  });

  it('rechaza equipamiento con nombre duplicado', async () => {
    equipamientoRepository.findOne.mockResolvedValue(crearEquipamiento());

    await expect(
      service.crearEquipamiento({ nombre: 'Proyector' }),
    ).rejects.toThrow(ConflictException);
    expect(equipamientoRepository.save).not.toHaveBeenCalled();
  });

  it('asigna equipamiento a un aula', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula());
    equipamientoRepository.findOne.mockResolvedValue(crearEquipamiento());
    aulaEquipamientoRepository.findOne.mockResolvedValue(null);
    const relacion = crearAulaEquipamiento({
      cantidadTotal: 25,
      cantidadDisponible: 23,
      observaciones: '2 en reparación',
    });
    aulaEquipamientoRepository.save.mockResolvedValue(relacion);

    await expect(
      service.asignarEquipamientoAula(1, {
        equipamientoId: 1,
        cantidadTotal: 25,
        cantidadDisponible: 23,
        observaciones: ' 2 en reparación ',
      }),
    ).resolves.toEqual(relacion);

    expect(aulaEquipamientoRepository.create).toHaveBeenCalledWith({
      aulaId: 1,
      equipamientoId: 1,
      cantidadTotal: 25,
      cantidadDisponible: 23,
      observaciones: '2 en reparación',
      activo: true,
    });
  });

  it('rechaza asignar equipamiento a un aula inactiva', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula({ activo: false }));

    await expect(
      service.asignarEquipamientoAula(1, {
        equipamientoId: 1,
        cantidadTotal: 1,
        cantidadDisponible: 1,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(equipamientoRepository.findOne).not.toHaveBeenCalled();
  });

  it('rechaza asignar un equipamiento inactivo', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula());
    equipamientoRepository.findOne.mockResolvedValue(
      crearEquipamiento({ activo: false }),
    );

    await expect(
      service.asignarEquipamientoAula(1, {
        equipamientoId: 1,
        cantidadTotal: 1,
        cantidadDisponible: 1,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(aulaEquipamientoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza asignar dos veces el mismo equipamiento activo', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula());
    equipamientoRepository.findOne.mockResolvedValue(crearEquipamiento());
    aulaEquipamientoRepository.findOne.mockResolvedValue(
      crearAulaEquipamiento(),
    );

    await expect(
      service.asignarEquipamientoAula(1, {
        equipamientoId: 1,
        cantidadTotal: 1,
        cantidadDisponible: 1,
      }),
    ).rejects.toThrow(ConflictException);
    expect(aulaEquipamientoRepository.save).not.toHaveBeenCalled();
  });

  it('actualiza las cantidades del equipamiento de un aula', async () => {
    const relacion = crearAulaEquipamiento({
      cantidadTotal: 25,
      cantidadDisponible: 25,
    });
    aulaEquipamientoRepository.findOne
      .mockResolvedValueOnce({ ...relacion })
      .mockResolvedValueOnce({
        ...relacion,
        cantidadDisponible: 22,
        observaciones: '3 en reparación',
      });
    aulaEquipamientoRepository.save.mockImplementation(
      async (entidad) => entidad,
    );

    const resultado = await service.actualizarEquipamientoAula(1, 1, {
      cantidadDisponible: 22,
      observaciones: '3 en reparación',
    });

    expect(aulaEquipamientoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        cantidadTotal: 25,
        cantidadDisponible: 22,
        observaciones: '3 en reparación',
      }),
    );
    expect(resultado.cantidadDisponible).toBe(22);
  });

  it('permite inactivar un catálogo sin asignaciones activas', async () => {
    const equipamiento = crearEquipamiento();
    equipamientoRepository.findOne
      .mockResolvedValueOnce(equipamiento)
      .mockResolvedValueOnce({ ...equipamiento, activo: false });
    aulaEquipamientoRepository.findOne.mockResolvedValue(null);
    equipamientoRepository.update.mockResolvedValue({ affected: 1 });

    const resultado = await service.cambiarEstadoEquipamiento(1, false);

    expect(equipamientoRepository.update).toHaveBeenCalledWith(1, {
      activo: false,
    });
    expect(resultado.activo).toBe(false);
  });

  it('lists classroom unavailability ordered by start time', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula());
    const indisponibilidades = [crearIndisponibilidad()];
    indisponibilidadAulaRepository.find.mockResolvedValue(indisponibilidades);

    await expect(service.listarIndisponibilidadesAula(1)).resolves.toEqual(
      indisponibilidades,
    );
    expect(indisponibilidadAulaRepository.find).toHaveBeenCalledWith({
      where: { aulaId: 1 },
      order: { fechaHoraInicio: 'ASC' },
    });
  });

  it('creates unavailability with a normalized reason', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula());
    indisponibilidadAulaRepository.find.mockResolvedValue([]);
    indisponibilidadAulaRepository.save.mockImplementation(
      async (entidad) => entidad,
    );

    const resultado = await service.crearIndisponibilidadAula(1, {
      tipo: TipoIndisponibilidadAula.REPARACION,
      fechaHoraInicio: '2027-10-10T08:00:00-06:00',
      fechaHoraFin: '2027-10-10T10:00:00-06:00',
      motivo: ' Repair AC ',
    });

    expect(indisponibilidadAulaRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        aulaId: 1,
        tipo: TipoIndisponibilidadAula.REPARACION,
        motivo: 'Repair AC',
        activo: true,
      }),
    );
    expect(resultado).toMatchObject({ activo: true });
  });

  it('rejects an end time equal to the start time', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula());

    await expect(
      service.crearIndisponibilidadAula(1, {
        tipo: TipoIndisponibilidadAula.BLOQUEO,
        fechaHoraInicio: '2027-10-10T10:00:00-06:00',
        fechaHoraFin: '2027-10-10T10:00:00-06:00',
        motivo: 'Block',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(indisponibilidadAulaRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an overlapping active unavailability', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula());
    indisponibilidadAulaRepository.find.mockResolvedValue([
      crearIndisponibilidad(),
    ]);

    await expect(
      service.crearIndisponibilidadAula(1, {
        tipo: TipoIndisponibilidadAula.LIMPIEZA,
        fechaHoraInicio: '2027-10-10T09:00:00-06:00',
        fechaHoraFin: '2027-10-10T11:00:00-06:00',
        motivo: 'Cleaning',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('allows contiguous unavailabilities', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula());
    indisponibilidadAulaRepository.find.mockResolvedValue([
      crearIndisponibilidad(),
    ]);
    indisponibilidadAulaRepository.save.mockImplementation(
      async (entidad) => entidad,
    );

    await expect(
      service.crearIndisponibilidadAula(1, {
        tipo: TipoIndisponibilidadAula.LIMPIEZA,
        fechaHoraInicio: '2027-10-10T10:00:00-06:00',
        fechaHoraFin: '2027-10-10T12:00:00-06:00',
        motivo: 'Cleaning',
      }),
    ).resolves.toMatchObject({ activo: true });
  });

  it('prevents reactivation when it overlaps another active record', async () => {
    const inactiva = crearIndisponibilidad({ activo: false });
    aulaRepository.findOne.mockResolvedValue(crearAula());
    indisponibilidadAulaRepository.findOne.mockResolvedValue(inactiva);
    indisponibilidadAulaRepository.find.mockResolvedValue([
      inactiva,
      crearIndisponibilidad({
        id: 2,
        fechaHoraInicio: new Date('2027-10-10T09:00:00-06:00'),
        fechaHoraFin: new Date('2027-10-10T11:00:00-06:00'),
      }),
    ]);

    await expect(
      service.cambiarEstadoIndisponibilidadAula(1, 1, true),
    ).rejects.toThrow(ConflictException);
    expect(indisponibilidadAulaRepository.save).not.toHaveBeenCalled();
  });

  describe('indisponibilidades de aulas', () => {
    it('rechaza una fecha final anterior al inicio', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());

      await expect(
        service.crearIndisponibilidadAula(1, {
          tipo: TipoIndisponibilidadAula.REPARACION,
          fechaHoraInicio: '2027-10-10T12:00:00-06:00',
          fechaHoraFin: '2027-10-10T08:00:00-06:00',
          motivo: 'Reparación',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(indisponibilidadAulaRepository.save).not.toHaveBeenCalled();
    });

    it('rechaza crear una indisponibilidad en un aula inactiva', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula({ activo: false }));

      await expect(
        service.crearIndisponibilidadAula(1, {
          tipo: TipoIndisponibilidadAula.MANTENIMIENTO,
          fechaHoraInicio: '2027-10-10T08:00:00-06:00',
          fechaHoraFin: '2027-10-10T10:00:00-06:00',
          motivo: 'Mantenimiento',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(indisponibilidadAulaRepository.save).not.toHaveBeenCalled();
    });

    it('actualiza una indisponibilidad sin chocar consigo misma', async () => {
      const existente = crearIndisponibilidad();
      aulaRepository.findOne.mockResolvedValue(crearAula());
      indisponibilidadAulaRepository.findOne
        .mockResolvedValueOnce({ ...existente })
        .mockResolvedValueOnce({
          ...existente,
          motivo: 'Mantenimiento actualizado',
        });
      indisponibilidadAulaRepository.find.mockResolvedValue([existente]);
      indisponibilidadAulaRepository.save.mockImplementation(
        async (entidad) => entidad,
      );

      const resultado = await service.actualizarIndisponibilidadAula(1, 1, {
        motivo: ' Mantenimiento actualizado ',
      });

      expect(indisponibilidadAulaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          motivo: 'Mantenimiento actualizado',
        }),
      );
      expect(resultado.motivo).toBe('Mantenimiento actualizado');
    });

    it('inactiva una indisponibilidad sin eliminarla', async () => {
      const existente = crearIndisponibilidad();
      aulaRepository.findOne.mockResolvedValue(crearAula());
      indisponibilidadAulaRepository.findOne
        .mockResolvedValueOnce({ ...existente })
        .mockResolvedValueOnce({ ...existente, activo: false });
      indisponibilidadAulaRepository.save.mockImplementation(
        async (entidad) => entidad,
      );

      const resultado = await service.cambiarEstadoIndisponibilidadAula(
        1,
        1,
        false,
      );

      expect(indisponibilidadAulaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, activo: false }),
      );
      expect(resultado.activo).toBe(false);
    });

    it('permite reactivar una indisponibilidad cuando no existen cruces', async () => {
      const inactiva = crearIndisponibilidad({ activo: false });
      aulaRepository.findOne.mockResolvedValue(crearAula());
      indisponibilidadAulaRepository.findOne
        .mockResolvedValueOnce({ ...inactiva })
        .mockResolvedValueOnce({ ...inactiva, activo: true });
      indisponibilidadAulaRepository.find.mockResolvedValue([]);
      indisponibilidadAulaRepository.save.mockImplementation(
        async (entidad) => entidad,
      );

      const resultado = await service.cambiarEstadoIndisponibilidadAula(
        1,
        1,
        true,
      );

      expect(resultado.activo).toBe(true);
    });
  });

  describe('reservas extraordinarias de aulas', () => {
    const dtoReserva = {
      tipo: TipoReservaAula.EXAMEN,
      titulo: ' Examen final EIF223 ',
      descripcion: ' Examen final del curso ',
      fechaHoraInicio: '2027-10-10T12:00:00-06:00',
      fechaHoraFin: '2027-10-10T14:00:00-06:00',
    };

    it('crea una reserva normalizando título y descripción', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());
      reservaAulaRepository.find.mockResolvedValue([]);
      indisponibilidadAulaRepository.find.mockResolvedValue([]);
      reservaAulaRepository.save.mockImplementation(async (entidad) => entidad);

      const resultado = await service.crearReservaAula(1, dtoReserva);

      expect(reservaAulaRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aulaId: 1,
          titulo: 'Examen final EIF223',
          descripcion: 'Examen final del curso',
          activo: true,
        }),
      );
      expect(resultado.titulo).toBe('Examen final EIF223');
    });

    it('lista las reservas de un aula ordenadas por inicio', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());
      const reservas = [crearReserva()];
      reservaAulaRepository.find.mockResolvedValue(reservas);

      await expect(service.listarReservasAula(1)).resolves.toEqual(reservas);

      expect(reservaAulaRepository.find).toHaveBeenCalledWith({
        where: { aulaId: 1 },
        order: { fechaHoraInicio: 'ASC' },
      });
    });

    it('obtiene una reserva por id dentro del aula', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());
      const reserva = crearReserva();
      reservaAulaRepository.findOne.mockResolvedValue(reserva);

      await expect(service.obtenerReservaPorId(1, 1)).resolves.toEqual(reserva);

      expect(reservaAulaRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, aulaId: 1 },
      });
    });

    it('rechaza una reserva en un aula inactiva', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula({ activo: false }));

      await expect(
        service.crearReservaAula(1, {
          tipo: TipoReservaAula.REUNION,
          titulo: 'Reunión',
          fechaHoraInicio: '2027-10-15T08:00:00-06:00',
          fechaHoraFin: '2027-10-15T10:00:00-06:00',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(reservaAulaRepository.save).not.toHaveBeenCalled();
    });

    it('rechaza una reserva con fin anterior al inicio', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());

      await expect(
        service.crearReservaAula(1, {
          tipo: TipoReservaAula.EVENTO,
          titulo: 'Evento',
          fechaHoraInicio: '2027-10-15T12:00:00-06:00',
          fechaHoraFin: '2027-10-15T08:00:00-06:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza una reserva que se cruza con otra reserva activa', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());
      reservaAulaRepository.find.mockResolvedValue([crearReserva()]);

      await expect(
        service.crearReservaAula(1, {
          ...dtoReserva,
          fechaHoraInicio: '2027-10-10T13:00:00-06:00',
          fechaHoraFin: '2027-10-10T15:00:00-06:00',
        }),
      ).rejects.toThrow(ConflictException);

      expect(indisponibilidadAulaRepository.find).not.toHaveBeenCalled();
    });

    it('rechaza una reserva que se cruza con una indisponibilidad activa', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());
      reservaAulaRepository.find.mockResolvedValue([]);
      indisponibilidadAulaRepository.find.mockResolvedValue([
        crearIndisponibilidad(),
      ]);

      await expect(
        service.crearReservaAula(1, {
          ...dtoReserva,
          fechaHoraInicio: '2027-10-10T09:00:00-06:00',
          fechaHoraFin: '2027-10-10T11:00:00-06:00',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('permite una reserva contigua a una indisponibilidad', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());
      reservaAulaRepository.find.mockResolvedValue([]);
      indisponibilidadAulaRepository.find.mockResolvedValue([
        crearIndisponibilidad(),
      ]);
      reservaAulaRepository.save.mockImplementation(async (entidad) => entidad);

      await expect(
        service.crearReservaAula(1, {
          ...dtoReserva,
          fechaHoraInicio: '2027-10-10T10:00:00-06:00',
          fechaHoraFin: '2027-10-10T12:00:00-06:00',
        }),
      ).resolves.toEqual(
        expect.objectContaining({ titulo: 'Examen final EIF223' }),
      );
    });

    it('impide reactivar una reserva cuando aparece un conflicto', async () => {
      const inactiva = crearReserva({ activo: false });
      aulaRepository.findOne.mockResolvedValue(crearAula());
      reservaAulaRepository.findOne.mockResolvedValue(inactiva);
      reservaAulaRepository.find.mockResolvedValue([
        inactiva,
        crearReserva({
          id: 2,
          fechaHoraInicio: new Date('2027-10-10T13:00:00-06:00'),
          fechaHoraFin: new Date('2027-10-10T15:00:00-06:00'),
        }),
      ]);

      await expect(
        service.cambiarEstadoReservaAula(1, 1, true),
      ).rejects.toThrow(ConflictException);

      expect(reservaAulaRepository.save).not.toHaveBeenCalled();
    });

    it('permite una reserva contigua a otra reserva', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());
      reservaAulaRepository.find.mockResolvedValue([
        crearReserva({
          fechaHoraInicio: new Date('2027-10-15T08:00:00-06:00'),
          fechaHoraFin: new Date('2027-10-15T10:00:00-06:00'),
        }),
      ]);
      indisponibilidadAulaRepository.find.mockResolvedValue([]);
      reservaAulaRepository.save.mockImplementation(async (entidad) => entidad);

      await expect(
        service.crearReservaAula(1, {
          tipo: TipoReservaAula.REUNION,
          titulo: 'Reunión posterior',
          fechaHoraInicio: '2027-10-15T10:00:00-06:00',
          fechaHoraFin: '2027-10-15T12:00:00-06:00',
        }),
      ).resolves.toEqual(expect.objectContaining({ activo: true }));
    });

    it('actualiza una reserva sin chocar consigo misma', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());
      const existente = crearReserva({
        fechaHoraInicio: new Date('2027-10-15T08:00:00-06:00'),
        fechaHoraFin: new Date('2027-10-15T10:00:00-06:00'),
      });
      reservaAulaRepository.findOne
        .mockResolvedValueOnce({ ...existente })
        .mockResolvedValueOnce({ ...existente, titulo: 'Examen actualizado' });
      reservaAulaRepository.find.mockResolvedValue([existente]);
      indisponibilidadAulaRepository.find.mockResolvedValue([]);
      reservaAulaRepository.save.mockImplementation(async (entidad) => entidad);

      const resultado = await service.actualizarReservaAula(1, 1, {
        titulo: ' Examen actualizado ',
      });

      expect(reservaAulaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, titulo: 'Examen actualizado' }),
      );
      expect(resultado.titulo).toBe('Examen actualizado');
    });

    it('convierte una descripción vacía en null al actualizar', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());
      const existente = crearReserva();
      reservaAulaRepository.findOne
        .mockResolvedValueOnce({ ...existente })
        .mockResolvedValueOnce({ ...existente, descripcion: null });
      reservaAulaRepository.find.mockResolvedValue([]);
      indisponibilidadAulaRepository.find.mockResolvedValue([]);
      reservaAulaRepository.save.mockImplementation(async (entidad) => entidad);

      const resultado = await service.actualizarReservaAula(1, 1, {
        descripcion: '   ',
      });

      expect(reservaAulaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ descripcion: null }),
      );
      expect(resultado.descripcion).toBeNull();
    });

    it('permite inactivar una reserva sin eliminarla', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());
      const existente = crearReserva();
      reservaAulaRepository.findOne
        .mockResolvedValueOnce({ ...existente })
        .mockResolvedValueOnce({ ...existente, activo: false });
      reservaAulaRepository.save.mockImplementation(async (entidad) => entidad);

      const resultado = await service.cambiarEstadoReservaAula(1, 1, false);

      expect(reservaAulaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ activo: false }),
      );
      expect(resultado.activo).toBe(false);
    });

    it('rechaza reactivar una reserva que se cruza con una indisponibilidad', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());
      const inactiva = crearReserva({
        activo: false,
        fechaHoraInicio: new Date('2027-10-15T08:00:00-06:00'),
        fechaHoraFin: new Date('2027-10-15T10:00:00-06:00'),
      });
      reservaAulaRepository.findOne.mockResolvedValue(inactiva);
      reservaAulaRepository.find.mockResolvedValue([]);
      indisponibilidadAulaRepository.find.mockResolvedValue([
        crearIndisponibilidad({
          fechaHoraInicio: new Date('2027-10-15T09:00:00-06:00'),
          fechaHoraFin: new Date('2027-10-15T11:00:00-06:00'),
        }),
      ]);

      await expect(
        service.cambiarEstadoReservaAula(1, 1, true),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza reactivar una reserva si el aula está inactiva', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula({ activo: false }));
      reservaAulaRepository.findOne.mockResolvedValue(
        crearReserva({ activo: false }),
      );

      await expect(
        service.cambiarEstadoReservaAula(1, 1, true),
      ).rejects.toThrow(BadRequestException);

      expect(reservaAulaRepository.save).not.toHaveBeenCalled();
    });

    it('permite reactivar una reserva si el horario está libre', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());
      const inactiva = crearReserva({ activo: false });
      reservaAulaRepository.findOne
        .mockResolvedValueOnce({ ...inactiva })
        .mockResolvedValueOnce({ ...inactiva, activo: true });
      reservaAulaRepository.find.mockResolvedValue([]);
      indisponibilidadAulaRepository.find.mockResolvedValue([]);
      reservaAulaRepository.save.mockImplementation(async (entidad) => entidad);

      await expect(
        service.cambiarEstadoReservaAula(1, 1, true),
      ).resolves.toMatchObject({ activo: true });
    });
  });

  it('rechaza crear una indisponibilidad que se cruza con una reserva', async () => {
    aulaRepository.findOne.mockResolvedValue(crearAula());
    reservaAulaRepository.find.mockResolvedValue([
      crearReserva({
        fechaHoraInicio: new Date('2027-10-20T08:00:00-06:00'),
        fechaHoraFin: new Date('2027-10-20T10:00:00-06:00'),
      }),
    ]);

    await expect(
      service.crearIndisponibilidadAula(1, {
        tipo: TipoIndisponibilidadAula.MANTENIMIENTO,
        fechaHoraInicio: '2027-10-20T09:00:00-06:00',
        fechaHoraFin: '2027-10-20T11:00:00-06:00',
        motivo: 'Mantenimiento',
      }),
    ).rejects.toThrow(ConflictException);

    expect(indisponibilidadAulaRepository.save).not.toHaveBeenCalled();
  });

  describe('búsqueda de aulas disponibles', () => {
    it('filtra aulas disponibles por tipo de mobiliario', async () => {
      periodosAcademicosService.obtenerPorId.mockResolvedValue(crearPeriodo());

      aulaRepository.find.mockResolvedValue([
        crearAula({
          tipoMobiliario: TipoMobiliarioAula.MESA_COMPUTADORA,
        }),
      ]);

      disponibilidadAulaRepository.find.mockResolvedValue([
        crearDisponibilidad({
          aulaId: 1,
          periodoId: 1,
          diaSemana: 1,
          horaInicio: '07:00:00',
          horaFin: '12:00:00',
        }),
      ]);

      indisponibilidadAulaRepository.find.mockResolvedValue([]);
      reservaAulaRepository.find.mockResolvedValue([]);

      const resultado = await service.buscarAulasDisponibles({
        periodoId: 1,
        fechaHoraInicio: '2027-03-01T08:00:00-06:00',
        fechaHoraFin: '2027-03-01T10:00:00-06:00',
        tipoMobiliario: TipoMobiliarioAula.MESA_COMPUTADORA,
      });

      expect(aulaRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            activo: true,
            tipoMobiliario: TipoMobiliarioAula.MESA_COMPUTADORA,
          }),
        }),
      );

      expect(resultado).toHaveLength(1);
    });

    it('devuelve un aula disponible que cumple capacidad y equipamiento', async () => {
      const aula = crearAula({
        id: 1,
        capacidad: 45,
        activo: true,
        equipamientos: [
          crearAulaEquipamiento({
            aulaId: 1,
            equipamientoId: 1,
            cantidadTotal: 1,
            cantidadDisponible: 1,
            activo: true,
            equipamiento: crearEquipamiento({
              id: 1,
              activo: true,
            }),
          }),
        ],
      });

      aulaRepository.find.mockResolvedValue([aula]);

      indisponibilidadAulaRepository.find.mockResolvedValue([]);

      reservaAulaRepository.find.mockResolvedValue([]);

      const resultado = await service.buscarAulasDisponibles({
        periodoId: 1,
        fechaHoraInicio: '2027-03-01T08:00:00-06:00',
        fechaHoraFin: '2027-03-01T10:00:00-06:00',
        cantidadEstudiantes: 35,
        equipamientos: [
          {
            equipamientoId: 1,
            cantidadMinima: 1,
          },
        ],
      });

      expect(resultado).toHaveLength(1);

      expect(resultado[0]).toEqual(
        expect.objectContaining({
          id: 1,
          recomendacionCapacidad: 'RECOMENDADA',
          capacidadSobrante: 10,
        }),
      );
    });

    it('excluye un aula ocupada por una reserva', async () => {
      aulaRepository.find.mockResolvedValue([
        crearAula({
          id: 1,
          capacidad: 45,
        }),
      ]);

      indisponibilidadAulaRepository.find.mockResolvedValue([]);

      reservaAulaRepository.find.mockResolvedValue([
        crearReserva({
          aulaId: 1,
          fechaHoraInicio: new Date('2027-03-01T08:00:00-06:00'),
          fechaHoraFin: new Date('2027-03-01T10:00:00-06:00'),
        }),
      ]);

      const resultado = await service.buscarAulasDisponibles({
        periodoId: 1,
        fechaHoraInicio: '2027-03-01T08:30:00-06:00',
        fechaHoraFin: '2027-03-01T09:30:00-06:00',
      });

      expect(resultado).toEqual([]);
    });

    it('excluye un aula con mantenimiento o bloqueo', async () => {
      aulaRepository.find.mockResolvedValue([
        crearAula({
          id: 1,
        }),
      ]);

      indisponibilidadAulaRepository.find.mockResolvedValue([
        crearIndisponibilidad({
          aulaId: 1,
          fechaHoraInicio: new Date('2027-03-01T08:00:00-06:00'),
          fechaHoraFin: new Date('2027-03-01T12:00:00-06:00'),
        }),
      ]);

      reservaAulaRepository.find.mockResolvedValue([]);

      const resultado = await service.buscarAulasDisponibles({
        periodoId: 1,
        fechaHoraInicio: '2027-03-01T09:00:00-06:00',
        fechaHoraFin: '2027-03-01T10:00:00-06:00',
      });

      expect(resultado).toEqual([]);
    });

    it('excluye un aula si no tiene suficiente equipamiento disponible', async () => {
      const aula = crearAula({
        equipamientos: [
          crearAulaEquipamiento({
            equipamientoId: 1,
            cantidadTotal: 25,
            cantidadDisponible: 10,
            activo: true,
            equipamiento: crearEquipamiento({
              id: 1,
              activo: true,
            }),
          }),
        ],
      });

      aulaRepository.find.mockResolvedValue([aula]);

      indisponibilidadAulaRepository.find.mockResolvedValue([]);

      reservaAulaRepository.find.mockResolvedValue([]);

      const resultado = await service.buscarAulasDisponibles({
        periodoId: 1,
        fechaHoraInicio: '2027-03-01T08:00:00-06:00',
        fechaHoraFin: '2027-03-01T10:00:00-06:00',
        equipamientos: [
          {
            equipamientoId: 1,
            cantidadMinima: 20,
          },
        ],
      });

      expect(resultado).toEqual([]);
    });

    it('excluye equipamiento inactivo aunque exista físicamente en el aula', async () => {
      const aula = crearAula({
        equipamientos: [
          crearAulaEquipamiento({
            equipamientoId: 1,
            cantidadDisponible: 1,
            activo: false,
            equipamiento: crearEquipamiento({
              id: 1,
              activo: true,
            }),
          }),
        ],
      });

      aulaRepository.find.mockResolvedValue([aula]);

      indisponibilidadAulaRepository.find.mockResolvedValue([]);

      reservaAulaRepository.find.mockResolvedValue([]);

      const resultado = await service.buscarAulasDisponibles({
        periodoId: 1,
        fechaHoraInicio: '2027-03-01T08:00:00-06:00',
        fechaHoraFin: '2027-03-01T10:00:00-06:00',
        equipamientos: [
          {
            equipamientoId: 1,
            cantidadMinima: 1,
          },
        ],
      });

      expect(resultado).toEqual([]);
    });

    it('rechaza equipamiento repetido en la búsqueda', async () => {
      await expect(
        service.buscarAulasDisponibles({
          periodoId: 1,
          fechaHoraInicio: '2027-03-01T08:00:00-06:00',
          fechaHoraFin: '2027-03-01T10:00:00-06:00',
          equipamientos: [
            {
              equipamientoId: 1,
              cantidadMinima: 1,
            },
            {
              equipamientoId: 1,
              cantidadMinima: 2,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(aulaRepository.find).not.toHaveBeenCalled();
    });

    it('clasifica sobrecapacidad cuando se permite incluirla', async () => {
      aulaRepository.find.mockResolvedValue([
        crearAula({
          capacidad: 32,
        }),
      ]);

      indisponibilidadAulaRepository.find.mockResolvedValue([]);

      reservaAulaRepository.find.mockResolvedValue([]);

      const resultado = await service.buscarAulasDisponibles({
        periodoId: 1,
        fechaHoraInicio: '2027-03-01T08:00:00-06:00',
        fechaHoraFin: '2027-03-01T10:00:00-06:00',
        cantidadEstudiantes: 35,
        incluirSobrecupo: true,
      });

      expect(resultado[0]).toEqual(
        expect.objectContaining({
          recomendacionCapacidad: 'SOBRECAPACIDAD',
          capacidadSobrante: -3,
        }),
      );
    });

    it('excluye un aula sin disponibilidad base para ese día', async () => {
      periodosAcademicosService.obtenerPorId.mockResolvedValue(crearPeriodo());

      aulaRepository.find.mockResolvedValue([
        crearAula({
          id: 1,
        }),
      ]);

      disponibilidadAulaRepository.find.mockResolvedValue([]);

      const resultado = await service.buscarAulasDisponibles({
        periodoId: 1,
        fechaHoraInicio: '2027-03-01T08:00:00-06:00',
        fechaHoraFin: '2027-03-01T10:00:00-06:00',
      });

      expect(resultado).toEqual([]);
    });

    it('incluye un aula si su disponibilidad cubre todo el horario', async () => {
      periodosAcademicosService.obtenerPorId.mockResolvedValue(crearPeriodo());

      aulaRepository.find.mockResolvedValue([
        crearAula({
          id: 1,
        }),
      ]);

      disponibilidadAulaRepository.find.mockResolvedValue([
        crearDisponibilidad({
          aulaId: 1,
          periodoId: 1,
          diaSemana: 1,
          horaInicio: '07:00:00',
          horaFin: '12:00:00',
        }),
      ]);

      indisponibilidadAulaRepository.find.mockResolvedValue([]);

      reservaAulaRepository.find.mockResolvedValue([]);

      const resultado = await service.buscarAulasDisponibles({
        periodoId: 1,
        fechaHoraInicio: '2027-03-01T08:00:00-06:00',
        fechaHoraFin: '2027-03-01T10:00:00-06:00',
      });

      expect(resultado).toHaveLength(1);
    });

    it('considera varios bloques contiguos como disponibilidad continua', async () => {
      periodosAcademicosService.obtenerPorId.mockResolvedValue(crearPeriodo());

      aulaRepository.find.mockResolvedValue([
        crearAula({
          id: 1,
        }),
      ]);

      disponibilidadAulaRepository.find.mockResolvedValue([
        crearDisponibilidad({
          id: 1,
          horaInicio: '07:00:00',
          horaFin: '10:00:00',
        }),

        crearDisponibilidad({
          id: 2,
          horaInicio: '10:00:00',
          horaFin: '12:00:00',
        }),
      ]);

      indisponibilidadAulaRepository.find.mockResolvedValue([]);

      reservaAulaRepository.find.mockResolvedValue([]);

      const resultado = await service.buscarAulasDisponibles({
        periodoId: 1,
        fechaHoraInicio: '2027-03-01T08:00:00-06:00',
        fechaHoraFin: '2027-03-01T11:00:00-06:00',
      });

      expect(resultado).toHaveLength(1);
    });

    it('rechaza búsqueda fuera de las fechas del periodo', async () => {
      periodosAcademicosService.obtenerPorId.mockResolvedValue(crearPeriodo());

      await expect(
        service.buscarAulasDisponibles({
          periodoId: 1,
          fechaHoraInicio: '2027-07-01T08:00:00-06:00',
          fechaHoraFin: '2027-07-01T10:00:00-06:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('indica que un aula con sobrecapacidad requiere autorización', async () => {
      jest.spyOn(service, 'buscarAulasDisponibles').mockResolvedValue([
        {
          ...crearAula({
            id: 1,
            capacidad: 45,
          }),
          capacidadSobrante: -5,
          recomendacionCapacidad: 'SOBRECAPACIDAD',
        } as any,
      ]);

      aulaRepository.findOne.mockResolvedValue(
        crearAula({
          id: 1,
        }),
      );

      const resultado = await service.evaluarAulaParaAsignacion(1, {
        periodoId: 1,
        fechaHoraInicio: '2027-03-01T08:00:00-06:00',
        fechaHoraFin: '2027-03-01T10:00:00-06:00',
        cantidadEstudiantes: 50,
      });

      expect(resultado).toEqual(
        expect.objectContaining({
          apta: false,
          requiereAutorizacionSobrecupo: true,
          motivo: 'SOBRECAPACIDAD',
        }),
      );
    });
  });

  describe('consulta de ocupación de aula', () => {
    it('retorna ocupaciones ordenadas cronológicamente', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula({ id: 1 }));

      indisponibilidadAulaRepository.find.mockResolvedValue([
        crearIndisponibilidad({
          id: 10,
          tipo: TipoIndisponibilidadAula.MANTENIMIENTO,
          motivo: 'Mantenimiento preventivo',
          fechaHoraInicio: new Date('2027-10-15T10:00:00-06:00'),
          fechaHoraFin: new Date('2027-10-15T12:00:00-06:00'),
        }),
      ]);

      reservaAulaRepository.find.mockResolvedValue([
        crearReserva({
          id: 20,
          tipo: TipoReservaAula.EXAMEN,
          titulo: 'Examen final',
          fechaHoraInicio: new Date('2027-10-15T08:00:00-06:00'),
          fechaHoraFin: new Date('2027-10-15T10:00:00-06:00'),
        }),
      ]);

      const resultado = await service.consultarOcupacionAula(1, {
        fechaHoraInicio: '2027-10-15T07:00:00-06:00',
        fechaHoraFin: '2027-10-15T13:00:00-06:00',
      });

      expect(resultado.aula).toEqual(expect.objectContaining({ id: 1 }));
      expect(resultado.ocupaciones).toHaveLength(2);
      expect(resultado.ocupaciones[0]).toMatchObject({
        id: 20,
        origen: 'RESERVA',
        titulo: 'Examen final',
      });
      expect(resultado.ocupaciones[1]).toMatchObject({
        id: 10,
        origen: 'INDISPONIBILIDAD',
        titulo: 'Mantenimiento preventivo',
      });
    });

    it('rechaza si fecha inicio es mayor o igual a fin', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula({ id: 1 }));

      await expect(
        service.consultarOcupacionAula(1, {
          fechaHoraInicio: '2027-10-15T10:00:00-06:00',
          fechaHoraFin: '2027-10-15T08:00:00-06:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('auditoría de aulas', () => {
    it('registra el usuario que creó un aula', async () => {
      aulaRepository.findOne.mockResolvedValue(null);

      const aula = crearAula({
        id: 1,
      });

      aulaRepository.save.mockResolvedValue(aula);

      auditoriaAulaRepository.save.mockImplementation(
        async (entidad) => entidad,
      );

      await service.crear(
        {
          codigo: 'AULA-01',
          nombre: 'Aula 1',
          capacidad: 45,
          tipo: aula.tipo,
          tipoMobiliario: aula.tipoMobiliario,
          origen: aula.origen,
        },
        7,
      );

      expect(auditoriaAulaRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aulaId: 1,
          usuarioId: 7,
          accion: 'CREAR',
          entidad: 'AULA',
          entidadId: 1,
        }),
      );
    });

    it('lista auditoría de un aula de la más reciente a la más antigua', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());

      auditoriaAulaRepository.find.mockResolvedValue([]);

      await service.listarAuditoriaAula(1);

      expect(auditoriaAulaRepository.find).toHaveBeenCalledWith({
        where: {
          aulaId: 1,
        },
        order: {
          createdAt: 'DESC',
        },
      });
    });
  });

  describe('disponibilidad de aulas por periodo', () => {
    it('lista los bloques del aula para un periodo', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());

      periodosAcademicosService.obtenerPorId.mockResolvedValue(crearPeriodo());

      disponibilidadAulaRepository.find.mockResolvedValue([
        crearDisponibilidad(),
      ]);

      const resultado = await service.listarDisponibilidadesAula(1, 1);

      expect(disponibilidadAulaRepository.find).toHaveBeenCalledWith({
        where: {
          aulaId: 1,
          periodoId: 1,
        },
        order: {
          diaSemana: 'ASC',
          horaInicio: 'ASC',
        },
      });

      expect(resultado).toHaveLength(1);
    });

    it('crea un bloque válido', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());

      periodosAcademicosService.obtenerPorId.mockResolvedValue(
        crearPeriodo({
          estado: EstadoPeriodoAcademico.EN_PREPARACION,
        }),
      );

      disponibilidadAulaRepository.find.mockResolvedValue([]);

      disponibilidadAulaRepository.save.mockImplementation(async (entidad) => ({
        id: 1,
        ...entidad,
      }));

      auditoriaAulaRepository.save.mockImplementation(
        async (entidad) => entidad,
      );

      const resultado = await service.crearDisponibilidadAula(
        1,
        {
          periodoId: 1,
          diaSemana: 1,
          horaInicio: '07:00',
          horaFin: '12:00',
        },
        7,
      );

      expect(resultado).toEqual(
        expect.objectContaining({
          aulaId: 1,
          periodoId: 1,
          diaSemana: 1,
          horaInicio: '07:00',
          horaFin: '12:00',
        }),
      );
    });

    it('rechaza bloques que se cruzan', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());

      periodosAcademicosService.obtenerPorId.mockResolvedValue(crearPeriodo());

      disponibilidadAulaRepository.find.mockResolvedValue([
        crearDisponibilidad({
          horaInicio: '07:00:00',
          horaFin: '12:00:00',
        }),
      ]);

      await expect(
        service.crearDisponibilidadAula(1, {
          periodoId: 1,
          diaSemana: 1,
          horaInicio: '10:00',
          horaFin: '14:00',
        }),
      ).rejects.toThrow(ConflictException);

      expect(disponibilidadAulaRepository.save).not.toHaveBeenCalled();
    });

    it('permite bloques contiguos', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());

      periodosAcademicosService.obtenerPorId.mockResolvedValue(crearPeriodo());

      disponibilidadAulaRepository.find.mockResolvedValue([
        crearDisponibilidad({
          horaInicio: '07:00:00',
          horaFin: '12:00:00',
        }),
      ]);

      disponibilidadAulaRepository.save.mockImplementation(async (entidad) => ({
        id: 2,
        ...entidad,
      }));

      const resultado = await service.crearDisponibilidadAula(1, {
        periodoId: 1,
        diaSemana: 1,
        horaInicio: '12:00',
        horaFin: '15:00',
      });

      expect(resultado).toEqual(
        expect.objectContaining({
          horaInicio: '12:00',
          horaFin: '15:00',
        }),
      );
    });

    it('rechaza disponibilidad con inicio igual al fin', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());

      periodosAcademicosService.obtenerPorId.mockResolvedValue(crearPeriodo());

      await expect(
        service.crearDisponibilidadAula(1, {
          periodoId: 1,
          diaSemana: 1,
          horaInicio: '08:00',
          horaFin: '08:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza modificar disponibilidad en un periodo EN_CURSO', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());

      periodosAcademicosService.obtenerPorId.mockResolvedValue(
        crearPeriodo({
          estado: EstadoPeriodoAcademico.EN_CURSO,
        }),
      );

      await expect(
        service.crearDisponibilidadAula(1, {
          periodoId: 1,
          diaSemana: 1,
          horaInicio: '07:00',
          horaFin: '12:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('elimina un bloque en periodo editable', async () => {
      aulaRepository.findOne.mockResolvedValue(crearAula());

      disponibilidadAulaRepository.findOne.mockResolvedValue(
        crearDisponibilidad(),
      );

      periodosAcademicosService.obtenerPorId.mockResolvedValue(crearPeriodo());

      disponibilidadAulaRepository.delete.mockResolvedValue({
        affected: 1,
      });

      const resultado = await service.eliminarDisponibilidadAula(1, 1, 7);

      expect(disponibilidadAulaRepository.delete).toHaveBeenCalledWith(1);

      expect(resultado).toEqual({
        message: 'Bloque de disponibilidad eliminado correctamente.',
      });
    });
  });
});
