import { BadRequestException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { ProveedorFormulario } from './constants/proveedor-formulario.constant';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { CrearFormularioEstudianteDto } from './dto/crear-formulario-estudiante.dto';
import { FormulariosEstudiantesService } from './formularios-estudiantes.service';

describe('Validaciones Nuevo Formulario de Estudiantes — PBI-90 (Frontend-Backend Alignment)', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  const payloadValido = {
    proveedor: ProveedorFormulario.INTERNO,
    titulo: 'Formulario Matrícula 2027',
    descripcion: 'Formulario oficial para levantamiento de requisitos académicos',
    carreraId: 1,
    planEstudioId: 2,
  };

  const transformar = (body: Record<string, unknown>) =>
    pipe.transform(body, {
      type: 'body',
      metatype: CrearFormularioEstudianteDto,
    });

  describe('Validaciones de DTO — Modalidad / Proveedor', () => {
    it('acepta modalidades válidas INTERNO y GOOGLE_FORMS', async () => {
      const interno = await transformar({
        ...payloadValido,
        proveedor: ProveedorFormulario.INTERNO,
      });
      expect(interno.proveedor).toBe(ProveedorFormulario.INTERNO);

      const google = await transformar({
        ...payloadValido,
        proveedor: ProveedorFormulario.GOOGLE_FORMS,
      });
      expect(google.proveedor).toBe(ProveedorFormulario.GOOGLE_FORMS);
    });

    it('rechaza modalidad ausente, nula o vacía (sin valor por defecto en DTO)', async () => {
      const sinProveedor = { ...payloadValido };
      delete (sinProveedor as any).proveedor;
      await expect(transformar(sinProveedor)).rejects.toThrow(BadRequestException);

      await expect(transformar({ ...payloadValido, proveedor: null })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, proveedor: '' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza modalidades desconocidas o no soportadas', async () => {
      await expect(transformar({ ...payloadValido, proveedor: 'DESCONOCIDO' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, proveedor: 'MICROSOFT_FORMS' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('Validaciones de DTO — Título', () => {
    it('acepta títulos válidos hasta 255 caracteres', async () => {
      const normal = await transformar({ ...payloadValido, titulo: 'Admisión Regular 2026' });
      expect(normal.titulo).toBe('Admisión Regular 2026');

      const maximo = 'T'.repeat(255);
      const enLimite = await transformar({ ...payloadValido, titulo: maximo });
      expect(enLimite.titulo).toBe(maximo);
    });

    it('elimina espacios exteriores', async () => {
      const res = await transformar({ ...payloadValido, titulo: '   Título Con Espacios   ' });
      expect(res.titulo).toBe('Título Con Espacios');
    });

    it('rechaza título ausente, vacío o compuesto únicamente por espacios', async () => {
      const sinTitulo = { ...payloadValido };
      delete (sinTitulo as any).titulo;
      await expect(transformar(sinTitulo)).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, titulo: '' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, titulo: '     ' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza títulos que superen los 255 caracteres', async () => {
      const excede = 'T'.repeat(256);
      await expect(transformar({ ...payloadValido, titulo: excede })).rejects.toThrow(BadRequestException);
    });
  });

  describe('Validaciones de DTO — Descripción', () => {
    it('acepta descripciones válidas hasta 1000 caracteres', async () => {
      const maximo = 'D'.repeat(1000);
      const enLimite = await transformar({ ...payloadValido, descripcion: maximo });
      expect(enLimite.descripcion).toBe(maximo);
    });

    it('elimina espacios exteriores', async () => {
      const res = await transformar({ ...payloadValido, descripcion: '   Descripción recortada   ' });
      expect(res.descripcion).toBe('Descripción recortada');
    });

    it('rechaza descripción ausente, vacía o compuesta únicamente por espacios', async () => {
      const sinDesc = { ...payloadValido };
      delete (sinDesc as any).descripcion;
      await expect(transformar(sinDesc)).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, descripcion: '' })).rejects.toThrow(BadRequestException);
      await expect(transformar({ ...payloadValido, descripcion: '     ' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza descripciones que superen los 1000 caracteres', async () => {
      const excede = 'D'.repeat(1001);
      await expect(transformar({ ...payloadValido, descripcion: excede })).rejects.toThrow(BadRequestException);
    });
  });

  describe('Validaciones de DTO — Identificadores de Carrera y Plan', () => {
    it('acepta IDs enteros positivos para carrera y plan', async () => {
      const res = await transformar({ ...payloadValido, carreraId: 10, planEstudioId: 25 });
      expect(res.carreraId).toBe(10);
      expect(res.planEstudioId).toBe(25);
    });

    it('rechaza identificadores ausentes o nulos', async () => {
      const sinCarrera = { ...payloadValido };
      delete (sinCarrera as any).carreraId;
      await expect(transformar(sinCarrera)).rejects.toThrow(BadRequestException);

      const sinPlan = { ...payloadValido };
      delete (sinPlan as any).planEstudioId;
      await expect(transformar(sinPlan)).rejects.toThrow(BadRequestException);
    });

    it('rechaza identificadores negativos, cero o decimales', async () => {
      for (const campo of ['carreraId', 'planEstudioId']) {
        await expect(transformar({ ...payloadValido, [campo]: 0 })).rejects.toThrow(BadRequestException);
        await expect(transformar({ ...payloadValido, [campo]: -1 })).rejects.toThrow(BadRequestException);
        await expect(transformar({ ...payloadValido, [campo]: 1.5 })).rejects.toThrow(BadRequestException);
        await expect(transformar({ ...payloadValido, [campo]: 'no-numero' })).rejects.toThrow(BadRequestException);
      }
    });
  });

  describe('Validaciones de Negocio en Servicio — Creación de Formularios', () => {
    let service: FormulariosEstudiantesService;
    let mockFormularioRepo: any;
    let mockRespuestaRepo: any;
    let mockCarreraRepo: any;
    let mockPlanEstudioRepo: any;
    let mockPlanAsignaturaRepo: any;
    let mockPeriodoRepo: any;
    let mockGoogleFormsClient: any;
    let mockGoogleDriveClient: any;
    let mockEstructuraAcademica: any;
    let mockPersistenciaInterna: any;

    beforeEach(() => {
      mockFormularioRepo = {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn((attrs) => ({ ...attrs })),
      };
      mockRespuestaRepo = { createQueryBuilder: jest.fn() };
      mockCarreraRepo = { findOne: jest.fn() };
      mockPlanEstudioRepo = { findOne: jest.fn() };
      mockPlanAsignaturaRepo = { find: jest.fn() };
      mockPeriodoRepo = { find: jest.fn() };
      mockGoogleFormsClient = {
        crearFormulario: jest.fn(),
        actualizarFormulario: jest.fn(),
        publicarFormulario: jest.fn(),
        obtenerFormulario: jest.fn().mockResolvedValue({
          formId: 'google-form-123',
          responderUri: 'https://docs.google.com/forms/d/e/123/viewform',
        }),
      };
      mockGoogleDriveClient = {
        permitirCualquieraConEnlaceResponder: jest.fn(),
        renombrarArchivo: jest.fn(),
      };
      mockEstructuraAcademica = {
        tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
      };
      mockPersistenciaInterna = {
        crearFormularioInterno: jest.fn(),
      };

      service = new FormulariosEstudiantesService(
        mockFormularioRepo,
        mockRespuestaRepo,
        mockCarreraRepo,
        mockPlanEstudioRepo,
        mockPlanAsignaturaRepo,
        mockPeriodoRepo,
        mockGoogleFormsClient,
        mockGoogleDriveClient,
        mockEstructuraAcademica,
        mockPersistenciaInterna,
      );
    });

    it('rechaza directamente en el servicio llamadas sin modalidad o con modalidad desconocida', async () => {
      mockCarreraRepo.findOne.mockResolvedValue({ id: 1, activo: true });
      mockPlanEstudioRepo.findOne.mockResolvedValue({ id: 2, carreraId: 1, activo: true });

      const dtoSinModalidad = {
        titulo: 'Título',
        descripcion: 'Descripción',
        carreraId: 1,
        planEstudioId: 2,
      } as any;

      await expect(service.crear(1, dtoSinModalidad)).rejects.toThrow(BadRequestException);
      await expect(service.crear(1, dtoSinModalidad)).rejects.toThrow(
        'La modalidad del formulario es obligatoria y debe ser INTERNO o GOOGLE_FORMS',
      );
      expect(mockPersistenciaInterna.crearFormularioInterno).not.toHaveBeenCalled();
      expect(mockGoogleFormsClient.crearFormulario).not.toHaveBeenCalled();
    });

    it('falla con NotFoundException cuando la carrera no existe o está inactiva', async () => {
      mockCarreraRepo.findOne.mockResolvedValue(null);

      const dto: CrearFormularioEstudianteDto = {
        proveedor: ProveedorFormulario.INTERNO,
        titulo: 'Formulario',
        descripcion: 'Descripción',
        carreraId: 999,
        planEstudioId: 2,
      };

      await expect(service.crear(1, dto)).rejects.toThrow(NotFoundException);
      await expect(service.crear(1, dto)).rejects.toThrow('La carrera indicada no existe o está inactiva');
      expect(mockPersistenciaInterna.crearFormularioInterno).not.toHaveBeenCalled();
    });

    it('falla con BadRequestException cuando el plan no existe o está inactivo', async () => {
      mockCarreraRepo.findOne.mockResolvedValue({ id: 1, activo: true });
      mockPlanEstudioRepo.findOne.mockResolvedValue(null);

      const dto: CrearFormularioEstudianteDto = {
        proveedor: ProveedorFormulario.INTERNO,
        titulo: 'Formulario',
        descripcion: 'Descripción',
        carreraId: 1,
        planEstudioId: 888,
      };

      await expect(service.crear(1, dto)).rejects.toThrow(BadRequestException);
      await expect(service.crear(1, dto)).rejects.toThrow(
        'El plan de estudio no pertenece a la carrera o está inactivo',
      );
      expect(mockPersistenciaInterna.crearFormularioInterno).not.toHaveBeenCalled();
    });

    it('falla con BadRequestException cuando el plan pertenece a una carrera diferente', async () => {
      mockCarreraRepo.findOne.mockResolvedValue({ id: 1, activo: true });
      // PlanEstudioRepo busca por { id: 5, carreraId: 1, activo: true }, si pertenece a carrera 2 retorna null
      mockPlanEstudioRepo.findOne.mockImplementation(async (query: any) => {
        if (query.where.carreraId === 1 && query.where.id === 5) return null;
        return { id: 5, carreraId: 2, activo: true };
      });

      const dto: CrearFormularioEstudianteDto = {
        proveedor: ProveedorFormulario.INTERNO,
        titulo: 'Formulario',
        descripcion: 'Descripción',
        carreraId: 1,
        planEstudioId: 5,
      };

      await expect(service.crear(1, dto)).rejects.toThrow(BadRequestException);
      await expect(service.crear(1, dto)).rejects.toThrow(
        'El plan de estudio no pertenece a la carrera o está inactivo',
      );
      expect(mockPersistenciaInterna.crearFormularioInterno).not.toHaveBeenCalled();
    });

    it('falla con ForbiddenException si el usuario no tiene alcance sobre la carrera', async () => {
      mockCarreraRepo.findOne.mockResolvedValue({ id: 1, activo: true });
      mockPlanEstudioRepo.findOne.mockResolvedValue({ id: 2, carreraId: 1, activo: true });
      mockEstructuraAcademica.tieneAlcanceSobreCarrera.mockResolvedValue(false);

      const dto: CrearFormularioEstudianteDto = {
        proveedor: ProveedorFormulario.INTERNO,
        titulo: 'Formulario',
        descripcion: 'Descripción',
        carreraId: 1,
        planEstudioId: 2,
      };

      await expect(service.crear(1, dto)).rejects.toThrow(ForbiddenException);
      await expect(service.crear(1, dto)).rejects.toThrow('No posee alcance académico sobre la carrera indicada.');
      expect(mockPersistenciaInterna.crearFormularioInterno).not.toHaveBeenCalled();
    });

    it('creación válida de formulario INTERNO delega a persistencia interna y no invoca Google', async () => {
      mockCarreraRepo.findOne.mockResolvedValue({ id: 1, activo: true });
      mockPlanEstudioRepo.findOne.mockResolvedValue({ id: 2, carreraId: 1, activo: true });
      mockEstructuraAcademica.tieneAlcanceSobreCarrera.mockResolvedValue(true);
      mockPlanAsignaturaRepo.find.mockResolvedValue([
        { id: 10, cursoId: 100, curso: { id: 100, codigo: 'MAT1', nombre: 'Matemáticas' }, activo: true },
      ]);
      mockPeriodoRepo.find.mockResolvedValue([{ id: 1, anio: 2026, ciclo: 1 }]);

      const mockFormInterno = {
        id: 77,
        titulo: 'Formulario Interno',
        proveedor: ProveedorFormulario.INTERNO,
        estado: EstadoFormularioEstudiante.CREANDO,
      };
      mockPersistenciaInterna.crearFormularioInterno.mockResolvedValue(mockFormInterno);

      const dto: CrearFormularioEstudianteDto = {
        proveedor: ProveedorFormulario.INTERNO,
        titulo: 'Formulario Interno',
        descripcion: 'Formulario oficial',
        carreraId: 1,
        planEstudioId: 2,
      };

      const resultado = await service.crear(10, dto);
      expect(resultado).toBe(mockFormInterno);
      expect(mockPersistenciaInterna.crearFormularioInterno).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          titulo: 'Formulario Interno',
          carreraId: 1,
          planEstudioId: 2,
        }),
      );
      expect(mockGoogleFormsClient.crearFormulario).not.toHaveBeenCalled();
      expect(mockGoogleDriveClient.permitirCualquieraConEnlaceResponder).not.toHaveBeenCalled();
    });

    it('creación válida de formulario GOOGLE_FORMS invoca cliente de Google Forms y no persiste como interno', async () => {
      mockCarreraRepo.findOne.mockResolvedValue({ id: 1, activo: true });
      mockPlanEstudioRepo.findOne.mockResolvedValue({ id: 2, carreraId: 1, activo: true });
      mockEstructuraAcademica.tieneAlcanceSobreCarrera.mockResolvedValue(true);
      mockPlanAsignaturaRepo.find.mockResolvedValue([
        { id: 10, cursoId: 100, curso: { id: 100, codigo: 'ISC101', nombre: 'Programación' }, activo: true },
      ]);
      mockPeriodoRepo.find.mockResolvedValue([{ id: 1, anio: 2026, ciclo: 1 }]);

      mockGoogleFormsClient.crearFormulario.mockResolvedValue({
        formId: 'google-form-123',
        responderUri: 'https://docs.google.com/forms/d/e/123/viewform',
        revisionId: 'rev-1',
      });
      mockGoogleFormsClient.actualizarFormulario.mockImplementation(async (_usuario, _formId, requests: any[]) => {
        let qIdx = 0;
        return {
          replies: requests.map((req, idx) => {
            if (!req.createItem) return {};
            if (!req.createItem.item?.questionItem) {
              return { createItem: { itemId: `section-${idx}` } };
            }
            return {
              createItem: {
                itemId: `item-${idx}`,
                questionId: [`q-${qIdx++}`],
              },
            };
          }),
        };
      });
      mockGoogleDriveClient.permitirCualquieraConEnlaceResponder.mockResolvedValue({});

      mockFormularioRepo.findOne
        .mockResolvedValueOnce(null) // verificación de título no duplicado
        .mockResolvedValueOnce({
          id: 88,
          titulo: 'Formulario Google',
          proveedor: ProveedorFormulario.GOOGLE_FORMS,
          estado: EstadoFormularioEstudiante.CREANDO,
        });
      mockFormularioRepo.save.mockImplementation(async (form: any) => ({
        id: 88,
        ...form,
      }));

      const dto: CrearFormularioEstudianteDto = {
        proveedor: ProveedorFormulario.GOOGLE_FORMS,
        titulo: 'Formulario Google',
        descripcion: 'Formulario externo',
        carreraId: 1,
        planEstudioId: 2,
      };

      const resultado = await service.crear(10, dto);
      expect(resultado).toBeDefined();
      expect(mockGoogleFormsClient.crearFormulario).toHaveBeenCalled();
      expect(mockPersistenciaInterna.crearFormularioInterno).not.toHaveBeenCalled();
    });
  });
});
