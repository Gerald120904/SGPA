import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PERMISOS_KEY } from '../permisos/decorators/permisos.decorator';
import { CrearFormularioEstudianteDto } from './dto/crear-formulario-estudiante.dto';
import { FormulariosEstudiantesController } from './formularios-estudiantes.controller';
import { FormulariosEstudiantesService } from './formularios-estudiantes.service';
import { FormulariosEstudiantesSyncService } from './formularios-estudiantes-sync.service';

describe('FormulariosEstudiantesController', () => {
  let controller: FormulariosEstudiantesController;
  let reflector: Reflector;
  let service: {
    crear: jest.Mock;
  };
  let syncService: Record<string, jest.Mock>;

  beforeEach(() => {
    reflector = new Reflector();
    service = {
      crear: jest.fn(),
    };
    syncService = {};

    controller = new FormulariosEstudiantesController(
      service as unknown as FormulariosEstudiantesService,
      syncService as unknown as FormulariosEstudiantesSyncService,
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
});
