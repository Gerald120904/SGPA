import {
  ConflictException,
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
    findOne: jest.Mock;
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
    obtenerCarreraIdsConAlcance: jest.Mock;
  };

  const usuarioId = 10;
  const respuestaId = 1;

  const mockFormulario = {
    id: 1,
    carreraId: 2,
    planEstudioId: 3,
    carrera: { id: 2, nombre: 'Ingeniería en Sistemas' },
    planEstudio: { id: 3, nombre: 'Plan 2026' },
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

  const mockRespuestaBase = {
    id: respuestaId,
    formularioId: 1,
    formulario: { ...mockFormulario },
    estado: EstadoRespuestaFormulario.PENDIENTE,
    procesadoAt: null,
    revisadoPorUsuarioId: null,
    revisadoAt: null,
    motivoRechazo: null,
    detalleError: null,
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

  beforeEach(() => {
    formularioRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockFormulario }),
    };

    respuestaRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ ...mockRespuestaBase }),
      save: jest.fn(async (r) => r),
      createQueryBuilder: jest.fn(),
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
      obtenerCarreraIdsConAlcance: jest.fn().mockResolvedValue([2]),
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

  describe('listarSolicitudes', () => {
    it('retorna solicitudes pendientes/revisión en carreras con alcance', async () => {
      const solicitudes = [
        { ...mockRespuestaBase, id: 1 },
        {
          ...mockRespuestaBase,
          id: 2,
          estado: EstadoRespuestaFormulario.REQUIERE_REVISION,
        },
      ];
      respuestaRepo.find.mockResolvedValue(solicitudes);

      const res = await service.listarSolicitudes(usuarioId);

      expect(estructuraAcademicaService.obtenerCarreraIdsConAlcance).toHaveBeenCalledWith(usuarioId);
      expect(respuestaRepo.find).toHaveBeenCalledWith({
        where: {
          estado: expect.anything(),
          formulario: {
            carreraId: expect.anything(),
          },
        },
        relations: {
          formulario: {
            carrera: true,
            planEstudio: true,
          },
        },
        order: {
          createdAt: 'DESC',
        },
      });
      expect(res).toEqual(solicitudes);
    });

    it('retorna array vacío si el usuario no tiene carreras con alcance', async () => {
      estructuraAcademicaService.obtenerCarreraIdsConAlcance.mockResolvedValue([]);

      const res = await service.listarSolicitudes(usuarioId);

      expect(res).toEqual([]);
      expect(respuestaRepo.find).not.toHaveBeenCalled();
    });

    it('aplica filtros de carreraId y planEstudioId si son provistos', async () => {
      estructuraAcademicaService.obtenerCarreraIdsConAlcance.mockResolvedValue([1, 2]);
      respuestaRepo.find.mockResolvedValue([]);

      await service.listarSolicitudes(usuarioId, 1, 10);

      expect(respuestaRepo.find).toHaveBeenCalledWith({
        where: {
          estado: expect.anything(),
          formulario: {
            carreraId: 1,
            planEstudioId: 10,
          },
        },
        relations: {
          formulario: {
            carrera: true,
            planEstudio: true,
          },
        },
        order: {
          createdAt: 'DESC',
        },
      });
    });
  });

  describe('aprobarRespuesta', () => {
    it('PENDIENTE + aceptar: crea/actualiza estudiante y marca PROCESADO', async () => {
      const mockRespuesta = { ...mockRespuestaBase };
      respuestaRepo.findOne.mockResolvedValue(mockRespuesta);

      const res = await service.aprobarRespuesta(respuestaId, usuarioId);

      expect(res).toEqual({
        respuestaId: 1,
        estado: EstadoRespuestaFormulario.PROCESADO,
        creados: 1,
        actualizados: 0,
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
      expect(mockRespuesta.revisadoPorUsuarioId).toBe(usuarioId);
      expect(mockRespuesta.revisadoAt).toBeInstanceOf(Date);
      expect(mockRespuesta.procesadoAt).toBeInstanceOf(Date);
      expect(mockRespuesta.motivoRechazo).toBeNull();
      expect(mockRespuesta.detalleError).toBeNull();
    });

    it('REQUIERE_REVISION + aceptar: queda PROCESADO tras la revisión humana', async () => {
      const mockRespuesta = {
        ...mockRespuestaBase,
        estado: EstadoRespuestaFormulario.REQUIERE_REVISION,
      };
      respuestaRepo.findOne.mockResolvedValue(mockRespuesta);

      const res = await service.aprobarRespuesta(respuestaId, usuarioId);

      expect(res.estado).toBe(EstadoRespuestaFormulario.PROCESADO);
      expect(mockRespuesta.estado).toBe(EstadoRespuestaFormulario.PROCESADO);
      expect(mockRespuesta.revisadoPorUsuarioId).toBe(usuarioId);
    });

    it('PROCESADO + aceptar nuevamente: lanza ConflictException', async () => {
      const mockRespuesta = {
        ...mockRespuestaBase,
        estado: EstadoRespuestaFormulario.PROCESADO,
      };
      respuestaRepo.findOne.mockResolvedValue(mockRespuesta);

      await expect(
        service.aprobarRespuesta(respuestaId, usuarioId),
      ).rejects.toThrow(ConflictException);

      expect(
        estudiantesImportacionService.ejecutarDesdeGoogleForms,
      ).not.toHaveBeenCalled();
    });

    it('RECHAZADO + aceptar: lanza ConflictException', async () => {
      const mockRespuesta = {
        ...mockRespuestaBase,
        estado: EstadoRespuestaFormulario.RECHAZADO,
      };
      respuestaRepo.findOne.mockResolvedValue(mockRespuesta);

      await expect(
        service.aprobarRespuesta(respuestaId, usuarioId),
      ).rejects.toThrow(ConflictException);

      expect(
        estudiantesImportacionService.ejecutarDesdeGoogleForms,
      ).not.toHaveBeenCalled();
    });

    it('estudiante con error de validación/conflicto: marca REQUIERE_REVISION y lanza ConflictException', async () => {
      const mockRespuesta = { ...mockRespuestaBase };
      respuestaRepo.findOne.mockResolvedValue(mockRespuesta);

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
            errores: ['El estudiante pertenece a otra carrera o plan.'],
          },
        ],
      });

      await expect(
        service.aprobarRespuesta(respuestaId, usuarioId),
      ).rejects.toThrow(ConflictException);

      expect(mockRespuesta.estado).toBe(
        EstadoRespuestaFormulario.REQUIERE_REVISION,
      );
      expect(mockRespuesta.detalleError).toBe(
        'El estudiante pertenece a otra carrera o plan.',
      );
    });

    it('usuario fuera del alcance: lanza ForbiddenException', async () => {
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(false);

      await expect(
        service.aprobarRespuesta(respuestaId, usuarioId),
      ).rejects.toThrow(ForbiddenException);

      expect(
        estudiantesImportacionService.ejecutarDesdeGoogleForms,
      ).not.toHaveBeenCalled();
    });

    it('solicitud no existente: lanza NotFoundException', async () => {
      respuestaRepo.findOne.mockResolvedValue(null);

      await expect(
        service.aprobarRespuesta(respuestaId, usuarioId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rechazarRespuesta', () => {
    it('PENDIENTE + rechazar: marca RECHAZADO y no llama a EstudiantesImportacionService', async () => {
      const mockRespuesta = { ...mockRespuestaBase };
      respuestaRepo.findOne.mockResolvedValue(mockRespuesta);

      const res = await service.rechazarRespuesta(
        respuestaId,
        usuarioId,
        'Información inconsistente',
      );

      expect(res.estado).toBe(EstadoRespuestaFormulario.RECHAZADO);
      expect(mockRespuesta.estado).toBe(EstadoRespuestaFormulario.RECHAZADO);
      expect(mockRespuesta.revisadoPorUsuarioId).toBe(usuarioId);
      expect(mockRespuesta.revisadoAt).toBeInstanceOf(Date);
      expect(mockRespuesta.motivoRechazo).toBe('Información inconsistente');
      expect(mockRespuesta.procesadoAt).toBeNull();
      expect(
        estudiantesImportacionService.ejecutarDesdeGoogleForms,
      ).not.toHaveBeenCalled();
    });

    it('PROCESADO + rechazar: lanza ConflictException', async () => {
      const mockRespuesta = {
        ...mockRespuestaBase,
        estado: EstadoRespuestaFormulario.PROCESADO,
      };
      respuestaRepo.findOne.mockResolvedValue(mockRespuesta);

      await expect(
        service.rechazarRespuesta(respuestaId, usuarioId),
      ).rejects.toThrow(ConflictException);
    });

    it('usuario fuera de alcance al rechazar: lanza ForbiddenException', async () => {
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(false);

      await expect(
        service.rechazarRespuesta(respuestaId, usuarioId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('solicitud inexistente al rechazar: lanza NotFoundException', async () => {
      respuestaRepo.findOne.mockResolvedValue(null);

      await expect(
        service.rechazarRespuesta(respuestaId, usuarioId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('contarSolicitudesPorPlan', () => {
    it('retorna conteos de solicitudes agrupados por plan para una carrera con alcance', async () => {
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(true);
      const mockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { planEstudioId: '3', total: '5' },
          { planEstudioId: '4', total: '2' },
        ]),
      };
      respuestaRepo.createQueryBuilder.mockReturnValue(mockQb);

      const res = await service.contarSolicitudesPorPlan(usuarioId, 2);

      expect(res).toEqual([
        { planEstudioId: 3, total: 5 },
        { planEstudioId: 4, total: 2 },
      ]);
      expect(mockQb.innerJoin).toHaveBeenCalledWith(
        'respuesta.formulario',
        'formulario',
      );
      expect(mockQb.where).toHaveBeenCalledWith(
        'formulario.carreraId = :carreraId',
        { carreraId: 2 },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'respuesta.estado IN (:...estados)',
        {
          estados: [
            EstadoRespuestaFormulario.PENDIENTE,
            EstadoRespuestaFormulario.REQUIERE_REVISION,
          ],
        },
      );
    });

    it('usuario fuera de alcance: lanza ForbiddenException', async () => {
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(false);

      await expect(
        service.contarSolicitudesPorPlan(usuarioId, 99),
      ).rejects.toThrow(ForbiddenException);
      expect(respuestaRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
