import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from './entities/curso.entity';
import { CursosService } from './cursos.service';

describe('CursosService', () => {
  let service: CursosService;

  let cursoRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let carreraRepository: {
    find: jest.Mock;
  };

  const carreraInformatica = {
    id: 1,
    codigo: 'EIF',
    nombre: 'Ingeniería en Sistemas',
    gradoAcademico: 'BACHILLERATO',
    descripcion: null,
    activo: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as Carrera;

  const crearCurso = (cambios: Partial<Curso> = {}): Curso => ({
    id: 1,
    codigo: 'EIF201',
    nombre: 'Programación I',
    descripcion: 'Curso de programación',
    activo: true,
    carreras: [carreraInformatica],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...cambios,
  });

  beforeEach(() => {
    cursoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<Curso>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };
    carreraRepository = {
      find: jest.fn().mockResolvedValue([carreraInformatica]),
    };

    service = new CursosService(
      cursoRepository as unknown as Repository<Curso>,
      carreraRepository as unknown as Repository<Carrera>,
    );

    jest.clearAllMocks();
  });

  it('lista los cursos ordenados por código', async () => {
    const cursos = [
      crearCurso(),
      crearCurso({
        id: 2,
        codigo: 'ETA400',
        nombre: 'Administración General',
      }),
    ];

    cursoRepository.find.mockResolvedValue(cursos);

    const resultado = await service.listar();

    expect(cursoRepository.find).toHaveBeenCalledWith({
      relations: {
        carreras: true,
      },
      order: {
        codigo: 'ASC',
      },
    });

    expect(resultado).toEqual(cursos);
  });

  it('obtiene un curso por id', async () => {
    const curso = crearCurso();

    cursoRepository.findOne.mockResolvedValue(curso);

    const resultado = await service.obtenerPorId(1);

    expect(cursoRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 1,
      },
      relations: {
        carreras: true,
      },
    });

    expect(resultado).toEqual(curso);
  });

  it('devuelve 404 si el curso no existe', async () => {
    cursoRepository.findOne.mockResolvedValue(null);

    await expect(service.obtenerPorId(999)).rejects.toThrow(NotFoundException);
  });

  it('crea un curso normalizando el código', async () => {
    cursoRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(crearCurso());

    const cursoGuardado = crearCurso();

    cursoRepository.save.mockResolvedValue(cursoGuardado);

    const resultado = await service.crear({
      codigo: ' eif201 ',
      nombre: ' Programación I ',
      descripcion: ' Curso de programación ',
      carreraIds: [1],
    });

    expect(cursoRepository.create).toHaveBeenCalledWith({
      codigo: 'EIF201',
      nombre: 'Programación I',
      descripcion: 'Curso de programación',
      activo: true,
      carreras: [carreraInformatica],
    });

    expect(carreraRepository.find).toHaveBeenCalledTimes(1);

    expect(resultado).toEqual(cursoGuardado);
  });

  it('rechaza un código duplicado', async () => {
    cursoRepository.findOne.mockResolvedValue(crearCurso());

    await expect(
      service.crear({
        codigo: 'EIF201',
        nombre: 'Otro curso',
        carreraIds: [1],
      }),
    ).rejects.toThrow(ConflictException);

    expect(cursoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza código vacío después de normalizar', async () => {
    await expect(
      service.crear({
        codigo: '   ',
        nombre: 'Curso prueba',
        carreraIds: [1],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(cursoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza nombre vacío después de normalizar', async () => {
    await expect(
      service.crear({
        codigo: 'EIF999',
        nombre: '   ',
        carreraIds: [1],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(cursoRepository.save).not.toHaveBeenCalled();
  });

  it('actualiza y normaliza un curso', async () => {
    cursoRepository.findOne
      .mockResolvedValueOnce(crearCurso())
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        crearCurso({
          codigo: 'EIF202',
          nombre: 'Soporte Técnico',
        }),
      );

    const resultado = await service.actualizar(1, {
      codigo: ' eif202 ',
      nombre: ' Soporte Técnico ',
    });

    expect(cursoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: 'EIF202',
        nombre: 'Soporte Técnico',
      }),
    );

    expect(resultado.codigo).toBe('EIF202');
  });

  it('permite dejar la descripción en null', async () => {
    cursoRepository.findOne
      .mockResolvedValueOnce(crearCurso())
      .mockResolvedValueOnce(
        crearCurso({
          descripcion: null,
        }),
      );

    await service.actualizar(1, {
      descripcion: '',
    });

    expect(cursoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        descripcion: null,
      }),
    );
  });

  it('cambia el estado de un curso', async () => {
    cursoRepository.findOne
      .mockResolvedValueOnce(crearCurso())
      .mockResolvedValueOnce(
        crearCurso({
          activo: false,
        }),
      );

    const resultado = await service.cambiarEstado(1, false);

    expect(cursoRepository.update).toHaveBeenCalledWith(1, {
      activo: false,
    });

    expect(resultado.activo).toBe(false);
  });

  it('convierte un duplicado de MySQL en conflicto', async () => {
    cursoRepository.findOne.mockResolvedValue(null);

    cursoRepository.save.mockRejectedValue({
      code: 'ER_DUP_ENTRY',
    });

    await expect(
      service.crear({
        codigo: 'EIF201',
        nombre: 'Programación I',
        carreraIds: [1],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza carreras inexistentes al crear', async () => {
    cursoRepository.findOne.mockResolvedValue(null);
    carreraRepository.find.mockResolvedValue([]);

    await expect(
      service.crear({
        codigo: 'EIF203',
        nombre: 'Estructuras de datos',
        carreraIds: [999],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(cursoRepository.save).not.toHaveBeenCalled();
  });

  it('reemplaza las carreras durante la actualización', async () => {
    const carreraAdministracion = {
      ...carreraInformatica,
      id: 2,
      codigo: 'ADM',
      nombre: 'Administración',
    };

    cursoRepository.findOne
      .mockResolvedValueOnce(crearCurso())
      .mockResolvedValueOnce(crearCurso({ carreras: [carreraAdministracion] }));
    carreraRepository.find.mockResolvedValue([carreraAdministracion]);

    const resultado = await service.actualizar(1, {
      carreraIds: [2],
    });

    expect(cursoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        carreras: [carreraAdministracion],
      }),
    );
    expect(resultado.carreras).toEqual([carreraAdministracion]);
  });
});
