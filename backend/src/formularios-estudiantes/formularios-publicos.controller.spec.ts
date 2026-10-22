import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { EnviarRespuestaPublicaDto } from './dto/enviar-respuesta-publica.dto';
import { FormulariosEstudiantesController } from './formularios-estudiantes.controller';
import { FormulariosEstudiantesProcesamientoService } from './formularios-estudiantes-procesamiento.service';
import { FormulariosEstudiantesService } from './formularios-estudiantes.service';
import { FormulariosEstudiantesSyncService } from './formularios-estudiantes-sync.service';
import { FormulariosPublicosController } from './formularios-publicos.controller';
import { FormulariosPublicosService } from './formularios-publicos.service';

describe('FormulariosPublicosController (Subfases 3A y 3B - Endpoints y Aislamiento)', () => {
  let controller: FormulariosPublicosController;
  let service: jest.Mocked<FormulariosPublicosService>;

  const tokenValido = 'b'.repeat(64);

  beforeEach(async () => {
    service = {
      consultarFormularioPublico: jest.fn(),
      registrarRespuestaPublica: jest.fn(),
    } as unknown as jest.Mocked<FormulariosPublicosService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormulariosPublicosController],
      providers: [
        {
          provide: FormulariosPublicosService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<FormulariosPublicosController>(
      FormulariosPublicosController,
    );
  });

  it('delega consultarFormulario al servicio de formularios públicos', async () => {
    service.consultarFormularioPublico.mockResolvedValueOnce({
      formulario: { titulo: 'Prueba', descripcion: 'Desc' },
      carrera: { id: 1, nombre: 'Carrera', codigo: 'C1' },
      planEstudio: { id: 2, nombre: 'Plan', anioAprobacion: 2024 },
      periodos: [],
      catalogo: [],
    } as any);

    const res = await controller.consultarFormulario(tokenValido);
    expect(service.consultarFormularioPublico).toHaveBeenCalledWith(tokenValido);
    expect(res.formulario.titulo).toBe('Prueba');
  });

  it('delega enviarRespuesta al servicio de formularios públicos', async () => {
    const dto: EnviarRespuestaPublicaDto = {
      identificacion: '401230456',
      primerNombre: 'Carlos',
      primerApellido: 'Soto',
      correoEstudiantil: 'csoto@universidad.ac.cr',
      periodoIngresoId: 1,
      asignaturasAprobadasIds: [10],
    };

    service.registrarRespuestaPublica.mockResolvedValueOnce({
      mensaje: 'Registrado con éxito',
      codigoConfirmacion: 'INT-uuid-456',
      estado: 'PENDIENTE' as any,
    });

    const res = await controller.enviarRespuesta(tokenValido, dto);
    expect(service.registrarRespuestaPublica).toHaveBeenCalledWith(tokenValido, dto);
    expect(res.codigoConfirmacion).toBe('INT-uuid-456');
  });

  it('garantiza que las rutas públicas no exigen AuthGuard administrativo', () => {
    const guards = Reflect.getMetadata('__guards__', FormulariosPublicosController) || [];
    const tieneAuthGuard = guards.some((g: any) => g === AuthGuard || g?.name === 'AuthGuard');
    const tienePermisosGuard = guards.some(
      (g: any) => g === PermisosGuard || g?.name === 'PermisosGuard',
    );

    expect(tieneAuthGuard).toBe(false);
    expect(tienePermisosGuard).toBe(false);
  });

  it('garantiza que el controlador administrativo de FormulariosEstudiantes SI protege sus rutas con AuthGuard y PermisosGuard', () => {
    const adminGuards =
      Reflect.getMetadata('__guards__', FormulariosEstudiantesController) || [];
    const tieneAuthGuard = adminGuards.some(
      (g: any) => g === AuthGuard || g?.name === 'AuthGuard',
    );
    const tienePermisosGuard = adminGuards.some(
      (g: any) => g === PermisosGuard || g?.name === 'PermisosGuard',
    );

    expect(tieneAuthGuard).toBe(true);
    expect(tienePermisosGuard).toBe(true);
  });
});
