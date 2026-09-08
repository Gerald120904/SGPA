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
import { EstadoAtestadoProfesor } from './constants/estado-atestado-profesor.constant';
import { TipoAtestadoProfesor } from './constants/tipo-atestado-profesor.constant';
import { DiaSemana } from './constants/dia-semana.constant';
import { EstadoDisponibilidad } from './constants/estado-disponibilidad.constant';
import {
  AccionHistorialPerfilProfesor,
  TipoHistorialPerfilProfesor,
} from './constants/historial-perfil-profesor.constant';
import { AtestadoProfesor } from './entities/atestado-profesor.entity';
import { DisponibilidadProfesor } from './entities/disponibilidad-profesor.entity';
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

  it('rechaza carreras inexistentes o inactivas', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearProfesor());

    carreraRepository.find.mockResolvedValue([carrera]);

    await expect(
      service.actualizarCarrerasMiPerfil(10, {
        carreraIds: [1, 2],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(profesorCarreraRepository.delete).not.toHaveBeenCalled();
  });

  it('reemplaza las carreras del perfil', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearProfesor());

    carreraRepository.find.mockResolvedValue([carrera]);

    profesorCarreraRepository.find.mockResolvedValue([]);

    profesorCarreraRepository.delete.mockResolvedValue({
      affected: 1,
    });

    profesorCarreraRepository.save.mockResolvedValue([
      {
        profesorUsuarioId: 10,
        carreraId: 1,
      },
    ]);

    jest.spyOn(service, 'obtenerMiPerfil').mockResolvedValue({
      id: 10,
      carreras: [
        {
          id: 1,
          codigo: 'EIF',
          nombre: 'Ingeniería en Sistemas',
          activo: true,
        },
      ],
      perfilesAcademicos: [],
      cursosHabilitados: [],
    } as any);

    await service.actualizarCarrerasMiPerfil(10, {
      carreraIds: [1],
    });

    expect(profesorCarreraRepository.delete).toHaveBeenCalledWith({
      profesorUsuarioId: 10,
    });

    expect(profesorCarreraRepository.create).toHaveBeenCalledWith({
      profesorUsuarioId: 10,
      carreraId: 1,
    });

    expect(profesorCarreraRepository.save).toHaveBeenCalled();

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('permite dejar vacías las carreras del perfil', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearProfesor());

    profesorCarreraRepository.find.mockResolvedValue([]);

    profesorCarreraRepository.delete.mockResolvedValue({
      affected: 1,
    });

    jest.spyOn(service, 'obtenerMiPerfil').mockResolvedValue({
      id: 10,
      carreras: [],
      perfilesAcademicos: [],
      cursosHabilitados: [],
    } as any);

    await service.actualizarCarrerasMiPerfil(10, {
      carreraIds: [],
    });

    expect(carreraRepository.find).not.toHaveBeenCalled();

    expect(profesorCarreraRepository.delete).toHaveBeenCalledWith({
      profesorUsuarioId: 10,
    });

    expect(profesorCarreraRepository.save).not.toHaveBeenCalled();
  });

  it('permite actualizar carreras como adscripción sin restringir por cursos', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearProfesor());

    carreraRepository.find.mockResolvedValue([carrera]);

    profesorCarreraRepository.find.mockResolvedValue([]);
    profesorCarreraRepository.delete.mockResolvedValue({ affected: 0 });
    profesorCarreraRepository.save.mockResolvedValue([]);

    jest.spyOn(service, 'obtenerMiPerfil').mockResolvedValue({
      id: 10,
      carreras: [
        {
          id: 1,
          codigo: 'EIF',
          nombre: 'Ingeniería en Sistemas',
          activo: true,
        },
      ],
      perfilesAcademicos: [],
      cursosHabilitados: [],
    } as any);

    const resultado = await service.actualizarCarrerasMiPerfil(10, {
      carreraIds: [1],
    });

    expect(profesorCarreraRepository.delete).toHaveBeenCalledWith({
      profesorUsuarioId: 10,
    });
    expect(resultado).toBeDefined();
  });

  it('registra historial cuando cambian las carreras del perfil', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearProfesor());

    carreraRepository.find.mockResolvedValue([carrera]);

    profesorCarreraRepository.find.mockResolvedValueOnce([
      {
        profesorUsuarioId: 10,
        carreraId: 2,
        carrera: {
          id: 2,
          codigo: 'ADM',
          nombre: 'Administración',
          activo: true,
        },
      },
    ]);

    profesorCarreraRepository.delete.mockResolvedValue({
      affected: 1,
    });

    profesorCarreraRepository.save.mockResolvedValue([
      {
        profesorUsuarioId: 10,
        carreraId: 1,
      },
    ]);

    jest.spyOn(service, 'obtenerMiPerfil').mockResolvedValue({
      id: 10,
      carreras: [],
    } as any);

    await service.actualizarCarrerasMiPerfil(10, {
      carreraIds: [1],
    });

    expect(historialPerfilRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        profesorUsuarioId: 10,
        usuarioAccionId: 10,
        tipo: TipoHistorialPerfilProfesor.CARRERAS,
        accion: AccionHistorialPerfilProfesor.ACTUALIZAR_CARRERAS,

        datosAnteriores: {
          carreraIds: [2],
        },

        datosNuevos: {
          carreraIds: [1],
        },
      }),
    );

    expect(historialPerfilRepository.save).toHaveBeenCalled();
  });

  it('no crea historial cuando las carreras no cambian', async () => {
    usuarioRepository.findOne.mockResolvedValue(crearProfesor());

    carreraRepository.find.mockResolvedValue([carrera]);

    profesorCarreraRepository.find.mockResolvedValue([
      {
        profesorUsuarioId: 10,
        carreraId: 1,
        carrera,
      },
    ]);

    profesorCarreraRepository.delete.mockResolvedValue({
      affected: 1,
    });

    profesorCarreraRepository.save.mockResolvedValue([
      {
        profesorUsuarioId: 10,
        carreraId: 1,
      },
    ]);

    jest.spyOn(service, 'obtenerMiPerfil').mockResolvedValue({
      id: 10,
    } as any);

    await service.actualizarCarrerasMiPerfil(10, {
      carreraIds: [1],
    });

    expect(historialPerfilRepository.create).not.toHaveBeenCalled();
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

    profesorCarreraRepository.find.mockResolvedValue([]);

    const perfilSeguridad = {
      id: 1,
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
    expect(resultado[0].disponibilidadPeriodo.estado).toBe(
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
    expect(resultado[0].disponibilidadPeriodo.estado).toBe(
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
    expect(resultado[0].disponibleEnHorario).toBe(true);
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
    expect(resultado[0].disponibilidadPeriodo.estado).toBe(
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

  describe('ELEGIBILIDAD', () => {
    beforeEach(() => {
      usuarioRepository.findOne.mockResolvedValue(crearProfesor());
    });

    const perfilSeguridad = {
      id: 1,
      codigo: 'INF-SEG',
      nombre: 'Seguridad Informática',
      activo: true,
    } as PerfilAcademico;

    const perfilMatematica = {
      id: 3,
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
  });
});
