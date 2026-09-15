import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { FormulariosEstudiantesProcesamientoService } from './formularios-estudiantes-procesamiento.service';

describe('FormulariosEstudiantesProcesamientoService', () => {
  let service: FormulariosEstudiantesProcesamientoService;

  let formularioRepo: {
    findOne: jest.Mock;
  };
  let respuestaRepo: {
    find: jest.Mock;
    save: jest.Mock;
  };
  let periodoRepo: {
    findOne: jest.Mock;
  };
  let planAsignaturaRepo: {
    find: jest.Mock;
  };
  let estudiantesImportacionService: {
    ejecutarDesdeGoogleForms: jest.Mock;
  };
  let estructuraAcademicaService: {
    tieneAlcanceSobreCarrera: jest.Mock;
  };

  const usuarioId = 10;
  const formularioId = 1;

  const mockFormulario = {
    id: 1,
    carreraId: 2,
    planEstudioId: 3,
  };

  const mockPeriodo = {
    id: 20,
    codigo: '2026-C1',
    nombre: 'I Ciclo 2026',
  };

  const mockPlanAsignatura = {
    id: 101,
    planEstudioId: 3,
    cursoId: 201,
    curso: {
      id: 201,
      codigo: 'EIF201',
    },
  };

  beforeEach(() => {
    formularioRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockFormulario }),
    };

    respuestaRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (r) => r),
    };

    periodoRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockPeriodo }),
    };

    planAsignaturaRepo = {
      find: jest.fn().mockResolvedValue([{ ...mockPlanAsignatura }]),
    };

    estudiantesImportacionService = {
      ejecutarDesdeGoogleForms: jest.fn().mockResolvedValue({
        creados: 1,
        actualizados: 0,
        aprobacionesNuevas: 1,
        sinCambios: 0,
        errores: 0,
        filas: [{ fila: 2, accion: 'CREAR', errores: [] }],
      }),
    };

    estructuraAcademicaService = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
    };

    service = new FormulariosEstudiantesProcesamientoService(
      formularioRepo as never,
      respuestaRepo as never,
      periodoRepo as never,
      planAsignaturaRepo as never,
      estudiantesImportacionService as never,
      estructuraAcademicaService as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('falla con NotFoundException si el formulario no existe', async () => {
    formularioRepo.findOne.mockResolvedValue(null);

    await expect(service.procesar(formularioId, usuarioId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('falla con ForbiddenException si el usuario no tiene alcance sobre la carrera', async () => {
    estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(false);

    await expect(service.procesar(formularioId, usuarioId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('procesa respuesta PENDIENTE combinando primer y segundo nombre y resolviendo IDs', async () => {
    const mockRespuesta = {
      id: 1,
      formularioId: 1,
      estado: EstadoRespuestaFormulario.PENDIENTE,
      procesadoAt: null,
      datosNormalizadosJson: {
        primerNombre: 'Ana',
        segundoNombre: 'Sofía',
        primerApellido: 'Vargas',
        segundoApellido: 'Mora',
        identificacion: '401110222',
        correoEstudiantil: 'ana@est.una.ac.cr',
        contacto: '88889999',
        periodoIngresoId: 20,
        asignaturasAprobadas: [
          {
            planAsignaturaId: 101,
            cursoId: 201,
            codigo: 'EIF201',
          },
        ],
        optativasNoDisciplinarias: null,
        requiereRevisionOptativas: false,
      },
    };

    respuestaRepo.find.mockResolvedValue([mockRespuesta]);

    const res = await service.procesar(formularioId, usuarioId);

    expect(res).toEqual({
      candidatas: 1,
      procesadas: 1,
      omitidasYaProcesadas: 0,
      requierenRevision: 0,
      errores: 0,
      estudiantesCreados: 1,
      estudiantesActualizados: 0,
      aprobacionesNuevas: 1,
    });

    expect(
      estudiantesImportacionService.ejecutarDesdeGoogleForms,
    ).toHaveBeenCalledWith(usuarioId, {
      carreraId: 2,
      planEstudioId: 3,
      estudiantes: [
        {
          fila: 2,
          cedula: '401110222',
          nombres: 'Ana Sofía',
          apellido1: 'Vargas',
          apellido2: 'Mora',
          correoInstitucional: 'ana@est.una.ac.cr',
          telefono: '88889999',
          periodoIngresoCodigo: '2026-C1',
          asignaturasAprobadas: ['EIF201'],
        },
      ],
    });

    expect(mockRespuesta.estado).toBe(EstadoRespuestaFormulario.PROCESADO);
    expect(mockRespuesta.procesadoAt).toBeInstanceOf(Date);
    expect(mockRespuesta.detalleError).toBeNull();
  });

  it('procesa correctamente una respuesta con cero asignaturas aprobadas', async () => {
    const mockRespuesta = {
      id: 2,
      formularioId: 1,
      estado: EstadoRespuestaFormulario.PENDIENTE,
      procesadoAt: null,
      datosNormalizadosJson: {
        primerNombre: 'Carlos',
        segundoNombre: null,
        primerApellido: 'Pérez',
        segundoApellido: null,
        identificacion: '501110222',
        correoEstudiantil: 'carlos@est.una.ac.cr',
        contacto: null,
        periodoIngresoId: 20,
        asignaturasAprobadas: [],
        optativasNoDisciplinarias: null,
        requiereRevisionOptativas: false,
      },
    };

    respuestaRepo.find.mockResolvedValue([mockRespuesta]);
    estudiantesImportacionService.ejecutarDesdeGoogleForms.mockResolvedValue({
      creados: 1,
      actualizados: 0,
      aprobacionesNuevas: 0,
      sinCambios: 0,
      errores: 0,
      filas: [{ fila: 2, accion: 'CREAR', errores: [] }],
    });

    const res = await service.procesar(formularioId, usuarioId);

    expect(res.estudiantesCreados).toBe(1);
    expect(res.aprobacionesNuevas).toBe(0);
    expect(mockRespuesta.estado).toBe(EstadoRespuestaFormulario.PROCESADO);
  });

  it('respuesta con optativa real: importa formalmente, conserva REQUIERE_REVISION y llena procesadoAt', async () => {
    const mockRespuesta = {
      id: 3,
      formularioId: 1,
      estado: EstadoRespuestaFormulario.REQUIERE_REVISION,
      procesadoAt: null,
      datosNormalizadosJson: {
        primerNombre: 'María',
        segundoNombre: null,
        primerApellido: 'Castro',
        segundoApellido: null,
        identificacion: '601110222',
        correoEstudiantil: 'maria@est.una.ac.cr',
        contacto: null,
        periodoIngresoId: 20,
        asignaturasAprobadas: [
          {
            planAsignaturaId: 101,
            cursoId: 201,
            codigo: 'EIF201',
          },
        ],
        optativasNoDisciplinarias: 'Teatro y Sociedad',
        requiereRevisionOptativas: true,
      },
    };

    respuestaRepo.find.mockResolvedValue([mockRespuesta]);

    const res = await service.procesar(formularioId, usuarioId);

    expect(res.procesadas).toBe(1);
    expect(res.requierenRevision).toBe(1);
    expect(res.estudiantesCreados).toBe(1);
    expect(mockRespuesta.estado).toBe(
      EstadoRespuestaFormulario.REQUIERE_REVISION,
    );
    expect(mockRespuesta.procesadoAt).toBeInstanceOf(Date);
  });

  it('si el importador devuelve accion ERROR (conflicto de datos), marca REQUIERE_REVISION y procesadoAt nulo', async () => {
    const mockRespuesta = {
      id: 4,
      formularioId: 1,
      estado: EstadoRespuestaFormulario.PENDIENTE,
      procesadoAt: null,
      datosNormalizadosJson: {
        primerNombre: 'Pedro',
        segundoNombre: null,
        primerApellido: 'Rojas',
        segundoApellido: null,
        identificacion: '701110222',
        correoEstudiantil: 'pedro@est.una.ac.cr',
        contacto: null,
        periodoIngresoId: 20,
        asignaturasAprobadas: [],
        optativasNoDisciplinarias: null,
        requiereRevisionOptativas: false,
      },
    };

    respuestaRepo.find.mockResolvedValue([mockRespuesta]);
    estudiantesImportacionService.ejecutarDesdeGoogleForms.mockResolvedValue({
      creados: 0,
      actualizados: 0,
      aprobacionesNuevas: 0,
      sinCambios: 0,
      errores: 1,
      filas: [
        {
          fila: 2,
          accion: 'ERROR',
          errores: ['El correo institucional pertenece a otra cédula.'],
        },
      ],
    });

    const res = await service.procesar(formularioId, usuarioId);

    expect(res.requierenRevision).toBe(1);
    expect(res.procesadas).toBe(0);
    expect(mockRespuesta.estado).toBe(
      EstadoRespuestaFormulario.REQUIERE_REVISION,
    );
    expect(mockRespuesta.detalleError).toBe(
      'El correo institucional pertenece a otra cédula.',
    );
    expect(mockRespuesta.procesadoAt).toBeNull();
  });

  it('si el período de ingreso ya no existe en la BD, marca REQUIERE_REVISION', async () => {
    const mockRespuesta = {
      id: 5,
      formularioId: 1,
      estado: EstadoRespuestaFormulario.PENDIENTE,
      procesadoAt: null,
      datosNormalizadosJson: {
        primerNombre: 'Luis',
        segundoNombre: null,
        primerApellido: 'Mora',
        segundoApellido: null,
        identificacion: '801110222',
        correoEstudiantil: 'luis@est.una.ac.cr',
        contacto: null,
        periodoIngresoId: 999, // Inexistente
        asignaturasAprobadas: [],
        optativasNoDisciplinarias: null,
        requiereRevisionOptativas: false,
      },
    };

    respuestaRepo.find.mockResolvedValue([mockRespuesta]);
    periodoRepo.findOne.mockResolvedValue(null);

    const res = await service.procesar(formularioId, usuarioId);

    expect(res.requierenRevision).toBe(1);
    expect(mockRespuesta.estado).toBe(
      EstadoRespuestaFormulario.REQUIERE_REVISION,
    );
    expect(mockRespuesta.detalleError).toBe(
      'El período de ingreso asociado a la respuesta ya no existe.',
    );
  });

  it('si una asignatura cambió de plan o fue eliminada, marca REQUIERE_REVISION', async () => {
    const mockRespuesta = {
      id: 6,
      formularioId: 1,
      estado: EstadoRespuestaFormulario.PENDIENTE,
      procesadoAt: null,
      datosNormalizadosJson: {
        primerNombre: 'Elena',
        segundoNombre: null,
        primerApellido: 'Jiménez',
        segundoApellido: null,
        identificacion: '901110222',
        correoEstudiantil: 'elena@est.una.ac.cr',
        contacto: null,
        periodoIngresoId: 20,
        asignaturasAprobadas: [
          {
            planAsignaturaId: 101,
            cursoId: 201,
            codigo: 'EIF201',
          },
        ],
        optativasNoDisciplinarias: null,
        requiereRevisionOptativas: false,
      },
    };

    respuestaRepo.find.mockResolvedValue([mockRespuesta]);
    // Asignatura pertenece a otro plan
    planAsignaturaRepo.find.mockResolvedValue([
      {
        ...mockPlanAsignatura,
        planEstudioId: 99, // Distinto al plan del formulario (3)
      },
    ]);

    const res = await service.procesar(formularioId, usuarioId);

    expect(res.requierenRevision).toBe(1);
    expect(mockRespuesta.estado).toBe(
      EstadoRespuestaFormulario.REQUIERE_REVISION,
    );
    expect(mockRespuesta.detalleError).toContain(
      'ya no pertenece al plan del formulario',
    );
  });

  it('si ocurre una excepción inesperada, guarda estado ERROR y no detiene las demás', async () => {
    const mockRespuesta1 = {
      id: 7,
      formularioId: 1,
      estado: EstadoRespuestaFormulario.PENDIENTE,
      procesadoAt: null,
      datosNormalizadosJson: {
        primerNombre: 'Error',
        segundoNombre: null,
        primerApellido: 'Test',
        segundoApellido: null,
        identificacion: '111111111',
        correoEstudiantil: 'err@est.una.ac.cr',
        contacto: null,
        periodoIngresoId: 20,
        asignaturasAprobadas: [],
        optativasNoDisciplinarias: null,
        requiereRevisionOptativas: false,
      },
    };

    const mockRespuesta2 = {
      id: 8,
      formularioId: 1,
      estado: EstadoRespuestaFormulario.PENDIENTE,
      procesadoAt: null,
      datosNormalizadosJson: {
        primerNombre: 'Valido',
        segundoNombre: null,
        primerApellido: 'Test',
        segundoApellido: null,
        identificacion: '222222222',
        correoEstudiantil: 'val@est.una.ac.cr',
        contacto: null,
        periodoIngresoId: 20,
        asignaturasAprobadas: [],
        optativasNoDisciplinarias: null,
        requiereRevisionOptativas: false,
      },
    };

    respuestaRepo.find.mockResolvedValue([mockRespuesta1, mockRespuesta2]);

    estudiantesImportacionService.ejecutarDesdeGoogleForms
      .mockRejectedValueOnce(new Error('Fallo crítico de base de datos'))
      .mockResolvedValueOnce({
        creados: 1,
        actualizados: 0,
        aprobacionesNuevas: 0,
        sinCambios: 0,
        errores: 0,
        filas: [{ fila: 2, accion: 'CREAR', errores: [] }],
      });

    const res = await service.procesar(formularioId, usuarioId);

    expect(res.errores).toBe(1);
    expect(res.procesadas).toBe(1);
    expect(mockRespuesta1.estado).toBe(EstadoRespuestaFormulario.ERROR);
    expect(mockRespuesta1.detalleError).toBe(
      'Fallo crítico de base de datos',
    );
    expect(mockRespuesta2.estado).toBe(EstadoRespuestaFormulario.PROCESADO);
  });
});
