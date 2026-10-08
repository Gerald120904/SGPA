import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { EstadoPeriodoAcademico } from '../periodos-academicos/constants/estado-periodo-academico.constant';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { EstadoPerfilProfesor } from '../perfiles-academicos/constants/estado-perfil-profesor.constant';
import { CursoPerfilAcademico } from '../perfiles-academicos/entities/curso-perfil-academico.entity';
import { PerfilAcademico } from '../perfiles-academicos/entities/perfil-academico.entity';
import { ProfesorPerfilAcademico } from '../perfiles-academicos/entities/profesor-perfil-academico.entity';
import { RequisitoPerfilAcademico } from '../perfiles-academicos/entities/requisito-perfil-academico.entity';
import { EstadoCumplimientoRequisito } from './constants/estado-cumplimiento-requisito.constant';
import { EstadoAtestadoProfesor } from './constants/estado-atestado-profesor.constant';
import { TipoAtestadoProfesor } from './constants/tipo-atestado-profesor.constant';
import { DiaSemana } from './constants/dia-semana.constant';
import { EstadoDisponibilidad } from './constants/estado-disponibilidad.constant';
import {
  AccionHistorialPerfilProfesor,
  TipoHistorialPerfilProfesor,
} from './constants/historial-perfil-profesor.constant';
import { AtestadoProfesor } from './entities/atestado-profesor.entity';
import { CumplimientoRequisitoProfesor } from './entities/cumplimiento-requisito-profesor.entity';
import { DisponibilidadProfesor } from './entities/disponibilidad-profesor.entity';
import { EvidenciaRequisitoProfesor } from './entities/evidencia-requisito-profesor.entity';
import { HistorialPerfilProfesor } from './entities/historial-perfil-profesor.entity';
import { ProfesorCarrera } from './entities/profesor-carrera.entity';
import { ProyectoProfesor } from './entities/proyecto-profesor.entity';
import { ProfesoresService } from './profesores.service';

describe('ProfesoresService', () => {
  let service: ProfesoresService;

  let usuarioRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
  };

  let carreraRepository: {
    find: jest.Mock;
  };

  let cursoRepository: {
    findOne: jest.Mock;
  };

  let profesorCarreraRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let perfilRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
  };

  let cursoPerfilRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
  };

  let profesorPerfilRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let atestadoRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let requisitoPerfilRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
  };

  let cumplimientoRequisitoRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let evidenciaRequisitoRepository: {
    find: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let proyectoRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let periodoRepository: {
    findOne: jest.Mock;
  };

  let disponibilidadRepository: {
    find: jest.Mock;
  };

  let historialPerfilRepository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let manager: {
    getRepository: jest.Mock;
  };

  let dataSource: {
    transaction: jest.Mock;
  };

  let estructuraAcademicaService: {
    tieneAlcanceSobreCarrera: jest.Mock;
    tieneAlcanceSobreProfesor: jest.Mock;
  };

  const carrera = {
    id: 1,
    codigo: 'EIF',
    nombre: 'Ingeniería en Sistemas',
    activo: true,
  } as Carrera;

  const curso = {
    id: 5,
    codigo: 'EIF201',
    nombre: 'Programación I',
    activo: true,
    carreras: [carrera],
  } as Curso;

  const crearProfesor = (cambios: Partial<Usuario> = {}): Usuario =>
    ({
      id: 10,
      cedula: '123456789',
      nombres: 'Juan',
      apellido1: 'Pérez',
      apellido2: null,
      correo: 'juan@una.ac.cr',
      passwordHash: 'NO-DEBE-SALIR',
      activo: true,
      ultimoAcceso: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
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

  beforeEach(() => {
    estructuraAcademicaService = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
      tieneAlcanceSobreProfesor: jest.fn().mockResolvedValue(true),
    };

    usuarioRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    carreraRepository = {
      find: jest.fn(),
    };

    cursoRepository = {
      findOne: jest.fn(),
    };

    profesorCarreraRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({
        profesorUsuarioId: 10,
        carreraId: 1,
      }),
      delete: jest.fn(),
      create: jest.fn((valor) => valor),
      save: jest.fn(),
    };

    perfilRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    cursoPerfilRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    profesorPerfilRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((valor) => valor),
      save: jest.fn(async (valor) => ({ id: 100, ...valor })),
    };

    atestadoRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((valor) => valor),
      save: jest.fn(async (valor) => ({ id: 1, ...valor })),
    };

    requisitoPerfilRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    cumplimientoRequisitoRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((valor) => valor),
      save: jest.fn(async (valor) => valor),
    };

    evidenciaRequisitoRepository = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      create: jest.fn((valor) => valor),
      save: jest.fn(async (valor) => valor),
    };

    proyectoRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((valor) => valor),
      save: jest.fn(async (valor) => ({ id: 1, ...valor })),
    };

    periodoRepository = {
      findOne: jest.fn(),
    };

    disponibilidadRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    historialPerfilRepository = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((datos) => datos),
      save: jest.fn(async (datos) => ({
        ...datos,
        id: datos.id ?? 1,
        createdAt: datos.createdAt ?? new Date(),
      })),
    };

    manager = {
      getRepository: jest.fn((entidad) => {
        if (entidad === ProfesorCarrera) {
          return profesorCarreraRepository;
        }

        if (entidad === ProfesorPerfilAcademico) {
          return profesorPerfilRepository;
        }

        if (entidad === HistorialPerfilProfesor) {
          return historialPerfilRepository;
        }

        if (entidad === RequisitoPerfilAcademico) {
          return requisitoPerfilRepository;
        }

        if (entidad === CumplimientoRequisitoProfesor) {
          return cumplimientoRequisitoRepository;
        }

        if (entidad === EvidenciaRequisitoProfesor) {
          return evidenciaRequisitoRepository;
        }

        if (entidad === AtestadoProfesor) {
          return atestadoRepository;
        }

        throw new Error(`Repositorio no mockeado: ${entidad.name}`);
      }),
    };

    dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    service = new ProfesoresService(
      usuarioRepository as unknown as Repository<Usuario>,
      carreraRepository as unknown as Repository<Carrera>,
      cursoRepository as unknown as Repository<Curso>,
      profesorCarreraRepository as unknown as Repository<ProfesorCarrera>,
      perfilRepository as unknown as Repository<PerfilAcademico>,
      profesorPerfilRepository as unknown as Repository<ProfesorPerfilAcademico>,
      cursoPerfilRepository as unknown as Repository<CursoPerfilAcademico>,
      atestadoRepository as unknown as Repository<AtestadoProfesor>,
      requisitoPerfilRepository as unknown as Repository<RequisitoPerfilAcademico>,
      cumplimientoRequisitoRepository as unknown as Repository<CumplimientoRequisitoProfesor>,
      evidenciaRequisitoRepository as unknown as Repository<EvidenciaRequisitoProfesor>,
      proyectoRepository as unknown as Repository<ProyectoProfesor>,
      periodoRepository as unknown as Repository<PeriodoAcademico>,
      disponibilidadRepository as unknown as Repository<DisponibilidadProfesor>,
      historialPerfilRepository as unknown as Repository<HistorialPerfilProfesor>,
      estructuraAcademicaService as unknown as any,
      dataSource as unknown as DataSource,
    );

    jest.clearAllMocks();
  });

  it('lista únicamente usuarios con rol PROFESOR', async () => {
    const profesor = crearProfesor();

    const usuarioNormal = crearProfesor({
      id: 11,
      correo: 'otro@una.ac.cr',
      usuarioRoles: [
        {
          rol: {
            nombre: RolSistema.COORDINADOR,
            activo: true,
          },
        },
      ] as any,
    });

    usuarioRepository.find.mockResolvedValue([profesor, usuarioNormal]);

    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorPerfilRepository.find.mockResolvedValue([]);
    cursoPerfilRepository.find.mockResolvedValue([]);

    const resultado = await service.listar();

    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(10);
    expect(resultado[0].correo).toBe('juan@una.ac.cr');
  });

  it('no expone passwordHash al listar profesores', async () => {
    usuarioRepository.find.mockResolvedValue([crearProfesor()]);

    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorPerfilRepository.find.mockResolvedValue([]);

    const resultado = await service.listar();

    expect(resultado[0]).not.toHaveProperty('passwordHash');
  });

  it('impide autogestión a un profesor inactivo', async () => {
    usuarioRepository.findOne.mockResolvedValue(
      crearProfesor({
        activo: false,
      }),
    );

    await expect(service.obtenerMiPerfil(10)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('impide autogestión a un usuario sin rol PROFESOR', async () => {
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

    await expect(service.obtenerMiPerfil(10)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('devuelve lista vacía de perfiles disponibles si el profesor no tiene carreras asignadas', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearProfesor());
    profesorCarreraRepository.find.mockResolvedValue([]);

    const resultado = await service.listarPerfilesDisponiblesMiPerfil(10);

    expect(resultado).toEqual([]);
    expect(perfilRepository.find).not.toHaveBeenCalled();
  });

  it('lista perfiles académicos activos asociados a las carreras asignadas al profesor', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearProfesor());
    profesorCarreraRepository.find.mockResolvedValue([
      {
        profesorUsuarioId: 10,
        carreraId: 1,
      },
      {
        profesorUsuarioId: 10,
        carreraId: 2,
      },
    ]);

    perfilRepository.find.mockResolvedValue([
      {
        id: 100,
        carreraId: 1,
        codigo: 'PERF-01',
        nombre: 'Desarrollo de Software',
        descripcion: 'Perfil de software',
        activo: true,
        carrera: {
          id: 1,
          codigo: 'EIF',
          nombre: 'Ingeniería en Sistemas',
          activo: true,
        },
      },
    ]);

    const resultado = await service.listarPerfilesDisponiblesMiPerfil(10);

    expect(resultado).toEqual([
      {
        id: 100,
        carreraId: 1,
        carreraCodigo: 'EIF',
        carreraNombre: 'Ingeniería en Sistemas',
        codigo: 'PERF-01',
        nombre: 'Desarrollo de Software',
        descripcion: 'Perfil de software',
        activo: true,
      },
    ]);
  });

  it('filtra profesores por nombre', async () => {
    const p1 = crearProfesor({ id: 1, nombres: 'Carlos', apellido1: 'Gómez' });
    const p2 = crearProfesor({ id: 2, nombres: 'María', apellido1: 'Sánchez' });

    usuarioRepository.find.mockResolvedValue([p1, p2]);
    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorPerfilRepository.find.mockResolvedValue([]);
    cursoPerfilRepository.find.mockResolvedValue([]);

    const resultado = await service.listar({ nombre: 'carlos' });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(1);
  });

  it('filtra profesores por cédula', async () => {
    const p1 = crearProfesor({ id: 1, cedula: '111111111' });
    const p2 = crearProfesor({ id: 2, cedula: '222222222' });

    usuarioRepository.find.mockResolvedValue([p1, p2]);
    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorPerfilRepository.find.mockResolvedValue([]);
    cursoPerfilRepository.find.mockResolvedValue([]);

    const resultado = await service.listar({ cedula: '111' });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(1);
  });

  it('filtra profesores activos', async () => {
    const p1 = crearProfesor({ id: 1, activo: true });
    const p2 = crearProfesor({ id: 2, activo: false });

    usuarioRepository.find.mockResolvedValue([p1, p2]);
    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorPerfilRepository.find.mockResolvedValue([]);
    cursoPerfilRepository.find.mockResolvedValue([]);

    const resultado = await service.listar({ activo: true });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(1);
  });

  it('filtra profesores por carrera', async () => {
    const p1 = crearProfesor({ id: 1 });
    const p2 = crearProfesor({ id: 2 });

    usuarioRepository.find.mockResolvedValue([p1, p2]);
    profesorPerfilRepository.find.mockResolvedValue([]);
    cursoPerfilRepository.find.mockResolvedValue([]);

    profesorCarreraRepository.find.mockImplementation(async ({ where }) => {
      if (where.profesorUsuarioId === 1) {
        return [{ profesorUsuarioId: 1, carreraId: 1, carrera }];
      }
      return [];
    });

    const resultado = await service.listar({ carreraId: 1 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(1);
  });

  it('filtra por curso únicamente cuando está APROBADO', async () => {
    const profesorAprobado = crearProfesor();
    const profesorPendiente = crearProfesor({
      id: 11,
      correo: 'pendiente@una.ac.cr',
    });

    usuarioRepository.find.mockResolvedValue([
      profesorAprobado,
      profesorPendiente,
    ]);

    profesorCarreraRepository.find.mockImplementation(async ({ where }) => {
      if (where.profesorUsuarioId === 10) {
        return [
          {
            profesorUsuarioId: 10,
            carreraId: 1,
            carrera,
          },
        ];
      }
      return [];
    });

    const perfilSeguridad = {
      id: 1,
      carreraId: 1,
      codigo: 'INF-SEG',
      nombre: 'Seguridad Informática',
      activo: true,
    } as PerfilAcademico;

    profesorPerfilRepository.find.mockImplementation(async ({ where }) => {
      if (where.profesorUsuarioId === 10) {
        return [
          {
            id: 100,
            profesorUsuarioId: 10,
            perfilAcademicoId: 1,
            estado: EstadoPerfilProfesor.APROBADO,
            perfilAcademico: perfilSeguridad,
          },
        ];
      }

      if (where.estado === EstadoPerfilProfesor.APROBADO) {
        return [];
      }

      return [
        {
          id: 101,
          profesorUsuarioId: 11,
          perfilAcademicoId: 1,
          estado: EstadoPerfilProfesor.PENDIENTE,
          perfilAcademico: perfilSeguridad,
        },
      ];
    });

    cursoPerfilRepository.find.mockResolvedValue([
      {
        id: 1,
        perfilAcademicoId: 1,
        cursoId: 5,
        activo: true,
        curso: {
          id: 5,
          codigo: 'EIF201',
          nombre: 'Programación I',
          activo: true,
        },
        perfilAcademico: perfilSeguridad,
      },
    ]);

    const resultado = await service.listar({
      cursoId: 5,
    });

    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(10);
  });

  it('filtra por perfilAcademicoId únicamente cuando está APROBADO', async () => {
    const profesorAprobado = crearProfesor();
    const profesorPendiente = crearProfesor({ id: 11, correo: 'p@una.ac.cr' });

    usuarioRepository.find.mockResolvedValue([
      profesorAprobado,
      profesorPendiente,
    ]);
    profesorCarreraRepository.find.mockResolvedValue([]);

    profesorPerfilRepository.find.mockImplementation(async ({ where }) => {
      if (where.profesorUsuarioId === 10) {
        return [
          {
            id: 100,
            profesorUsuarioId: 10,
            perfilAcademicoId: 1,
            estado: EstadoPerfilProfesor.APROBADO,
            perfilAcademico: {
              id: 1,
              codigo: 'INF-SEG',
              nombre: 'Seguridad',
              activo: true,
            },
          },
        ];
      }
      return [
        {
          id: 101,
          profesorUsuarioId: 11,
          perfilAcademicoId: 1,
          estado: EstadoPerfilProfesor.PENDIENTE,
          perfilAcademico: {
            id: 1,
            codigo: 'INF-SEG',
            nombre: 'Seguridad',
            activo: true,
          },
        },
      ];
    });

    const resultado = await service.listar({ perfilAcademicoId: 1 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(10);
  });

  it('considera PENDIENTE al profesor sin disponibilidad registrada', async () => {
    usuarioRepository.find.mockResolvedValue([crearProfesor()]);

    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorPerfilRepository.find.mockResolvedValue([]);

    periodoRepository.findOne.mockResolvedValue({
      id: 2,
      codigo: '2099-C1',
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
    });

    disponibilidadRepository.find.mockResolvedValue([]);

    const resultado = await service.listar({
      periodoAcademicoId: 2,
      estadoDisponibilidad: EstadoDisponibilidad.PENDIENTE,
    });

    expect(resultado).toHaveLength(1);
    expect((resultado[0] as any).disponibilidadPeriodo.estado).toBe(
      EstadoDisponibilidad.PENDIENTE,
    );
  });

  it('filtra profesores con disponibilidad REGISTRADA', async () => {
    usuarioRepository.find.mockResolvedValue([crearProfesor()]);

    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorPerfilRepository.find.mockResolvedValue([]);

    periodoRepository.findOne.mockResolvedValue({
      id: 2,
      codigo: '2099-C1',
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
    });

    disponibilidadRepository.find.mockResolvedValue([
      {
        id: 50,
        profesorUsuarioId: 10,
        periodoAcademicoId: 2,
        estado: EstadoDisponibilidad.REGISTRADA,
        bloques: [],
      },
    ]);

    const resultado = await service.listar({
      periodoAcademicoId: 2,
      estadoDisponibilidad: EstadoDisponibilidad.REGISTRADA,
    });

    expect(resultado).toHaveLength(1);
    expect((resultado[0] as any).disponibilidadPeriodo.estado).toBe(
      EstadoDisponibilidad.REGISTRADA,
    );
  });

  it('filtra profesores disponibles en día y hora', async () => {
    usuarioRepository.find.mockResolvedValue([crearProfesor()]);

    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorPerfilRepository.find.mockResolvedValue([]);

    periodoRepository.findOne.mockResolvedValue({
      id: 2,
      codigo: '2099-C1',
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
    });

    disponibilidadRepository.find.mockResolvedValue([
      {
        id: 50,
        profesorUsuarioId: 10,
        periodoAcademicoId: 2,
        estado: EstadoDisponibilidad.REGISTRADA,
        bloques: [
          {
            id: 100,
            dia: DiaSemana.LUNES,
            horaInicio: '08:00:00',
            horaFin: '12:00:00',
          },
        ],
      },
    ]);

    const resultado = await service.listar({
      periodoAcademicoId: 2,
      dia: DiaSemana.LUNES,
      hora: '10:00',
    });

    expect(resultado).toHaveLength(1);
    expect((resultado[0] as any).disponibleEnHorario).toBe(true);
  });

  it('no considera disponible al profesor exactamente a la hora final del bloque', async () => {
    usuarioRepository.find.mockResolvedValue([crearProfesor()]);

    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorPerfilRepository.find.mockResolvedValue([]);

    periodoRepository.findOne.mockResolvedValue({
      id: 2,
      codigo: '2099-C1',
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
    });

    disponibilidadRepository.find.mockResolvedValue([
      {
        id: 50,
        profesorUsuarioId: 10,
        periodoAcademicoId: 2,
        estado: EstadoDisponibilidad.REGISTRADA,
        bloques: [
          {
            id: 100,
            dia: DiaSemana.LUNES,
            horaInicio: '08:00:00',
            horaFin: '12:00:00',
          },
        ],
      },
    ]);

    const resultado = await service.listar({
      periodoAcademicoId: 2,
      dia: DiaSemana.LUNES,
      hora: '12:00',
    });

    expect(resultado).toHaveLength(0);
  });

  it('exige día y hora juntos', async () => {
    await expect(
      service.listar({
        dia: DiaSemana.LUNES,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.listar({
        hora: '10:00',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('exige periodo académico para filtrar disponibilidad', async () => {
    await expect(
      service.listar({
        estadoDisponibilidad: EstadoDisponibilidad.REGISTRADA,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza periodo inexistente al consultar disponibilidad', async () => {
    usuarioRepository.find.mockResolvedValue([crearProfesor()]);

    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorPerfilRepository.find.mockResolvedValue([]);
    periodoRepository.findOne.mockResolvedValue(null);

    await expect(
      service.listar({
        periodoAcademicoId: 999,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('combina carrera, curso, activo y disponibilidad', async () => {
    usuarioRepository.find.mockResolvedValue([crearProfesor()]);

    profesorCarreraRepository.find.mockImplementation(async ({ where }) => {
      if (where.profesorUsuarioId === 10) {
        return [
          {
            profesorUsuarioId: 10,
            carreraId: 1,
            carrera,
          },
        ];
      }
      return [];
    });

    profesorPerfilRepository.find.mockImplementation(async ({ where }) => {
      if (where.profesorUsuarioId === 10) {
        return [
          {
            id: 100,
            profesorUsuarioId: 10,
            perfilAcademicoId: 1,
            estado: EstadoPerfilProfesor.APROBADO,
            perfilAcademico: {
              id: 1,
              carreraId: 1,
              codigo: 'INF-SEG',
              nombre: 'Seguridad Informática',
              activo: true,
            },
          },
        ];
      }

      return [];
    });

    cursoPerfilRepository.find.mockResolvedValue([
      {
        id: 1,
        perfilAcademicoId: 1,
        cursoId: 5,
        activo: true,
        curso: {
          id: 5,
          codigo: 'EIF201',
          nombre: 'Programación I',
          activo: true,
        },
        perfilAcademico: {
          id: 1,
          carreraId: 1,
          codigo: 'INF-SEG',
          nombre: 'Seguridad Informática',
          activo: true,
        },
      },
    ]);

    periodoRepository.findOne.mockResolvedValue({
      id: 2,
      codigo: '2099-C1',
      estado: EstadoPeriodoAcademico.EN_PREPARACION,
    });

    disponibilidadRepository.find.mockResolvedValue([
      {
        id: 50,
        profesorUsuarioId: 10,
        periodoAcademicoId: 2,
        estado: EstadoDisponibilidad.REGISTRADA,
        bloques: [
          {
            id: 100,
            dia: DiaSemana.MARTES,
            horaInicio: '08:00:00',
            horaFin: '12:00:00',
          },
        ],
      },
    ]);

    const resultado = await service.listar({
      activo: true,
      carreraId: 1,
      cursoId: 5,
      periodoAcademicoId: 2,
      dia: DiaSemana.MARTES,
      hora: '09:00',
    });

    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(10);
  });

  it('considera BLOQUEADA una disponibilidad registrada cuando el periodo está CERRADO', async () => {
    usuarioRepository.find.mockResolvedValue([crearProfesor()]);

    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorPerfilRepository.find.mockResolvedValue([]);

    periodoRepository.findOne.mockResolvedValue({
      id: 2,
      codigo: '2099-C1',
      estado: EstadoPeriodoAcademico.CERRADO,
    });

    disponibilidadRepository.find.mockResolvedValue([
      {
        id: 50,
        profesorUsuarioId: 10,
        periodoAcademicoId: 2,
        estado: EstadoDisponibilidad.REGISTRADA,
        bloques: [],
      },
    ]);

    const resultado = await service.listar({
      periodoAcademicoId: 2,
      estadoDisponibilidad: EstadoDisponibilidad.BLOQUEADA,
    });

    expect(resultado).toHaveLength(1);
    expect((resultado[0] as any).disponibilidadPeriodo.estado).toBe(
      EstadoDisponibilidad.BLOQUEADA,
    );
  });

  it('considera BLOQUEADA la disponibilidad inexistente cuando el periodo está CERRADO', async () => {
    usuarioRepository.find.mockResolvedValue([crearProfesor()]);

    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorPerfilRepository.find.mockResolvedValue([]);

    periodoRepository.findOne.mockResolvedValue({
      id: 2,
      codigo: '2099-C1',
      estado: EstadoPeriodoAcademico.CERRADO,
    });

    disponibilidadRepository.find.mockResolvedValue([]);

    const resultado = await service.listar({
      periodoAcademicoId: 2,
      estadoDisponibilidad: EstadoDisponibilidad.BLOQUEADA,
    });

    expect(resultado).toHaveLength(1);
    expect((resultado[0] as any).disponibilidadPeriodo.estado).toBe(
      EstadoDisponibilidad.BLOQUEADA,
    );
  });

  it('consulta el historial del perfil sin exponer datos sensibles', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearProfesor());

    historialPerfilRepository.find.mockResolvedValue([
      {
        id: 1,
        profesorUsuarioId: 10,
        usuarioAccionId: 2,
        cursoId: 5,
        perfilAcademicoId: 1,
        tipo: TipoHistorialPerfilProfesor.PERFIL_ACADEMICO,
        accion: AccionHistorialPerfilProfesor.APROBAR_PERFIL,
        datosAnteriores: { estado: 'PENDIENTE' },
        datosNuevos: { estado: 'APROBADO' },
        curso,
        perfilAcademico: {
          id: 1,
          codigo: 'INF-SEG',
          nombre: 'Seguridad Informática',
        },
        usuarioAccion: {
          ...crearProfesor({
            id: 2,
            correo: 'coordinador@una.ac.cr',
          }),
          passwordHash: 'SUPER-SECRETO',
          passwordResetTokenHash: 'TOKEN-SECRETO',
        },
        createdAt: new Date('2026-09-03T12:00:00'),
      },
    ]);

    const resultado = await service.obtenerHistorialPerfil(10);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].realizadoPor).not.toHaveProperty('passwordHash');
    expect(resultado[0].realizadoPor).not.toHaveProperty(
      'passwordResetTokenHash',
    );
    expect(resultado[0].accion).toBe(
      AccionHistorialPerfilProfesor.APROBAR_PERFIL,
    );
    expect(resultado[0].perfilAcademico?.codigo).toBe('INF-SEG');
  });

  describe('PROFESOR ↔ PERFIL', () => {
    const perfilSeguridad = {
      id: 1,
      codigo: 'INF-SEG',
      nombre: 'Seguridad Informática',
      activo: true,
      carrera,
    } as PerfilAcademico;

    const perfilDatos = {
      id: 2,
      codigo: 'INF-DAT',
      nombre: 'Datos',
      activo: true,
      carrera,
    } as PerfilAcademico;

    it('profesor solicita perfil y queda PENDIENTE', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      perfilRepository.findOne.mockResolvedValue(perfilSeguridad);
      profesorPerfilRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 100,
          profesorUsuarioId: 10,
          perfilAcademicoId: 1,
          estado: EstadoPerfilProfesor.PENDIENTE,
          perfilAcademico: perfilSeguridad,
          solicitadoPorUsuarioId: 10,
        });

      const resultado = await service.solicitarPerfilMiPerfil(10, {
        perfilAcademicoId: 1,
      });

      expect(resultado).toBeDefined();
      expect(resultado?.estado).toBe(EstadoPerfilProfesor.PENDIENTE);
      expect(historialPerfilRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: TipoHistorialPerfilProfesor.PERFIL_ACADEMICO,
          accion: AccionHistorialPerfilProfesor.SOLICITAR_PERFIL,
        }),
      );
    });

    it('coordinador aprueba perfil docente', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      const solicitudPendiente = {
        id: 100,
        profesorUsuarioId: 10,
        perfilAcademicoId: 1,
        estado: EstadoPerfilProfesor.PENDIENTE,
        perfilAcademico: perfilSeguridad,
      } as ProfesorPerfilAcademico;

      requisitoPerfilRepository.find.mockResolvedValue([
        { id: 50, perfilAcademicoId: 1, obligatorio: true },
      ]);
      cumplimientoRequisitoRepository.find.mockResolvedValue([
        {
          requisitoPerfilAcademicoId: 50,
          estado: EstadoCumplimientoRequisito.CUMPLE,
        },
      ]);

      profesorPerfilRepository.findOne
        .mockResolvedValueOnce(solicitudPendiente)
        .mockResolvedValueOnce({
          ...solicitudPendiente,
          estado: EstadoPerfilProfesor.APROBADO,
          revisadoPorUsuarioId: 2,
        });

      const resultado = await service.revisarPerfilProfesor(10, 1, 2, {
        estado: EstadoPerfilProfesor.APROBADO,
        observacion: 'Perfil verificado',
      });

      expect(resultado.estado).toBe(EstadoPerfilProfesor.APROBADO);
      expect(historialPerfilRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: TipoHistorialPerfilProfesor.PERFIL_ACADEMICO,
          accion: AccionHistorialPerfilProfesor.APROBAR_PERFIL,
        }),
      );
    });

    it('profesor puede tener varios perfiles', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorPerfilRepository.find.mockResolvedValue([
        {
          id: 100,
          profesorUsuarioId: 10,
          perfilAcademicoId: 1,
          estado: EstadoPerfilProfesor.APROBADO,
          perfilAcademico: perfilSeguridad,
        },
        {
          id: 101,
          profesorUsuarioId: 10,
          perfilAcademicoId: 2,
          estado: EstadoPerfilProfesor.APROBADO,
          perfilAcademico: perfilDatos,
        },
      ]);

      const resultado = await service.listarPerfilesMiPerfil(10);
      expect(resultado).toHaveLength(2);
      expect(resultado.map((p) => p.codigo)).toEqual(['INF-SEG', 'INF-DAT']);
    });

    it('rechaza perfil duplicado pendiente', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      perfilRepository.findOne.mockResolvedValue(perfilSeguridad);
      profesorPerfilRepository.findOne.mockResolvedValue({
        id: 100,
        profesorUsuarioId: 10,
        perfilAcademicoId: 1,
        estado: EstadoPerfilProfesor.PENDIENTE,
      });

      await expect(
        service.solicitarPerfilMiPerfil(10, { perfilAcademicoId: 1 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('impide solicitar un perfil académico de una carrera no asignada al profesor', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());

      perfilRepository.findOne.mockResolvedValue(perfilSeguridad);

      profesorCarreraRepository.findOne.mockResolvedValue(null);

      await expect(
        service.solicitarPerfilMiPerfil(10, {
          perfilAcademicoId: 1,
        }),
      ).rejects.toThrow(
        'No puede solicitar un perfil académico de una carrera que no tiene asignada.',
      );

      expect(profesorPerfilRepository.findOne).not.toHaveBeenCalled();
    });

    it('rechaza aprobar perfil a un profesor inactivo', async () => {
      usuarioRepository.findOne.mockResolvedValue(
        crearProfesor({ activo: false }),
      );
      profesorPerfilRepository.findOne.mockResolvedValue({
        id: 100,
        profesorUsuarioId: 10,
        perfilAcademicoId: 1,
        estado: EstadoPerfilProfesor.PENDIENTE,
        perfilAcademico: perfilSeguridad,
      });

      await expect(
        service.revisarPerfilProfesor(10, 1, 2, {
          estado: EstadoPerfilProfesor.APROBADO,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza aprobar perfil si el perfil está inactivo', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorPerfilRepository.findOne.mockResolvedValue({
        id: 100,
        profesorUsuarioId: 10,
        perfilAcademicoId: 1,
        estado: EstadoPerfilProfesor.PENDIENTE,
        perfilAcademico: { ...perfilSeguridad, activo: false },
      });

      await expect(
        service.revisarPerfilProfesor(10, 1, 2, {
          estado: EstadoPerfilProfesor.APROBADO,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('EXPEDIENTE DE REQUISITOS DEL PERFIL', () => {
    const perfil = {
      id: 1,
      codigo: 'INF-SEG',
      nombre: 'Seguridad Informática',
      numeroPerfil: 7,
      activo: true,
      carrera,
    } as unknown as PerfilAcademico;
    const solicitud = {
      id: 100,
      profesorUsuarioId: 10,
      perfilAcademicoId: 1,
      estado: EstadoPerfilProfesor.PENDIENTE,
      perfilAcademico: perfil,
      observacionRevision: null,
    } as ProfesorPerfilAcademico;
    const requisito = {
      id: 50,
      perfilAcademicoId: 1,
      obligatorio: true,
      descripcion: 'Licenciatura afín',
      orden: 1,
    } as RequisitoPerfilAcademico;
    const cumplimiento = {
      id: 500,
      profesorPerfilAcademicoId: 100,
      requisitoPerfilAcademicoId: 50,
      estado: EstadoCumplimientoRequisito.PENDIENTE,
      observacionProfesor: null,
      observacionRevision: null,
      revisadoPorUsuarioId: null,
      fechaRevision: null,
      evidencias: [],
    } as unknown as CumplimientoRequisitoProfesor;

    it('crea un cumplimiento pendiente por cada requisito al solicitar', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      perfilRepository.findOne.mockResolvedValue(perfil);
      profesorPerfilRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...solicitud });
      requisitoPerfilRepository.find.mockResolvedValue(
        Array.from({ length: 11 }, (_, indice) => ({
          ...requisito,
          id: 50 + indice,
          orden: indice + 1,
        })),
      );
      cumplimientoRequisitoRepository.find.mockResolvedValue([]);

      await service.solicitarPerfilMiPerfil(10, { perfilAcademicoId: 1 });

      expect(cumplimientoRequisitoRepository.create).toHaveBeenCalledTimes(11);
      expect(cumplimientoRequisitoRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            requisitoPerfilAcademicoId: 50,
            estado: EstadoCumplimientoRequisito.PENDIENTE,
          }),
          expect.objectContaining({ requisitoPerfilAcademicoId: 60 }),
        ]),
      );
    });

    it('al reenviar reinicia la revisión y conserva las evidencias', async () => {
      const existente = {
        ...solicitud,
        estado: EstadoPerfilProfesor.RECHAZADO,
      } as ProfesorPerfilAcademico;
      const cumplimientoExistente = {
        ...cumplimiento,
        estado: EstadoCumplimientoRequisito.NO_CUMPLE,
        observacionProfesor: 'Adjunto título',
        observacionRevision: 'No corresponde',
        revisadoPorUsuarioId: 2,
        fechaRevision: new Date(),
        evidencias: [{ id: 900 }],
      } as unknown as CumplimientoRequisitoProfesor;
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      perfilRepository.findOne.mockResolvedValue(perfil);
      profesorPerfilRepository.findOne
        .mockResolvedValueOnce(existente)
        .mockResolvedValueOnce({
          ...existente,
          estado: EstadoPerfilProfesor.PENDIENTE,
        });
      requisitoPerfilRepository.find.mockResolvedValue([requisito]);
      cumplimientoRequisitoRepository.find.mockResolvedValue([
        cumplimientoExistente,
      ]);

      await service.solicitarPerfilMiPerfil(10, { perfilAcademicoId: 1 });

      expect(cumplimientoExistente).toEqual(
        expect.objectContaining({
          estado: EstadoCumplimientoRequisito.PENDIENTE,
          observacionProfesor: 'Adjunto título',
          observacionRevision: null,
          revisadoPorUsuarioId: null,
          fechaRevision: null,
          evidencias: [{ id: 900 }],
        }),
      );
      expect(evidenciaRequisitoRepository.delete).not.toHaveBeenCalled();
    });

    it('reemplaza las evidencias y guarda la observación del profesor', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorPerfilRepository.findOne.mockResolvedValue(solicitud);
      requisitoPerfilRepository.findOne.mockResolvedValue(requisito);
      cumplimientoRequisitoRepository.findOne.mockResolvedValue({
        ...cumplimiento,
      });
      atestadoRepository.find.mockResolvedValue([
        {
          id: 20,
          profesorUsuarioId: 10,
          estado: EstadoAtestadoProfesor.PENDIENTE,
        },
      ]);
      jest.spyOn(service, 'obtenerExpedientePerfilProfesor').mockResolvedValue({
        requisitos: [{ id: 50, evidencias: [{ id: 20 }] }],
      } as never);

      const resultado = await service.guardarEvidenciasRequisitoMiPerfil(
        10,
        1,
        50,
        { requisitoId: 50, atestadoIds: [20], observacion: '  Título  ' },
      );

      expect(evidenciaRequisitoRepository.delete).toHaveBeenCalledWith({
        cumplimientoRequisitoId: 500,
      });
      expect(evidenciaRequisitoRepository.create).toHaveBeenCalledWith({
        cumplimientoRequisitoId: 500,
        atestadoProfesorId: 20,
      });
      expect(cumplimientoRequisitoRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ observacionProfesor: 'Título' }),
      );
      expect(resultado).toEqual({ id: 50, evidencias: [{ id: 20 }] });
    });

    it('rechaza si el requisito del cuerpo no coincide con la ruta', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());

      await expect(
        service.guardarEvidenciasRequisitoMiPerfil(10, 1, 50, {
          requisitoId: 51,
          atestadoIds: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un requisito perteneciente a otro perfil', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorPerfilRepository.findOne.mockResolvedValue(solicitud);
      requisitoPerfilRepository.findOne.mockResolvedValue(null);

      await expect(
        service.guardarEvidenciasRequisitoMiPerfil(10, 1, 50, {
          requisitoId: 50,
          atestadoIds: [],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza un atestado perteneciente a otro profesor', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorPerfilRepository.findOne.mockResolvedValue(solicitud);
      requisitoPerfilRepository.findOne.mockResolvedValue(requisito);
      cumplimientoRequisitoRepository.findOne.mockResolvedValue(cumplimiento);
      atestadoRepository.find.mockResolvedValue([
        {
          id: 20,
          profesorUsuarioId: 99,
          estado: EstadoAtestadoProfesor.PENDIENTE,
        },
      ]);

      await expect(
        service.guardarEvidenciasRequisitoMiPerfil(10, 1, 50, {
          requisitoId: 50,
          atestadoIds: [20],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rechaza un atestado inactivo', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorPerfilRepository.findOne.mockResolvedValue(solicitud);
      requisitoPerfilRepository.findOne.mockResolvedValue(requisito);
      cumplimientoRequisitoRepository.findOne.mockResolvedValue(cumplimiento);
      atestadoRepository.find.mockResolvedValue([
        {
          id: 20,
          profesorUsuarioId: 10,
          estado: EstadoAtestadoProfesor.INACTIVO,
        },
      ]);

      await expect(
        service.guardarEvidenciasRequisitoMiPerfil(10, 1, 50, {
          requisitoId: 50,
          atestadoIds: [20],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('devuelve el expediente ordenado y excluye atestados inactivos', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorPerfilRepository.findOne.mockResolvedValue(solicitud);
      requisitoPerfilRepository.find.mockResolvedValue([
        requisito,
        { ...requisito, id: 51, orden: 2 },
      ]);
      cumplimientoRequisitoRepository.find.mockResolvedValue([
        {
          ...cumplimiento,
          evidencias: [
            {
              id: 1,
              atestado: {
                id: 20,
                tipo: TipoAtestadoProfesor.TITULO_ACADEMICO,
                nombre: 'Licenciatura',
                estado: EstadoAtestadoProfesor.APROBADO,
              },
            },
          ],
        },
      ]);
      atestadoRepository.find.mockResolvedValue([
        {
          id: 20,
          profesorUsuarioId: 10,
          tipo: TipoAtestadoProfesor.TITULO_ACADEMICO,
          nombre: 'Licenciatura',
          estado: EstadoAtestadoProfesor.APROBADO,
        },
        {
          id: 21,
          profesorUsuarioId: 10,
          tipo: TipoAtestadoProfesor.OTRO,
          nombre: 'Antiguo',
          estado: EstadoAtestadoProfesor.INACTIVO,
        },
      ]);

      const resultado = await service.obtenerExpedientePerfilProfesor(
        10,
        1,
        10,
      );

      expect(resultado.requisitos.map((item) => item.id)).toEqual([50, 51]);
      expect(resultado.requisitos[0].evidencias[0].id).toBe(20);
      expect(resultado.atestadosDisponibles.map((item) => item.id)).toEqual([
        20,
      ]);
    });

    it('impide consultar el expediente fuera del alcance académico', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorPerfilRepository.findOne.mockResolvedValue(solicitud);
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        false,
      );

      await expect(
        service.obtenerExpedientePerfilProfesor(10, 1, 2),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each<
      | EstadoCumplimientoRequisito.CUMPLE
      | EstadoCumplimientoRequisito.NO_CUMPLE
    >([
      EstadoCumplimientoRequisito.CUMPLE,
      EstadoCumplimientoRequisito.NO_CUMPLE,
    ])('guarda la revisión manual %s con revisor y fecha', async (estado) => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorPerfilRepository.findOne.mockResolvedValue(solicitud);
      requisitoPerfilRepository.findOne.mockResolvedValue(requisito);
      cumplimientoRequisitoRepository.findOne.mockResolvedValue({
        ...cumplimiento,
      });

      await service.revisarRequisitoPerfilProfesor(10, 1, 50, 2, {
        estado,
        observacion: '  Verificado  ',
      });

      expect(cumplimientoRequisitoRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          estado,
          observacionRevision: 'Verificado',
          revisadoPorUsuarioId: 2,
          fechaRevision: expect.any(Date),
        }),
      );
    });

    it('impide revisar un requisito fuera del alcance académico', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorPerfilRepository.findOne.mockResolvedValue(solicitud);
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        false,
      );

      await expect(
        service.revisarRequisitoPerfilProfesor(10, 1, 50, 2, {
          estado: EstadoCumplimientoRequisito.CUMPLE,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each([
      EstadoCumplimientoRequisito.PENDIENTE,
      EstadoCumplimientoRequisito.NO_CUMPLE,
      EstadoCumplimientoRequisito.NO_APLICA,
    ])(
      'bloquea la aprobación si un requisito obligatorio está %s',
      async (estado) => {
        usuarioRepository.findOne.mockResolvedValue(crearProfesor());
        profesorPerfilRepository.findOne.mockResolvedValue(solicitud);
        requisitoPerfilRepository.find.mockResolvedValue([requisito]);
        cumplimientoRequisitoRepository.find.mockResolvedValue([
          { ...cumplimiento, estado },
        ]);

        await expect(
          service.revisarPerfilProfesor(10, 1, 2, {
            estado: EstadoPerfilProfesor.APROBADO,
          }),
        ).rejects.toThrow(
          'No se puede aprobar el perfil académico porque existen requisitos obligatorios pendientes o incumplidos.',
        );
      },
    );

    it('bloquea la aprobación si falta el cumplimiento obligatorio', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorPerfilRepository.findOne.mockResolvedValue(solicitud);
      requisitoPerfilRepository.find.mockResolvedValue([requisito]);
      cumplimientoRequisitoRepository.find.mockResolvedValue([]);

      await expect(
        service.revisarPerfilProfesor(10, 1, 2, {
          estado: EstadoPerfilProfesor.APROBADO,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('permite rechazar sin evaluar todos los requisitos', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorPerfilRepository.findOne
        .mockResolvedValueOnce(solicitud)
        .mockResolvedValueOnce({
          ...solicitud,
          estado: EstadoPerfilProfesor.RECHAZADO,
          revisadoPorUsuarioId: 2,
        });

      const resultado = await service.revisarPerfilProfesor(10, 1, 2, {
        estado: EstadoPerfilProfesor.RECHAZADO,
        observacion: 'Debe completar la documentación',
      });

      expect(resultado.estado).toBe(EstadoPerfilProfesor.RECHAZADO);
      expect(requisitoPerfilRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('ELEGIBILIDAD', () => {
    beforeEach(() => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorCarreraRepository.find.mockResolvedValue([
        {
          profesorUsuarioId: 10,
          carreraId: 1,
          carrera,
        },
      ]);
    });

    const perfilSeguridad = {
      id: 1,
      carreraId: 1,
      codigo: 'INF-SEG',
      nombre: 'Seguridad Informática',
      activo: true,
    } as PerfilAcademico;

    const perfilMatematica = {
      id: 3,
      carreraId: 1,
      codigo: 'INF-MAT',
      nombre: 'Matemática para Informática',
      activo: true,
    } as PerfilAcademico;

    const cursoSeguridad = {
      id: 50,
      codigo: 'EIF472',
      nombre: 'Seguridad',
      activo: true,
      descripcion: 'Curso de seguridad',
      carreras: [carrera],
    } as Curso;

    const cursoDiscretas = {
      id: 51,
      codigo: 'EIF203',
      nombre: 'Estructuras Discretas',
      activo: true,
      descripcion: 'Curso de estructuras',
      carreras: [carrera],
    } as Curso;

    it('profesor con SEGURIDAD es elegible para curso SEGURIDAD', async () => {
      profesorPerfilRepository.find.mockResolvedValue([
        {
          id: 100,
          profesorUsuarioId: 10,
          perfilAcademicoId: 1,
          estado: EstadoPerfilProfesor.APROBADO,
          perfilAcademico: perfilSeguridad,
        },
      ]);

      cursoPerfilRepository.find.mockResolvedValue([
        {
          id: 1,
          perfilAcademicoId: 1,
          cursoId: 50,
          activo: true,
          curso: cursoSeguridad,
          perfilAcademico: perfilSeguridad,
        },
      ]);

      const cursosHabilitados =
        await service.listarCursosHabilitadosMiPerfil(10);
      expect(cursosHabilitados).toHaveLength(1);
      expect(cursosHabilitados[0].id).toBe(50);
      expect(cursosHabilitados[0].codigo).toBe('EIF472');
      expect(cursosHabilitados[0].habilitadoPor[0].codigo).toBe('INF-SEG');
    });

    it('profesor con DATOS no es elegible para curso SEGURIDAD', async () => {
      const perfilDatos = {
        id: 2,
        carreraId: 1,
        codigo: 'INF-DAT',
        nombre: 'Datos',
        activo: true,
      } as PerfilAcademico;

      profesorPerfilRepository.find.mockResolvedValue([
        {
          id: 101,
          profesorUsuarioId: 10,
          perfilAcademicoId: 2,
          estado: EstadoPerfilProfesor.APROBADO,
          perfilAcademico: perfilDatos,
        },
      ]);

      cursoPerfilRepository.find.mockResolvedValue([]);

      const cursosHabilitados =
        await service.listarCursosHabilitadosMiPerfil(10);
      expect(cursosHabilitados).toHaveLength(0);
    });

    it('profesor con SEGURIDAD y MATEMATICA para curso que acepta ambos aparece una sola vez con ambos en habilitadoPor', async () => {
      profesorPerfilRepository.find.mockResolvedValue([
        {
          id: 100,
          profesorUsuarioId: 10,
          perfilAcademicoId: 1,
          estado: EstadoPerfilProfesor.APROBADO,
          perfilAcademico: perfilSeguridad,
        },
        {
          id: 102,
          profesorUsuarioId: 10,
          perfilAcademicoId: 3,
          estado: EstadoPerfilProfesor.APROBADO,
          perfilAcademico: perfilMatematica,
        },
      ]);

      cursoPerfilRepository.find.mockResolvedValue([
        {
          id: 10,
          perfilAcademicoId: 1,
          cursoId: 51,
          activo: true,
          curso: cursoDiscretas,
          perfilAcademico: perfilSeguridad,
        },
        {
          id: 11,
          perfilAcademicoId: 3,
          cursoId: 51,
          activo: true,
          curso: cursoDiscretas,
          perfilAcademico: perfilMatematica,
        },
      ]);

      const cursosHabilitados =
        await service.listarCursosHabilitadosMiPerfil(10);
      expect(cursosHabilitados).toHaveLength(1);
      expect(cursosHabilitados[0].id).toBe(51);
      expect(cursosHabilitados[0].habilitadoPor).toHaveLength(2);
      expect(cursosHabilitados[0].habilitadoPor.map((h) => h.perfilId)).toEqual(
        expect.arrayContaining([1, 3]),
      );
    });

    it('no habilita cursos de un perfil aprobado si su carrera ya no está asignada al profesor', async () => {
      profesorPerfilRepository.find.mockResolvedValue([
        {
          id: 100,
          profesorUsuarioId: 10,
          perfilAcademicoId: 1,
          estado: EstadoPerfilProfesor.APROBADO,
          perfilAcademico: perfilSeguridad,
        },
      ]);

      profesorCarreraRepository.find.mockResolvedValue([]);

      cursoPerfilRepository.find.mockResolvedValue([
        {
          id: 1,
          perfilAcademicoId: 1,
          cursoId: 50,
          activo: true,
          curso: cursoSeguridad,
          perfilAcademico: perfilSeguridad,
        },
      ]);

      const resultado = await service.listarCursosHabilitadosMiPerfil(10);

      expect(resultado).toEqual([]);
      expect(cursoPerfilRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('ATESTADOS', () => {
    beforeEach(() => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
    });

    it('profesor agrega título -> PENDIENTE', async () => {
      atestadoRepository.save.mockImplementation(async (datos) => ({
        id: 1,
        ...datos,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const resultado = await service.crearAtestadoMiPerfil(10, {
        tipo: TipoAtestadoProfesor.TITULO_ACADEMICO,
        nombre: 'Bachillerato en Sistemas',
        institucion: 'UNA',
        fechaObtencion: '2022-12-01',
        descripcion: 'Grado universitario',
      });

      expect(resultado.estado).toBe(EstadoAtestadoProfesor.PENDIENTE);
      expect(resultado.nombre).toBe('Bachillerato en Sistemas');
      expect(resultado.institucion).toBe('UNA');
      expect(atestadoRepository.save).toHaveBeenCalled();
    });

    it('coordinador aprueba atestado -> APROBADO', async () => {
      atestadoRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.TITULO_ACADEMICO,
        nombre: 'Bachillerato en Sistemas',
        institucion: 'UNA',
        estado: EstadoAtestadoProfesor.PENDIENTE,
        revisadoPorUsuarioId: null,
      });

      atestadoRepository.save.mockImplementation(async (datos) => datos);

      const resultado = await service.revisarAtestadoProfesor(10, 1, 2, {
        estado: EstadoAtestadoProfesor.APROBADO,
        observacion: 'Válido',
      });

      expect(resultado.estado).toBe(EstadoAtestadoProfesor.APROBADO);
      expect(resultado.revisadoPorUsuarioId).toBe(2);
      expect(resultado.observacionRevision).toBe('Válido');
    });

    it('coordinador rechaza atestado -> RECHAZADO', async () => {
      atestadoRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.CERTIFICACION,
        nombre: 'Certificación Fake',
        institucion: 'Desconocida',
        estado: EstadoAtestadoProfesor.PENDIENTE,
      });

      atestadoRepository.save.mockImplementation(async (datos) => datos);

      const resultado = await service.revisarAtestadoProfesor(10, 1, 2, {
        estado: EstadoAtestadoProfesor.RECHAZADO,
        observacion: 'No acreditada',
      });

      expect(resultado.estado).toBe(EstadoAtestadoProfesor.RECHAZADO);
      expect(resultado.observacionRevision).toBe('No acreditada');
    });

    it('profesor inactivo no agrega atestado', async () => {
      usuarioRepository.findOne.mockResolvedValue(
        crearProfesor({ activo: false }),
      );

      await expect(
        service.crearAtestadoMiPerfil(10, {
          tipo: TipoAtestadoProfesor.TITULO_ACADEMICO,
          nombre: 'Licenciatura',
          institucion: 'UNA',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('profesor inactivo no recibe aprobación de atestado', async () => {
      usuarioRepository.findOne.mockResolvedValue(
        crearProfesor({ activo: false }),
      );

      await expect(
        service.revisarAtestadoProfesor(10, 1, 2, {
          estado: EstadoAtestadoProfesor.APROBADO,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('editar atestado APROBADO vuelve automáticamente a PENDIENTE', async () => {
      atestadoRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.TITULO_ACADEMICO,
        nombre: 'Bachillerato',
        institucion: 'UNA',
        estado: EstadoAtestadoProfesor.APROBADO,
        revisadoPorUsuarioId: 2,
        fechaRevision: new Date(),
        observacionRevision: 'Aprobado antes',
      });

      atestadoRepository.save.mockImplementation(async (datos) => datos);

      const resultado = await service.actualizarAtestadoMiPerfil(10, 1, {
        nombre: 'Maestría en Computación',
      });

      expect(resultado.estado).toBe(EstadoAtestadoProfesor.PENDIENTE);
      expect(resultado.revisadoPorUsuarioId).toBeNull();
      expect(resultado.fechaRevision).toBeNull();
      expect(resultado.observacionRevision).toBeNull();
    });

    it('editar atestado RECHAZADO vuelve automáticamente a PENDIENTE', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());

      atestadoRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.CERTIFICACION,
        nombre: 'Certificación rechazada',
        institucion: 'Institución',
        estado: EstadoAtestadoProfesor.RECHAZADO,
        revisadoPorUsuarioId: 2,
        fechaRevision: new Date(),
        observacionRevision: 'Documento incorrecto',
      });

      atestadoRepository.save.mockImplementation(async (datos) => datos);

      const resultado = await service.actualizarAtestadoMiPerfil(10, 1, {
        nombre: 'Certificación corregida',
      });

      expect(resultado.estado).toBe(EstadoAtestadoProfesor.PENDIENTE);
      expect(resultado.revisadoPorUsuarioId).toBeNull();
      expect(resultado.fechaRevision).toBeNull();
      expect(resultado.observacionRevision).toBeNull();
    });

    it('inactivar atestado cambia estado a INACTIVO', async () => {
      atestadoRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        estado: EstadoAtestadoProfesor.APROBADO,
      });

      atestadoRepository.save.mockImplementation(async (datos) => datos);

      const resultado = await service.inactivarAtestadoMiPerfil(10, 1);
      expect(resultado.estado).toBe(EstadoAtestadoProfesor.INACTIVO);
    });

    it('no permite modificar atestado inactivo', async () => {
      atestadoRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        estado: EstadoAtestadoProfesor.INACTIVO,
      });

      await expect(
        service.actualizarAtestadoMiPerfil(10, 1, { nombre: 'Otro' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('no permite revisar atestado inactivo', async () => {
      atestadoRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        estado: EstadoAtestadoProfesor.INACTIVO,
      });

      await expect(
        service.revisarAtestadoProfesor(10, 1, 2, {
          estado: EstadoAtestadoProfesor.APROBADO,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('no permite revisar con el mismo estado', async () => {
      atestadoRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        estado: EstadoAtestadoProfesor.APROBADO,
      });

      await expect(
        service.revisarAtestadoProfesor(10, 1, 2, {
          estado: EstadoAtestadoProfesor.APROBADO,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('PROYECTOS', () => {
    beforeEach(() => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
    });

    it('crea proyecto exitosamente', async () => {
      proyectoRepository.save.mockImplementation(async (datos) => ({
        id: 1,
        ...datos,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const resultado = await service.crearProyectoMiPerfil(10, {
        nombre: 'Ciberseguridad UNA',
        unidad: 'CENTIC',
        rol: 'Investigador',
        fechaInicio: '2024-01-01',
        fechaFin: '2024-12-31',
        descripcion: 'Investigación en redes',
      });

      expect(resultado.nombre).toBe('Ciberseguridad UNA');
      expect(resultado.unidad).toBe('CENTIC');
      expect(resultado.activo).toBe(true);
    });

    it('rechaza fechaFin anterior a fechaInicio', async () => {
      await expect(
        service.crearProyectoMiPerfil(10, {
          nombre: 'Proyecto Temporal',
          fechaInicio: '2024-12-31',
          fechaFin: '2024-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('actualiza proyecto exitosamente', async () => {
      proyectoRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        nombre: 'Proyecto Original',
        fechaInicio: '2024-01-01',
        fechaFin: '2024-12-31',
        activo: true,
      });

      proyectoRepository.save.mockImplementation(async (datos) => datos);

      const resultado = await service.actualizarProyectoMiPerfil(10, 1, {
        nombre: 'Proyecto Actualizado',
      });

      expect(resultado.nombre).toBe('Proyecto Actualizado');
    });

    it('cambia estado de proyecto (activo: false / true)', async () => {
      proyectoRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        nombre: 'Proyecto',
        activo: true,
      });

      proyectoRepository.save.mockImplementation(async (datos) => datos);

      const resultado = await service.cambiarEstadoProyectoMiPerfil(10, 1, {
        activo: false,
      });

      expect(resultado.activo).toBe(false);
    });

    it('rechaza cambiar estado al mismo valor', async () => {
      proyectoRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        activo: true,
      });

      await expect(
        service.cambiarEstadoProyectoMiPerfil(10, 1, { activo: true }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('PERFIL COMPLETO (obtenerPorId)', () => {
    it('devuelve carreras, perfilesAcademicos, cursosHabilitados, atestados y proyectos', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
      profesorCarreraRepository.find.mockResolvedValue([]);
      profesorPerfilRepository.find.mockResolvedValue([]);
      cursoPerfilRepository.find.mockResolvedValue([]);
      atestadoRepository.find.mockResolvedValue([
        {
          id: 1,
          profesorUsuarioId: 10,
          tipo: TipoAtestadoProfesor.TITULO_ACADEMICO,
          nombre: 'Maestría',
          institucion: 'UNA',
          fechaObtencion: '2023-01-01',
          descripcion: null,
          estado: EstadoAtestadoProfesor.APROBADO,
          revisadoPorUsuarioId: 2,
          fechaRevision: new Date(),
          observacionRevision: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      proyectoRepository.find.mockResolvedValue([
        {
          id: 1,
          profesorUsuarioId: 10,
          nombre: 'Lab Ciberseguridad',
          unidad: 'CENTIC',
          rol: 'Líder',
          fechaInicio: '2024-01-01',
          fechaFin: null,
          descripcion: null,
          activo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const perfil = await service.obtenerPorId(10);

      expect(perfil).toHaveProperty('carreras');
      expect(perfil).toHaveProperty('perfilesAcademicos');
      expect(perfil).toHaveProperty('cursosHabilitados');
      expect(perfil).toHaveProperty('atestados');
      expect(perfil).toHaveProperty('proyectos');
      expect(perfil.atestados).toHaveLength(1);
      expect(perfil.proyectos).toHaveLength(1);
      expect(perfil.atestados[0].nombre).toBe('Maestría');
      expect(perfil.proyectos[0].nombre).toBe('Lab Ciberseguridad');
    });
  });

  describe('ALCANCE Y AUTORIDAD ACADEMICA', () => {
    it('coordinador sin alcance sobre la carrera del perfil no puede aprobarlo', async () => {
      profesorPerfilRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        perfilAcademicoId: 5,
        estado: EstadoPerfilProfesor.PENDIENTE,
        perfilAcademico: { id: 5, carreraId: 2, activo: true },
      });

      usuarioRepository.findOne.mockImplementation(async ({ where }) => {
        if (where.id === 10) return crearProfesor({ id: 10 });
        if (where.id === 2) {
          return crearProfesor({
            id: 2,
            usuarioRoles: [
              { rol: { nombre: RolSistema.COORDINADOR, activo: true } },
            ] as any,
          });
        }
        return null;
      });

      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        false,
      );

      await expect(
        service.revisarPerfilProfesor(10, 5, 2, {
          estado: EstadoPerfilProfesor.APROBADO,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('coordinador sin alcance sobre el profesor no puede aprobar atestado', async () => {
      atestadoRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        estado: EstadoAtestadoProfesor.PENDIENTE,
      });

      usuarioRepository.findOne.mockImplementation(async ({ where }) => {
        if (where.id === 10) return crearProfesor({ id: 10 });
        if (where.id === 2) {
          return crearProfesor({
            id: 2,
            usuarioRoles: [
              { rol: { nombre: RolSistema.COORDINADOR, activo: true } },
            ] as any,
          });
        }
        return null;
      });

      estructuraAcademicaService.tieneAlcanceSobreProfesor.mockResolvedValue(
        false,
      );

      await expect(
        service.revisarAtestadoProfesor(10, 1, 2, {
          estado: EstadoAtestadoProfesor.APROBADO,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('inactiva perfil administrativamente cuando el revisor posee alcance sobre la carrera', async () => {
      const perfilDocente = {
        id: 1,
        profesorUsuarioId: 10,
        perfilAcademicoId: 5,
        estado: EstadoPerfilProfesor.APROBADO,
        perfilAcademico: { id: 5, carreraId: 2, activo: true },
      };

      profesorPerfilRepository.findOne
        .mockResolvedValueOnce(perfilDocente)
        .mockResolvedValueOnce({
          ...perfilDocente,
          estado: EstadoPerfilProfesor.INACTIVO,
          revisadoPorUsuarioId: 2,
        });

      usuarioRepository.findOne.mockImplementation(async ({ where }) => {
        if (where.id === 10) return crearProfesor({ id: 10 });
        if (where.id === 2) {
          return crearProfesor({
            id: 2,
            usuarioRoles: [
              { rol: { nombre: RolSistema.COORDINADOR, activo: true } },
            ] as any,
          });
        }
        return null;
      });

      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        true,
      );

      const resultado = await service.inactivarPerfilProfesor(
        10,
        5,
        2,
        'Inactivación admin',
      );
      expect(resultado.estado).toBe(EstadoPerfilProfesor.INACTIVO);
      expect(
        estructuraAcademicaService.tieneAlcanceSobreCarrera,
      ).toHaveBeenCalledWith(2, 2);
    });

    it('rechaza inactivar perfil administrativamente si el usuario no tiene alcance sobre la carrera', async () => {
      profesorPerfilRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        perfilAcademicoId: 5,
        estado: EstadoPerfilProfesor.APROBADO,
        perfilAcademico: { id: 5, carreraId: 2, activo: true },
      });

      usuarioRepository.findOne.mockImplementation(async ({ where }) => {
        if (where.id === 10) return crearProfesor({ id: 10 });
        if (where.id === 2) {
          return crearProfesor({
            id: 2,
            usuarioRoles: [
              { rol: { nombre: RolSistema.COORDINADOR, activo: true } },
            ] as any,
          });
        }
        return null;
      });

      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        false,
      );

      await expect(
        service.inactivarPerfilProfesor(10, 5, 2, 'Inactivar sin alcance'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite al profesor inactivar su propio perfil sin validar alcance académico', async () => {
      const perfilDocente = {
        id: 1,
        profesorUsuarioId: 10,
        perfilAcademicoId: 5,
        estado: EstadoPerfilProfesor.APROBADO,
        perfilAcademico: { id: 5, carreraId: 2, activo: true },
      };

      profesorPerfilRepository.findOne
        .mockResolvedValueOnce(perfilDocente)
        .mockResolvedValueOnce({
          ...perfilDocente,
          estado: EstadoPerfilProfesor.INACTIVO,
          revisadoPorUsuarioId: 10,
        });

      usuarioRepository.findOne.mockImplementation(async ({ where }) => {
        if (where.id === 10) return crearProfesor({ id: 10 });
        return null;
      });

      const resultado = await service.inactivarPerfilProfesor(
        10,
        5,
        10,
        'Autogestión',
      );
      expect(resultado.estado).toBe(EstadoPerfilProfesor.INACTIVO);
      expect(
        estructuraAcademicaService.tieneAlcanceSobreCarrera,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Etapa 5 - Atestados y consistencia de evidencias', () => {
    beforeEach(() => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor({ id: 10 }));
    });

    it('crear experiencia con inicio válido y fin null (actualidad)', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor({ id: 10 }));
      atestadoRepository.save.mockImplementation(async (datos) => ({
        id: 1,
        profesorUsuarioId: 10,
        ...datos,
      }));

      const resultado = await service.crearAtestadoMiPerfil(10, {
        tipo: TipoAtestadoProfesor.EXPERIENCIA_DOCENTE,
        nombre: 'Profesor de Cátedra',
        institucion: 'UNA',
        fechaInicio: '2022-02-01',
      });

      expect(resultado.tipo).toBe(TipoAtestadoProfesor.EXPERIENCIA_DOCENTE);
      expect(resultado.fechaInicio).toBe('2022-02-01');
      expect(resultado.fechaFin).toBeNull();
      expect(resultado.fechaObtencion).toBeNull();
    });

    it('rechaza crear experiencia sin fecha de inicio', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor({ id: 10 }));

      await expect(
        service.crearAtestadoMiPerfil(10, {
          tipo: TipoAtestadoProfesor.EXPERIENCIA_DOCENTE,
          nombre: 'Profesor',
          institucion: 'UNA',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza crear experiencia con fecha fin anterior a la fecha de inicio', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor({ id: 10 }));

      await expect(
        service.crearAtestadoMiPerfil(10, {
          tipo: TipoAtestadoProfesor.EXPERIENCIA_PROFESIONAL,
          nombre: 'Desarrollador Senior',
          institucion: 'Tech Corp',
          fechaInicio: '2024-05-01',
          fechaFin: '2023-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crear título académico guarda fechaObtencion y limpia fechaInicio/fechaFin', async () => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor({ id: 10 }));
      atestadoRepository.save.mockImplementation(async (datos) => ({
        id: 2,
        profesorUsuarioId: 10,
        ...datos,
      }));

      const resultado = await service.crearAtestadoMiPerfil(10, {
        tipo: TipoAtestadoProfesor.TITULO_ACADEMICO,
        nombre: 'Licenciatura en Informática',
        institucion: 'UNA',
        fechaObtencion: '2020-11-20',
      });

      expect(resultado.tipo).toBe(TipoAtestadoProfesor.TITULO_ACADEMICO);
      expect(resultado.fechaObtencion).toBe('2020-11-20');
      expect(resultado.fechaInicio).toBeNull();
      expect(resultado.fechaFin).toBeNull();
    });

    it('cambiar experiencia a título limpia las fechas de periodo', async () => {
      const atestadoExistente = {
        id: 1,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.EXPERIENCIA_DOCENTE,
        nombre: 'Docencia previa',
        institucion: 'UNA',
        fechaInicio: '2020-01-01',
        fechaFin: '2022-01-01',
        fechaObtencion: null,
        estado: EstadoAtestadoProfesor.APROBADO,
      };

      atestadoRepository.findOne.mockResolvedValue(atestadoExistente);
      atestadoRepository.save.mockImplementation(async (datos) => datos);
      evidenciaRequisitoRepository.find.mockResolvedValue([]);

      const resultado = await service.actualizarAtestadoMiPerfil(10, 1, {
        tipo: TipoAtestadoProfesor.TITULO_ACADEMICO,
        fechaObtencion: '2023-05-10',
      });

      expect(resultado.tipo).toBe(TipoAtestadoProfesor.TITULO_ACADEMICO);
      expect(resultado.fechaObtencion).toBe('2023-05-10');
      expect(resultado.fechaInicio).toBeNull();
      expect(resultado.fechaFin).toBeNull();
      expect(resultado.estado).toBe(EstadoAtestadoProfesor.PENDIENTE);
    });

    it('editar atestado vinculado resetea cumplimiento a PENDIENTE y limpia revisión', async () => {
      const atestadoExistente = {
        id: 1,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.CERTIFICACION,
        nombre: 'Certificación B2 Inglés',
        institucion: 'TOEIC',
        fechaObtencion: '2024-01-01',
        estado: EstadoAtestadoProfesor.APROBADO,
      };

      const cumplimientoVinculado = {
        id: 100,
        profesorUsuarioId: 10,
        requisitoPerfilAcademicoId: 5,
        estado: EstadoCumplimientoRequisito.CUMPLE,
        revisadoPorUsuarioId: 2,
        fechaRevision: new Date('2026-02-01'),
        observacionRevision: 'Aprobado previamente',
      };

      atestadoRepository.findOne.mockResolvedValue(atestadoExistente);
      atestadoRepository.save.mockImplementation(async (datos) => datos);

      evidenciaRequisitoRepository.find.mockResolvedValue([
        {
          id: 1,
          atestadoProfesorId: 1,
          cumplimientoRequisitoId: 100,
        },
      ]);

      cumplimientoRequisitoRepository.find.mockResolvedValue([
        cumplimientoVinculado,
      ]);

      cumplimientoRequisitoRepository.save.mockImplementation(
        async (datos) => datos,
      );

      await service.actualizarAtestadoMiPerfil(10, 1, {
        nombre: 'Certificación C1 Inglés Actualizada',
      });

      expect(cumplimientoRequisitoRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 100,
          estado: EstadoCumplimientoRequisito.PENDIENTE,
          revisadoPorUsuarioId: null,
          fechaRevision: null,
          observacionRevision: null,
        }),
      );
    });

    it('inactivar evidencia resetea cumplimiento a PENDIENTE', async () => {
      const atestadoExistente = {
        id: 1,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.CERTIFICACION,
        nombre: 'Certificación Java',
        institucion: 'Oracle',
        estado: EstadoAtestadoProfesor.APROBADO,
      };

      const cumplimientoVinculado = {
        id: 200,
        profesorUsuarioId: 10,
        requisitoPerfilAcademicoId: 7,
        estado: EstadoCumplimientoRequisito.CUMPLE,
        revisadoPorUsuarioId: 2,
        fechaRevision: new Date('2026-02-01'),
        observacionRevision: 'Válido',
      };

      atestadoRepository.findOne.mockResolvedValue(atestadoExistente);
      atestadoRepository.save.mockImplementation(async (datos) => datos);

      evidenciaRequisitoRepository.find.mockResolvedValue([
        {
          id: 2,
          atestadoProfesorId: 1,
          cumplimientoRequisitoId: 200,
        },
      ]);

      cumplimientoRequisitoRepository.find.mockResolvedValue([
        cumplimientoVinculado,
      ]);

      cumplimientoRequisitoRepository.save.mockImplementation(
        async (datos) => datos,
      );

      const resultado = await service.inactivarAtestadoMiPerfil(10, 1);
      expect(resultado.estado).toBe(EstadoAtestadoProfesor.INACTIVO);

      expect(cumplimientoRequisitoRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 200,
          estado: EstadoCumplimientoRequisito.PENDIENTE,
          revisadoPorUsuarioId: null,
          fechaRevision: null,
          observacionRevision: null,
        }),
      );
    });

    it('rechazar evidencia resetea cumplimiento a PENDIENTE', async () => {
      const atestadoExistente = {
        id: 1,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.CERTIFICACION,
        nombre: 'Certificación AWS',
        institucion: 'Amazon',
        estado: EstadoAtestadoProfesor.PENDIENTE,
      };

      const cumplimientoVinculado = {
        id: 300,
        profesorUsuarioId: 10,
        requisitoPerfilAcademicoId: 8,
        estado: EstadoCumplimientoRequisito.CUMPLE,
        revisadoPorUsuarioId: 2,
        fechaRevision: new Date('2026-02-01'),
        observacionRevision: 'OK',
      };

      atestadoRepository.findOne.mockResolvedValue(atestadoExistente);
      atestadoRepository.save.mockImplementation(async (datos) => datos);

      usuarioRepository.findOne.mockImplementation(async ({ where }) => {
        if (where.id === 10) return crearProfesor({ id: 10 });
        if (where.id === 2) {
          return crearProfesor({
            id: 2,
            usuarioRoles: [
              { rol: { nombre: RolSistema.COORDINADOR, activo: true } },
            ] as any,
          });
        }
        return null;
      });

      estructuraAcademicaService.tieneAlcanceSobreProfesor.mockResolvedValue(
        true,
      );

      evidenciaRequisitoRepository.find.mockResolvedValue([
        {
          id: 3,
          atestadoProfesorId: 1,
          cumplimientoRequisitoId: 300,
        },
      ]);

      cumplimientoRequisitoRepository.find.mockResolvedValue([
        cumplimientoVinculado,
      ]);

      cumplimientoRequisitoRepository.save.mockImplementation(
        async (datos) => datos,
      );

      const resultado = await service.revisarAtestadoProfesor(10, 1, 2, {
        estado: EstadoAtestadoProfesor.RECHAZADO,
        observacion: 'Documento ilegible',
      });

      expect(resultado.estado).toBe(EstadoAtestadoProfesor.RECHAZADO);
      expect(cumplimientoRequisitoRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 300,
          estado: EstadoCumplimientoRequisito.PENDIENTE,
          revisadoPorUsuarioId: null,
          fechaRevision: null,
          observacionRevision: null,
        }),
      );
    });

    it('aprobar evidencia no marca automáticamente CUMPLE ni resetea cumplimientos', async () => {
      const atestadoExistente = {
        id: 1,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.CERTIFICACION,
        nombre: 'Certificación Scrum Master',
        institucion: 'Scrum.org',
        estado: EstadoAtestadoProfesor.PENDIENTE,
      };

      atestadoRepository.findOne.mockResolvedValue(atestadoExistente);
      atestadoRepository.save.mockImplementation(async (datos) => datos);

      usuarioRepository.findOne.mockImplementation(async ({ where }) => {
        if (where.id === 10) return crearProfesor({ id: 10 });
        if (where.id === 2) {
          return crearProfesor({
            id: 2,
            usuarioRoles: [
              { rol: { nombre: RolSistema.COORDINADOR, activo: true } },
            ] as any,
          });
        }
        return null;
      });

      estructuraAcademicaService.tieneAlcanceSobreProfesor.mockResolvedValue(
        true,
      );

      cumplimientoRequisitoRepository.save.mockClear();

      const resultado = await service.revisarAtestadoProfesor(10, 1, 2, {
        estado: EstadoAtestadoProfesor.APROBADO,
        observacion: 'Verificado',
      });

      expect(resultado.estado).toBe(EstadoAtestadoProfesor.APROBADO);
      // No debe llamar invalidarCumplimientos ni alterar requisitos a CUMPLE
      expect(cumplimientoRequisitoRepository.save).not.toHaveBeenCalled();
    });

    it('cambiar evidencias de un requisito resetea revisión a PENDIENTE', async () => {
      profesorPerfilRepository.findOne.mockResolvedValue({
        id: 1,
        profesorUsuarioId: 10,
        perfilAcademicoId: 5,
        estado: EstadoPerfilProfesor.PENDIENTE,
        perfilAcademico: {
          id: 5,
          codigo: 'PA-01',
          nombre: 'Perfil Software',
          numeroPerfil: 1,
        },
      });

      requisitoPerfilRepository.findOne.mockResolvedValue({
        id: 20,
        perfilAcademicoId: 5,
        activo: true,
      });

      atestadoRepository.find.mockResolvedValue([
        {
          id: 5,
          profesorUsuarioId: 10,
          estado: EstadoAtestadoProfesor.APROBADO,
        },
      ]);

      const cumplimientoExistente = {
        id: 400,
        profesorUsuarioId: 10,
        requisitoPerfilAcademicoId: 20,
        estado: EstadoCumplimientoRequisito.CUMPLE,
        revisadoPorUsuarioId: 2,
        fechaRevision: new Date('2026-02-01'),
        observacionRevision: 'Aprobado con anterioridad',
        observacionProfesor: 'Antigua nota',
      };

      cumplimientoRequisitoRepository.findOne.mockResolvedValue(
        cumplimientoExistente,
      );

      cumplimientoRequisitoRepository.save.mockImplementation(
        async (datos) => datos,
      );

      await service.guardarEvidenciasRequisitoMiPerfil(10, 5, 20, {
        requisitoId: 20,
        atestadoIds: [5],
        observacion: 'Adjunto nueva evidencia',
      });

      expect(cumplimientoRequisitoRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 400,
          estado: EstadoCumplimientoRequisito.PENDIENTE,
          revisadoPorUsuarioId: null,
          fechaRevision: null,
          observacionRevision: null,
          observacionProfesor: 'Adjunto nueva evidencia',
        }),
      );
    });

    it('evidencias permanecen relacionadas tras invalidarCumplimientosPorAtestado', async () => {
      const atestadoExistente = {
        id: 1,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.EXPERIENCIA_DOCENTE,
        nombre: 'Docencia UNA',
        institucion: 'UNA',
        fechaInicio: '2021-01-01',
        fechaFin: '2023-01-01',
        estado: EstadoAtestadoProfesor.APROBADO,
      };

      const cumplimiento = {
        id: 500,
        profesorUsuarioId: 10,
        requisitoPerfilAcademicoId: 12,
        estado: EstadoCumplimientoRequisito.CUMPLE,
        revisadoPorUsuarioId: 2,
      };

      atestadoRepository.findOne.mockResolvedValue(atestadoExistente);
      atestadoRepository.save.mockImplementation(async (datos) => datos);

      evidenciaRequisitoRepository.find.mockResolvedValue([
        {
          id: 10,
          atestadoProfesorId: 1,
          cumplimientoRequisitoId: 500,
        },
      ]);

      cumplimientoRequisitoRepository.find.mockResolvedValue([cumplimiento]);

      cumplimientoRequisitoRepository.save.mockImplementation(
        async (datos) => datos,
      );

      await service.actualizarAtestadoMiPerfil(10, 1, {
        fechaFin: '2024-01-01',
      });

      // No se borran las evidencias, solo se resetea el cumplimiento
      expect(evidenciaRequisitoRepository.delete).not.toHaveBeenCalled();
      expect(cumplimientoRequisitoRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 500,
          estado: EstadoCumplimientoRequisito.PENDIENTE,
        }),
      );
    });

    it('perfil APROBADO + editar evidencia de obligatorio -> perfil pasa a PENDIENTE y registra INVALIDAR_PERFIL', async () => {
      const atestadoExistente = {
        id: 1,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.TITULO_ACADEMICO,
        nombre: 'Licenciatura en Computación',
        institucion: 'UNA',
        fechaObtencion: '2020-01-01',
        estado: EstadoAtestadoProfesor.APROBADO,
      };

      const perfilSolicitud = {
        id: 100,
        profesorUsuarioId: 10,
        perfilAcademicoId: 1,
        estado: EstadoPerfilProfesor.APROBADO,
        revisadoPorUsuarioId: 2,
        fechaRevision: new Date(),
        observacionRevision: 'Aprobado previamente',
      };

      const requisitoObligatorio = {
        id: 10,
        perfilAcademicoId: 1,
        obligatorio: true,
      };

      const cumplimiento = {
        id: 500,
        profesorPerfilAcademicoId: 100,
        requisitoPerfilAcademicoId: 10,
        estado: EstadoCumplimientoRequisito.CUMPLE,
        profesorPerfilAcademico: perfilSolicitud,
        requisitoPerfilAcademico: requisitoObligatorio,
      };

      atestadoRepository.findOne.mockResolvedValue(atestadoExistente);
      atestadoRepository.save.mockImplementation(async (datos) => datos);
      evidenciaRequisitoRepository.find.mockResolvedValue([
        {
          id: 10,
          atestadoProfesorId: 1,
          cumplimientoRequisitoId: 500,
        },
      ]);
      cumplimientoRequisitoRepository.find.mockResolvedValue([cumplimiento]);
      cumplimientoRequisitoRepository.save.mockImplementation(async (d) => d);
      profesorPerfilRepository.save.mockImplementation(async (d) => d);

      await service.actualizarAtestadoMiPerfil(10, 1, {
        nombre: 'Licenciatura en Informática Modificada',
      });

      expect(profesorPerfilRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 100,
          estado: EstadoPerfilProfesor.PENDIENTE,
          revisadoPorUsuarioId: null,
          fechaRevision: null,
          observacionRevision: null,
        }),
      );

      expect(historialPerfilRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          profesorUsuarioId: 10,
          usuarioAccionId: 10,
          tipo: TipoHistorialPerfilProfesor.PERFIL_ACADEMICO,
          accion: AccionHistorialPerfilProfesor.INVALIDAR_PERFIL,
          datosAnteriores: expect.objectContaining({
            estado: EstadoPerfilProfesor.APROBADO,
          }),
          datosNuevos: expect.objectContaining({
            estado: EstadoPerfilProfesor.PENDIENTE,
          }),
        }),
      );
    });

    it('perfil APROBADO + inactivar evidencia de obligatorio -> perfil pasa a PENDIENTE', async () => {
      const atestadoExistente = {
        id: 2,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.CERTIFICACION,
        nombre: 'Certificación de Idioma',
        institucion: 'TOEIC',
        fechaObtencion: '2022-01-01',
        estado: EstadoAtestadoProfesor.APROBADO,
      };

      const perfilSolicitud = {
        id: 100,
        profesorUsuarioId: 10,
        perfilAcademicoId: 1,
        estado: EstadoPerfilProfesor.APROBADO,
      };

      const requisitoObligatorio = {
        id: 11,
        perfilAcademicoId: 1,
        obligatorio: true,
      };

      const cumplimiento = {
        id: 501,
        profesorPerfilAcademicoId: 100,
        requisitoPerfilAcademicoId: 11,
        estado: EstadoCumplimientoRequisito.CUMPLE,
        profesorPerfilAcademico: perfilSolicitud,
        requisitoPerfilAcademico: requisitoObligatorio,
      };

      atestadoRepository.findOne.mockResolvedValue(atestadoExistente);
      atestadoRepository.save.mockImplementation(async (d) => d);
      evidenciaRequisitoRepository.find.mockResolvedValue([
        {
          id: 11,
          atestadoProfesorId: 2,
          cumplimientoRequisitoId: 501,
        },
      ]);
      cumplimientoRequisitoRepository.find.mockResolvedValue([cumplimiento]);
      cumplimientoRequisitoRepository.save.mockImplementation(async (d) => d);
      profesorPerfilRepository.save.mockImplementation(async (d) => d);

      await service.inactivarAtestadoMiPerfil(10, 2);

      expect(profesorPerfilRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 100,
          estado: EstadoPerfilProfesor.PENDIENTE,
        }),
      );
    });

    it('perfil APROBADO + rechazar evidencia de obligatorio -> perfil pasa a PENDIENTE', async () => {
      const atestadoExistente = {
        id: 3,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.EXPERIENCIA_DOCENTE,
        nombre: 'Docencia Universidad',
        institucion: 'UCR',
        fechaInicio: '2021-01-01',
        estado: EstadoAtestadoProfesor.PENDIENTE,
      };

      const perfilSolicitud = {
        id: 100,
        profesorUsuarioId: 10,
        perfilAcademicoId: 1,
        estado: EstadoPerfilProfesor.APROBADO,
      };

      const requisitoObligatorio = {
        id: 12,
        perfilAcademicoId: 1,
        obligatorio: true,
      };

      const cumplimiento = {
        id: 502,
        profesorPerfilAcademicoId: 100,
        requisitoPerfilAcademicoId: 12,
        estado: EstadoCumplimientoRequisito.CUMPLE,
        profesorPerfilAcademico: perfilSolicitud,
        requisitoPerfilAcademico: requisitoObligatorio,
      };

      atestadoRepository.findOne.mockResolvedValue(atestadoExistente);
      atestadoRepository.save.mockImplementation(async (d) => d);
      usuarioRepository.findOne.mockImplementation(async ({ where }) => {
        if (where.id === 10) return crearProfesor({ id: 10 });
        if (where.id === 2) {
          return crearProfesor({
            id: 2,
            usuarioRoles: [
              { rol: { nombre: RolSistema.COORDINADOR, activo: true } },
            ] as any,
          });
        }
        return null;
      });
      estructuraAcademicaService.tieneAlcanceSobreProfesor.mockResolvedValue(
        true,
      );

      evidenciaRequisitoRepository.find.mockResolvedValue([
        {
          id: 12,
          atestadoProfesorId: 3,
          cumplimientoRequisitoId: 502,
        },
      ]);
      cumplimientoRequisitoRepository.find.mockResolvedValue([cumplimiento]);
      cumplimientoRequisitoRepository.save.mockImplementation(async (d) => d);
      profesorPerfilRepository.save.mockImplementation(async (d) => d);

      await service.revisarAtestadoProfesor(10, 3, 2, {
        estado: EstadoAtestadoProfesor.RECHAZADO,
        observacion: 'Constancia no cumple con requisitos',
      });

      expect(profesorPerfilRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 100,
          estado: EstadoPerfilProfesor.PENDIENTE,
        }),
      );
    });

    it('perfil APROBADO + cambiar evidencias de obligatorio -> perfil pasa a PENDIENTE', async () => {
      const perfilSolicitud = {
        id: 100,
        profesorUsuarioId: 10,
        perfilAcademicoId: 1,
        estado: EstadoPerfilProfesor.APROBADO,
        perfilAcademico: {
          id: 1,
          codigo: 'PA-01',
          nombre: 'Perfil Software',
          numeroPerfil: 1,
        },
      };

      const requisitoObligatorio = {
        id: 20,
        perfilAcademicoId: 1,
        obligatorio: true,
      };

      const cumplimientoExistente = {
        id: 400,
        profesorPerfilAcademicoId: 100,
        requisitoPerfilAcademicoId: 20,
        estado: EstadoCumplimientoRequisito.CUMPLE,
        revisadoPorUsuarioId: 2,
        fechaRevision: new Date(),
        observacionRevision: 'Cumplido',
      };

      profesorPerfilRepository.findOne.mockResolvedValue(perfilSolicitud);
      requisitoPerfilRepository.findOne.mockResolvedValue(requisitoObligatorio);
      cumplimientoRequisitoRepository.findOne.mockResolvedValue(
        cumplimientoExistente,
      );
      atestadoRepository.find.mockResolvedValue([
        {
          id: 5,
          profesorUsuarioId: 10,
          estado: EstadoAtestadoProfesor.APROBADO,
        },
      ]);
      cumplimientoRequisitoRepository.save.mockImplementation(async (d) => d);
      profesorPerfilRepository.save.mockImplementation(async (d) => d);

      await service.guardarEvidenciasRequisitoMiPerfil(10, 1, 20, {
        requisitoId: 20,
        atestadoIds: [5],
        observacion: 'Nueva evidencia adjuntada',
      });

      expect(profesorPerfilRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 100,
          estado: EstadoPerfilProfesor.PENDIENTE,
          revisadoPorUsuarioId: null,
          fechaRevision: null,
          observacionRevision: null,
        }),
      );

      expect(historialPerfilRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionHistorialPerfilProfesor.INVALIDAR_PERFIL,
        }),
      );
    });

    it('perfil APROBADO + invalidar facultativo -> perfil sigue APROBADO', async () => {
      const atestadoExistente = {
        id: 4,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.CAPACITACION,
        nombre: 'Taller de Innovación Docente',
        institucion: 'UNA',
        fechaObtencion: '2024-01-01',
        estado: EstadoAtestadoProfesor.APROBADO,
      };

      const perfilSolicitud = {
        id: 100,
        profesorUsuarioId: 10,
        perfilAcademicoId: 1,
        estado: EstadoPerfilProfesor.APROBADO,
      };

      const requisitoFacultativo = {
        id: 30,
        perfilAcademicoId: 1,
        obligatorio: false,
      };

      const cumplimiento = {
        id: 503,
        profesorPerfilAcademicoId: 100,
        requisitoPerfilAcademicoId: 30,
        estado: EstadoCumplimientoRequisito.CUMPLE,
        profesorPerfilAcademico: perfilSolicitud,
        requisitoPerfilAcademico: requisitoFacultativo,
      };

      atestadoRepository.findOne.mockResolvedValue(atestadoExistente);
      atestadoRepository.save.mockImplementation(async (d) => d);
      evidenciaRequisitoRepository.find.mockResolvedValue([
        {
          id: 13,
          atestadoProfesorId: 4,
          cumplimientoRequisitoId: 503,
        },
      ]);
      cumplimientoRequisitoRepository.find.mockResolvedValue([cumplimiento]);
      cumplimientoRequisitoRepository.save.mockImplementation(async (d) => d);
      profesorPerfilRepository.save.mockClear();
      historialPerfilRepository.create.mockClear();

      await service.actualizarAtestadoMiPerfil(10, 4, {
        nombre: 'Taller de Innovación Docente Actualizado',
      });

      // El perfil NO se debe guardar/cambiar a PENDIENTE
      expect(profesorPerfilRepository.save).not.toHaveBeenCalled();
      expect(historialPerfilRepository.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionHistorialPerfilProfesor.INVALIDAR_PERFIL,
        }),
      );
    });

    it('perfil ya PENDIENTE -> no genera transición duplicada al invalidar', async () => {
      const atestadoExistente = {
        id: 1,
        profesorUsuarioId: 10,
        tipo: TipoAtestadoProfesor.TITULO_ACADEMICO,
        nombre: 'Licenciatura en Computación',
        institucion: 'UNA',
        fechaObtencion: '2020-01-01',
        estado: EstadoAtestadoProfesor.APROBADO,
      };

      const perfilSolicitudPendiente = {
        id: 100,
        profesorUsuarioId: 10,
        perfilAcademicoId: 1,
        estado: EstadoPerfilProfesor.PENDIENTE,
      };

      const requisitoObligatorio = {
        id: 10,
        perfilAcademicoId: 1,
        obligatorio: true,
      };

      const cumplimiento = {
        id: 500,
        profesorPerfilAcademicoId: 100,
        requisitoPerfilAcademicoId: 10,
        estado: EstadoCumplimientoRequisito.PENDIENTE,
        profesorPerfilAcademico: perfilSolicitudPendiente,
        requisitoPerfilAcademico: requisitoObligatorio,
      };

      atestadoRepository.findOne.mockResolvedValue(atestadoExistente);
      atestadoRepository.save.mockImplementation(async (datos) => datos);
      evidenciaRequisitoRepository.find.mockResolvedValue([
        {
          id: 10,
          atestadoProfesorId: 1,
          cumplimientoRequisitoId: 500,
        },
      ]);
      cumplimientoRequisitoRepository.find.mockResolvedValue([cumplimiento]);
      cumplimientoRequisitoRepository.save.mockImplementation(async (d) => d);
      profesorPerfilRepository.save.mockClear();
      historialPerfilRepository.create.mockClear();

      await service.actualizarAtestadoMiPerfil(10, 1, {
        nombre: 'Licenciatura Editada',
      });

      expect(profesorPerfilRepository.save).not.toHaveBeenCalled();
      expect(historialPerfilRepository.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionHistorialPerfilProfesor.INVALIDAR_PERFIL,
        }),
      );
    });
  });
});
