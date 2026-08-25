import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { GradoAcademico } from '../carreras/constants/grado-academico.constant';
import { Carrera } from '../carreras/entities/carrera.entity';
import { TipoPlanAsignatura } from './constants/tipo-plan-asignatura.constant';
import { TipoBloquePlan } from './constants/tipo-bloque-plan.constant';
import { BloquePlan } from './entities/bloque-plan.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanAsignaturasService } from './plan-asignaturas.service';

describe('PlanAsignaturasService', () => {
  let service: PlanAsignaturasService;
  let asignaturaRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let planRepository: { findOne: jest.Mock };
  let bloqueRepository: { findOne: jest.Mock };
  let transactionRepository: { save: jest.Mock };
  let dataSource: { transaction: jest.Mock };

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
    id: 1,
    carreraId: 1,
    codigo: 'BA-INFORM 2012-10',
    nombre: 'Plan de Bachillerato',
    descripcion: null,
    activo: true,
    carrera,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as PlanEstudio;

  const crearAsignatura = (
    cambios: Partial<PlanAsignatura> = {},
  ): PlanAsignatura => ({
    id: 10,
    planEstudioId: 1,
    bloqueId: null,
    cursoId: null,
    nivel: 1,
    ciclo: 1,
    orden: 1,
    creditos: 3,
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

  beforeEach(() => {
    asignaturaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((datos: Partial<PlanAsignatura>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };
    planRepository = { findOne: jest.fn() };
    bloqueRepository = { findOne: jest.fn() };
    transactionRepository = { save: jest.fn() };
    dataSource = {
      transaction: jest.fn(async (callback) =>
        callback({
          getRepository: jest.fn().mockReturnValue(transactionRepository),
        }),
      ),
    };

    service = new PlanAsignaturasService(
      asignaturaRepository as unknown as Repository<PlanAsignatura>,
      planRepository as unknown as Repository<PlanEstudio>,
      bloqueRepository as unknown as Repository<BloquePlan>,
      dataSource as unknown as DataSource,
    );
  });

  it('lista las asignaturas ordenadas dentro del plan', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.find.mockResolvedValue([crearAsignatura()]);

    await service.listar(1);

    expect(asignaturaRepository.find).toHaveBeenCalledWith({
      where: { planEstudioId: 1 },
      relations: { curso: true, bloque: true },
      order: { nivel: 'ASC', ciclo: 'ASC', orden: 'ASC' },
    });
  });

  it('devuelve 404 cuando el plan no existe', async () => {
    planRepository.findOne.mockResolvedValue(null);

    await expect(service.listar(999)).rejects.toThrow(NotFoundException);
  });

  it('rechaza modificar un plan inactivo', async () => {
    planRepository.findOne.mockResolvedValue({ ...plan, activo: false });

    await expect(
      service.crear(1, {
        nivel: 1,
        ciclo: 1,
        orden: 1,
        creditos: 3,
        tipo: TipoPlanAsignatura.OBLIGATORIA,
        codigoReferencia: 'EIF201',
        nombreReferencia: 'Programación I',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('crea una asignatura sin curso y normaliza código y nombre', async () => {
    const guardada = crearAsignatura();
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(guardada);
    asignaturaRepository.save.mockResolvedValue(guardada);

    const resultado = await service.crear(1, {
      nivel: 1,
      ciclo: 1,
      orden: 1,
      creditos: 3,
      tipo: TipoPlanAsignatura.OBLIGATORIA,
      codigoReferencia: ' eif201 ',
      nombreReferencia: ' Programación I ',
    });

    expect(asignaturaRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        planEstudioId: 1,
        bloqueId: null,
        bloque: null,
        cursoId: null,
        curso: null,
        codigoReferencia: 'EIF201',
        nombreReferencia: 'Programación I',
      }),
    );
    expect(resultado).toEqual(guardada);
  });

  it('rechaza un código duplicado dentro del mismo plan', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne.mockResolvedValue(crearAsignatura());

    await expect(
      service.crear(1, {
        nivel: 1,
        ciclo: 1,
        orden: 2,
        creditos: 3,
        tipo: TipoPlanAsignatura.OBLIGATORIA,
        codigoReferencia: ' eif201 ',
        nombreReferencia: 'Programación avanzada',
      }),
    ).rejects.toThrow(ConflictException);

    expect(asignaturaRepository.findOne).toHaveBeenCalledWith({
      where: {
        planEstudioId: 1,
        codigoReferencia: 'EIF201',
      },
    });
    expect(asignaturaRepository.save).not.toHaveBeenCalled();
  });

  it('guarda las horas académicas de la asignatura dentro del plan', async () => {
    const guardada = crearAsignatura({
      horasTeoria: 2,
      horasPractica: 2,
      horasLaboratorio: 0,
      horasGira: null,
      horasEstudioIndependiente: 4,
      horasTotales: 8,
      horasDocente: 4,
      observacionHoras: 'Según plan oficial',
    });
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(guardada);
    asignaturaRepository.save.mockResolvedValue({ id: 10 });

    const resultado = await service.crear(1, {
      nivel: 1,
      ciclo: 1,
      orden: 1,
      creditos: 3,
      tipo: TipoPlanAsignatura.OBLIGATORIA,
      codigoReferencia: 'EIF201',
      nombreReferencia: 'Programación I',
      horasTeoria: 2,
      horasPractica: 2,
      horasLaboratorio: 0,
      horasEstudioIndependiente: 4,
      horasTotales: 8,
      horasDocente: 4,
      observacionHoras: ' Según plan oficial ',
    });

    expect(asignaturaRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        horasTeoria: 2,
        horasPractica: 2,
        horasLaboratorio: 0,
        horasGira: null,
        horasEstudioIndependiente: 4,
        horasTotales: 8,
        horasDocente: 4,
        observacionHoras: 'Según plan oficial',
      }),
    );
    expect(resultado.horasTotales).toBe(8);
  });

  it('guarda una carga masiva completa dentro de una transacción', async () => {
    const guardadas = [
      crearAsignatura({ id: 100 }),
      crearAsignatura({
        id: 101,
        orden: 2,
        codigoReferencia: 'MAT030',
        nombreReferencia: 'Matemática para informática',
      }),
    ];
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne.mockResolvedValue(null);
    transactionRepository.save.mockImplementation(async (asignaturas) =>
      asignaturas.map((asignatura, index) => ({
        ...asignatura,
        id: 100 + index,
      })),
    );
    asignaturaRepository.find.mockResolvedValue(guardadas);

    const resultado = await service.cargaMasiva(1, {
      asignaturas: [
        {
          nivel: 1,
          ciclo: 1,
          orden: 1,
          creditos: 3,
          tipo: TipoPlanAsignatura.OBLIGATORIA,
          codigoReferencia: 'EIF201',
          nombreReferencia: 'Programación I',
        },
        {
          nivel: 1,
          ciclo: 1,
          orden: 2,
          creditos: 4,
          tipo: TipoPlanAsignatura.OBLIGATORIA,
          codigoReferencia: 'MAT030',
          nombreReferencia: 'Matemática para informática',
        },
      ],
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(transactionRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        cursoId: null,
        orden: 1,
        codigoReferencia: 'EIF201',
      }),
      expect.objectContaining({
        cursoId: null,
        orden: 2,
        codigoReferencia: 'MAT030',
      }),
    ]);
    expect(asignaturaRepository.find).toHaveBeenCalledWith({
      where: [
        { id: 100, planEstudioId: 1 },
        { id: 101, planEstudioId: 1 },
      ],
      relations: { curso: true, bloque: true },
      order: { nivel: 'ASC', ciclo: 'ASC', orden: 'ASC' },
    });
    expect(resultado).toEqual({
      total: 2,
      asignaturas: guardadas,
    });
  });

  it('rechaza códigos repetidos dentro de la misma carga sin importar mayúsculas', async () => {
    planRepository.findOne.mockResolvedValue(plan);

    await expect(
      service.cargaMasiva(1, {
        asignaturas: [
          {
            nivel: 1,
            ciclo: 1,
            orden: 1,
            creditos: 3,
            tipo: TipoPlanAsignatura.OBLIGATORIA,
            codigoReferencia: 'EIF201',
            nombreReferencia: 'Programación I',
          },
          {
            nivel: 1,
            ciclo: 1,
            orden: 2,
            creditos: 3,
            tipo: TipoPlanAsignatura.OBLIGATORIA,
            codigoReferencia: ' eif201 ',
            nombreReferencia: 'Programación II',
          },
        ],
      }),
    ).rejects.toThrow(
      'La carga contiene el mismo código de asignatura más de una vez.',
    );

    expect(asignaturaRepository.findOne).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('no inicia la transacción si una asignatura no tiene nombre', async () => {
    planRepository.findOne.mockResolvedValue(plan);

    await expect(
      service.cargaMasiva(1, {
        asignaturas: [
          {
            nivel: 1,
            ciclo: 1,
            orden: 1,
            creditos: 3,
            tipo: TipoPlanAsignatura.OBLIGATORIA,
            codigoReferencia: 'EIF201',
            nombreReferencia: 'Programación I',
          },
          {
            nivel: 1,
            ciclo: 1,
            orden: 2,
            creditos: 3,
            tipo: TipoPlanAsignatura.OBLIGATORIA,
            codigoReferencia: 'MAT030',
            nombreReferencia: '   ',
          },
        ],
      }),
    ).rejects.toThrow('El nombre de la asignatura es obligatorio.');

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('crea una asignatura dentro de un bloque del mismo plan', async () => {
    const bloque = {
      id: 5,
      planEstudioId: 1,
      codigo: 'TC',
      nombre: 'Tronco común',
      tipo: TipoBloquePlan.TRONCO_COMUN,
      orden: 1,
      descripcion: null,
      activo: true,
      planEstudio: plan,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as BloquePlan;
    const guardada = crearAsignatura({
      bloqueId: 5,
      bloque,
    });
    planRepository.findOne.mockResolvedValue(plan);
    bloqueRepository.findOne.mockResolvedValue(bloque);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(guardada);
    asignaturaRepository.save.mockResolvedValue({ id: 10 });

    const resultado = await service.crear(1, {
      bloqueId: 5,
      nivel: 1,
      ciclo: 1,
      orden: 1,
      creditos: 3,
      tipo: TipoPlanAsignatura.OBLIGATORIA,
      codigoReferencia: 'EIF201',
      nombreReferencia: 'Programación I',
    });

    expect(bloqueRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 5,
        planEstudioId: 1,
      },
    });
    expect(asignaturaRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        planEstudioId: 1,
        bloqueId: 5,
        bloque,
      }),
    );
    expect(resultado.bloqueId).toBe(5);
  });

  it('rechaza un bloque que no pertenece al plan', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    bloqueRepository.findOne.mockResolvedValue(null);

    await expect(
      service.crear(1, {
        bloqueId: 999,
        nivel: 1,
        ciclo: 1,
        orden: 1,
        creditos: 3,
        tipo: TipoPlanAsignatura.OBLIGATORIA,
        codigoReferencia: 'EIF201',
        nombreReferencia: 'Programación I',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(asignaturaRepository.save).not.toHaveBeenCalled();
  });

  it('crea un espacio curricular sin curso', async () => {
    const optativa = crearAsignatura({
      cursoId: null,
      curso: null,
      tipo: TipoPlanAsignatura.OPTATIVA,
      codigoReferencia: 'OPT-1',
      nombreReferencia: 'Optativa',
    });
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.save.mockResolvedValue(optativa);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(optativa);

    const resultado = await service.crear(1, {
      nivel: 4,
      ciclo: 1,
      orden: 3,
      creditos: 3,
      tipo: TipoPlanAsignatura.OPTATIVA,
      codigoReferencia: ' opt-1 ',
      nombreReferencia: ' Optativa ',
    });

    expect(asignaturaRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cursoId: null,
        curso: null,
        codigoReferencia: 'OPT-1',
        nombreReferencia: 'Optativa',
      }),
    );
    expect(resultado).toEqual(optativa);
  });

  it('exige nombre para un espacio sin curso', async () => {
    planRepository.findOne.mockResolvedValue(plan);

    await expect(
      service.crear(1, {
        nivel: 4,
        ciclo: 1,
        orden: 3,
        creditos: 3,
        tipo: TipoPlanAsignatura.OPTATIVA,
        codigoReferencia: 'OPT-1',
        nombreReferencia: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite borrar horas y la observación durante la actualización', async () => {
    const asignatura = crearAsignatura({
      horasLaboratorio: 2,
      observacionHoras: 'Dato provisional',
    });
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(asignatura)
      .mockResolvedValueOnce(
        crearAsignatura({
          horasLaboratorio: null,
          observacionHoras: null,
        }),
      );

    const resultado = await service.actualizar(1, 10, {
      horasLaboratorio: null,
      observacionHoras: null,
    });

    expect(asignaturaRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        horasLaboratorio: null,
        observacionHoras: null,
      }),
    );
    expect(resultado.horasLaboratorio).toBeNull();
  });

  it('rechaza actualizar a un código que ya usa otra asignatura del plan', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(crearAsignatura())
      .mockResolvedValueOnce(
        crearAsignatura({ id: 20, codigoReferencia: 'MAT030' }),
      );

    await expect(
      service.actualizar(1, 10, { codigoReferencia: ' mat030 ' }),
    ).rejects.toThrow(ConflictException);

    expect(asignaturaRepository.findOne).toHaveBeenLastCalledWith({
      where: {
        planEstudioId: 1,
        codigoReferencia: 'MAT030',
      },
    });
    expect(asignaturaRepository.save).not.toHaveBeenCalled();
  });

  it('exige código al actualizar una asignatura', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne.mockResolvedValue(crearAsignatura());

    await expect(
      service.actualizar(1, 10, { codigoReferencia: '   ' }),
    ).rejects.toThrow('El código de la asignatura no puede estar vacío.');
  });

  it('exige nombre al actualizar una asignatura', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne.mockResolvedValue(crearAsignatura());

    await expect(
      service.actualizar(1, 10, { nombreReferencia: '   ' }),
    ).rejects.toThrow('El nombre de la asignatura no puede estar vacío.');
  });

  it('cambia el estado de una asignatura dentro de un plan activo', async () => {
    planRepository.findOne.mockResolvedValue(plan);
    asignaturaRepository.findOne
      .mockResolvedValueOnce(crearAsignatura())
      .mockResolvedValueOnce(
        crearAsignatura({
          activo: false,
        }),
      );

    const resultado = await service.cambiarEstado(1, 10, false);

    expect(asignaturaRepository.update).toHaveBeenCalledWith(10, {
      activo: false,
    });
    expect(resultado.activo).toBe(false);
  });
});
