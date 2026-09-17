import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PERMISOS_KEY } from '../permisos/decorators/permisos.decorator';
import { CrearFormularioEstudianteDto } from './dto/crear-formulario-estudiante.dto';
import { RechazarRespuestaFormularioDto } from './dto/rechazar-respuesta-formulario.dto';
import { FormulariosEstudiantesController } from './formularios-estudiantes.controller';
import { FormulariosEstudiantesProcesamientoService } from './formularios-estudiantes-procesamiento.service';
import { FormulariosEstudiantesService } from './formularios-estudiantes.service';
import { FormulariosEstudiantesSyncService } from './formularios-estudiantes-sync.service';

describe('FormulariosEstudiantesController', () => {
  let controller: FormulariosEstudiantesController;
  let reflector: Reflector;
  let service: {
    crear: jest.Mock;
    listar: jest.Mock;
    obtenerPorId: jest.Mock;
    cerrar: jest.Mock;
  };
  let syncService: {
    sincronizar: jest.Mock;
    listarRespuestas: jest.Mock;
  };
  let procesamientoService: {
    listarSolicitudes: jest.Mock;
    aprobarRespuesta: jest.Mock;
    rechazarRespuesta: jest.Mock;
  };

  beforeEach(() => {
    reflector = new Reflector();
    service = {
      crear: jest.fn(),
      listar: jest.fn(),
      obtenerPorId: jest.fn(),
      cerrar: jest.fn(),
    };
    syncService = {
      sincronizar: jest.fn(),
      listarRespuestas: jest.fn(),
    };
    procesamientoService = {
      listarSolicitudes: jest.fn(),
      aprobarRespuesta: jest.fn(),
      rechazarRespuesta: jest.fn(),
      contarSolicitudesPorPlan: jest.fn(),
    };

    controller = new FormulariosEstudiantesController(
      service as unknown as FormulariosEstudiantesService,
      syncService as unknown as FormulariosEstudiantesSyncService,
      procesamientoService as unknown as FormulariosEstudiantesProcesamientoService,
    );
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('seguridad a nivel de controlador', () => {
    it('requiere AuthGuard y PermisosGuard a nivel de controlador', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        FormulariosEstudiantesController,
      );
      expect(guards).toEqual([AuthGuard, PermisosGuard]);
    });
  });

  describe('listar', () => {
    it('delega al servicio con usuarioId extraído de req.user.sub', async () => {
      const mockReq = {
        user: {
          sub: 42,
        },
      } as any;

      const resultadoEsperado = [{ id: 1, titulo: 'Form 1' }];
      service.listar.mockResolvedValue(resultadoEsperado);

      const res = await controller.listar(mockReq);

      expect(service.listar).toHaveBeenCalledWith(42);
      expect(res).toBe(resultadoEsperado);
    });

    it('tiene configurado el decorador de permisos para FORMULARIOS_ESTUDIANTES_VER', () => {
      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        FormulariosEstudiantesController.prototype.listar,
      );
      expect(permisos).toEqual([PermisoSistema.FORMULARIOS_ESTUDIANTES_VER]);
    });
  });

  describe('listarSolicitudes', () => {
    it('delega al procesamientoService con usuarioId extraído de req.user.sub y filtros', async () => {
      const mockReq = {
        user: {
          sub: 42,
        },
      } as any;

      const resultadoEsperado = [{ id: 10, estado: 'PENDIENTE' }];
      procesamientoService.listarSolicitudes.mockResolvedValue(resultadoEsperado);

      const res = await controller.listarSolicitudes(mockReq, { carreraId: 5, planEstudioId: 10 });

      expect(procesamientoService.listarSolicitudes).toHaveBeenCalledWith(42, 5, 10);
      expect(res).toBe(resultadoEsperado);
    });

    it('tiene configurado el decorador de permisos para ESTUDIANTES_VER', () => {
      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        FormulariosEstudiantesController.prototype.listarSolicitudes,
      );
      expect(permisos).toEqual([PermisoSistema.ESTUDIANTES_VER]);
    });
  });

  describe('obtenerPorId', () => {
    it('delega al servicio con id y usuarioId extraído de req.user.sub', async () => {
      const mockReq = {
        user: {
          sub: 42,
        },
      } as any;

      const resultadoEsperado = { id: 1, titulo: 'Form 1' };
      service.obtenerPorId.mockResolvedValue(resultadoEsperado);

      const res = await controller.obtenerPorId(mockReq, 1);

      expect(service.obtenerPorId).toHaveBeenCalledWith(1, 42);
      expect(res).toBe(resultadoEsperado);
    });

    it('tiene configurado el decorador de permisos para FORMULARIOS_ESTUDIANTES_VER', () => {
      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        FormulariosEstudiantesController.prototype.obtenerPorId,
      );
      expect(permisos).toEqual([PermisoSistema.FORMULARIOS_ESTUDIANTES_VER]);
    });
  });

  describe('crear', () => {
    it('delega al servicio con usuarioId extraído de req.user.sub y el dto', async () => {
      const mockReq = {
        user: {
          sub: 42,
        },
      } as any;

      const dto: CrearFormularioEstudianteDto = {
        titulo: 'Formulario 2026',
        descripcion: 'Descripción del formulario para estudiantes',
        carreraId: 1,
        planEstudioId: 2,
      };

      const resultadoEsperado = { id: 99, titulo: 'Formulario 2026' };
      service.crear.mockResolvedValue(resultadoEsperado);

      const res = await controller.crear(mockReq, dto);

      expect(service.crear).toHaveBeenCalledWith(42, dto);
      expect(res).toBe(resultadoEsperado);
    });

    it('tiene configurado el decorador de permisos para FORMULARIOS_ESTUDIANTES_CREAR', () => {
      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        FormulariosEstudiantesController.prototype.crear,
      );
      expect(permisos).toEqual([PermisoSistema.FORMULARIOS_ESTUDIANTES_CREAR]);
    });
  });

  describe('sincronizar', () => {
    it('delega al syncService con id y req.user.sub', async () => {
      const mockReq = {
        user: {
          sub: 42,
        },
      } as any;

      const resultadoEsperado = {
        recibidasGoogle: 1,
        nuevas: 1,
        ignoradasExistentes: 0,
        pendientes: 1,
        requierenRevision: 0,
        errores: 0,
      };
      syncService.sincronizar.mockResolvedValue(resultadoEsperado);

      const res = await controller.sincronizar(mockReq, 1);

      expect(syncService.sincronizar).toHaveBeenCalledWith(1, 42);
      expect(res).toBe(resultadoEsperado);
    });

    it('tiene configurado el decorador de permisos para FORMULARIOS_ESTUDIANTES_GESTIONAR', () => {
      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        FormulariosEstudiantesController.prototype.sincronizar,
      );
      expect(permisos).toEqual([
        PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR,
      ]);
    });
  });

  describe('cerrar', () => {
    it('delega al service.cerrar con id y req.user.sub', async () => {
      const mockReq = {
        user: {
          sub: 42,
        },
      } as any;

      const resultadoEsperado = { id: 1, estado: 'CERRADO' };
      service.cerrar.mockResolvedValue(resultadoEsperado);

      const res = await controller.cerrar(mockReq, 1);

      expect(service.cerrar).toHaveBeenCalledWith(1, 42);
      expect(res).toBe(resultadoEsperado);
    });

    it('tiene configurado el decorador de permisos para FORMULARIOS_ESTUDIANTES_GESTIONAR', () => {
      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        FormulariosEstudiantesController.prototype.cerrar,
      );
      expect(permisos).toEqual([
        PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR,
      ]);
    });
  });

  describe('listarRespuestas', () => {
    it('delega al syncService con id y req.user.sub', async () => {
      const mockReq = {
        user: {
          sub: 42,
        },
      } as any;

      const resultadoEsperado = [{ id: 1 }];
      syncService.listarRespuestas.mockResolvedValue(resultadoEsperado);

      const res = await controller.listarRespuestas(mockReq, 1);

      expect(syncService.listarRespuestas).toHaveBeenCalledWith(1, 42);
      expect(res).toBe(resultadoEsperado);
    });

    it('tiene configurado el decorador de permisos para FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS', () => {
      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        FormulariosEstudiantesController.prototype.listarRespuestas,
      );
      expect(permisos).toEqual([
        PermisoSistema.FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS,
      ]);
    });
  });

  describe('aceptarRespuesta', () => {
    it('delega al procesamientoService con respuestaId y req.user.sub', async () => {
      const mockReq = {
        user: {
          sub: 42,
        },
      } as any;

      const resultadoEsperado = {
        respuestaId: 10,
        estado: 'PROCESADO',
        creados: 1,
        actualizados: 0,
        aprobacionesNuevas: 1,
      };
      procesamientoService.aprobarRespuesta.mockResolvedValue(resultadoEsperado);

      const res = await controller.aceptarRespuesta(mockReq, 10);

      expect(procesamientoService.aprobarRespuesta).toHaveBeenCalledWith(10, 42);
      expect(res).toBe(resultadoEsperado);
    });

    it('tiene configurado el decorador de permisos para ESTUDIANTES_GESTIONAR', () => {
      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        FormulariosEstudiantesController.prototype.aceptarRespuesta,
      );
      expect(permisos).toEqual([PermisoSistema.ESTUDIANTES_GESTIONAR]);
    });
  });

  describe('rechazarRespuesta', () => {
    it('delega al procesamientoService con respuestaId, req.user.sub y motivo', async () => {
      const mockReq = {
        user: {
          sub: 42,
        },
      } as any;

      const dto: RechazarRespuestaFormularioDto = {
        motivo: 'Datos inconsistentes',
      };

      const resultadoEsperado = {
        id: 10,
        estado: 'RECHAZADO',
        motivoRechazo: 'Datos inconsistentes',
      };
      procesamientoService.rechazarRespuesta.mockResolvedValue(resultadoEsperado);

      const res = await controller.rechazarRespuesta(mockReq, 10, dto);

      expect(procesamientoService.rechazarRespuesta).toHaveBeenCalledWith(
        10,
        42,
        'Datos inconsistentes',
      );
      expect(res).toBe(resultadoEsperado);
    });

    it('tiene configurado el decorador de permisos para ESTUDIANTES_GESTIONAR', () => {
      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        FormulariosEstudiantesController.prototype.rechazarRespuesta,
      );
      expect(permisos).toEqual([PermisoSistema.ESTUDIANTES_GESTIONAR]);
    });
  });

  describe('contarSolicitudesPorPlan', () => {
    it('delega al procesamientoService con usuarioId y carreraId', async () => {
      const mockReq = {
        user: {
          sub: 42,
        },
      } as any;

      const resultadoEsperado = [{ planEstudioId: 3, total: 5 }];
      procesamientoService.contarSolicitudesPorPlan.mockResolvedValue(
        resultadoEsperado,
      );

      const res = await controller.contarSolicitudesPorPlan(mockReq, 2);

      expect(procesamientoService.contarSolicitudesPorPlan).toHaveBeenCalledWith(
        42,
        2,
      );
      expect(res).toBe(resultadoEsperado);
    });

    it('tiene configurado el decorador de permisos para ESTUDIANTES_VER', () => {
      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        FormulariosEstudiantesController.prototype.contarSolicitudesPorPlan,
      );
      expect(permisos).toEqual([PermisoSistema.ESTUDIANTES_VER]);
    });
  });
});
