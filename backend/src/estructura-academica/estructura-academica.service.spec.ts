import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { ProfesorCarrera } from '../profesores/entities/profesor-carrera.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { TipoAsignacionAcademica } from './constants/tipo-asignacion-academica.constant';
import { AreaAcademica } from './entities/area-academica.entity';
import { AreaCarrera } from './entities/area-carrera.entity';
import { AsignacionAcademica } from './entities/asignacion-academica.entity';
import { EstructuraAcademicaService } from './estructura-academica.service';

describe('EstructuraAcademicaService', () => {
  let service: EstructuraAcademicaService;

  let areaRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let areaCarreraRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  let asignacionRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  let carreraRepository: {
    findOne: jest.Mock;
  };

  let usuarioRepository: {
    findOne: jest.Mock;
  };

  let profesorCarreraRepository: {
    find: jest.Mock;
  };

  beforeEach(() => {
    areaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((val) => val),
      save: jest.fn(async (val) => ({ id: 1, ...val })),
    };

    areaCarreraRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((val) => val),
      save: jest.fn(async (val) => ({ id: 1, ...val })),
      delete: jest.fn(),
    };

    asignacionRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((val) => val),
      save: jest.fn(async (val) => ({ id: 1, ...val })),
    };

    carreraRepository = {
      findOne: jest.fn(),
    };

    usuarioRepository = {
      findOne: jest.fn(),
    };

    profesorCarreraRepository = {
      find: jest.fn(),
    };

    service = new EstructuraAcademicaService(
      areaRepository as unknown as Repository<AreaAcademica>,
      areaCarreraRepository as unknown as Repository<AreaCarrera>,
      asignacionRepository as unknown as Repository<AsignacionAcademica>,
      carreraRepository as unknown as Repository<Carrera>,
      usuarioRepository as unknown as Repository<Usuario>,
      profesorCarreraRepository as unknown as Repository<ProfesorCarrera>,
    );

    jest.clearAllMocks();
  });

  describe('validarAmbito', () => {
    it('falla si COORDINADOR_CARRERA no tiene carreraId', () => {
      expect(() =>
        service.validarAmbito(
          TipoAsignacionAcademica.COORDINADOR_CARRERA,
          null,
          null,
        ),
      ).toThrow(BadRequestException);
    });

    it('falla si COORDINADOR_CARRERA tiene areaAcademicaId', () => {
      expect(() =>
        service.validarAmbito(
          TipoAsignacionAcademica.COORDINADOR_CARRERA,
          1,
          2,
        ),
      ).toThrow(BadRequestException);
    });

    it('falla si COORDINADOR_AREA no tiene areaAcademicaId', () => {
      expect(() =>
        service.validarAmbito(
          TipoAsignacionAcademica.COORDINADOR_AREA,
          null,
          null,
        ),
      ).toThrow(BadRequestException);
    });

    it('falla si COORDINADOR_AREA tiene carreraId', () => {
      expect(() =>
        service.validarAmbito(TipoAsignacionAcademica.COORDINADOR_AREA, 1, 2),
      ).toThrow(BadRequestException);
    });

    it('falla si DIRECCION_ACADEMICA tiene carreraId o areaAcademicaId', () => {
      expect(() =>
        service.validarAmbito(
          TipoAsignacionAcademica.DIRECCION_ACADEMICA,
          1,
          null,
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validarAmbito(
          TipoAsignacionAcademica.DIRECCION_ACADEMICA,
          null,
          2,
        ),
      ).toThrow(BadRequestException);
    });

    it('acepta ámbitos válidos', () => {
      expect(() =>
        service.validarAmbito(
          TipoAsignacionAcademica.COORDINADOR_CARRERA,
          1,
          null,
        ),
      ).not.toThrow();
      expect(() =>
        service.validarAmbito(
          TipoAsignacionAcademica.COORDINADOR_AREA,
          null,
          2,
        ),
      ).not.toThrow();
      expect(() =>
        service.validarAmbito(
          TipoAsignacionAcademica.DIRECCION_ACADEMICA,
          null,
          null,
        ),
      ).not.toThrow();
    });
  });

  describe('tieneAlcanceSobreCarrera', () => {
    it('retorna true para DIRECCION_ACADEMICA sobre cualquier carrera', async () => {
      asignacionRepository.find.mockResolvedValue([
        { tipo: TipoAsignacionAcademica.DIRECCION_ACADEMICA, activo: true },
      ]);

      const alcance = await service.tieneAlcanceSobreCarrera(10, 99);
      expect(alcance).toBe(true);
    });

    it('retorna true para Coordinador de Carrera sobre su carrera y false sobre otra', async () => {
      asignacionRepository.find.mockResolvedValue([
        {
          tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA,
          carreraId: 1,
          activo: true,
        },
      ]);

      const alcanceA = await service.tieneAlcanceSobreCarrera(10, 1);
      const alcanceB = await service.tieneAlcanceSobreCarrera(10, 2);

      expect(alcanceA).toBe(true);
      expect(alcanceB).toBe(false);
    });

    it('retorna true para Coordinador de Área sobre carreras asociadas a su área', async () => {
      asignacionRepository.find.mockResolvedValue([
        {
          tipo: TipoAsignacionAcademica.COORDINADOR_AREA,
          areaAcademicaId: 5,
          activo: true,
        },
      ]);

      areaCarreraRepository.findOne.mockImplementation(async ({ where }) => {
        if (where.carreraId === 1 || where.carreraId === 2) {
          return { areaAcademicaId: 5, carreraId: where.carreraId };
        }
        return null;
      });

      const alcance1 = await service.tieneAlcanceSobreCarrera(10, 1);
      const alcance2 = await service.tieneAlcanceSobreCarrera(10, 2);
      const alcance3 = await service.tieneAlcanceSobreCarrera(10, 3);

      expect(alcance1).toBe(true);
      expect(alcance2).toBe(true);
      expect(alcance3).toBe(false);
    });
  });

  describe('tieneAlcanceSobreProfesor', () => {
    it('retorna true si usuario tiene DIRECCION_ACADEMICA', async () => {
      asignacionRepository.find.mockResolvedValue([
        { tipo: TipoAsignacionAcademica.DIRECCION_ACADEMICA, activo: true },
      ]);

      const alcance = await service.tieneAlcanceSobreProfesor(10, 20);
      expect(alcance).toBe(true);
    });

    it('retorna true si comparte al menos una carrera del profesor', async () => {
      asignacionRepository.find.mockResolvedValue([
        {
          tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA,
          carreraId: 1,
          activo: true,
        },
      ]);

      profesorCarreraRepository.find.mockResolvedValue([
        { profesorUsuarioId: 20, carreraId: 1 },
      ]);

      const alcance = await service.tieneAlcanceSobreProfesor(10, 20);
      expect(alcance).toBe(true);
    });

    it('retorna false si el profesor no comparte carreras con el revisor', async () => {
      asignacionRepository.find.mockResolvedValue([
        {
          tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA,
          carreraId: 1,
          activo: true,
        },
      ]);

      profesorCarreraRepository.find.mockResolvedValue([
        { profesorUsuarioId: 20, carreraId: 2 },
      ]);

      const alcance = await service.tieneAlcanceSobreProfesor(10, 20);
      expect(alcance).toBe(false);
    });
  });

  describe('CRUD Áreas', () => {
    it('crea un área académica', async () => {
      areaRepository.findOne.mockResolvedValue(null);

      const area = await service.crearArea({
        codigo: 'INF',
        nombre: 'Informática',
        descripcion: 'Área de informática',
      });

      expect(area.codigo).toBe('INF');
      expect(area.nombre).toBe('Informática');
    });

    it('rechaza código duplicado', async () => {
      areaRepository.findOne.mockResolvedValue({ id: 1, codigo: 'INF' });

      await expect(
        service.crearArea({
          codigo: 'INF',
          nombre: 'Informática',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Vigencia de Asignaciones y Alcance Temporal', () => {
    it('reconoce asignación vigente con inicio en el pasado y sin fechaFin', async () => {
      asignacionRepository.find.mockResolvedValue([
        {
          tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA,
          carreraId: 1,
          activo: true,
          fechaInicio: '2020-01-01',
          fechaFin: null,
        },
      ]);

      const alcance = await service.tieneAlcanceSobreCarrera(10, 1);
      expect(alcance).toBe(true);
    });

    it('reconoce asignación vigente con rango activo (2020-01-01 a 2099-12-31)', async () => {
      asignacionRepository.find.mockResolvedValue([
        {
          tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA,
          carreraId: 1,
          activo: true,
          fechaInicio: '2020-01-01',
          fechaFin: '2099-12-31',
        },
      ]);

      const alcance = await service.tieneAlcanceSobreCarrera(10, 1);
      expect(alcance).toBe(true);
    });

    it('rechaza asignación con fechaInicio futura', async () => {
      asignacionRepository.find.mockResolvedValue([
        {
          tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA,
          carreraId: 1,
          activo: true,
          fechaInicio: '2099-01-01',
          fechaFin: null,
        },
      ]);

      const alcance = await service.tieneAlcanceSobreCarrera(10, 1);
      expect(alcance).toBe(false);
    });

    it('rechaza asignación con fechaFin pasada', async () => {
      asignacionRepository.find.mockResolvedValue([
        {
          tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA,
          carreraId: 1,
          activo: true,
          fechaInicio: '2020-01-01',
          fechaFin: '2020-12-31',
        },
      ]);

      const alcance = await service.tieneAlcanceSobreCarrera(10, 1);
      expect(alcance).toBe(false);
    });

    it('rechaza asignación inactiva', async () => {
      asignacionRepository.find.mockResolvedValue([
        {
          tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA,
          carreraId: 1,
          activo: false,
          fechaInicio: '2020-01-01',
          fechaFin: null,
        },
      ]);

      const alcance = await service.tieneAlcanceSobreCarrera(10, 1);
      expect(alcance).toBe(false);
    });
  });

  describe('inactivarAsignacion', () => {
    it('inactiva una asignación activa y asigna fechaFin', async () => {
      asignacionRepository.findOne.mockResolvedValue({
        id: 1,
        activo: true,
        fechaInicio: '2020-01-01',
        fechaFin: null,
      });

      const resultado = await service.inactivarAsignacion(1, {
        fechaFin: '2026-09-04',
      });

      expect(resultado.activo).toBe(false);
      expect(resultado.fechaFin).toBe('2026-09-04');
    });

    it('falla si la asignación ya está inactiva', async () => {
      asignacionRepository.findOne.mockResolvedValue({
        id: 1,
        activo: false,
        fechaInicio: '2020-01-01',
        fechaFin: '2020-12-31',
      });

      await expect(service.inactivarAsignacion(1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rechaza fechaFin anterior a fechaInicio', async () => {
      asignacionRepository.findOne.mockResolvedValue({
        id: 1,
        activo: true,
        fechaInicio: '2026-09-01',
        fechaFin: null,
      });

      await expect(
        service.inactivarAsignacion(1, { fechaFin: '2026-08-20' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
