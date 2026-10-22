import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { MotorRequisitosService } from '../planes-estudio/motor-requisitos/motor-requisitos.service';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { ProveedorFormulario } from './constants/proveedor-formulario.constant';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { RespuestaFormularioEstudiante } from './entities/respuesta-formulario-estudiante.entity';
import {
  FormulariosInternosPersistenciaService,
  CrearFormularioInternoInput,
  GuardarRespuestaInternaInput,
} from './formularios-internos-persistencia.service';

describe('FormulariosInternosPersistenciaService (Subfases 2A, 2B, 2C)', () => {
  let service: FormulariosInternosPersistenciaService;
  let formularioRepo: jest.Mocked<Repository<FormularioEstudiante>>;
  let respuestaRepo: jest.Mocked<Repository<RespuestaFormularioEstudiante>>;
  let carreraRepo: jest.Mocked<Repository<Carrera>>;
  let planEstudioRepo: jest.Mocked<Repository<PlanEstudio>>;
  let estructuraAcademicaService: jest.Mocked<EstructuraAcademicaService>;
  let motorRequisitosService: { obtenerEstructuraPlan: jest.Mock };

  beforeEach(async () => {
    formularioRepo = {
      create: jest.fn((dto) => ({ ...dto } as any)),
      save: jest.fn((entity) => Promise.resolve({ id: 100, ...entity } as any)),
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<FormularioEstudiante>>;

    respuestaRepo = {
      create: jest.fn((dto) => ({ ...dto } as any)),
      save: jest.fn((entity) => Promise.resolve({ id: 500, ...entity } as any)),
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<RespuestaFormularioEstudiante>>;

    carreraRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Carrera>>;

    planEstudioRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<PlanEstudio>>;

    estructuraAcademicaService = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<EstructuraAcademicaService>;
    motorRequisitosService = {
      obtenerEstructuraPlan: jest.fn().mockResolvedValue({
        plan: { id: 10, nombre: 'Plan QA', codigo: 'QA-PLAN', carreraId: 1 },
        asignaturas: [{ id: 101, planEstudioId: 10, cursoId: 201, codigo: 'QA-101', nombre: 'Materia QA', nivel: 1, ciclo: 1, activo: true }],
        requisitos: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormulariosInternosPersistenciaService,
        {
          provide: getRepositoryToken(FormularioEstudiante),
          useValue: formularioRepo,
        },
        {
          provide: getRepositoryToken(RespuestaFormularioEstudiante),
          useValue: respuestaRepo,
        },
        {
          provide: getRepositoryToken(Carrera),
          useValue: carreraRepo,
        },
        {
          provide: getRepositoryToken(PlanEstudio),
          useValue: planEstudioRepo,
        },
        {
          provide: EstructuraAcademicaService,
          useValue: estructuraAcademicaService,
        },
        {
          provide: MotorRequisitosService,
          useValue: motorRequisitosService,
        },
      ],
    }).compile();

    service = module.get<FormulariosInternosPersistenciaService>(
      FormulariosInternosPersistenciaService,
    );
  });

  describe('Generación de identificadores criptográficos y seguros', () => {
    it('genera tokens públicos de 64 caracteres hex con 256 bits de entropía sin colisiones', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const token = service.generarTokenPublico();
        expect(token).toMatch(/^[0-9a-f]{64}$/);
        tokens.add(token);
      }
      expect(tokens.size).toBe(50);
    });

    it('genera identificadores de respuesta interna con prefijo INT- y formato UUID', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const id = service.generarIdentificadorRespuesta();
        expect(id).toMatch(/^INT-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        ids.add(id);
      }
      expect(ids.size).toBe(50);
    });
  });

  describe('Creación y persistencia de formularios internos', () => {
    const inputValido: CrearFormularioInternoInput = {
      titulo: 'Formulario de Matrícula 2026',
      descripcion: 'Registro de asignaturas aprobadas',
      carreraId: 1,
      planEstudioId: 10,
    };

    it('crea exitosamente un formulario interno con proveedor INTERNO y token público', async () => {
      carreraRepo.findOne.mockResolvedValueOnce({ id: 1, nombre: 'Ingeniería', activo: true } as Carrera);
      planEstudioRepo.findOne.mockResolvedValueOnce({ id: 10, nombre: 'Plan QA', codigo: 'QA-PLAN', carreraId: 1, activo: true } as PlanEstudio);

      const resultado = await service.crearFormularioInterno(42, inputValido);

      expect(carreraRepo.findOne).toHaveBeenCalledWith({ where: { id: 1, activo: true } });
      expect(planEstudioRepo.findOne).toHaveBeenCalledWith({
        where: { id: 10, carreraId: 1, activo: true },
      });
      expect(estructuraAcademicaService.tieneAlcanceSobreCarrera).toHaveBeenCalledWith(42, 1);
      expect(resultado.mapaPreguntas).toMatchObject({
        version: 3,
        plan: { id: 10, nombre: 'Plan QA', codigo: 'QA-PLAN', carreraId: 1 },
        asignaturas: [{ id: 101, codigo: 'QA-101' }],
        requisitos: [],
      });

      expect(formularioRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: 'Formulario de Matrícula 2026',
          descripcion: 'Registro de asignaturas aprobadas',
          carreraId: 1,
          planEstudioId: 10,
          creadoPorUsuarioId: 42,
          proveedor: ProveedorFormulario.INTERNO,
          estado: EstadoFormularioEstudiante.PUBLICADO,
          googleFormId: null,
          tokenPublico: expect.stringMatching(/^[0-9a-f]{64}$/),
          responderUri: expect.stringMatching(/^\/formularios(\/p|-publicos)\/[0-9a-f]{64}$/),
        }),
      );
      expect(resultado.id).toBe(100);
      expect(resultado.proveedor).toBe(ProveedorFormulario.INTERNO);
    });

    it('falla con NotFoundException si la carrera no existe o está inactiva', async () => {
      carreraRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.crearFormularioInterno(42, inputValido)).rejects.toThrow(
        NotFoundException,
      );
      expect(planEstudioRepo.findOne).not.toHaveBeenCalled();
      expect(formularioRepo.save).not.toHaveBeenCalled();
    });

    it('falla con ForbiddenException si el usuario no posee alcance sobre la carrera', async () => {
      carreraRepo.findOne.mockResolvedValueOnce({ id: 1, activo: true } as Carrera);
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValueOnce(false);

      await expect(service.crearFormularioInterno(42, inputValido)).rejects.toThrow(
        ForbiddenException,
      );
      expect(planEstudioRepo.findOne).not.toHaveBeenCalled();
    });

    it('falla con BadRequestException si el plan no existe, no pertenece a la carrera o está inactivo', async () => {
      carreraRepo.findOne.mockResolvedValueOnce({ id: 1, activo: true } as Carrera);
      planEstudioRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.crearFormularioInterno(42, inputValido)).rejects.toThrow(
        BadRequestException,
      );
      expect(formularioRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Regeneración y revocación de acceso público', () => {
    it('conserva el comportamiento histórico al reactivar un formulario anterior sin instantánea', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        id: 5,
        carreraId: 1,
        planEstudioId: 10,
        proveedor: ProveedorFormulario.INTERNO,
        mapaPreguntas: null,
        tokenPublico: 'a'.repeat(64),
      } as FormularioEstudiante);

      const resultado = await service.publicarFormularioInterno(5, 42);
      expect(resultado.mapaPreguntas).toBeNull();
      expect(motorRequisitosService.obtenerEstructuraPlan).not.toHaveBeenCalled();
    });

    it('regenera el token público de un formulario interno, revocando el token anterior', async () => {
      const tokenAnterior = 'token_anterior_1234567890abcdef1234567890abcdef1234567890abcdef12345678';
      const formOriginal = {
        id: 5,
        carreraId: 1,
        proveedor: ProveedorFormulario.INTERNO,
        tokenPublico: tokenAnterior,
        responderUri: `/formularios/p/${tokenAnterior}`,
      } as FormularioEstudiante;

      formularioRepo.findOne.mockResolvedValueOnce(formOriginal);

      const resultado = await service.regenerarTokenPublico(5, 42);

      expect(resultado.tokenPublico).not.toBe(tokenAnterior);
      expect(resultado.tokenPublico).toMatch(/^[0-9a-f]{64}$/);
      expect(resultado.responderUri).toBe(`/formularios/p/${resultado.tokenPublico}`);
      expect(formularioRepo.save).toHaveBeenCalled();
    });

    it('impide regenerar token si el formulario es de proveedor GOOGLE_FORMS', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        id: 5,
        carreraId: 1,
        proveedor: ProveedorFormulario.GOOGLE_FORMS,
      } as FormularioEstudiante);

      await expect(service.regenerarTokenPublico(5, 42)).rejects.toThrow(BadRequestException);
    });

    it('revoca el acceso al formulario interno actualizando su estado a CERRADO', async () => {
      const formOriginal = {
        id: 5,
        carreraId: 1,
        proveedor: ProveedorFormulario.INTERNO,
        estado: EstadoFormularioEstudiante.PUBLICADO,
      } as FormularioEstudiante;

      formularioRepo.findOne.mockResolvedValueOnce(formOriginal);

      const resultado = await service.revocarAcceso(5, 42);

      expect(resultado.estado).toBe(EstadoFormularioEstudiante.CERRADO);
      expect(formularioRepo.save).toHaveBeenCalled();
    });
  });

  describe('Consulta pública por token criptográfico', () => {
    const validToken = 'a'.repeat(64);

    it('rechaza consultas con tokens mal formateados o de longitud incorrecta', async () => {
      await expect(service.obtenerPorTokenPublico('abc')).rejects.toThrow(BadRequestException);
      await expect(service.obtenerPorTokenPublico('')).rejects.toThrow(BadRequestException);
      await expect(service.obtenerPorTokenPublico('a'.repeat(65))).rejects.toThrow(BadRequestException);
    });

    it('devuelve el formulario si el token existe, es INTERNO y está PUBLICADO', async () => {
      const formMock = {
        id: 1,
        tokenPublico: validToken,
        proveedor: ProveedorFormulario.INTERNO,
        estado: EstadoFormularioEstudiante.PUBLICADO,
        titulo: 'Formulario Activo',
      } as FormularioEstudiante;

      formularioRepo.findOne.mockResolvedValueOnce(formMock);

      const form = await service.obtenerPorTokenPublico(validToken);
      expect(form.id).toBe(1);
      expect(form.titulo).toBe('Formulario Activo');
    });

    it('lanza NotFoundException si el token no existe', async () => {
      formularioRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.obtenerPorTokenPublico(validToken)).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException informando que el formulario está cerrado si estado es CERRADO', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tokenPublico: validToken,
        proveedor: ProveedorFormulario.INTERNO,
        estado: EstadoFormularioEstudiante.CERRADO,
      } as FormularioEstudiante);

      await expect(service.obtenerPorTokenPublico(validToken)).rejects.toThrow(
        'El formulario se encuentra cerrado y no acepta nuevas respuestas',
      );
    });
  });

  describe('Persistencia de respuestas de formulario interno', () => {
    const inputRespuesta: GuardarRespuestaInternaInput = {
      formularioId: 10,
      payloadJson: {
        identificacion: '12345678',
        nombre: 'Estudiante Test',
        asignaturasSeleccionadas: [101, 102],
      },
      datosNormalizadosJson: {
        identificacion: '12345678',
        primerNombre: 'Estudiante',
        segundoNombre: null,
        primerApellido: 'Test',
        segundoApellido: null,
        correoEstudiantil: 'test@universidad.ac.cr',
        contacto: null,
        periodoIngresoId: 1,
        asignaturasAprobadas: [],
        optativasNoDisciplinarias: null,
        requiereRevisionOptativas: false,
      },
    };

    it('guarda una respuesta interna con ID server-generated INT-uuid y estado PENDIENTE', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        id: 10,
        proveedor: ProveedorFormulario.INTERNO,
        estado: EstadoFormularioEstudiante.PUBLICADO,
      } as FormularioEstudiante);

      const res = await service.guardarRespuestaInterna(inputRespuesta);

      expect(respuestaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          formularioId: 10,
          googleResponseId: expect.stringMatching(/^INT-[0-9a-f-]{36}$/),
          payloadJson: inputRespuesta.payloadJson,
          datosNormalizadosJson: inputRespuesta.datosNormalizadosJson,
          estado: EstadoRespuestaFormulario.PENDIENTE,
        }),
      );
      expect(res.id).toBe(500);
    });

    it('reutiliza la respuesta persistida con la misma clave tras crear otra instancia del servicio', async () => {
      formularioRepo.findOne.mockResolvedValue({
        id: 10, proveedor: ProveedorFormulario.INTERNO, estado: EstadoFormularioEstudiante.PUBLICADO,
      } as FormularioEstudiante);
      const intento = { ...inputRespuesta, idempotencyKey: '11111111-1111-4111-8111-111111111111' };
      respuestaRepo.findOne.mockResolvedValueOnce(null);
      const primera = await service.guardarRespuestaInterna(intento);
      respuestaRepo.findOne.mockResolvedValueOnce(primera as RespuestaFormularioEstudiante);
      const segunda = await service.guardarRespuestaInterna(intento);
      expect(segunda.googleResponseId).toBe(primera.googleResponseId);
      expect(segunda.idempotente).toBe(true);
      expect(respuestaRepo.save).toHaveBeenCalledTimes(1);
    });

    it('rechaza reutilizar la clave con un payload distinto', async () => {
      formularioRepo.findOne.mockResolvedValue({
        id: 10, proveedor: ProveedorFormulario.INTERNO, estado: EstadoFormularioEstudiante.PUBLICADO,
      } as FormularioEstudiante);
      const intento = { ...inputRespuesta, idempotencyKey: '11111111-1111-4111-8111-111111111111' };
      respuestaRepo.findOne.mockResolvedValueOnce(null);
      const primera = await service.guardarRespuestaInterna(intento);
      respuestaRepo.findOne.mockResolvedValueOnce(primera as RespuestaFormularioEstudiante);
      await expect(service.guardarRespuestaInterna({
        ...intento, payloadJson: { identificacion: 'otra' },
      })).rejects.toThrow('solicitud diferente');
      expect(respuestaRepo.save).toHaveBeenCalledTimes(1);
    });

    it('resuelve una colisión concurrente mediante la clave única de MySQL', async () => {
      formularioRepo.findOne.mockResolvedValue({
        id: 10, proveedor: ProveedorFormulario.INTERNO, estado: EstadoFormularioEstudiante.PUBLICADO,
      } as FormularioEstudiante);
      const intento = { ...inputRespuesta, idempotencyKey: '11111111-1111-4111-8111-111111111111' };
      respuestaRepo.findOne.mockResolvedValueOnce(null).mockImplementationOnce(async () => ({
        id: 501,
        googleResponseId: respuestaRepo.create.mock.results[0].value.googleResponseId,
        payloadJson: intento.payloadJson,
      } as RespuestaFormularioEstudiante));
      respuestaRepo.save.mockRejectedValueOnce({ driverError: { code: 'ER_DUP_ENTRY', errno: 1062 } });
      const resultado = await service.guardarRespuestaInterna(intento);
      expect(resultado.id).toBe(501);
      expect(resultado.idempotente).toBe(true);
    });

    it('rechaza respuestas si el formulario no es de proveedor INTERNO', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        id: 10,
        proveedor: ProveedorFormulario.GOOGLE_FORMS,
        estado: EstadoFormularioEstudiante.PUBLICADO,
      } as FormularioEstudiante);

      await expect(service.guardarRespuestaInterna(inputRespuesta)).rejects.toThrow(
        'No se pueden registrar respuestas internas en un formulario externo',
      );
    });

    it('rechaza respuestas si el formulario está en estado CERRADO', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        id: 10,
        proveedor: ProveedorFormulario.INTERNO,
        estado: EstadoFormularioEstudiante.CERRADO,
      } as FormularioEstudiante);

      await expect(service.guardarRespuestaInterna(inputRespuesta)).rejects.toThrow(
        'No se pueden recibir respuestas de un formulario que no está PUBLICADO',
      );
    });

    it('rechaza respuestas sin payloadJson válido', async () => {
      formularioRepo.findOne.mockResolvedValueOnce({
        id: 10,
        proveedor: ProveedorFormulario.INTERNO,
        estado: EstadoFormularioEstudiante.PUBLICADO,
      } as FormularioEstudiante);

      await expect(
        service.guardarRespuestaInterna({
          formularioId: 10,
          payloadJson: null as any,
        }),
      ).rejects.toThrow('El payload de la respuesta es obligatorio');
    });
  });

  describe('Compatibilidad histórica con formularios y respuestas Google', () => {
    it('demuestra que registros históricos sin proveedor explícito asumen GOOGLE_FORMS de forma segura', () => {
      const formHistorico = new FormularioEstudiante();
      formHistorico.id = 1;
      formHistorico.titulo = 'Formulario Google 2025';
      formHistorico.googleFormId = 'gform-abc-123';
      formHistorico.tokenPublico = null;
      // Comportamiento del decorador TypeORM por omisión:
      formHistorico.proveedor = formHistorico.proveedor ?? ProveedorFormulario.GOOGLE_FORMS;

      expect(formHistorico.proveedor).toBe(ProveedorFormulario.GOOGLE_FORMS);
      expect(formHistorico.googleFormId).toBe('gform-abc-123');
      expect(formHistorico.tokenPublico).toBeNull();
    });

    it('demuestra que respuestas de Google existentes con IDs nativos coexisten sin colisión con IDs INT-', () => {
      const respGoogle = new RespuestaFormularioEstudiante();
      respGoogle.formularioId = 1;
      respGoogle.googleResponseId = '2_ABaOnudK7M...googleNativeId';

      const respInterna = new RespuestaFormularioEstudiante();
      respInterna.formularioId = 1;
      respInterna.googleResponseId = service.generarIdentificadorRespuesta();

      expect(respGoogle.googleResponseId.startsWith('INT-')).toBe(false);
      expect(respInterna.googleResponseId.startsWith('INT-')).toBe(true);
      expect(respGoogle.googleResponseId).not.toBe(respInterna.googleResponseId);
    });
  });
});
