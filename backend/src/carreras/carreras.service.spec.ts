import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { GradoAcademico } from './constants/grado-academico.constant';
import { CarrerasService } from './carreras.service';
import { Carrera } from './entities/carrera.entity';

describe('CarrerasService', () => {
  let service: CarrerasService;

  let carreraRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  const crearCarrera = (cambios: Partial<Carrera> = {}): Carrera => ({
    id: 1,
    codigo: 'EIF',
    nombre: 'Ingeniería en Sistemas de Información',
    grado: GradoAcademico.BACHILLERATO,
    descripcion: 'Carrera de informática',
    activo: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...cambios,
  });

  beforeEach(() => {
    carreraRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<Carrera>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };

    service = new CarrerasService(
      carreraRepository as unknown as Repository<Carrera>,
    );

    jest.clearAllMocks();
  });

  it('lista las carreras ordenadas por nombre', async () => {
    const carreras = [
      crearCarrera(),
      crearCarrera({
        id: 2,
        codigo: 'ADM',
        nombre: 'Administración',
      }),
    ];

    carreraRepository.find.mockResolvedValue(carreras);

    const resultado = await service.listar();

    expect(carreraRepository.find).toHaveBeenCalledWith({
      order: {
        nombre: 'ASC',
      },
    });

    expect(resultado).toEqual(carreras);
  });

  it('obtiene una carrera por id', async () => {
    const carrera = crearCarrera();

    carreraRepository.findOne.mockResolvedValue(carrera);

    const resultado = await service.obtenerPorId(1);

    expect(carreraRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 1,
      },
    });

    expect(resultado).toEqual(carrera);
  });

  it('devuelve 404 si la carrera no existe', async () => {
    carreraRepository.findOne.mockResolvedValue(null);

    await expect(service.obtenerPorId(999)).rejects.toThrow(NotFoundException);
  });

  it('crea una carrera normalizando el código', async () => {
    carreraRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const carreraGuardada = crearCarrera();

    carreraRepository.save.mockResolvedValue(carreraGuardada);

    const resultado = await service.crear({
      codigo: ' eif ',
      nombre: ' Ingeniería en Sistemas de Información ',
      grado: GradoAcademico.BACHILLERATO,
      descripcion: ' Carrera de informática ',
    });

    expect(carreraRepository.create).toHaveBeenCalledWith({
      codigo: 'EIF',
      nombre: 'Ingeniería en Sistemas de Información',
      grado: GradoAcademico.BACHILLERATO,
      descripcion: 'Carrera de informática',
      activo: true,
    });

    expect(resultado).toEqual(carreraGuardada);
  });

  it('rechaza un código duplicado', async () => {
    carreraRepository.findOne.mockResolvedValue(crearCarrera());

    await expect(
      service.crear({
        codigo: 'EIF',
        nombre: 'Otra carrera',
        grado: GradoAcademico.BACHILLERATO,
      }),
    ).rejects.toThrow(ConflictException);

    expect(carreraRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza un nombre duplicado', async () => {
    carreraRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(crearCarrera());

    await expect(
      service.crear({
        codigo: 'OTR',
        nombre: 'Ingeniería en Sistemas de Información',
        grado: GradoAcademico.BACHILLERATO,
      }),
    ).rejects.toThrow(ConflictException);

    expect(carreraRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza código vacío después de normalizar', async () => {
    await expect(
      service.crear({
        codigo: '   ',
        nombre: 'Carrera prueba',
        grado: GradoAcademico.BACHILLERATO,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('actualiza una carrera y normaliza los datos', async () => {
    carreraRepository.findOne
      .mockResolvedValueOnce(crearCarrera())
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        crearCarrera({
          codigo: 'INFO',
          nombre: 'Informática',
        }),
      );

    const resultado = await service.actualizar(1, {
      codigo: ' info ',
      nombre: ' Informática ',
      grado: GradoAcademico.LICENCIATURA,
    });

    expect(carreraRepository.update).toHaveBeenCalledWith(1, {
      codigo: 'INFO',
      nombre: 'Informática',
      grado: GradoAcademico.LICENCIATURA,
    });

    expect(resultado.codigo).toBe('INFO');
  });

  it('permite dejar la descripción en null', async () => {
    carreraRepository.findOne
      .mockResolvedValueOnce(crearCarrera())
      .mockResolvedValueOnce(
        crearCarrera({
          descripcion: null,
        }),
      );

    await service.actualizar(1, {
      descripcion: '',
    });

    expect(carreraRepository.update).toHaveBeenCalledWith(1, {
      descripcion: null,
    });
  });

  it('cambia el estado de una carrera', async () => {
    carreraRepository.findOne
      .mockResolvedValueOnce(crearCarrera())
      .mockResolvedValueOnce(
        crearCarrera({
          activo: false,
        }),
      );

    const resultado = await service.cambiarEstado(1, false);

    expect(carreraRepository.update).toHaveBeenCalledWith(1, {
      activo: false,
    });

    expect(resultado.activo).toBe(false);
  });
});
