import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PERMISOS_KEY } from '../permisos/decorators/permisos.decorator';
import { CrearFormularioEstudianteDto } from './dto/crear-formulario-estudiante.dto';
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
    procesar: jest.Mock;
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
      procesar: jest.fn(),
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

  describe('procesar', () => {
    it('delega al procesamientoService con id y req.user.sub', async () => {
      const mockReq = {
        user: {
          sub: 42,
        },
      } as any;

      const resultadoEsperado = {
        candidatas: 1,
        procesadas: 1,
        omitidasYaProcesadas: 0,
        requierenRevision: 0,
        errores: 0,
        estudiantesCreados: 1,
        estudiantesActualizados: 0,
        aprobacionesNuevas: 2,
      };
      procesamientoService.procesar.mockResolvedValue(resultadoEsperado);

      const res = await controller.procesar(mockReq, 1);

      expect(procesamientoService.procesar).toHaveBeenCalledWith(1, 42);
      expect(res).toBe(resultadoEsperado);
    });

    it('tiene configurado el decorador de permisos para FORMULARIOS_ESTUDIANTES_GESTIONAR', () => {
      const permisos = reflector.get<PermisoSistema[]>(
        PERMISOS_KEY,
        FormulariosEstudiantesController.prototype.procesar,
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
});
