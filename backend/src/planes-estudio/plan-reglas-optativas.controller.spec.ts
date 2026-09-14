import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisosService } from '../permisos/permisos.service';
import { PlanReglasOptativasController } from './plan-reglas-optativas.controller';
import { PlanReglasOptativasService } from './plan-reglas-optativas.service';

describe('PlanReglasOptativasController', () => {
  const jwtSecret = 'test-secret';

  const reglasService = {
    obtener: jest.fn(),
    guardar: jest.fn(),
    eliminar: jest.fn(),
  };

  let permisosAsignados: Set<PermisoSistema>;

  const permisosService = {
    usuarioTienePermisos: jest.fn(),
  };

  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: jwtSecret,
        }),
      ],
      controllers: [PlanReglasOptativasController],
      providers: [
        AuthGuard,
        PermisosGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(jwtSecret),
          },
        },
        {
          provide: PermisosService,
          useValue: permisosService,
        },
        {
          provide: PlanReglasOptativasService,
          useValue: reglasService,
        },
      ],
    }).compile();

    app = module.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    jwtService = module.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    permisosAsignados = new Set<PermisoSistema>([
      PermisoSistema.PLANES_ESTUDIO_VER,
      PermisoSistema.PLANES_ESTUDIO_GESTIONAR,
    ]);
    permisosService.usuarioTienePermisos.mockImplementation(
      async (_usuarioId, requeridos: PermisoSistema[]) =>
        requeridos.every((p) => permisosAsignados.has(p)),
    );
  });

  const generarToken = (rol: string = 'ADMIN_GLOBAL') =>
    jwtService.sign({
      sub: 1,
      email: 'admin@correo.una.ac.cr',
      roles: [rol],
    });

  it('GET /planes-estudio/:planId/regla-optativas - obtiene la regla del plan con PLANES_ESTUDIO_VER', async () => {
    const data = {
      regla: { id: 1, minimoDisciplinariasPropias: 2 },
      cantidadEspaciosOptativos: 4,
    };
    reglasService.obtener.mockResolvedValue(data);

    const response = await request(app.getHttpServer())
      .get('/planes-estudio/1/regla-optativas')
      .set('Authorization', `Bearer ${generarToken('ESTUDIANTE')}`)
      .expect(200);

    expect(response.body).toEqual(data);
    expect(reglasService.obtener).toHaveBeenCalledWith(1);
  });

  it('GET /planes-estudio/:planId/regla-optativas - rechaza sin PLANES_ESTUDIO_VER', async () => {
    permisosAsignados.clear();
    await request(app.getHttpServer())
      .get('/planes-estudio/1/regla-optativas')
      .set('Authorization', `Bearer ${generarToken('ESTUDIANTE')}`)
      .expect(403);
  });

  it('PUT /planes-estudio/:planId/regla-optativas - guarda la regla del plan con PLANES_ESTUDIO_GESTIONAR', async () => {
    const regla = {
      id: 1,
      planEstudioId: 1,
      minimoDisciplinariasPropias: 2,
      maximoOtrasAreas: 2,
    };
    reglasService.guardar.mockResolvedValue(regla);

    const response = await request(app.getHttpServer())
      .put('/planes-estudio/1/regla-optativas')
      .set('Authorization', `Bearer ${generarToken('COORDINADOR')}`)
      .send({
        minimoDisciplinariasPropias: 2,
        maximoOtrasAreas: 2,
      })
      .expect(200);

    expect(response.body).toEqual(regla);
    expect(reglasService.guardar).toHaveBeenCalledWith(1, {
      minimoDisciplinariasPropias: 2,
      maximoOtrasAreas: 2,
    });
  });

  it('DELETE /planes-estudio/:planId/regla-optativas - elimina la regla con PLANES_ESTUDIO_GESTIONAR', async () => {
    reglasService.eliminar.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/planes-estudio/1/regla-optativas')
      .set('Authorization', `Bearer ${generarToken('COORDINADOR')}`)
      .expect(204);

    expect(reglasService.eliminar).toHaveBeenCalledWith(1);
  });
});
