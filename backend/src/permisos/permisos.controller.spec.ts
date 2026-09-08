import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  PermisoSistema,
  PERMISOS_SISTEMA,
} from './constants/permisos.constant';
import { PermisosController } from './permisos.controller';
import { PermisosService } from './permisos.service';

describe('PermisosController', () => {
  const jwtSecret = 'permisos-test-secret';

  const permisosService = {
    obtenerCatalogo: jest.fn(),
    listarUsuario: jest.fn(),
    reemplazarPermisos: jest.fn(),
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
      controllers: [PermisosController],
      providers: [
        AuthGuard,
        RolesGuard,
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

    jwtService = module.get(JwtService);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    permisosService.obtenerCatalogo.mockReturnValue(PERMISOS_SISTEMA);
    permisosService.listarUsuario.mockResolvedValue([]);
    permisosService.reemplazarPermisos.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  async function crearToken(roles: string[], sub = 1) {
    return jwtService.signAsync({
      sub,
      correo: 'admin@sgpa.local',
      roles,
    });
  }

  it('GET /permisos/catalogo - permite a ADMIN_GLOBAL', async () => {
    const token = await crearToken(['ADMIN_GLOBAL']);

    await request(app.getHttpServer())
      .get('/permisos/catalogo')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, PERMISOS_SISTEMA);

    expect(permisosService.obtenerCatalogo).toHaveBeenCalled();
  });

  it('GET /permisos/catalogo - rechaza a COORDINADOR', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/permisos/catalogo')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /permisos/usuarios/:usuarioId - permite a ADMIN_GLOBAL', async () => {
    const token = await crearToken(['ADMIN_GLOBAL']);

    await request(app.getHttpServer())
      .get('/permisos/usuarios/10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(permisosService.listarUsuario).toHaveBeenCalledWith(10);
  });

  it('PUT /permisos/usuarios/:usuarioId - actualiza permisos', async () => {
    const token = await crearToken(['ADMIN_GLOBAL']);

    await request(app.getHttpServer())
      .put('/permisos/usuarios/10')
      .set('Authorization', `Bearer ${token}`)
      .send({
        permisos: [
          PermisoSistema.PROFESORES_VER,
          PermisoSistema.ATESTADOS_VALIDAR,
        ],
      })
      .expect(200);

    expect(permisosService.reemplazarPermisos).toHaveBeenCalledWith(10, [
      PermisoSistema.PROFESORES_VER,
      PermisoSistema.ATESTADOS_VALIDAR,
    ]);
  });
});
