import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { TipoOptativa } from './constants/tipo-optativa.constant';
import { CursoOptativo } from './entities/curso-optativo.entity';
import { OptativasService } from './optativas.service';

describe('OptativasService', () => {
  let service: OptativasService;
  let optativaRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let cursoRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let carreraRepository: {
    findOne: jest.Mock;
  };

  const carreraInformatica: Carrera = {
    id: 1,
    codigo: 'EIF',
    nombre: 'Ingeniería en Sistemas de Información',
    descripcion: null,
    activo: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const cursoSeguridad: Curso = {
    id: 10,
    codigo: 'EIF472',
    nombre: 'Seguridad Informática',
    descripcion: 'Aspectos de seguridad',
    activo: true,
    carreras: [carreraInformatica],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const crearCursoOptativo = (
    cambios: Partial<CursoOptativo> = {},
  ): CursoOptativo => ({
    id: 1,
    cursoId: 10,
    tipo: TipoOptativa.DISCIPLINARIA,
    carreraOrigenId: 1,
    activo: true,
    curso: cursoSeguridad,
    carreraOrigen: carreraInformatica,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...cambios,
  });

  beforeEach(() => {
    optativaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<CursoOptativo>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };
    cursoRepository = {
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<Curso>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };
    carreraRepository = {
      findOne: jest.fn(),
    };

    service = new OptativasService(
      optativaRepository as unknown as Repository<CursoOptativo>,
      cursoRepository as unknown as Repository<Curso>,
      carreraRepository as unknown as Repository<Carrera>,
    );

    jest.clearAllMocks();
  });

  it('crea una optativa disciplinaria con carrera de origen creando un nuevo Curso', async () => {
    const optativa = crearCursoOptativo();
    carreraRepository.findOne.mockResolvedValue(carreraInformatica);
    cursoRepository.findOne.mockResolvedValue(null);
    cursoRepository.save.mockResolvedValue(cursoSeguridad);
    optativaRepository.findOne
      .mockResolvedValueOnce(null) // para existente
      .mockResolvedValueOnce(optativa); // para obtenerPorId
    optativaRepository.save.mockResolvedValue(optativa);

    const resultado = await service.crear({
      codigo: 'EIF472',
      nombre: 'Seguridad Informática',
      descripcion: 'Aspectos de seguridad',
      tipo: TipoOptativa.DISCIPLINARIA,
      carreraOrigenId: 1,
    });

    expect(carreraRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(cursoRepository.create).toHaveBeenCalledWith({
      codigo: 'EIF472',
      nombre: 'Seguridad Informática',
      descripcion: 'Aspectos de seguridad',
      activo: true,
      carreras: [carreraInformatica],
    });
    expect(cursoRepository.save).toHaveBeenCalled();
    expect(optativaRepository.create).toHaveBeenCalledWith({
      cursoId: 10,
      curso: cursoSeguridad,
      tipo: TipoOptativa.DISCIPLINARIA,
      carreraOrigenId: 1,
      carreraOrigen: carreraInformatica,
      activo: true,
    });
    expect(resultado).toEqual(optativa);
  });

  it('reutiliza un Curso existente si ya existe con el mismo código y nombre', async () => {
    const optativa = crearCursoOptativo();
    carreraRepository.findOne.mockResolvedValue(carreraInformatica);
    cursoRepository.findOne.mockResolvedValue(cursoSeguridad);
    optativaRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(optativa);
    optativaRepository.save.mockResolvedValue(optativa);

    const resultado = await service.crear({
      codigo: 'EIF472',
      nombre: 'Seguridad Informática',
      tipo: TipoOptativa.DISCIPLINARIA,
      carreraOrigenId: 1,
    });

    expect(cursoRepository.create).not.toHaveBeenCalled();
    expect(cursoRepository.save).not.toHaveBeenCalled();
    expect(optativaRepository.save).toHaveBeenCalled();
    expect(resultado).toEqual(optativa);
  });

  it('rechaza si ya existe un curso con el mismo código pero nombre diferente', async () => {
    carreraRepository.findOne.mockResolvedValue(carreraInformatica);
    cursoRepository.findOne.mockResolvedValue({
      ...cursoSeguridad,
      nombre: 'Ciberseguridad Avanzada',
    });

    await expect(
      service.crear({
        codigo: 'EIF472',
        nombre: 'Seguridad Informática',
        tipo: TipoOptativa.DISCIPLINARIA,
        carreraOrigenId: 1,
      }),
    ).rejects.toThrow(ConflictException);

    expect(optativaRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza una optativa DISCIPLINARIA sin carreraOrigenId', async () => {
    await expect(
      service.crear({
        codigo: 'EIF472',
        nombre: 'Seguridad Informática',
        tipo: TipoOptativa.DISCIPLINARIA,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(carreraRepository.findOne).not.toHaveBeenCalled();
    expect(cursoRepository.findOne).not.toHaveBeenCalled();
  });

  it('rechaza si la carrera de origen no existe', async () => {
    carreraRepository.findOne.mockResolvedValue(null);

    await expect(
      service.crear({
        codigo: 'EIF472',
        nombre: 'Seguridad Informática',
        tipo: TipoOptativa.DISCIPLINARIA,
        carreraOrigenId: 999,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(cursoRepository.findOne).not.toHaveBeenCalled();
  });

  it('rechaza si la carrera de origen está inactiva', async () => {
    carreraRepository.findOne.mockResolvedValue({
      ...carreraInformatica,
      activo: false,
    });

    await expect(
      service.crear({
        codigo: 'EIF472',
        nombre: 'Seguridad Informática',
        tipo: TipoOptativa.DISCIPLINARIA,
        carreraOrigenId: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite crear una optativa ABIERTA sin carrera de origen', async () => {
    const cursoAbierto: Curso = {
      id: 20,
      codigo: 'OPT-AB-01',
      nombre: 'Etiqueta y Protocolo',
      descripcion: null,
      activo: true,
      carreras: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const optativaAbierta = crearCursoOptativo({
      id: 2,
      cursoId: 20,
      tipo: TipoOptativa.ABIERTA,
      carreraOrigenId: null,
      carreraOrigen: null,
      curso: cursoAbierto,
    });

    cursoRepository.findOne.mockResolvedValue(null);
    cursoRepository.save.mockResolvedValue(cursoAbierto);
    optativaRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(optativaAbierta);
    optativaRepository.save.mockResolvedValue(optativaAbierta);

    const resultado = await service.crear({
      codigo: 'OPT-AB-01',
      nombre: 'Etiqueta y Protocolo',
      tipo: TipoOptativa.ABIERTA,
    });

    expect(carreraRepository.findOne).not.toHaveBeenCalled();
    expect(optativaRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: TipoOptativa.ABIERTA,
        carreraOrigenId: null,
        carreraOrigen: null,
      }),
    );
    expect(resultado.tipo).toBe(TipoOptativa.ABIERTA);
  });

  it('permite crear una optativa de SEDE sin carrera de origen', async () => {
    const cursoSede: Curso = {
      id: 30,
      codigo: 'OPT-SED-01',
      nombre: 'Taller de Sede Regional',
      descripcion: null,
      activo: true,
      carreras: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const optativaSede = crearCursoOptativo({
      id: 3,
      cursoId: 30,
      tipo: TipoOptativa.SEDE,
      carreraOrigenId: null,
      carreraOrigen: null,
      curso: cursoSede,
    });

    cursoRepository.findOne.mockResolvedValue(null);
    cursoRepository.save.mockResolvedValue(cursoSede);
    optativaRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(optativaSede);
    optativaRepository.save.mockResolvedValue(optativaSede);

    const resultado = await service.crear({
      codigo: 'OPT-SED-01',
      nombre: 'Taller de Sede Regional',
      tipo: TipoOptativa.SEDE,
    });

    expect(resultado.tipo).toBe(TipoOptativa.SEDE);
  });

  it('rechaza si el mismo Curso ya está registrado en el catálogo de optativas', async () => {
    carreraRepository.findOne.mockResolvedValue(carreraInformatica);
    cursoRepository.findOne.mockResolvedValue(cursoSeguridad);
    optativaRepository.findOne.mockResolvedValue(crearCursoOptativo());

    await expect(
      service.crear({
        codigo: 'EIF472',
        nombre: 'Seguridad Informática',
        tipo: TipoOptativa.DISCIPLINARIA,
        carreraOrigenId: 1,
      }),
    ).rejects.toThrow(ConflictException);

    expect(optativaRepository.save).not.toHaveBeenCalled();
  });

  it('desactivar una optativa no desactiva el Curso', async () => {
    const optativa = crearCursoOptativo();
    optativaRepository.findOne
      .mockResolvedValueOnce(optativa)
      .mockResolvedValueOnce({ ...optativa, activo: false });
    optativaRepository.update.mockResolvedValue({ affected: 1 });

    const resultado = await service.cambiarEstado(1, false);

    expect(optativaRepository.update).toHaveBeenCalledWith(1, {
      activo: false,
    });
    expect(cursoRepository.update).not.toHaveBeenCalled();
    expect(resultado.activo).toBe(false);
  });

  it('lista todas las optativas ordenadas por ID', async () => {
    const optativas = [crearCursoOptativo()];
    optativaRepository.find.mockResolvedValue(optativas);

    const resultado = await service.listar();

    expect(optativaRepository.find).toHaveBeenCalledWith({
      relations: { curso: true, carreraOrigen: true },
      order: { id: 'ASC' },
    });
    expect(resultado).toEqual(optativas);
  });

  it('obtiene una optativa por id', async () => {
    const optativa = crearCursoOptativo();
    optativaRepository.findOne.mockResolvedValue(optativa);

    const resultado = await service.obtenerPorId(1);

    expect(optativaRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      relations: { curso: true, carreraOrigen: true },
    });
    expect(resultado).toEqual(optativa);
  });

  it('actualiza la clasificación y descripción de una optativa', async () => {
    const optativa = crearCursoOptativo();
    const carreraTurismo: Carrera = {
      id: 2,
      codigo: 'TUR',
      nombre: 'Gestión Turística',
      descripcion: null,
      activo: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    carreraRepository.findOne.mockResolvedValue(carreraTurismo);
    optativaRepository.findOne
      .mockResolvedValueOnce(optativa)
      .mockResolvedValueOnce({
        ...optativa,
        carreraOrigenId: 2,
        carreraOrigen: carreraTurismo,
        curso: { ...cursoSeguridad, descripcion: 'Nueva descripción' },
      });
    cursoRepository.save.mockResolvedValue({
      ...cursoSeguridad,
      descripcion: 'Nueva descripción',
    });
    optativaRepository.save.mockResolvedValue(optativa);

    const resultado = await service.actualizar(1, {
      carreraOrigenId: 2,
      descripcion: 'Nueva descripción',
    });

    expect(carreraRepository.findOne).toHaveBeenCalledWith({
      where: { id: 2 },
    });
    expect(cursoRepository.save).toHaveBeenCalled();
    expect(optativaRepository.save).toHaveBeenCalled();
    expect(resultado.carreraOrigenId).toBe(2);
  });
});
