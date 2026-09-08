import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { EstadoPeriodoAcademico } from '../periodos-academicos/constants/estado-periodo-academico.constant';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { DiaSemana } from './constants/dia-semana.constant';
import { EstadoDisponibilidad } from './constants/estado-disponibilidad.constant';
import { DisponibilidadProfesoresService } from './disponibilidad-profesores.service';
import { BloqueDisponibilidadProfesor } from './entities/bloque-disponibilidad-profesor.entity';
import { DisponibilidadProfesor } from './entities/disponibilidad-profesor.entity';
import { HistorialDisponibilidadProfesor } from './entities/historial-disponibilidad-profesor.entity';

describe('DisponibilidadProfesoresService', () => {
  let service: DisponibilidadProfesoresService;

  let usuarioRepository: {
    findOne: jest.Mock;
  };

  let periodoRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
  };

  let disponibilidadRepository: {
    findOne: jest.Mock;
  };

  let bloqueRepository: Record<string, jest.Mock>;

  let historialRepository: {
    find: jest.Mock;
  };

  let txDisponibilidadRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let txBloqueRepository: {
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let txHistorialRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };

  let dataSource: {
    transaction: jest.Mock;
  };

  const crearProfesor = (cambios: Partial<Usuario> = {}): Usuario =>
    ({
      id: 10,
      cedula: '123456789',
      nombres: 'Juan',
      apellido1: 'Pérez',
      apellido2: null,
      correo: 'juan@una.ac.cr',
      passwordHash: 'NO-DEBE-SALIR',
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      activo: true,
      ultimoAcceso: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      usuarioRoles: [
        {
          rol: {
            nombre: RolSistema.PROFESOR,
            activo: true,
          },
        },
      ],
      ...cambios,
    }) as unknown as Usuario;

  const crearPeriodo = (
    cambios: Partial<PeriodoAcademico> = {},
  ): PeriodoAcademico =>
    ({
      id: 2,
      codigo: '2099-C1',
      nombre: 'I Ciclo 2099',
      anio: 2099,
      ciclo: 1,
      fechaInicio: '2099-02-15',
      fechaFin: '2099-06-25',
      fechaLimiteDisponibilidad: '2099-01-20',
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
      observaciones: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...cambios,
    }) as PeriodoAcademico;

  const crearBloque = (
    cambios: Partial<BloqueDisponibilidadProfesor> = {},
  ): BloqueDisponibilidadProfesor =>
    ({
      id: 100,
      disponibilidadId: 50,
      dia: DiaSemana.LUNES,
      horaInicio: '08:00:00',
      horaFin: '10:00:00',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...cambios,
    }) as BloqueDisponibilidadProfesor;

  const crearDisponibilidad = (
    cambios: Partial<DisponibilidadProfesor> = {},
  ): DisponibilidadProfesor =>
    ({
      id: 50,
      profesorUsuarioId: 10,
      periodoAcademicoId: 2,
      estado: EstadoDisponibilidad.REGISTRADA,
      observaciones: null,
      periodoAcademico: crearPeriodo(),
      bloques: [crearBloque()],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...cambios,
    }) as DisponibilidadProfesor;

  beforeEach(() => {
    usuarioRepository = {
      findOne: jest.fn(),
    };

    periodoRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    disponibilidadRepository = {
      findOne: jest.fn(),
    };

    bloqueRepository = {};

    historialRepository = {
      find: jest.fn(),
    };

    txDisponibilidadRepository = {
      findOne: jest.fn(),
      create: jest.fn((datos) => datos),
      save: jest.fn(async (datos) => ({
        ...datos,
        id: datos.id ?? 50,
        createdAt: datos.createdAt ?? new Date(),
        updatedAt: datos.updatedAt ?? new Date(),
      })),
    };

    txBloqueRepository = {
      delete: jest.fn(),
      create: jest.fn((datos) => datos),
      save: jest.fn(),
    };

    txHistorialRepository = {
      create: jest.fn((datos) => datos),
      save: jest.fn(),
    };

    const manager = {
      getRepository: jest.fn((entidad) => {
        if (entidad === DisponibilidadProfesor) {
          return txDisponibilidadRepository;
        }

        if (entidad === BloqueDisponibilidadProfesor) {
          return txBloqueRepository;
        }

        if (entidad === HistorialDisponibilidadProfesor) {
          return txHistorialRepository;
        }

        throw new Error('Repositorio inesperado.');
      }),
    };

    dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    service = new DisponibilidadProfesoresService(
      usuarioRepository as unknown as Repository<Usuario>,
      periodoRepository as unknown as Repository<PeriodoAcademico>,
      disponibilidadRepository as unknown as Repository<DisponibilidadProfesor>,
      bloqueRepository as unknown as Repository<BloqueDisponibilidadProfesor>,
      historialRepository as unknown as Repository<HistorialDisponibilidadProfesor>,
      dataSource as unknown as DataSource,
    );

    usuarioRepository.findOne.mockResolvedValue(crearProfesor());

    jest.clearAllMocks();
  });

  it('devuelve PENDIENTE cuando todavía no existe disponibilidad', async () => {
    const periodo = crearPeriodo();

    periodoRepository.findOne.mockResolvedValue(periodo);

    disponibilidadRepository.findOne.mockResolvedValue(null);

    const resultado = await service.consultarMiDisponibilidad(10, 2);

    expect(resultado.registrada).toBe(false);

    expect(resultado.estado).toBe(EstadoDisponibilidad.PENDIENTE);

    expect(resultado.bloques).toEqual([]);
  });

  it('ordena los bloques de lunes a domingo y por hora de inicio', async () => {
    const periodo = crearPeriodo();

    periodoRepository.findOne.mockResolvedValue(periodo);

    disponibilidadRepository.findOne.mockResolvedValue(
      crearDisponibilidad({
        periodoAcademico: periodo,
        bloques: [
          crearBloque({
            dia: DiaSemana.DOMINGO,
            horaInicio: '10:00:00',
            horaFin: '12:00:00',
          }),
          crearBloque({
            dia: DiaSemana.MIERCOLES,
            horaInicio: '09:00:00',
            horaFin: '11:00:00',
          }),
          crearBloque({
            dia: DiaSemana.LUNES,
            horaInicio: '14:00:00',
            horaFin: '16:00:00',
          }),
          crearBloque({
            dia: DiaSemana.LUNES,
            horaInicio: '08:00:00',
            horaFin: '10:00:00',
          }),
          crearBloque({
            dia: DiaSemana.VIERNES,
            horaInicio: '11:00:00',
            horaFin: '13:00:00',
          }),
        ],
      }),
    );

    const resultado = await service.consultarMiDisponibilidad(10, 2);

    expect(
      resultado.bloques.map((bloque) => `${bloque.dia}-${bloque.horaInicio}`),
    ).toEqual([
      'LUNES-08:00',
      'LUNES-14:00',
      'MIERCOLES-09:00',
      'VIERNES-11:00',
      'DOMINGO-10:00',
    ]);
  });

  it('impide registrar disponibilidad a un usuario sin rol PROFESOR', async () => {
    usuarioRepository.findOne.mockResolvedValue(
      crearProfesor({
        usuarioRoles: [
          {
            rol: {
              nombre: RolSistema.COORDINADOR,
              activo: true,
            },
          },
        ] as any,
      }),
    );

    await expect(
      service.guardarMiDisponibilidad(10, {
        periodoAcademicoId: 2,
        bloques: [],
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('impide registrar disponibilidad a un profesor inactivo', async () => {
    usuarioRepository.findOne.mockResolvedValue(
      crearProfesor({
        activo: false,
      }),
    );

    await expect(
      service.guardarMiDisponibilidad(10, {
        periodoAcademicoId: 2,
        bloques: [],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza disponibilidad para un periodo BORRADOR', async () => {
    periodoRepository.findOne.mockResolvedValue(
      crearPeriodo({
        estado: EstadoPeriodoAcademico.BORRADOR,
      }),
    );

    await expect(
      service.guardarMiDisponibilidad(10, {
        periodoAcademicoId: 2,
        bloques: [],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza disponibilidad para un periodo EN_CURSO', async () => {
    periodoRepository.findOne.mockResolvedValue(
      crearPeriodo({
        estado: EstadoPeriodoAcademico.EN_CURSO,
      }),
    );

    await expect(
      service.guardarMiDisponibilidad(10, {
        periodoAcademicoId: 2,
        bloques: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza si existen dos periodos EN_PREPARACION', async () => {
    const periodo = crearPeriodo();

    periodoRepository.findOne.mockResolvedValue(periodo);

    periodoRepository.find.mockResolvedValue([
      periodo,
      crearPeriodo({
        id: 3,
        codigo: '2099-C2',
        nombre: 'II Ciclo 2099',
        ciclo: 2,
      }),
    ]);

    await expect(
      service.guardarMiDisponibilidad(10, {
        periodoAcademicoId: 2,
        bloques: [],
      }),
    ).rejects.toThrow(ConflictException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza cuando venció la fecha límite de disponibilidad', async () => {
    const periodo = crearPeriodo({
      fechaLimiteDisponibilidad: '2020-01-01',
    });

    periodoRepository.findOne.mockResolvedValue(periodo);

    periodoRepository.find.mockResolvedValue([periodo]);

    await expect(
      service.guardarMiDisponibilidad(10, {
        periodoAcademicoId: 2,
        bloques: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza hora final igual o anterior a la hora inicial', async () => {
    const periodo = crearPeriodo();

    periodoRepository.findOne.mockResolvedValue(periodo);

    periodoRepository.find.mockResolvedValue([periodo]);

    await expect(
      service.guardarMiDisponibilidad(10, {
        periodoAcademicoId: 2,
        bloques: [
          {
            dia: DiaSemana.LUNES,
            horaInicio: '10:00',
            horaFin: '10:00',
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza bloques superpuestos el mismo día', async () => {
    const periodo = crearPeriodo();

    periodoRepository.findOne.mockResolvedValue(periodo);

    periodoRepository.find.mockResolvedValue([periodo]);

    await expect(
      service.guardarMiDisponibilidad(10, {
        periodoAcademicoId: 2,
        bloques: [
          {
            dia: DiaSemana.LUNES,
            horaInicio: '08:00',
            horaFin: '11:00',
          },
          {
            dia: DiaSemana.LUNES,
            horaInicio: '10:30',
            horaFin: '13:00',
          },
        ],
      }),
    ).rejects.toThrow(ConflictException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('permite bloques consecutivos sin considerarlos choque', async () => {
    const periodo = crearPeriodo();

    periodoRepository.findOne.mockResolvedValue(periodo);

    periodoRepository.find.mockResolvedValue([periodo]);

    txDisponibilidadRepository.findOne.mockResolvedValue(null);

    const resultadoFinal = crearDisponibilidad({
      bloques: [
        crearBloque({
          id: 101,
          horaInicio: '08:00:00',
          horaFin: '10:00:00',
        }),
        crearBloque({
          id: 102,
          horaInicio: '10:00:00',
          horaFin: '12:00:00',
        }),
      ],
    });

    disponibilidadRepository.findOne.mockResolvedValue(resultadoFinal);

    const resultado = await service.guardarMiDisponibilidad(10, {
      periodoAcademicoId: 2,
      bloques: [
        {
          dia: DiaSemana.LUNES,
          horaInicio: '08:00',
          horaFin: '10:00',
        },
        {
          dia: DiaSemana.LUNES,
          horaInicio: '10:00',
          horaFin: '12:00',
        },
      ],
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    expect(txBloqueRepository.save).toHaveBeenCalled();

    expect(txHistorialRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'CREAR',
        usuarioId: 10,
      }),
    );

    expect(resultado.bloques).toHaveLength(2);
  });

  it('permite registrar que el profesor no tiene bloques disponibles', async () => {
    const periodo = crearPeriodo();

    periodoRepository.findOne.mockResolvedValue(periodo);

    periodoRepository.find.mockResolvedValue([periodo]);

    txDisponibilidadRepository.findOne.mockResolvedValue(null);

    disponibilidadRepository.findOne.mockResolvedValue(
      crearDisponibilidad({
        bloques: [],
      }),
    );

    const resultado = await service.guardarMiDisponibilidad(10, {
      periodoAcademicoId: 2,
      bloques: [],
      observaciones: 'No disponible este ciclo',
    });

    expect(txBloqueRepository.save).not.toHaveBeenCalled();

    expect(resultado.bloques).toEqual([]);
  });

  it('al modificar reemplaza los bloques anteriores y crea historial MODIFICAR', async () => {
    const periodo = crearPeriodo();

    periodoRepository.findOne.mockResolvedValue(periodo);

    periodoRepository.find.mockResolvedValue([periodo]);

    const existente = crearDisponibilidad();

    txDisponibilidadRepository.findOne.mockResolvedValue(existente);

    disponibilidadRepository.findOne.mockResolvedValue(
      crearDisponibilidad({
        bloques: [
          crearBloque({
            id: 200,
            dia: DiaSemana.MARTES,
            horaInicio: '13:00:00',
            horaFin: '17:00:00',
          }),
        ],
      }),
    );

    await service.guardarMiDisponibilidad(10, {
      periodoAcademicoId: 2,
      bloques: [
        {
          dia: DiaSemana.MARTES,
          horaInicio: '13:00',
          horaFin: '17:00',
        },
      ],
    });

    expect(txBloqueRepository.delete).toHaveBeenCalledWith({
      disponibilidadId: 50,
    });

    expect(txHistorialRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'MODIFICAR',
        datosAnteriores: expect.any(Object),
        datosNuevos: expect.any(Object),
      }),
    );
  });

  it('impide modificar una disponibilidad marcada como BLOQUEADA', async () => {
    const periodo = crearPeriodo();

    periodoRepository.findOne.mockResolvedValue(periodo);

    periodoRepository.find.mockResolvedValue([periodo]);

    txDisponibilidadRepository.findOne.mockResolvedValue(
      crearDisponibilidad({
        estado: EstadoDisponibilidad.BLOQUEADA,
      }),
    );

    await expect(
      service.guardarMiDisponibilidad(10, {
        periodoAcademicoId: 2,
        bloques: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('copia la disponibilidad del periodo inmediatamente anterior', async () => {
    const origen = crearPeriodo({
      id: 1,
      codigo: '2098-C2',
      nombre: 'II Ciclo 2098',
      anio: 2098,
      ciclo: 2,
      estado: EstadoPeriodoAcademico.CERRADO,
    });

    const destino = crearPeriodo({
      id: 2,
      codigo: '2099-C1',
      anio: 2099,
      ciclo: 1,
    });

    periodoRepository.findOne
      .mockResolvedValueOnce(origen)
      .mockResolvedValueOnce(destino)
      .mockResolvedValueOnce(destino);

    periodoRepository.find.mockResolvedValue([destino]);

    const disponibilidadOrigen = crearDisponibilidad({
      id: 40,
      periodoAcademicoId: 1,
      periodoAcademico: origen,
      bloques: [
        crearBloque({
          disponibilidadId: 40,
          dia: DiaSemana.MIERCOLES,
          horaInicio: '08:00:00',
          horaFin: '12:00:00',
        }),
      ],
    });

    const disponibilidadDestino = crearDisponibilidad({
      periodoAcademicoId: 2,
      periodoAcademico: destino,
      bloques: [
        crearBloque({
          dia: DiaSemana.MIERCOLES,
          horaInicio: '08:00:00',
          horaFin: '12:00:00',
        }),
      ],
    });

    disponibilidadRepository.findOne
      .mockResolvedValueOnce(disponibilidadOrigen)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(disponibilidadDestino);

    const resultado = await service.copiarDisponibilidadAnterior(10, {
      periodoOrigenId: 1,
      periodoDestinoId: 2,
    });

    expect(txHistorialRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'COPIAR_PERIODO_ANTERIOR',
      }),
    );

    expect(resultado.bloques).toHaveLength(1);
  });

  it('rechaza copiar desde un periodo que no es el inmediatamente anterior', async () => {
    const origen = crearPeriodo({
      id: 1,
      codigo: '2098-C1',
      anio: 2098,
      ciclo: 1,
      estado: EstadoPeriodoAcademico.CERRADO,
    });

    const destino = crearPeriodo({
      id: 2,
      codigo: '2099-C1',
      anio: 2099,
      ciclo: 1,
    });

    periodoRepository.findOne
      .mockResolvedValueOnce(origen)
      .mockResolvedValueOnce(destino)
      .mockResolvedValueOnce(destino);

    periodoRepository.find.mockResolvedValue([destino]);

    await expect(
      service.copiarDisponibilidadAnterior(10, {
        periodoOrigenId: 1,
        periodoDestinoId: 2,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('no expone campos sensibles del usuario en el historial', async () => {
    periodoRepository.findOne.mockResolvedValue(crearPeriodo());

    disponibilidadRepository.findOne.mockResolvedValue(crearDisponibilidad());

    historialRepository.find.mockResolvedValue([
      {
        id: 1,
        disponibilidadId: 50,
        usuarioId: 10,
        accion: 'CREAR',
        datosAnteriores: null,
        datosNuevos: {
          bloques: [],
        },
        createdAt: new Date(),
        usuario: crearProfesor({
          passwordHash: 'SECRETO',
          passwordResetTokenHash: 'TOKEN-SECRETO',
        }),
      },
    ]);

    const resultado = await service.obtenerHistorialMiDisponibilidad(10, 2);

    expect(resultado).toHaveLength(1);

    expect(resultado[0].usuario).not.toHaveProperty('passwordHash');

    expect(resultado[0].usuario).not.toHaveProperty('passwordResetTokenHash');
  });
  it('devuelve BLOQUEADA una disponibilidad cuando el periodo está EN_CURSO', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.EN_CURSO,
    });

    periodoRepository.findOne.mockResolvedValue(periodo);

    disponibilidadRepository.findOne.mockResolvedValue(
      crearDisponibilidad({
        estado: EstadoDisponibilidad.REGISTRADA,

        periodoAcademico: periodo,
      }),
    );

    const resultado = await service.consultarMiDisponibilidad(10, 2);

    expect(resultado.estado).toBe(EstadoDisponibilidad.BLOQUEADA);

    expect(resultado.puedeEditar).toBe(false);
  });

  it('devuelve BLOQUEADA una disponibilidad histórica de un periodo CERRADO', async () => {
    const periodo = crearPeriodo({
      estado: EstadoPeriodoAcademico.CERRADO,
    });

    periodoRepository.findOne.mockResolvedValue(periodo);

    disponibilidadRepository.findOne.mockResolvedValue(
      crearDisponibilidad({
        estado: EstadoDisponibilidad.REGISTRADA,

        periodoAcademico: periodo,
      }),
    );

    const resultado = await service.consultarMiDisponibilidad(10, 2);

    expect(resultado.estado).toBe(EstadoDisponibilidad.BLOQUEADA);

    expect(resultado.bloques).toHaveLength(1);
  });

  it('mantiene REGISTRADA y editable durante EN_PREPARACION antes de la fecha límite', async () => {
    const periodo = crearPeriodo({
      fechaLimiteDisponibilidad: '2099-01-20',

      estado: EstadoPeriodoAcademico.EN_PREPARACION,
    });

    periodoRepository.findOne.mockResolvedValue(periodo);

    disponibilidadRepository.findOne.mockResolvedValue(
      crearDisponibilidad({
        estado: EstadoDisponibilidad.REGISTRADA,

        periodoAcademico: periodo,
      }),
    );

    const resultado = await service.consultarMiDisponibilidad(10, 2);

    expect(resultado.estado).toBe(EstadoDisponibilidad.REGISTRADA);

    expect(resultado.puedeEditar).toBe(true);
  });
});
