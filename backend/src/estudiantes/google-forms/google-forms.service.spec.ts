import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Carrera } from '../../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../../estructura-academica/estructura-academica.service';
import { PlanEstudio } from '../../planes-estudio/entities/plan-estudio.entity';
import { ConfiguracionFormularioEstudiantes } from './entities/configuracion-formulario-estudiantes.entity';
import { ImportacionGoogleEstudiante } from './entities/importacion-google-estudiante.entity';
import { GoogleFormsService } from './google-forms.service';

describe('GoogleFormsService', () => {
  let service: GoogleFormsService;
  let configRepo: jest.Mocked<Repository<ConfiguracionFormularioEstudiantes>>;
  let importacionRepo: jest.Mocked<Repository<ImportacionGoogleEstudiante>>;
  let carreraRepo: jest.Mocked<Repository<Carrera>>;
  let planRepo: jest.Mocked<Repository<PlanEstudio>>;
  let estructuraService: jest.Mocked<EstructuraAcademicaService>;

  const carreraMock = { id: 10, activo: true } as Carrera;
  const planMock = { id: 20, carreraId: 10, activo: true } as PlanEstudio;
  const configMock = {
    id: 1,
    nombre: 'Formulario Informática',
    googleFormId: 'form-abc',
    googleSheetId: 'sheet-xyz',
    carreraId: 10,
    planEstudioId: 20,
    activo: true,
    ultimaFilaProcesada: 1,
  } as ConfiguracionFormularioEstudiantes;

  beforeEach(() => {
    configRepo = {
      create: jest.fn().mockImplementation((val) => ({ ...val, id: 1 })),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      findOne: jest.fn().mockResolvedValue({ ...configMock }),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<ConfiguracionFormularioEstudiantes>>;

    importacionRepo = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<Repository<ImportacionGoogleEstudiante>>;

    carreraRepo = {
      findOne: jest.fn().mockResolvedValue(carreraMock),
    } as unknown as jest.Mocked<Repository<Carrera>>;

    planRepo = {
      findOne: jest.fn().mockResolvedValue(planMock),
    } as unknown as jest.Mocked<Repository<PlanEstudio>>;

    estructuraService = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<EstructuraAcademicaService>;

    service = new GoogleFormsService(
      configRepo,
      importacionRepo,
      carreraRepo,
      planRepo,
      estructuraService,
    );
  });

  it('crea una nueva configuración de formulario válida', async () => {
    const resultado = await service.crearConfiguracion(5, {
      nombre: 'Formulario Nuevo',
      googleFormId: 'form-123',
      googleSheetId: 'sheet-123',
      carreraId: 10,
      planEstudioId: 20,
    });

    expect(resultado).toMatchObject({
      nombre: 'Formulario Nuevo',
      googleFormId: 'form-123',
      googleSheetId: 'sheet-123',
      carreraId: 10,
      planEstudioId: 20,
      activo: true,
    });
    expect(configRepo.save).toHaveBeenCalled();
  });

  it('rechaza la creación si el plan no pertenece a la carrera', async () => {
    planRepo.findOne.mockResolvedValue({
      ...planMock,
      carreraId: 99,
    } as PlanEstudio);

    await expect(
      service.crearConfiguracion(5, {
        nombre: 'Formulario Inválido',
        googleFormId: 'form-123',
        googleSheetId: 'sheet-123',
        carreraId: 10,
        planEstudioId: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza la creación si el usuario no posee alcance sobre la carrera', async () => {
    estructuraService.tieneAlcanceSobreCarrera.mockResolvedValue(false);

    await expect(
      service.crearConfiguracion(5, {
        nombre: 'Formulario Sin Alcance',
        googleFormId: 'form-123',
        googleSheetId: 'sheet-123',
        carreraId: 10,
        planEstudioId: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('obtiene el detalle de una configuración existente', async () => {
    const config = await service.obtenerConfiguracionPorId(5, 1);
    expect(config.id).toBe(1);
  });

  it('lanza NotFoundException al buscar configuración inexistente', async () => {
    configRepo.findOne.mockResolvedValue(null);
    await expect(service.obtenerConfiguracionPorId(5, 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('actualiza el estado activo de la configuración', async () => {
    const config = await service.cambiarEstado(5, 1, false);
    expect(config.activo).toBe(false);
    expect(configRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ activo: false }),
    );
  });

  it('lista las respuestas de la bandeja filtradas', async () => {
    await service.listarRespuestas(5, 1);
    expect(importacionRepo.find).toHaveBeenCalledWith({
      where: { configuracionId: 1 },
      order: { filaOrigen: 'ASC', id: 'ASC' },
    });
  });
});
