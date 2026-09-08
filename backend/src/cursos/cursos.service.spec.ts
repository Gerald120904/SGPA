import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { GradoAcademico } from '../carreras/constants/grado-academico.constant';
import { Carrera } from '../carreras/entities/carrera.entity';
import { CursoOptativo } from '../optativas/entities/curso-optativo.entity';
import { TipoPlanAsignatura } from '../planes-estudio/constants/tipo-plan-asignatura.constant';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { CursosService } from './cursos.service';
import { CursoRequisito } from './entities/curso-requisito.entity';
import { Curso } from './entities/curso.entity';

describe('CursosService', () => {
  let service: CursosService;
  let cursoRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let cursoRequisitoRepository: {
    count: jest.Mock;
  };
  let optativaRepository: {
    count: jest.Mock;
  };
  let planAsignaturaRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
  };
  let managerCursoRepository: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let managerPlanAsignaturaRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let dataSource: {
    transaction: jest.Mock;
  };

  const carrera: Carrera = {
    id: 1,
    codigo: 'EIF',
    nombre: 'Ingeniería en Sistemas',
    descripcion: null,
    activo: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const carrera2: Carrera = {
    id: 2,
    codigo: 'TUR',
    nombre: 'Gestión Turística',
    descripcion: null,
    activo: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const plan: PlanEstudio = {
    id: 2,
    carreraId: 1,
    grado: GradoAcademico.BACHILLERATO,
    codigo: 'PLAN-2026',
    nombre: 'Plan 2026',
    descripcion: null,
    activo: true,
    carrera,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const crearPlanAsignatura = (
    cambios: Partial<PlanAsignatura> = {},
  ): PlanAsignatura => ({
    id: 17,
    planEstudioId: 2,
    cursoId: null,
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
      findOneOrFail: jest.fn(),
      create: jest.fn((datos: Partial<Curso>) => datos),
      save: jest.fn(),
      update: jest.fn(),
    };
    cursoRequisitoRepository = {
      count: jest.fn().mockResolvedValue(0),
    };
    optativaRepository = {
      count: jest.fn().mockResolvedValue(0),
    };
    planAsignaturaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };

    managerCursoRepository = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn((datos: Partial<Curso>) => datos),
      save: jest.fn(),
    };
    managerPlanAsignaturaRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(async (callback) => {
        const manager = {
          getRepository: jest.fn((target) => {
            if (target === Curso) return managerCursoRepository;
            if (target === PlanAsignatura)
              return managerPlanAsignaturaRepository;
            return {};
          }),
        };
        return callback(manager);
      }),
    };

    service = new CursosService(
      cursoRepository as unknown as Repository<Curso>,
      cursoRequisitoRepository as unknown as Repository<CursoRequisito>,
      optativaRepository as unknown as Repository<CursoOptativo>,
      planAsignaturaRepository as unknown as Repository<PlanAsignatura>,
      dataSource as unknown as DataSource,
    );

    jest.clearAllMocks();
  });

  describe('Creación de cursos', () => {
    it('crea un curso desde una asignatura normal del plan y asigna cursoId en transacción', async () => {
      const planAsignatura = crearPlanAsignatura();
      const curso = crearCurso();
      planAsignaturaRepository.findOne.mockResolvedValue(planAsignatura);
      managerCursoRepository.findOne.mockResolvedValue(null);
      managerCursoRepository.save.mockResolvedValue(curso);
      managerPlanAsignaturaRepository.findOne.mockResolvedValue(planAsignatura);
      managerPlanAsignaturaRepository.save.mockResolvedValue({
        ...planAsignatura,
        cursoId: 5,
        curso,
      });
      managerCursoRepository.findOneOrFail.mockResolvedValue(curso);

      const resultado = await service.crear({
        planAsignaturaId: 17,
        descripcion: ' Curso introductorio ',
      });

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(managerCursoRepository.create).toHaveBeenCalledWith({
        codigo: 'EIF201',
        nombre: 'Programación I',
        descripcion: 'Curso introductorio',
        activo: true,
        carreras: [carrera],
      });
      expect(managerPlanAsignaturaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 17,
          cursoId: 5,
        }),
      );
      expect(resultado).toEqual(curso);
    });

    it('reutiliza un curso existente con el mismo código y nombre', async () => {
      const planAsignatura = crearPlanAsignatura();
      const curso = crearCurso();
      planAsignaturaRepository.findOne.mockResolvedValue(planAsignatura);
      managerCursoRepository.findOne.mockResolvedValue(curso);
      managerPlanAsignaturaRepository.findOne.mockResolvedValue(planAsignatura);
      managerPlanAsignaturaRepository.save.mockResolvedValue({
        ...planAsignatura,
        cursoId: 5,
        curso,
      });
      managerCursoRepository.findOneOrFail.mockResolvedValue(curso);

      const resultado = await service.crear({ planAsignaturaId: 17 });

      expect(managerCursoRepository.create).not.toHaveBeenCalled();
      expect(managerPlanAsignaturaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ cursoId: 5 }),
      );
      expect(resultado).toEqual(curso);
    });

    it('agrega nueva carrera si el curso ya existe y pertenece a otra carrera', async () => {
      const planAsignaturaTurismo = crearPlanAsignatura({
        planEstudio: {
          ...plan,
          carrera: carrera2,
          carreraId: 2,
        },
      });
      const cursoExistente = crearCurso({ carreras: [carrera] });
      const cursoActualizado = {
        ...cursoExistente,
        carreras: [carrera, carrera2],
      };

      planAsignaturaRepository.findOne.mockResolvedValue(planAsignaturaTurismo);
      managerCursoRepository.findOne.mockResolvedValue(cursoExistente);
      managerCursoRepository.save.mockResolvedValue(cursoActualizado);
      managerPlanAsignaturaRepository.findOne.mockResolvedValue(
        planAsignaturaTurismo,
      );
      managerPlanAsignaturaRepository.save.mockResolvedValue({
        ...planAsignaturaTurismo,
        cursoId: 5,
      });
      managerCursoRepository.findOneOrFail.mockResolvedValue(cursoActualizado);

      const resultado = await service.crear({ planAsignaturaId: 17 });

      expect(managerCursoRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          carreras: [carrera, carrera2],
        }),
      );
      expect(resultado).toEqual(cursoActualizado);
    });

    it('rechaza un código existente con un nombre diferente', async () => {
      planAsignaturaRepository.findOne.mockResolvedValue(crearPlanAsignatura());
      managerCursoRepository.findOne.mockResolvedValue(
        crearCurso({ nombre: 'Bases de Datos' }),
      );

      await expect(service.crear({ planAsignaturaId: 17 })).rejects.toThrow(
        ConflictException,
      );

      expect(managerPlanAsignaturaRepository.save).not.toHaveBeenCalled();
    });

    it('rechaza una asignatura del plan inexistente', async () => {
      planAsignaturaRepository.findOne.mockResolvedValue(null);

      await expect(service.crear({ planAsignaturaId: 999 })).rejects.toThrow(
        NotFoundException,
      );

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rechaza una asignatura que ya está vinculada a un curso', async () => {
      const curso = crearCurso();
      planAsignaturaRepository.findOne.mockResolvedValue(
        crearPlanAsignatura({
          cursoId: 5,
          curso,
        }),
      );

      await expect(service.crear({ planAsignaturaId: 17 })).rejects.toThrow(
        ConflictException,
      );

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rechaza una asignatura inactiva', async () => {
      planAsignaturaRepository.findOne.mockResolvedValue(
        crearPlanAsignatura({ activo: false }),
      );

      await expect(service.crear({ planAsignaturaId: 17 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza un plan inactivo', async () => {
      planAsignaturaRepository.findOne.mockResolvedValue(
        crearPlanAsignatura({
          planEstudio: { ...plan, activo: false },
        }),
      );

      await expect(service.crear({ planAsignaturaId: 17 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza una carrera inactiva', async () => {
      planAsignaturaRepository.findOne.mockResolvedValue(
        crearPlanAsignatura({
          planEstudio: {
            ...plan,
            carrera: { ...carrera, activo: false },
          },
        }),
      );

      await expect(service.crear({ planAsignaturaId: 17 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza una asignatura sin código de referencia', async () => {
      planAsignaturaRepository.findOne.mockResolvedValue(
        crearPlanAsignatura({ codigoReferencia: '   ' }),
      );

      await expect(service.crear({ planAsignaturaId: 17 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza una asignatura sin nombre de referencia', async () => {
      planAsignaturaRepository.findOne.mockResolvedValue(
        crearPlanAsignatura({ nombreReferencia: '   ' }),
      );

      await expect(service.crear({ planAsignaturaId: 17 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza crear un curso desde una asignatura OPTATIVA o GENERAL', async () => {
      planAsignaturaRepository.findOne.mockResolvedValueOnce(
        crearPlanAsignatura({
          codigoReferencia: 'OPT',
          nombreReferencia: 'Optativo I',
          tipo: TipoPlanAsignatura.OPTATIVA,
        }),
      );

      await expect(service.crear({ planAsignaturaId: 17 })).rejects.toThrow(
        BadRequestException,
      );

      planAsignaturaRepository.findOne.mockResolvedValueOnce(
        crearPlanAsignatura({
          codigoReferencia: 'EST GEN',
          nombreReferencia: 'Estudios Generales I',
          tipo: TipoPlanAsignatura.GENERAL,
        }),
      );

      await expect(service.crear({ planAsignaturaId: 18 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Estado y Protección de Desactivación', () => {
    it('permite desactivar un curso sin referencias activas', async () => {
      const curso = crearCurso();
      cursoRepository.findOne
        .mockResolvedValueOnce(curso)
        .mockResolvedValueOnce({ ...curso, activo: false });
      planAsignaturaRepository.count.mockResolvedValue(0);
      optativaRepository.count.mockResolvedValue(0);
      cursoRequisitoRepository.count.mockResolvedValue(0);
      cursoRepository.update.mockResolvedValue({ affected: 1 });

      const resultado = await service.cambiarEstado(5, false);

      expect(cursoRepository.update).toHaveBeenCalledWith(5, { activo: false });
      expect(resultado.activo).toBe(false);
    });

    it('rechaza desactivar un curso usado por asignaturas activas de planes de estudio', async () => {
      const curso = crearCurso();
      cursoRepository.findOne.mockResolvedValue(curso);
      planAsignaturaRepository.count.mockResolvedValue(1);

      await expect(service.cambiarEstado(5, false)).rejects.toThrow(
        'No se puede desactivar el curso porque está vinculado a asignaturas activas de uno o más planes de estudio.',
      );

      expect(cursoRepository.update).not.toHaveBeenCalled();
    });

    it('rechaza desactivar un curso activo en el catálogo de optativas', async () => {
      const curso = crearCurso();
      cursoRepository.findOne.mockResolvedValue(curso);
      planAsignaturaRepository.count.mockResolvedValue(0);
      optativaRepository.count.mockResolvedValue(1);

      await expect(service.cambiarEstado(5, false)).rejects.toThrow(
        'No se puede desactivar el curso mientras esté activo en el catálogo de optativas.',
      );

      expect(cursoRepository.update).not.toHaveBeenCalled();
    });

    it('rechaza desactivar un curso utilizado como requisito o correquisito', async () => {
      const curso = crearCurso();
      cursoRepository.findOne.mockResolvedValue(curso);
      planAsignaturaRepository.count.mockResolvedValue(0);
      optativaRepository.count.mockResolvedValue(0);
      cursoRequisitoRepository.count
        .mockResolvedValueOnce(0) // como cursoId
        .mockResolvedValueOnce(1); // como requisitoCursoId

      await expect(service.cambiarEstado(5, false)).rejects.toThrow(
        'No se puede desactivar el curso porque participa en relaciones de requisitos o correquisitos.',
      );

      expect(cursoRepository.update).not.toHaveBeenCalled();
    });

    it('rechaza desactivar un curso que requiere a otro curso', async () => {
      const curso = crearCurso();
      cursoRepository.findOne.mockResolvedValue(curso);
      planAsignaturaRepository.count.mockResolvedValue(0);
      optativaRepository.count.mockResolvedValue(0);
      cursoRequisitoRepository.count
        .mockResolvedValueOnce(1) // como cursoId
        .mockResolvedValueOnce(0); // como requisitoCursoId

      await expect(service.cambiarEstado(5, false)).rejects.toThrow(
        'No se puede desactivar el curso porque participa en relaciones de requisitos o correquisitos.',
      );

      expect(cursoRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('Integridad y transacciones', () => {
    it('fallo al guardar PlanAsignatura propaga el error de la transacción', async () => {
      const planAsignatura = crearPlanAsignatura();
      const curso = crearCurso();
      planAsignaturaRepository.findOne.mockResolvedValue(planAsignatura);
      managerCursoRepository.findOne.mockResolvedValue(null);
      managerCursoRepository.save.mockResolvedValue(curso);
      managerPlanAsignaturaRepository.findOne.mockResolvedValue(planAsignatura);
      managerPlanAsignaturaRepository.save.mockRejectedValue(
        new Error('Fallo de base de datos en asignatura'),
      );

      await expect(service.crear({ planAsignaturaId: 17 })).rejects.toThrow(
        'Fallo de base de datos en asignatura',
      );
    });

    it('fallo al guardar Curso propaga el error y no modifica PlanAsignatura', async () => {
      const planAsignatura = crearPlanAsignatura();
      planAsignaturaRepository.findOne.mockResolvedValue(planAsignatura);
      managerCursoRepository.findOne.mockResolvedValue(null);
      managerCursoRepository.save.mockRejectedValue(
        new Error('Fallo al guardar curso'),
      );

      await expect(service.crear({ planAsignaturaId: 17 })).rejects.toThrow(
        'Fallo al guardar curso',
      );

      expect(managerPlanAsignaturaRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Consultas y actualización', () => {
    it('lista los cursos ordenados por código', async () => {
      const cursos = [crearCurso()];
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

      expect(resultado).toEqual(curso);
    });

    it('lista únicamente asignaturas disponibles excluyendo optativas y generales', async () => {
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
            tipo: expect.anything(),
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
  });
});
