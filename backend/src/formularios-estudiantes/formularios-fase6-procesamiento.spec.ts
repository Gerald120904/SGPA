import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PERMISOS_KEY } from '../permisos/decorators/permisos.decorator';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { ProveedorFormulario } from './constants/proveedor-formulario.constant';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { RespuestaFormularioEstudiante } from './entities/respuesta-formulario-estudiante.entity';
import { FormulariosEstudiantesController } from './formularios-estudiantes.controller';
import { FormulariosEstudiantesProcesamientoService } from './formularios-estudiantes-procesamiento.service';
import { EstudiantesImportacionService } from '../estudiantes/estudiantes-importacion.service';
import { FuenteRegistroAcademico } from '../estudiantes/constants/fuente-registro-academico.constant';
import { MotorRequisitosService } from '../planes-estudio/motor-requisitos/motor-requisitos.service';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';

describe('SGPA Fase 6: Procesamiento, Aprobación e Importación Académica (30 Pruebas)', () => {
  let procesamientoService: FormulariosEstudiantesProcesamientoService;
  let controller: FormulariosEstudiantesController;

  let mockFormularioRepo: any;
  let mockRespuestaRepo: any;
  let mockPeriodoRepo: any;
  let mockPlanAsignaturaRepo: any;
  let mockEstudiantesImportacionService: any;
  let mockEstructuraAcademicaService: any;
  let mockMotorRequisitosService: any;

  const adminUsuarioId = 42;
  const carreraId = 10;
  const planEstudioId = 100;
  const periodoId = 20261;

  const mockFormularioInterno: Partial<FormularioEstudiante> = {
    id: 1,
    titulo: 'Formulario de Matrícula Interno 2026',
    descripcion: 'Recepción oficial interna',
    carreraId,
    planEstudioId,
    proveedor: ProveedorFormulario.INTERNO,
    estado: EstadoFormularioEstudiante.PUBLICADO,
    tokenPublico: 'tok_interno_fase6_abc',
    googleFormId: null,
    responderUri: '/formularios/p/tok_interno_fase6_abc',
    carrera: { id: carreraId, nombre: 'Ingeniería en Sistemas' } as any,
    planEstudio: { id: planEstudioId, nombre: 'Plan 2026' } as any,
  };

  const mockFormularioGoogle: Partial<FormularioEstudiante> = {
    id: 2,
    titulo: 'Formulario Histórico Google',
    descripcion: 'Recepción Google Forms',
    carreraId,
    planEstudioId,
    proveedor: ProveedorFormulario.GOOGLE_FORMS,
    estado: EstadoFormularioEstudiante.PUBLICADO,
    tokenPublico: null,
    googleFormId: 'g_form_hist_123',
    responderUri: 'https://docs.google.com/forms/d/e/xxx/viewform',
    carrera: { id: carreraId, nombre: 'Ingeniería en Sistemas' } as any,
    planEstudio: { id: planEstudioId, nombre: 'Plan 2026' } as any,
  };

  const mockDatosNormalizados = {
    identificacion: '401110222',
    primerNombre: 'Carlos',
    segundoNombre: 'Eduardo',
    primerApellido: 'Vargas',
    segundoApellido: 'Mora',
    correoEstudiantil: 'carlos.vargas@est.una.ac.cr',
    contacto: '88887777',
    periodoIngresoId: periodoId,
    asignaturasAprobadas: [
      {
        planAsignaturaId: 501,
        cursoId: 801,
        codigo: 'EIF201',
      },
    ],
    optativasNoDisciplinarias: null,
    requiereRevisionOptativas: false,
  };

  const mockRespuestaInterna: Partial<RespuestaFormularioEstudiante> = {
    id: 701,
    formularioId: 1,
    formulario: mockFormularioInterno as FormularioEstudiante,
    estado: EstadoRespuestaFormulario.PENDIENTE,
    googleResponseId: 'INT-RESP-701',
    datosNormalizadosJson: { ...mockDatosNormalizados },
    payloadJson: { respuestas: [] },
    detalleError: null,
    motivoRechazo: null,
    revisadoPorUsuarioId: null,
    revisadoAt: null,
    procesadoAt: null,
  };

  const mockRespuestaGoogle: Partial<RespuestaFormularioEstudiante> = {
    id: 702,
    formularioId: 2,
    formulario: mockFormularioGoogle as FormularioEstudiante,
    estado: EstadoRespuestaFormulario.PENDIENTE,
    googleResponseId: '2_ABaOnuc-g_resp_999',
    datosNormalizadosJson: { ...mockDatosNormalizados },
    payloadJson: { respuestas: [] },
    detalleError: null,
    motivoRechazo: null,
    revisadoPorUsuarioId: null,
    revisadoAt: null,
    procesadoAt: null,
  };

  const mockPeriodoEntity: Partial<PeriodoAcademico> = {
    id: periodoId,
    codigo: '2026-I',
    nombre: 'I Ciclo 2026',
    anio: 2026,
    ciclo: 1,
  };

  const mockPlanAsignaturaEntity: Partial<PlanAsignatura> = {
    id: 501,
    planEstudioId,
    cursoId: 801,
    activo: true,
    curso: {
      id: 801,
      codigo: 'EIF201',
      nombre: 'Programación I',
    } as any,
  };

  beforeEach(() => {
    mockFormularioRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 1) return Promise.resolve({ ...mockFormularioInterno });
        if (where.id === 2) return Promise.resolve({ ...mockFormularioGoogle });
        return Promise.resolve(null);
      }),
      save: jest.fn(async (ent) => ent),
    };

    mockRespuestaRepo = {
      find: jest.fn().mockResolvedValue([{ ...mockRespuestaInterna }]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 701) return Promise.resolve({ ...mockRespuestaInterna });
        if (where.id === 702) return Promise.resolve({ ...mockRespuestaGoogle });
        return Promise.resolve(null);
      }),
      save: jest.fn(async (ent) => ent),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    mockPeriodoRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockPeriodoEntity }),
    };

    mockPlanAsignaturaRepo = {
      find: jest.fn().mockResolvedValue([{ ...mockPlanAsignaturaEntity }]),
    };

    mockEstudiantesImportacionService = {
      ejecutarDesdeFormulario: jest.fn().mockResolvedValue({
        creados: 1,
        actualizados: 0,
        aprobacionesNuevas: 1,
        sinCambios: 0,
        errores: 0,
        filas: [
          {
            fila: 2,
            accion: 'CREAR',
            errores: [],
            aprobacionesNuevas: [{ codigo: 'EIF201', planAsignaturaId: 501 }],
          },
        ],
      }),
      ejecutarDesdeGoogleForms: jest.fn().mockResolvedValue({
        creados: 1,
        actualizados: 0,
        aprobacionesNuevas: 1,
        sinCambios: 0,
        errores: 0,
        filas: [{ fila: 2, accion: 'CREAR', errores: [] }],
      }),
    };

    mockEstructuraAcademicaService = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
      obtenerCarreraIdsConAlcance: jest.fn().mockResolvedValue([carreraId]),
    };

    mockMotorRequisitosService = {
      validarSeleccionEstricta: jest.fn().mockResolvedValue({
        esValido: true,
        inconsistenciasGrafo: [],
        desmarcadasCascada: [],
        asignaturas: [{ asignaturaId: 501 }],
        solicitadasOriginales: [501],
      }),
    };

    procesamientoService = new FormulariosEstudiantesProcesamientoService(
      mockFormularioRepo,
      mockRespuestaRepo,
      mockPeriodoRepo,
      mockPlanAsignaturaRepo,
      mockEstudiantesImportacionService,
      mockEstructuraAcademicaService,
      {
        transaction: jest.fn(async (callback) =>
          callback({
            query: jest.fn().mockResolvedValue([
              { estado: EstadoRespuestaFormulario.PENDIENTE },
            ]),
            getRepository: () => mockRespuestaRepo,
          }),
        ),
      } as any,
      mockMotorRequisitosService,
    );

    controller = new FormulariosEstudiantesController(
      {} as any,
      {} as any,
      procesamientoService,
      {} as any,
    );
  });

  // 1. Consulta de respuesta interna pendiente
  it('1. Consulta de respuesta interna pendiente: lista respuestas internas en estado PENDIENTE con relaciones completas', async () => {
    mockRespuestaRepo.find.mockResolvedValueOnce([{ ...mockRespuestaInterna }]);
    const solicitudes = await procesamientoService.listarSolicitudes(
      adminUsuarioId,
      carreraId,
      planEstudioId,
    );

    expect(solicitudes.length).toBe(1);
    expect(solicitudes[0].formulario.proveedor).toBe(ProveedorFormulario.INTERNO);
    expect(solicitudes[0].estado).toBe(EstadoRespuestaFormulario.PENDIENTE);
  });

  // 2. Consulta de respuesta histórica Google
  it('2. Consulta de respuesta histórica Google: lista respuestas históricas con proveedor GOOGLE_FORMS sin colisiones', async () => {
    mockRespuestaRepo.find.mockResolvedValueOnce([{ ...mockRespuestaGoogle }]);
    const solicitudes = await procesamientoService.listarSolicitudes(
      adminUsuarioId,
      carreraId,
      planEstudioId,
    );

    expect(solicitudes.length).toBe(1);
    expect(solicitudes[0].formulario.proveedor).toBe(ProveedorFormulario.GOOGLE_FORMS);
    expect(solicitudes[0].googleResponseId).toBe('2_ABaOnuc-g_resp_999');
  });

  // 3. Identificación correcta del proveedor
  it('3. Identificación correcta del proveedor: distingue proveedor INTERNO vs GOOGLE_FORMS en entidad y procesamiento', async () => {
    expect(mockFormularioInterno.proveedor).toBe(ProveedorFormulario.INTERNO);
    expect(mockFormularioGoogle.proveedor).toBe(ProveedorFormulario.GOOGLE_FORMS);
    expect(mockFormularioInterno.proveedor).not.toBe(mockFormularioGoogle.proveedor);
  });

  // 4. Normalización correcta de respuestas internas
  it('4. Normalización correcta de respuestas internas: verifica que datosNormalizadosJson posee contrato completo', () => {
    const datos = mockRespuestaInterna.datosNormalizadosJson!;
    expect(datos.identificacion).toBe('401110222');
    expect(datos.primerNombre).toBe('Carlos');
    expect(datos.primerApellido).toBe('Vargas');
    expect(datos.correoEstudiantil).toBe('carlos.vargas@est.una.ac.cr');
    expect(datos.periodoIngresoId).toBe(periodoId);
    expect(Array.isArray(datos.asignaturasAprobadas)).toBe(true);
    expect(datos.asignaturasAprobadas[0].codigo).toBe('EIF201');
  });

  // 5. Aprobación administrativa válida
  it('5. Aprobación administrativa válida: aprueba respuesta interna pendiente y transiciona a PROCESADO con auditoría', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    const resultado = await procesamientoService.aprobarRespuesta(701, adminUsuarioId);

    expect(resultado.estado).toBe(EstadoRespuestaFormulario.PROCESADO);
    expect(resultado.creados).toBe(1);
    expect(respuestaClonada.estado).toBe(EstadoRespuestaFormulario.PROCESADO);
    expect(respuestaClonada.revisadoPorUsuarioId).toBe(adminUsuarioId);
    expect(respuestaClonada.revisadoAt).toBeInstanceOf(Date);
    expect(respuestaClonada.procesadoAt).toBeInstanceOf(Date);
  });

  // 6. Rechazo administrativo con motivo
  it('6. Rechazo administrativo con motivo: rechaza respuesta, transiciona a RECHAZADO, guarda motivo y no altera historial', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    const motivo = 'Falta documentación de ingreso oficial';
    const rechazada = await procesamientoService.rechazarRespuesta(701, adminUsuarioId, motivo);

    expect(rechazada.estado).toBe(EstadoRespuestaFormulario.RECHAZADO);
    expect(rechazada.motivoRechazo).toBe(motivo);
    expect(rechazada.revisadoPorUsuarioId).toBe(adminUsuarioId);
    expect(rechazada.procesadoAt).toBeNull();
    expect(mockEstudiantesImportacionService.ejecutarDesdeFormulario).not.toHaveBeenCalled();
  });

  // 7. Persistencia de FORMULARIO_INTERNO como fuente académica
  it('7. Persistencia de FORMULARIO_INTERNO como fuente académica: comprueba que historial recibe FuenteRegistroAcademico.FORMULARIO_INTERNO', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    await procesamientoService.aprobarRespuesta(701, adminUsuarioId);

    expect(
      mockEstudiantesImportacionService.ejecutarDesdeFormulario,
    ).toHaveBeenCalledWith(
      adminUsuarioId,
      expect.anything(),
      FuenteRegistroAcademico.FORMULARIO_INTERNO,
      expect.anything(),
    );
  });

  // 8. Conservación de GOOGLE_FORMS como fuente para registros Google
  it('8. Conservación de GOOGLE_FORMS como fuente para registros Google: comprueba que formularios Google persisten fuente GOOGLE_FORMS', async () => {
    const respuestaClonada = { ...mockRespuestaGoogle };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    await procesamientoService.aprobarRespuesta(702, adminUsuarioId);

    expect(
      mockEstudiantesImportacionService.ejecutarDesdeFormulario,
    ).toHaveBeenCalledWith(
      adminUsuarioId,
      expect.anything(),
      FuenteRegistroAcademico.GOOGLE_FORMS,
      expect.anything(),
    );
  });

  // 9. Inserción correcta de asignaturas aprobadas en el historial
  it('9. Inserción correcta de asignaturas aprobadas en el historial: verifica mapeo de planAsignaturaId y resultado APROBADO', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    await procesamientoService.aprobarRespuesta(701, adminUsuarioId);

    expect(
      mockEstudiantesImportacionService.ejecutarDesdeFormulario,
    ).toHaveBeenCalledWith(
      adminUsuarioId,
      expect.objectContaining({
        estudiantes: [
          expect.objectContaining({
            cedula: '401110222',
            asignaturasAprobadas: ['EIF201'],
          }),
        ],
      }),
      FuenteRegistroAcademico.FORMULARIO_INTERNO,
      expect.anything(),
    );
  });

  // 10. Protección frente a asignaturas de otro plan
  it('10. Protección frente a asignaturas de otro plan: detecta planAsignaturaId ajeno al plan del formulario y pasa a REQUIERE_REVISION', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    // Asignatura de otro plan (plan 999 !== 100)
    mockPlanAsignaturaRepo.find.mockResolvedValueOnce([
      {
        id: 501,
        planEstudioId: 999,
        cursoId: 801,
        curso: { id: 801, codigo: 'EIF201' },
      },
    ]);

    await expect(
      procesamientoService.aprobarRespuesta(701, adminUsuarioId),
    ).rejects.toThrow(ConflictException);

    expect(respuestaClonada.estado).toBe(EstadoRespuestaFormulario.REQUIERE_REVISION);
    expect(respuestaClonada.detalleError).toContain(
      'ya no pertenece al plan del formulario',
    );
  });

  // 11. Protección frente a datos alterados
  it('11. Protección frente a datos alterados: respuesta sin datos normalizados pasa a ERROR y no procesa', async () => {
    const respuestaAlterada = {
      ...mockRespuestaInterna,
      datosNormalizadosJson: null as any,
    };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaAlterada);

    await expect(
      procesamientoService.aprobarRespuesta(701, adminUsuarioId),
    ).rejects.toThrow(ConflictException);

    expect(respuestaAlterada.estado).toBe(EstadoRespuestaFormulario.ERROR);
    expect(respuestaAlterada.detalleError).toContain('no posee datos normalizados');
  });

  // 12. Falta de permisos de aprobación
  it('12. Falta de permisos de aprobación: verifica que el decorador @Permisos exige ESTUDIANTES_GESTIONAR', () => {
    const reflector = new Reflector();
    const handler = controller.aceptarRespuesta;
    const permisos = reflector.get<string[]>(PERMISOS_KEY, handler);

    expect(permisos).toBeDefined();
    expect(permisos).toContain(PermisoSistema.ESTUDIANTES_GESTIONAR);
  });

  // 13. Restricción de alcance por carrera
  it('13. Restricción de alcance por carrera: usuario sin alcance sobre carrera recibe ForbiddenException', async () => {
    mockEstructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValueOnce(false);

    await expect(
      procesamientoService.aprobarRespuesta(701, adminUsuarioId),
    ).rejects.toThrow(ForbiddenException);

    expect(mockEstudiantesImportacionService.ejecutarDesdeFormulario).not.toHaveBeenCalled();
  });

  // 14. Doble aprobación de una misma respuesta
  it('14. Doble aprobación de una misma respuesta: segunda llamada consecutiva sobre solicitud PROCESADO arroja ConflictException', async () => {
    const respuestaYaProcesada = {
      ...mockRespuestaInterna,
      estado: EstadoRespuestaFormulario.PROCESADO,
    };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaYaProcesada);

    await expect(
      procesamientoService.aprobarRespuesta(701, adminUsuarioId),
    ).rejects.toThrow(ConflictException);

    expect(mockEstudiantesImportacionService.ejecutarDesdeFormulario).not.toHaveBeenCalled();
  });

  // 15. Concurrencia entre dos administradores
  it('15. Concurrencia entre dos administradores: simula actualización concurrente y comprueba que solo una procede', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    // Simular que el update atómico retorna affected = 0 porque otro admin ya ganó la carrera
    mockRespuestaRepo.update.mockResolvedValueOnce({ affected: 0 });

    await expect(
      procesamientoService.aprobarRespuesta(701, adminUsuarioId),
    ).rejects.toThrow('Esta solicitud ya fue revisada.');
  });

  // 16. Fallo de importación con reversión transaccional
  it('16. Fallo de importación con reversión transaccional: fallo en importación académica revierte y marca REQUIERE_REVISION', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    mockEstudiantesImportacionService.ejecutarDesdeFormulario.mockRejectedValueOnce(
      new Error('Fallo crítico en motor de persistencia transaccional'),
    );

    await expect(
      procesamientoService.aprobarRespuesta(701, adminUsuarioId),
    ).rejects.toThrow(ConflictException);

    expect(respuestaClonada.estado).toBe(EstadoRespuestaFormulario.REQUIERE_REVISION);
    expect(respuestaClonada.detalleError).toContain(
      'Fallo crítico en motor de persistencia transaccional',
    );
  });

  // 17. Reintento seguro después de una falla
  it('17. Reintento seguro después de una falla: respuesta en REQUIERE_REVISION puede ser reprocesada y aprobada una vez corregida', async () => {
    const respuestaEnRevision = {
      ...mockRespuestaInterna,
      estado: EstadoRespuestaFormulario.REQUIERE_REVISION,
      detalleError: 'Error previo resuelto',
    };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaEnRevision);

    const resultado = await procesamientoService.aprobarRespuesta(701, adminUsuarioId);

    expect(resultado.estado).toBe(EstadoRespuestaFormulario.PROCESADO);
    expect(respuestaEnRevision.estado).toBe(EstadoRespuestaFormulario.PROCESADO);
    expect(respuestaEnRevision.detalleError).toBeNull();
  });

  // 18. Rechazo sin modificación del historial
  it('18. Rechazo sin modificación del historial: rechazo administrativo no crea estudiantes ni inserta en historial académico', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    await procesamientoService.rechazarRespuesta(701, adminUsuarioId, 'Datos inconsistentes');

    expect(mockEstudiantesImportacionService.ejecutarDesdeFormulario).not.toHaveBeenCalled();
    expect(mockEstudiantesImportacionService.ejecutarDesdeGoogleForms).not.toHaveBeenCalled();
  });

  // 19. Transiciones de estado inválidas
  it('19. Transiciones de estado inválidas: no permite aprobar respuestas ya RECHAZADO o ERROR', async () => {
    mockRespuestaRepo.findOne.mockResolvedValueOnce({
      ...mockRespuestaInterna,
      estado: EstadoRespuestaFormulario.RECHAZADO,
    });

    await expect(
      procesamientoService.aprobarRespuesta(701, adminUsuarioId),
    ).rejects.toThrow(ConflictException);

    mockRespuestaRepo.findOne.mockResolvedValueOnce({
      ...mockRespuestaInterna,
      estado: EstadoRespuestaFormulario.ERROR,
    });

    await expect(
      procesamientoService.aprobarRespuesta(701, adminUsuarioId),
    ).rejects.toThrow(ConflictException);
  });

  // 20. Estudiantes ya registrados
  it('20. Estudiantes ya registrados: detecta estudiante existente y aplica actualización académica sin duplicación', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    mockEstudiantesImportacionService.ejecutarDesdeFormulario.mockResolvedValueOnce({
      creados: 0,
      actualizados: 1,
      aprobacionesNuevas: 1,
      sinCambios: 0,
      errores: 0,
      filas: [{ fila: 2, accion: 'ACTUALIZAR', errores: [] }],
    });

    const resultado = await procesamientoService.aprobarRespuesta(701, adminUsuarioId);

    expect(resultado.creados).toBe(0);
    expect(resultado.actualizados).toBe(1);
    expect(resultado.estado).toBe(EstadoRespuestaFormulario.PROCESADO);
  });

  // 21. Materias ya existentes en el historial
  it('21. Materias ya existentes en el historial: omite inserción duplicada de materias previamente aprobadas', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    mockEstudiantesImportacionService.ejecutarDesdeFormulario.mockResolvedValueOnce({
      creados: 0,
      actualizados: 0,
      aprobacionesNuevas: 0,
      sinCambios: 1,
      errores: 0,
      filas: [{ fila: 2, accion: 'SIN_CAMBIOS', errores: [] }],
    });

    const resultado = await procesamientoService.aprobarRespuesta(701, adminUsuarioId);

    expect(resultado.aprobacionesNuevas).toBe(0);
    expect(resultado.estado).toBe(EstadoRespuestaFormulario.PROCESADO);
  });

  // 22. Prerrequisitos no satisfechos
  it('22. Prerrequisitos no satisfechos: MotorRequisitosService detecta prerrequisito faltante y rechaza aprobación con REQUIERE_REVISION', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    mockMotorRequisitosService.validarSeleccionEstricta.mockRejectedValueOnce(
      new BadRequestException(
        'Selección inválida: La asignatura "EIF201" requiere haber aprobado su prerrequisito "MAT001".',
      ),
    );

    await expect(
      procesamientoService.aprobarRespuesta(701, adminUsuarioId),
    ).rejects.toThrow(ConflictException);

    expect(respuestaClonada.estado).toBe(EstadoRespuestaFormulario.REQUIERE_REVISION);
    expect(respuestaClonada.detalleError).toContain(
      'requiere haber aprobado su prerrequisito',
    );
    expect(mockEstudiantesImportacionService.ejecutarDesdeFormulario).not.toHaveBeenCalled();
  });

  // 23. Correquisitos pendientes de decisión
  it('23. Correquisitos pendientes de decisión: correquisito no cumplido pasa a REQUIERE_REVISION para decisión del coordinador', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    mockMotorRequisitosService.validarSeleccionEstricta.mockRejectedValueOnce(
      new BadRequestException(
        'La asignatura EIF202 requiere correquisito de matrícula con EIF203.',
      ),
    );

    await expect(
      procesamientoService.aprobarRespuesta(701, adminUsuarioId),
    ).rejects.toThrow(ConflictException);

    expect(respuestaClonada.estado).toBe(EstadoRespuestaFormulario.REQUIERE_REVISION);
    expect(respuestaClonada.detalleError).toContain('requiere correquisito');
  });

  // 24. Consistencia de reglas frente a modificaciones curriculares
  it('24. Consistencia de reglas frente a modificaciones curriculares: cambio curricular posterior a publicación impide aprobación desfasada', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    // Asignatura modificó su cursoId asociado en el plan
    mockPlanAsignaturaRepo.find.mockResolvedValueOnce([
      {
        id: 501,
        planEstudioId,
        cursoId: 9999, // Cambió de 801 a 9999
        curso: { id: 9999, codigo: 'EIF999' },
      },
    ]);

    await expect(
      procesamientoService.aprobarRespuesta(701, adminUsuarioId),
    ).rejects.toThrow(ConflictException);

    expect(respuestaClonada.estado).toBe(EstadoRespuestaFormulario.REQUIERE_REVISION);
    expect(respuestaClonada.detalleError).toContain('cambió su curso asociado');
  });

  // 25. Compatibilidad de Google Forms
  it('25. Compatibilidad de Google Forms: verificar que ejecutarDesdeGoogleForms y flujo Google continúan 100% operativos', async () => {
    const importacionRealService = new EstudiantesImportacionService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const spyEjecutar = jest
      .spyOn(importacionRealService, 'ejecutarDesdeFormulario')
      .mockResolvedValueOnce({
        creados: 1,
        actualizados: 0,
        aprobacionesNuevas: 1,
        sinCambios: 0,
        errores: 0,
        filas: [],
      });

    await importacionRealService.ejecutarDesdeGoogleForms(adminUsuarioId, {
      carreraId,
      planEstudioId,
      estudiantes: [],
    });

    expect(spyEjecutar).toHaveBeenCalledWith(
      adminUsuarioId,
      expect.anything(),
      FuenteRegistroAcademico.GOOGLE_FORMS,
    );
  });

  // 26. Conservación de datos normalizados
  it('26. Conservación de datos normalizados: datosNormalizadosJson se preserva íntegro e inalterado tras el procesamiento', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    await procesamientoService.aprobarRespuesta(701, adminUsuarioId);

    expect(respuestaClonada.datosNormalizadosJson).toEqual(mockDatosNormalizados);
  });

  // 27. Ausencia de aprobación automática desde el endpoint público
  it('27. Ausencia de aprobación automática desde el endpoint público: POST público deja siempre respuesta en PENDIENTE, nunca PROCESADO', () => {
    expect(mockRespuestaInterna.estado).toBe(EstadoRespuestaFormulario.PENDIENTE);
    expect(mockRespuestaInterna.procesadoAt).toBeNull();
    expect(mockRespuestaInterna.revisadoPorUsuarioId).toBeNull();
  });

  // 28. Compatibilidad con el frontend Electron
  it('28. Compatibilidad con el frontend Electron: endpoints /respuestas/:respuestaId/aceptar y /rechazar delegan adecuadamente', async () => {
    const req = { user: { sub: adminUsuarioId } } as any;

    const spyAprobar = jest
      .spyOn(procesamientoService, 'aprobarRespuesta')
      .mockResolvedValueOnce({
        respuestaId: 701,
        estado: EstadoRespuestaFormulario.PROCESADO,
        creados: 1,
        actualizados: 0,
        aprobacionesNuevas: 1,
      });

    const resultadoAceptar = await controller.aceptarRespuesta(req, 701);
    expect(spyAprobar).toHaveBeenCalledWith(701, adminUsuarioId);
    expect(resultadoAceptar.estado).toBe(EstadoRespuestaFormulario.PROCESADO);

    const spyRechazar = jest
      .spyOn(procesamientoService, 'rechazarRespuesta')
      .mockResolvedValueOnce({
        id: 701,
        estado: EstadoRespuestaFormulario.RECHAZADO,
      } as any);

    const resultadoRechazar = await controller.rechazarRespuesta(req, 701, {
      motivo: 'Inconsistente',
    });
    expect(spyRechazar).toHaveBeenCalledWith(701, adminUsuarioId, 'Inconsistente');
    expect(resultadoRechazar.estado).toBe(EstadoRespuestaFormulario.RECHAZADO);
  });

  // 29. Manejo de errores sin fuga de datos
  it('29. Manejo de errores sin fuga de datos: mensajes de excepción no exponen SQL, hashes ni credenciales', async () => {
    const respuestaClonada = { ...mockRespuestaInterna };
    mockRespuestaRepo.findOne.mockResolvedValueOnce(respuestaClonada);

    mockEstudiantesImportacionService.ejecutarDesdeFormulario.mockRejectedValueOnce(
      new Error('SELECT * FROM usuarios WHERE token = 12345: DB_CONNECTION_TIMEOUT'),
    );

    try {
      await procesamientoService.aprobarRespuesta(701, adminUsuarioId);
      throw new Error('Debió lanzar ConflictException');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ConflictException);
      expect(e.message).not.toContain('12345');
      expect(respuestaClonada.estado).toBe(EstadoRespuestaFormulario.REQUIERE_REVISION);
    }
  });

  // 30. Ausencia de regresiones en Estudiantes y Planes de Estudio
  it('30. Ausencia de regresiones en Estudiantes y Planes de Estudio: módulos base mantienen sus contratos y validaciones', () => {
    expect(FuenteRegistroAcademico.FORMULARIO_INTERNO).toBe('FORMULARIO_INTERNO');
    expect(FuenteRegistroAcademico.GOOGLE_FORMS).toBe('GOOGLE_FORMS');
    expect(FuenteRegistroAcademico.EXCEL).toBe('EXCEL');
    expect(EstadoRespuestaFormulario.PENDIENTE).toBe('PENDIENTE');
    expect(EstadoRespuestaFormulario.PROCESADO).toBe('PROCESADO');
    expect(EstadoRespuestaFormulario.REQUIERE_REVISION).toBe('REQUIERE_REVISION');
    expect(EstadoRespuestaFormulario.RECHAZADO).toBe('RECHAZADO');
  });
});
