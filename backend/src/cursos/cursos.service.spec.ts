import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { GradoAcademico } from '../carreras/constants/grado-academico.constant';
import { Carrera } from '../carreras/entities/carrera.entity';
import { TipoPlanAsignatura } from '../planes-estudio/constants/tipo-plan-asignatura.constant';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { CursosService } from './cursos.service';
import { Curso } from './entities/curso.entity';

describe('CursosService', () => {
  let service: CursosService;
  let cursoRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let planAsignaturaRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };

  const carrera = {
    id: 1,
    codigo: 'EIF',
    nombre: 'Ingeniería en Sistemas',
    grado: GradoAcademico.BACHILLERATO,
    descripcion: null,
    activo: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as Carrera;

  const plan = {
    id: 2,
    carreraId: 1,
    codigo: 'PLAN-2026',
    nombre: 'Plan 2026',
    descripcion: null,
    activo: true,
    carrera,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as PlanEstudio;

  const crearPlanAsignatura = (
    cambios: Partial<PlanAsignatura> = {},
  ): PlanAsignatura => ({
    id: 17,
    planEstudioId: 2,
    cursoId: null,
    bloqueId: null,
    nivel: 1,
    ciclo: 1,
    orden: 1,
    creditos: 4,
    horasTeoria: null,
    horasPractica: null,
    horasLaboratorio: null,
    horasGira: null,
    horasEstudioIndependiente: null,
    horasTotales: null,
    horasDocente: null,
    observacionHoras: null,
    tipo: TipoPlanAsignatura.OBLIGATORIA,
    codigoReferencia: 'EIF201',
    nombreReferencia: 'Programación I',
    activo: true,
    planEstudio: plan,
    bloque: null,
    curso: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...cambios,
  });

  const crearCurso = (cambios: Partial<Curso> = {}): Curso => ({
    id: 5,
    codigo: 'EIF201',
    nombre: 'Programación I',
    descripcion: 'Curso introductorio',
    activo: true,
    carreras: [carrera],
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
    planAsignaturaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    service = new CursosService(
      cursoRepository as unknown as Repository<Curso>,
      planAsignaturaRepository as unknown as Repository<PlanAsignatura>,
    );

    jest.clearAllMocks();
  });

  it('lista los cursos ordenados por código', async () => {
    const cursos = [
      crearCurso(),
      crearCurso({
        id: 6,
        codigo: 'ETA400',
        nombre: 'Administración General',
      }),
    ];
    cursoRepository.find.mockResolvedValue(cursos);

    const resultado = await service.listar();

    expect(cursoRepository.find).toHaveBeenCalledWith({
      relations: { carreras: true },
      order: { codigo: 'ASC' },
    });
    expect(resultado).toEqual(cursos);
  });

  it('obtiene un curso por id', async () => {
    const curso = crearCurso();
    cursoRepository.findOne.mockResolvedValue(curso);

    const resultado = await service.obtenerPorId(5);

    expect(cursoRepository.findOne).toHaveBeenCalledWith({
      where: { id: 5 },
      relations: { carreras: true },
    });
    expect(resultado).toEqual(curso);
  });

  it('devuelve 404 si el curso no existe', async () => {
    cursoRepository.findOne.mockResolvedValue(null);

    await expect(service.obtenerPorId(999)).rejects.toThrow(NotFoundException);
  });

  it('crea un curso desde una asignatura del plan', async () => {
    const planAsignatura = crearPlanAsignatura();
    const curso = crearCurso();
    planAsignaturaRepository.findOne.mockResolvedValue(planAsignatura);
    cursoRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(curso);
    cursoRepository.save.mockResolvedValue(curso);
    planAsignaturaRepository.save.mockResolvedValue({
      ...planAsignatura,
      cursoId: 5,
      curso,
    });

    const resultado = await service.crear({
      planAsignaturaId: 17,
      descripcion: ' Curso introductorio ',
    });

    expect(cursoRepository.create).toHaveBeenCalledWith({
      codigo: 'EIF201',
      nombre: 'Programación I',
      descripcion: 'Curso introductorio',
      activo: true,
      carreras: [carrera],
    });
    expect(planAsignaturaRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 17,
        cursoId: 5,
      }),
    );
    expect(resultado).toEqual(curso);
  });

  it('rechaza una asignatura del plan inexistente', async () => {
    planAsignaturaRepository.findOne.mockResolvedValue(null);

    await expect(
      service.crear({ planAsignaturaId: 999 }),
    ).rejects.toThrow(NotFoundException);

    expect(cursoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza una asignatura que ya está vinculada a un curso', async () => {
    const curso = crearCurso();
    planAsignaturaRepository.findOne.mockResolvedValue(
      crearPlanAsignatura({
        cursoId: 5,
        curso,
      }),
    );

    await expect(
      service.crear({ planAsignaturaId: 17 }),
    ).rejects.toThrow(ConflictException);

    expect(cursoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza una asignatura o un plan inactivo', async () => {
    planAsignaturaRepository.findOne.mockResolvedValueOnce(
      crearPlanAsignatura({ activo: false }),
    );

    await expect(
      service.crear({ planAsignaturaId: 17 }),
    ).rejects.toThrow(BadRequestException);

    planAsignaturaRepository.findOne.mockResolvedValueOnce(
      crearPlanAsignatura({
        planEstudio: { ...plan, activo: false },
      }),
    );

    await expect(
      service.crear({ planAsignaturaId: 17 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('reutiliza un curso existente con el mismo código y nombre', async () => {
    const planAsignatura = crearPlanAsignatura();
    const curso = crearCurso();
    planAsignaturaRepository.findOne.mockResolvedValue(planAsignatura);
    cursoRepository.findOne
      .mockResolvedValueOnce(curso)
      .mockResolvedValueOnce(curso);
    planAsignaturaRepository.save.mockResolvedValue({
      ...planAsignatura,
      cursoId: 5,
      curso,
    });

    const resultado = await service.crear({ planAsignaturaId: 17 });

    expect(cursoRepository.create).not.toHaveBeenCalled();
    expect(cursoRepository.save).not.toHaveBeenCalled();
    expect(planAsignaturaRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ cursoId: 5 }),
    );
    expect(resultado).toEqual(curso);
  });

  it('rechaza un código existente con un nombre diferente', async () => {
    planAsignaturaRepository.findOne.mockResolvedValue(crearPlanAsignatura());
    cursoRepository.findOne.mockResolvedValue(
      crearCurso({ nombre: 'Bases de Datos' }),
    );

    await expect(
      service.crear({ planAsignaturaId: 17 }),
    ).rejects.toThrow(ConflictException);

    expect(planAsignaturaRepository.save).not.toHaveBeenCalled();
  });

  it('convierte un duplicado de MySQL en conflicto', async () => {
    planAsignaturaRepository.findOne.mockResolvedValue(crearPlanAsignatura());
    cursoRepository.findOne.mockResolvedValue(null);
    cursoRepository.save.mockRejectedValue({ code: 'ER_DUP_ENTRY' });

    await expect(
      service.crear({ planAsignaturaId: 17 }),
    ).rejects.toThrow(ConflictException);

    expect(planAsignaturaRepository.save).not.toHaveBeenCalled();
  });

  it('lista únicamente asignaturas disponibles según los filtros', async () => {
    const planAsignatura = crearPlanAsignatura();
    planAsignaturaRepository.find.mockResolvedValue([planAsignatura]);

    const resultado = await service.listarAsignaturasDisponibles({
      carreraId: 1,
      planId: 2,
      nivel: 1,
      ciclo: 1,
    });

    expect(planAsignaturaRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activo: true,
          planEstudioId: 2,
          nivel: 1,
          ciclo: 1,
          planEstudio: {
            activo: true,
            carreraId: 1,
          },
        }),
      }),
    );
    expect(resultado).toEqual([planAsignatura]);
  });

  it('actualiza solamente la descripción del curso', async () => {
    const curso = crearCurso();
    cursoRepository.findOne
      .mockResolvedValueOnce({ ...curso })
      .mockResolvedValueOnce({
        ...curso,
        descripcion: 'Nueva descripción',
      });
    cursoRepository.save.mockResolvedValue({
      ...curso,
      descripcion: 'Nueva descripción',
    });

    const resultado = await service.actualizar(5, {
      descripcion: ' Nueva descripción ',
    });

    expect(cursoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: 'EIF201',
        nombre: 'Programación I',
        descripcion: 'Nueva descripción',
      }),
    );
    expect(resultado.descripcion).toBe('Nueva descripción');
  });

  it('permite dejar la descripción en null', async () => {
    const curso = crearCurso();
    cursoRepository.findOne
      .mockResolvedValueOnce({ ...curso })
      .mockResolvedValueOnce({ ...curso, descripcion: null });
    cursoRepository.save.mockResolvedValue({ ...curso, descripcion: null });

    const resultado = await service.actualizar(5, { descripcion: '' });

    expect(cursoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ descripcion: null }),
    );
    expect(resultado.descripcion).toBeNull();
  });

  it('cambia el estado de un curso', async () => {
    const curso = crearCurso();
    cursoRepository.findOne
      .mockResolvedValueOnce(curso)
      .mockResolvedValueOnce({ ...curso, activo: false });
    cursoRepository.update.mockResolvedValue({ affected: 1 });

    const resultado = await service.cambiarEstado(5, false);

    expect(cursoRepository.update).toHaveBeenCalledWith(5, { activo: false });
    expect(resultado.activo).toBe(false);
  });
});
