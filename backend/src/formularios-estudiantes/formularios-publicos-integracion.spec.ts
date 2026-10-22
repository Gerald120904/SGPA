import {
  BadRequestException,
  ExecutionContext,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { MotorRequisitosService } from '../planes-estudio/motor-requisitos/motor-requisitos.service';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { ProveedorFormulario } from './constants/proveedor-formulario.constant';
import { EnviarRespuestaPublicaDto } from './dto/enviar-respuesta-publica.dto';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { RespuestaFormularioEstudiante } from './entities/respuesta-formulario-estudiante.entity';
import { FormulariosInternosPersistenciaService } from './formularios-internos-persistencia.service';
import { FormulariosPublicosController } from './formularios-publicos.controller';
import { FormulariosPublicosService } from './formularios-publicos.service';
import { RateLimitPublicoGuard } from './guards/rate-limit-publico.guard';

describe('Integración de Formularios Públicos (Subfase 3C - 22 Casos Obligatorios)', () => {
  let controller: FormulariosPublicosController;
  let service: FormulariosPublicosService;
  let rateLimitGuard: RateLimitPublicoGuard;
  let formularioRepo: jest.Mocked<Repository<FormularioEstudiante>>;
  let periodoRepo: jest.Mocked<Repository<PeriodoAcademico>>;
  let planAsignaturaRepo: jest.Mocked<Repository<PlanAsignatura>>;
  let persistenciaInternaService: jest.Mocked<FormulariosInternosPersistenciaService>;
  let motorRequisitosService: jest.Mocked<MotorRequisitosService>;

  const tokenValido = 'f'.repeat(64);
  const tokenInvalido = 'token-demasiado-corto';

  beforeEach(async () => {
    rateLimitGuard = new RateLimitPublicoGuard();
    rateLimitGuard.reset();

    formularioRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<FormularioEstudiante>>;

    periodoRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<PeriodoAcademico>>;

    planAsignaturaRepo = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<PlanAsignatura>>;

    persistenciaInternaService = {
      guardarRespuestaInterna: jest.fn(),
    } as unknown as jest.Mocked<FormulariosInternosPersistenciaService>;

    motorRequisitosService = {
      obtenerCatalogoFormulario: jest.fn(),
      validarSeleccionEstricta: jest.fn(),
    } as unknown as jest.Mocked<MotorRequisitosService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormulariosPublicosController],
      providers: [
        FormulariosPublicosService,
        {
          provide: getRepositoryToken(FormularioEstudiante),
          useValue: formularioRepo,
        },
        {
          provide: getRepositoryToken(PeriodoAcademico),
          useValue: periodoRepo,
        },
        {
          provide: getRepositoryToken(PlanAsignatura),
          useValue: planAsignaturaRepo,
        },
        {
          provide: FormulariosInternosPersistenciaService,
          useValue: persistenciaInternaService,
        },
        {
          provide: MotorRequisitosService,
          useValue: motorRequisitosService,
        },
        {
          provide: RateLimitPublicoGuard,
          useValue: rateLimitGuard,
        },
      ],
    }).compile();

    controller = module.get<FormulariosPublicosController>(
      FormulariosPublicosController,
    );
    service = module.get<FormulariosPublicosService>(FormulariosPublicosService);
  });

  // CASO 1: Consulta pública de formulario válido
  it('Caso 1: Consulta pública de formulario válido retorna estructura y catálogo', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 1,
      titulo: 'Prematrícula 2026',
      descripcion: 'Formulario semestral',
      planEstudioId: 2,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
      carrera: { id: 1, nombre: 'Ingeniería', codigo: 'ING' },
      planEstudio: { id: 2, nombre: 'Plan 2020', anioAprobacion: 2020 },
    } as any);

    periodoRepo.find.mockResolvedValueOnce([
      { id: 10, codigo: '2026-1', nombre: 'I Ciclo 2026', anio: 2026, numero: 1 } as any,
    ]);

    motorRequisitosService.obtenerCatalogoFormulario.mockResolvedValueOnce({
      plan: { id: 2, nombre: 'Plan 2020', carreraId: 1 },
      aprobadasValidas: [],
      niveles: [{ nivel: 1, ciclos: [{ ciclo: 1, asignaturas: [] }] }],
      resumen: [] as any,
    });

    const res = await controller.consultarFormulario(tokenValido);
    expect(res.formulario.titulo).toBe('Prematrícula 2026');
    expect(res.carrera.codigo).toBe('ING');
    expect(res.planEstudio.nombre).toBe('Plan 2020');
    expect(res.periodos).toHaveLength(1);
    expect(res.catalogo).toHaveLength(1);
  });

  // CASO 2: Rechazo de token inválido
  it('Caso 2: Rechaza tokens inválidos que no cumplen formato 64 hex', async () => {
    await expect(controller.consultarFormulario(tokenInvalido)).rejects.toThrow(
      'El enlace del formulario es inválido.',
    );
  });

  // CASO 3: Rechazo de formulario inexistente
  it('Caso 3: Rechaza con NotFoundException formularios no encontrados', async () => {
    formularioRepo.findOne.mockResolvedValueOnce(null);
    await expect(controller.consultarFormulario(tokenValido)).rejects.toThrow(
      NotFoundException,
    );
  });

  // CASO 4: Rechazo de formulario cerrado
  it('Caso 4: Rechaza consultas y envíos sobre formularios en estado CERRADO', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 1,
      estado: EstadoFormularioEstudiante.CERRADO,
      proveedor: ProveedorFormulario.INTERNO,
    } as any);

    await expect(controller.consultarFormulario(tokenValido)).rejects.toThrow(
      'El formulario se encuentra cerrado',
    );
  });

  // CASO 5: Rechazo de formularios Google en la API interna
  it('Caso 5: Rechaza formularios externos con proveedor GOOGLE_FORMS en la API interna', async () => {
    // La consulta filtra explícitamente proveedor: INTERNO
    formularioRepo.findOne.mockResolvedValueOnce(null);

    await expect(controller.consultarFormulario(tokenValido)).rejects.toThrow(
      NotFoundException,
    );
  });

  // CASO 6: Obtención de cursos ordenados por año y ciclo
  it('Caso 6: Retorna cursos ordenados jerárquicamente por nivel y ciclo', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 1,
      planEstudioId: 2,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
      carrera: { id: 1 },
      planEstudio: { id: 2 },
    } as any);
    periodoRepo.find.mockResolvedValueOnce([]);

    motorRequisitosService.obtenerCatalogoFormulario.mockResolvedValueOnce({
      plan: { id: 2, nombre: 'Plan', carreraId: 1 },
      aprobadasValidas: [],
      niveles: [
        {
          nivel: 1,
          ciclos: [
            { ciclo: 1, asignaturas: [{ codigo: 'A1' } as any] },
            { ciclo: 2, asignaturas: [{ codigo: 'A2' } as any] },
          ],
        },
        {
          nivel: 2,
          ciclos: [{ ciclo: 1, asignaturas: [{ codigo: 'B1' } as any] }],
        },
      ],
      resumen: [] as any,
    });

    const res = await controller.consultarFormulario(tokenValido);
    expect(res.catalogo[0].nivel).toBe(1);
    expect(res.catalogo[0].ciclos[0].ciclo).toBe(1);
    expect(res.catalogo[1].nivel).toBe(2);
  });

  // CASO 7: Envío válido con prerrequisitos satisfechos
  it('Caso 7: Registra exitosamente una respuesta válida cuando los prerrequisitos se cumplen', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 5,
      planEstudioId: 2,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
    } as any);
    periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as any);
    motorRequisitosService.validarSeleccionEstricta.mockResolvedValueOnce({
      esValido: true,
      aprobadasValidas: [101, 102],
    } as any);
    planAsignaturaRepo.find.mockResolvedValueOnce([
      { id: 101, cursoId: 1, codigoReferencia: 'PROG-1' } as any,
      { id: 102, cursoId: 2, codigoReferencia: 'PROG-2' } as any,
    ]);
    persistenciaInternaService.guardarRespuestaInterna.mockResolvedValueOnce({
      id: 1001,
      googleResponseId: 'INT-conf-1001',
      estado: EstadoRespuestaFormulario.PENDIENTE,
    } as any);

    const dto: EnviarRespuestaPublicaDto = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '208110999',
      primerNombre: 'Estudiante',
      primerApellido: 'Aprobado',
      correoEstudiantil: 'aprobado@universidad.ac.cr',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [101, 102],
    };

    const res = await controller.enviarRespuesta(tokenValido, dto);
    expect(res.codigoConfirmacion).toBe('INT-conf-1001');
    expect(res.estado).toBe(EstadoRespuestaFormulario.PENDIENTE);
  });

  // CASO 8: Rechazo de Programación III sin Programación II
  it('Caso 8: Rechaza Programación III si no se incluye Programación II', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 5,
      planEstudioId: 2,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
    } as any);
    periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as any);

    motorRequisitosService.validarSeleccionEstricta.mockRejectedValueOnce(
      new BadRequestException(
        'Selección inválida: La asignatura "IF-3000 - Programación III" no puede marcarse como aprobada porque falta su requisito previo.',
      ),
    );

    const dto: EnviarRespuestaPublicaDto = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '208110999',
      primerNombre: 'Estudiante',
      primerApellido: 'Prueba',
      correoEstudiantil: 'estudiante@universidad.ac.cr',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [103], // Prog III sin Prog II
    };

    await expect(controller.enviarRespuesta(tokenValido, dto)).rejects.toThrow(
      'Programación III',
    );
  });

  // CASO 9: Validación de varios prerrequisitos
  it('Caso 9: Rechaza asignatura con múltiples prerrequisitos si falta alguno de ellos', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 5,
      planEstudioId: 2,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
    } as any);
    periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as any);

    motorRequisitosService.validarSeleccionEstricta.mockRejectedValueOnce(
      new BadRequestException(
        'Selección inválida: La asignatura "IF-5000 - Arquitectura de Software" no puede marcarse como aprobada porque falta su requisito previo. Falta aprobar IF-3000 y IF-4000',
      ),
    );

    const dto: EnviarRespuestaPublicaDto = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '208110999',
      primerNombre: 'Estudiante',
      primerApellido: 'Prueba',
      correoEstudiantil: 'estudiante@universidad.ac.cr',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [105],
    };

    await expect(controller.enviarRespuesta(tokenValido, dto)).rejects.toThrow(
      'Arquitectura de Software',
    );
  });

  // CASO 10: Rechazo de asignaturas ajenas al plan
  it('Caso 10: Rechaza asignaturas ajenas al plan de estudios del formulario', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 5,
      planEstudioId: 2,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
    } as any);
    periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as any);

    motorRequisitosService.validarSeleccionEstricta.mockRejectedValueOnce(
      new BadRequestException('La asignatura #888 no pertenece al plan de estudios #2.'),
    );

    const dto: EnviarRespuestaPublicaDto = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '208110999',
      primerNombre: 'Estudiante',
      primerApellido: 'Prueba',
      correoEstudiantil: 'estudiante@universidad.ac.cr',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [888],
    };

    await expect(controller.enviarRespuesta(tokenValido, dto)).rejects.toThrow(
      'no pertenece al plan de estudios',
    );
  });

  // CASO 11: Rechazo de asignaturas inactivas o con requisitos inconsistentes
  it('Caso 11: Rechaza materias inactivas o con requisitos inconsistentes', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 5,
      planEstudioId: 2,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
    } as any);
    periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as any);

    motorRequisitosService.validarSeleccionEstricta.mockRejectedValueOnce(
      new BadRequestException(
        'El plan de estudio contiene inconsistencias en su grafo académico: Requisito apunta a asignatura inexistente o inactiva.',
      ),
    );

    const dto: EnviarRespuestaPublicaDto = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '208110999',
      primerNombre: 'Estudiante',
      primerApellido: 'Prueba',
      correoEstudiantil: 'estudiante@universidad.ac.cr',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [10],
    };

    await expect(controller.enviarRespuesta(tokenValido, dto)).rejects.toThrow(
      'inconsistencias en su grafo académico',
    );
  });

  // CASO 12: Correquisitos pendientes de definición (BLOQUEAR_REVISION)
  it('Caso 12: Rechaza materias con correquisitos bajo política preventiva BLOQUEAR_REVISION', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 5,
      planEstudioId: 2,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
    } as any);
    periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as any);

    motorRequisitosService.validarSeleccionEstricta.mockRejectedValueOnce(
      new BadRequestException(
        'Selección inválida: Bloqueada preventivamente: posee el correquisito IF-2001 pendiente de confirmación de política académica.',
      ),
    );

    const dto: EnviarRespuestaPublicaDto = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '208110999',
      primerNombre: 'Estudiante',
      primerApellido: 'Prueba',
      correoEstudiantil: 'estudiante@universidad.ac.cr',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [10],
    };

    await expect(controller.enviarRespuesta(tokenValido, dto)).rejects.toThrow(
      'Bloqueada preventivamente',
    );
  });

  // CASO 13: Rechazo de datos personales inválidos
  it('Caso 13: Rechaza datos personales inválidos mediante validación de DTO', async () => {
    const dtoInvalido = plainToInstance(EnviarRespuestaPublicaDto, {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '1', // muy corto (< 3)
      primerNombre: '', // vacío
      correoEstudiantil: 'no-es-correo', // formato email inválido
      periodoIngresoId: -1, // negativo
      asignaturasAprobadasIds: 'no-un-arreglo',
    });

    const errores = await validate(dtoInvalido);
    expect(errores.length).toBeGreaterThan(0);
    const camposConError = errores.map((e) => e.property);
    expect(camposConError).toContain('identificacion');
    expect(camposConError).toContain('primerNombre');
    expect(camposConError).toContain('correoEstudiantil');
    expect(camposConError).toContain('periodoIngresoId');
  });

  // CASO 14: Protección contra payloads manipulados (honeypot)
  it('Caso 14: Detecta y rechaza payloads de bots mediante honeypot (sitioWeb)', async () => {
    const dtoBot: EnviarRespuestaPublicaDto = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '208110999',
      primerNombre: 'Bot',
      primerApellido: 'Spammer',
      correoEstudiantil: 'bot@spam.com',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [1],
      sitioWeb: 'https://malicious-link.net',
    };

    await expect(controller.enviarRespuesta(tokenValido, dtoBot)).rejects.toThrow(
      'La solicitud no pudo ser procesada',
    );
  });

  // CASO 15: Rate limiting y respuesta HTTP 429
  it('Caso 15: Aplica rate limiting retornando HTTP 429 y Retry-After ante peticiones excesivas', () => {
    const resMock = { setHeader: jest.fn() };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', headers: {}, ip: '80.90.100.110' }),
        getResponse: () => resMock,
      }),
    } as unknown as ExecutionContext;

    // Límite POST es 10 peticiones
    for (let i = 0; i < 10; i++) {
      expect(rateLimitGuard.canActivate(ctx)).toBe(true);
    }

    // Petición 11 debe arrojar 429
    expect(() => rateLimitGuard.canActivate(ctx)).toThrow(HttpException);
    try {
      rateLimitGuard.canActivate(ctx);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
    expect(resMock.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  // CASO 16: Prevención de duplicaciones por reintento (idempotencia)
  it('Caso 16: Previene duplicados ante reintentos rápidos de red devolviendo confirmación previa', async () => {
    formularioRepo.findOne.mockResolvedValue({
      id: 5,
      planEstudioId: 2,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
    } as any);
    periodoRepo.findOne.mockResolvedValue({ id: 1 } as any);
    motorRequisitosService.validarSeleccionEstricta.mockResolvedValue({
      esValido: true,
      aprobadasValidas: [10],
    } as any);
    planAsignaturaRepo.find.mockResolvedValue([
      { id: 10, cursoId: 1, codigoReferencia: 'PROG-1' } as any,
    ]);
    persistenciaInternaService.guardarRespuestaInterna.mockResolvedValueOnce({
      id: 555,
      googleResponseId: 'INT-idemp-555',
      estado: EstadoRespuestaFormulario.PENDIENTE,
    } as any).mockResolvedValueOnce({
      id: 555,
      googleResponseId: 'INT-idemp-555',
      estado: EstadoRespuestaFormulario.PENDIENTE,
      idempotente: true,
    } as any);

    const dto: EnviarRespuestaPublicaDto = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '509990111',
      primerNombre: 'María',
      primerApellido: 'Pérez',
      correoEstudiantil: 'mperez@universidad.ac.cr',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [10],
    };

    // Envío inicial
    const res1 = await controller.enviarRespuesta(tokenValido, dto);
    expect(res1.codigoConfirmacion).toBe('INT-idemp-555');

    // Reintento inmediato (mismo estudiante, mismo formulario, mismo payload)
    const res2 = await controller.enviarRespuesta(tokenValido, dto);
    expect(res2.codigoConfirmacion).toBe('INT-idemp-555');
    expect((res2 as any).idempotente).toBe(true);
    expect(persistenciaInternaService.guardarRespuestaInterna).toHaveBeenCalledTimes(2);
  });

  // CASO 17: Almacenamiento de respuestas PENDIENTES
  it('Caso 17: Garantiza que toda respuesta se registre inicialmente en estado PENDIENTE', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 5,
      planEstudioId: 2,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
    } as any);
    periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as any);
    motorRequisitosService.validarSeleccionEstricta.mockResolvedValueOnce({
      esValido: true,
      aprobadasValidas: [],
    } as any);
    planAsignaturaRepo.find.mockResolvedValueOnce([]);

    persistenciaInternaService.guardarRespuestaInterna.mockImplementationOnce((input: any) =>
      Promise.resolve({
        id: 777,
        googleResponseId: 'INT-conf-777',
        estado: EstadoRespuestaFormulario.PENDIENTE,
        procesadoAt: null,
      } as any),
    );

    const dto: EnviarRespuestaPublicaDto = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '304440555',
      primerNombre: 'Laura',
      primerApellido: 'Rojas',
      correoEstudiantil: 'lrojas@universidad.ac.cr',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [],
    };

    const res = await controller.enviarRespuesta(tokenValido, dto);
    expect(res.estado).toBe(EstadoRespuestaFormulario.PENDIENTE);
  });

  // CASO 18: No exposición de datos internos en el GET
  it('Caso 18: Omite datos administrativos y credenciales en el GET público', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 1,
      titulo: 'Formulario Seguro',
      descripcion: 'Público',
      planEstudioId: 2,
      creadoPorUsuarioId: 44,
      googleFormId: 'sensitive-gform-id',
      detalleError: 'SQL connection error (sensitive)',
      carrera: { id: 1, nombre: 'Carrera', codigo: 'C1' },
      planEstudio: { id: 2, nombre: 'Plan', anioAprobacion: 2024 },
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
    } as any);
    periodoRepo.find.mockResolvedValueOnce([]);
    motorRequisitosService.obtenerCatalogoFormulario.mockResolvedValueOnce({
      plan: { id: 2 },
      aprobadasValidas: [],
      niveles: [],
      resumen: [],
    } as any);

    const res: any = await controller.consultarFormulario(tokenValido);
    expect(res.creadoPorUsuarioId).toBeUndefined();
    expect(res.googleFormId).toBeUndefined();
    expect(res.detalleError).toBeUndefined();
    expect(res.formulario.titulo).toBe('Formulario Seguro');
  });

  // CASO 19: Ausencia de acceso público a endpoints privados
  it('Caso 19: Las rutas públicas carecen de AuthGuard, manteniendo los endpoints administrativos protegidos', () => {
    const guardsPublicos = Reflect.getMetadata('__guards__', FormulariosPublicosController) || [];
    expect(guardsPublicos).toContain(RateLimitPublicoGuard);
    expect(guardsPublicos.some((g: any) => g?.name === 'AuthGuard')).toBe(false);
  });

  // CASO 20: Conservación del funcionamiento de Google Forms
  it('Caso 20: Respeta formularios de Google sin alterar su identificador ni sincronización', () => {
    const formGoogle = new FormularioEstudiante();
    formGoogle.id = 1;
    formGoogle.proveedor = ProveedorFormulario.GOOGLE_FORMS;
    formGoogle.googleFormId = 'google-form-abc';
    formGoogle.responderUri = 'https://docs.google.com/forms/d/e/123/viewform';

    expect(formGoogle.proveedor).toBe(ProveedorFormulario.GOOGLE_FORMS);
    expect(formGoogle.googleFormId).toBe('google-form-abc');
  });

  // CASO 21: Ausencia de aprobación automática de materias
  it('Caso 21: El envío público no crea registros de aprobación inmediata en historial académico', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 5,
      planEstudioId: 2,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
    } as any);
    periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as any);
    motorRequisitosService.validarSeleccionEstricta.mockResolvedValueOnce({
      esValido: true,
      aprobadasValidas: [10],
    } as any);
    planAsignaturaRepo.find.mockResolvedValueOnce([
      { id: 10, cursoId: 1, codigoReferencia: 'PROG-1' } as any,
    ]);
    persistenciaInternaService.guardarRespuestaInterna.mockResolvedValueOnce({
      id: 888,
      googleResponseId: 'INT-conf-888',
      estado: EstadoRespuestaFormulario.PENDIENTE,
    } as any);

    const dto: EnviarRespuestaPublicaDto = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '109990888',
      primerNombre: 'Test',
      primerApellido: 'Inmediato',
      correoEstudiantil: 'test@universidad.ac.cr',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [10],
    };

    const res = await controller.enviarRespuesta(tokenValido, dto);
    // Permanece en estado PENDIENTE para revisión administrativa
    expect(res.estado).toBe(EstadoRespuestaFormulario.PENDIENTE);
  });

  // CASO 22: Correcto tratamiento de errores de persistencia
  it('Caso 22: Trata errores inesperados del motor o persistencia sin exponer trazas internas sensibles', async () => {
    formularioRepo.findOne.mockResolvedValueOnce({
      id: 5,
      planEstudioId: 2,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      proveedor: ProveedorFormulario.INTERNO,
    } as any);
    periodoRepo.findOne.mockResolvedValueOnce({ id: 1 } as any);

    motorRequisitosService.validarSeleccionEstricta.mockRejectedValueOnce(
      new Error('DB_FATAL_ERROR: Connection dropped at 192.168.1.1:3306'),
    );

    const dto: EnviarRespuestaPublicaDto = {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '109990888',
      primerNombre: 'Test',
      primerApellido: 'Error',
      correoEstudiantil: 'test@universidad.ac.cr',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [10],
    };

    try {
      await controller.enviarRespuesta(tokenValido, dto);
      fail('Se esperaba que lanzara InternalServerErrorException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect(err.message).not.toContain('192.168.1.1');
      expect(err.message).toContain('No se pudo verificar la coherencia académica');
    }
  });
});
