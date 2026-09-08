import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Curso } from '../cursos/entities/curso.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { EstadoPerfilProfesor } from './constants/estado-perfil-profesor.constant';
import { CursoPerfilAcademico } from './entities/curso-perfil-academico.entity';
import { PerfilAcademico } from './entities/perfil-academico.entity';
import { ProfesorPerfilAcademico } from './entities/profesor-perfil-academico.entity';
import { PerfilesAcademicosService } from './perfiles-academicos.service';

describe('PerfilesAcademicosService', () => {
  let service: PerfilesAcademicosService;
  let perfilRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let cursoPerfilRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
    remove: jest.Mock;
  };
  let profesorPerfilRepository: {
    count: jest.Mock;
  };
  let carreraRepository: {
    findOne: jest.Mock;
  };
  let cursoRepository: {
    findOne: jest.Mock;
  };
  let estructuraAcademicaService: {
    tieneAlcanceSobreCarrera: jest.Mock;
  };

  const carreraSistemas = {
    id: 1,
    codigo: 'EIF',
    nombre: 'Ingeniería en Sistemas',
    activo: true,
  } as Carrera;

  const carreraAdministracion = {
    id: 2,
    codigo: 'ADM',
    nombre: 'Administración',
    activo: true,
  } as Carrera;

  beforeEach(() => {
    perfilRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (entidad) => ({ id: 10, ...entidad })),
      update: jest.fn(),
    };

    cursoPerfilRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (entidad) => ({ id: 20, ...entidad })),
      count: jest.fn(),
      remove: jest.fn(),
    };

    profesorPerfilRepository = {
      count: jest.fn(),
    };

    carreraRepository = {
      findOne: jest.fn(),
    };

    cursoRepository = {
      findOne: jest.fn(),
    };

    estructuraAcademicaService = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
    };

    service = new PerfilesAcademicosService(
      perfilRepository as unknown as Repository<PerfilAcademico>,
      cursoPerfilRepository as unknown as Repository<CursoPerfilAcademico>,
      profesorPerfilRepository as unknown as Repository<ProfesorPerfilAcademico>,
      carreraRepository as unknown as Repository<Carrera>,
      cursoRepository as unknown as Repository<Curso>,
      estructuraAcademicaService as unknown as EstructuraAcademicaService,
    );

    jest.clearAllMocks();
  });

  describe('PERFILES', () => {
    it('crear perfil para carrera exitosamente', async () => {
      carreraRepository.findOne.mockResolvedValue(carreraSistemas);
      perfilRepository.findOne
        .mockResolvedValueOnce(null) // no duplicate
        .mockResolvedValueOnce({
          id: 10,
          carreraId: 1,
          codigo: 'INF-SEG',
          nombre: 'Seguridad Informática',
          descripcion: 'Área de seguridad',
          activo: true,
          carrera: carreraSistemas,
        });

      const resultado = await service.crear(
        {
          carreraId: 1,
          codigo: 'inf-seg ',
          nombre: 'Seguridad Informática',
          descripcion: 'Área de seguridad',
        },
        1,
        true,
      );

      expect(perfilRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          carreraId: 1,
          codigo: 'INF-SEG',
          nombre: 'Seguridad Informática',
        }),
      );
      expect(resultado.codigo).toBe('INF-SEG');
    });

    it('falla por código duplicado dentro de la misma carrera', async () => {
      carreraRepository.findOne.mockResolvedValue(carreraSistemas);
      perfilRepository.findOne.mockResolvedValue({ id: 10, codigo: 'INF-SEG' });

      await expect(
        service.crear(
          {
            carreraId: 1,
            codigo: 'INF-SEG',
            nombre: 'Seguridad Informática',
          },
          1,
          true,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('permite mismo código en otra carrera', async () => {
      carreraRepository.findOne.mockResolvedValue(carreraAdministracion);
      perfilRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 11,
          carreraId: 2,
          codigo: 'INF-SEG',
          nombre: 'Seguridad en ADM',
          carrera: carreraAdministracion,
        });

      const resultado = await service.crear(
        {
          carreraId: 2,
          codigo: 'INF-SEG',
          nombre: 'Seguridad en ADM',
        },
        1,
        true,
      );

      expect(resultado.carreraId).toBe(2);
    });

    it('falla si la carrera no existe', async () => {
      carreraRepository.findOne.mockResolvedValue(null);

      await expect(
        service.crear(
          {
            carreraId: 999,
            codigo: 'TEST',
            nombre: 'Test',
          },
          1,
          true,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('falla si la carrera está inactiva', async () => {
      carreraRepository.findOne.mockResolvedValue({
        ...carreraSistemas,
        activo: false,
      });

      await expect(
        service.crear(
          {
            carreraId: 1,
            codigo: 'TEST',
            nombre: 'Test',
          },
          1,
          true,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('no permite desactivar perfil si tiene profesores aprobados o cursos activos', async () => {
      perfilRepository.findOne.mockResolvedValue({
        id: 10,
        carreraId: 1,
        activo: true,
      });
      profesorPerfilRepository.count.mockResolvedValue(2);
      cursoPerfilRepository.count.mockResolvedValue(0);

      await expect(
        service.cambiarEstado(10, false, 1, true),
      ).rejects.toBeInstanceOf(BadRequestException);

      profesorPerfilRepository.count.mockResolvedValue(0);
      cursoPerfilRepository.count.mockResolvedValue(1);

      await expect(
        service.cambiarEstado(10, false, 1, true),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('CURSO ↔ PERFIL', () => {
    const perfilActivo = {
      id: 10,
      carreraId: 1,
      codigo: 'INF-SEG',
      nombre: 'Seguridad Informática',
      activo: true,
    } as PerfilAcademico;

    const cursoActivo1 = {
      id: 50,
      codigo: 'EIF472',
      nombre: 'Seguridad de Sistemas',
      activo: true,
    } as Curso;

    const cursoActivo2 = {
      id: 51,
      codigo: 'EIF203',
      nombre: 'Estructuras Discretas',
      activo: true,
    } as Curso;

    it('curso puede tener 1 perfil', async () => {
      perfilRepository.findOne.mockResolvedValue(perfilActivo);
      cursoRepository.findOne.mockResolvedValue(cursoActivo1);
      cursoPerfilRepository.findOne.mockResolvedValue(null);
      cursoPerfilRepository.findOneOrFail.mockResolvedValue({
        id: 1,
        perfilAcademicoId: 10,
        cursoId: 50,
        activo: true,
        curso: cursoActivo1,
        perfilAcademico: perfilActivo,
      });

      const resultado = await service.asociarCurso(10, 50, 1, true);
      expect(resultado.cursoId).toBe(50);
      expect(resultado.perfilAcademicoId).toBe(10);
    });

    it('curso puede tener varios perfiles y perfil puede habilitar varios cursos', async () => {
      perfilRepository.findOne.mockResolvedValue(perfilActivo);
      cursoRepository.findOne.mockResolvedValue(cursoActivo2);
      cursoPerfilRepository.findOne.mockResolvedValue(null);
      cursoPerfilRepository.findOneOrFail.mockResolvedValue({
        id: 2,
        perfilAcademicoId: 10,
        cursoId: 51,
        activo: true,
        curso: cursoActivo2,
        perfilAcademico: perfilActivo,
      });

      const resultado = await service.asociarCurso(10, 51, 1, true);
      expect(resultado.cursoId).toBe(51);
    });

    it('falla por relación duplicada activa', async () => {
      perfilRepository.findOne.mockResolvedValue(perfilActivo);
      cursoRepository.findOne.mockResolvedValue(cursoActivo1);
      cursoPerfilRepository.findOne.mockResolvedValue({
        id: 1,
        perfilAcademicoId: 10,
        cursoId: 50,
        activo: true,
      });

      await expect(
        service.asociarCurso(10, 50, 1, true),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('falla si el perfil está inactivo', async () => {
      perfilRepository.findOne.mockResolvedValue({
        ...perfilActivo,
        activo: false,
      });

      await expect(
        service.asociarCurso(10, 50, 1, true),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('falla si el curso está inactivo', async () => {
      perfilRepository.findOne.mockResolvedValue(perfilActivo);
      cursoRepository.findOne.mockResolvedValue({
        ...cursoActivo1,
        activo: false,
      });

      await expect(
        service.asociarCurso(10, 50, 1, true),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('ALCANCE POR CARRERA', () => {
    it('permite a ADMIN_GLOBAL gestionar cualquier carrera sin validar alcance', async () => {
      carreraRepository.findOne.mockResolvedValue(carreraSistemas);
      perfilRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 10,
          carreraId: 1,
          codigo: 'INF-SEG',
          nombre: 'Seguridad Informática',
          activo: true,
        });

      await expect(
        service.crear(
          { carreraId: 1, codigo: 'INF-SEG', nombre: 'Seguridad Informática' },
          99,
          true,
        ),
      ).resolves.toBeDefined();

      expect(
        estructuraAcademicaService.tieneAlcanceSobreCarrera,
      ).not.toHaveBeenCalled();
    });

    it('permite a COORDINADOR con alcance crear perfil para su carrera', async () => {
      carreraRepository.findOne.mockResolvedValue(carreraSistemas);
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        true,
      );
      perfilRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 10,
          carreraId: 1,
          codigo: 'INF-SEG',
          nombre: 'Seguridad Informática',
          activo: true,
        });

      await expect(
        service.crear(
          { carreraId: 1, codigo: 'INF-SEG', nombre: 'Seguridad Informática' },
          10,
          false,
        ),
      ).resolves.toBeDefined();

      expect(
        estructuraAcademicaService.tieneAlcanceSobreCarrera,
      ).toHaveBeenCalledWith(10, 1);
    });

    it('rechaza a COORDINADOR crear perfil para carrera sin alcance', async () => {
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        false,
      );

      await expect(
        service.crear(
          { carreraId: 2, codigo: 'ADM-FIN', nombre: 'Finanzas' },
          10,
          false,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(
        estructuraAcademicaService.tieneAlcanceSobreCarrera,
      ).toHaveBeenCalledWith(10, 2);
      expect(perfilRepository.save).not.toHaveBeenCalled();
    });

    it('rechaza a COORDINADOR actualizar perfil de carrera sin alcance', async () => {
      perfilRepository.findOne.mockResolvedValue({
        id: 15,
        carreraId: 2,
        nombre: 'Finanzas',
      });
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        false,
      );

      await expect(
        service.actualizar(15, { nombre: 'Finanzas avanzadas' }, 10, false),
      ).rejects.toThrow(ForbiddenException);

      expect(
        estructuraAcademicaService.tieneAlcanceSobreCarrera,
      ).toHaveBeenCalledWith(10, 2);
    });

    it('rechaza a COORDINADOR cambiar estado de perfil de carrera sin alcance', async () => {
      perfilRepository.findOne.mockResolvedValue({
        id: 15,
        carreraId: 2,
        activo: true,
      });
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        false,
      );

      await expect(service.cambiarEstado(15, false, 10, false)).rejects.toThrow(
        ForbiddenException,
      );

      expect(
        estructuraAcademicaService.tieneAlcanceSobreCarrera,
      ).toHaveBeenCalledWith(10, 2);
    });
  });
});
