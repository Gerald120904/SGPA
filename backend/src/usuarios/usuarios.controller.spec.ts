import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

describe('UsuariosController', () => {
  const jwtSecret = 'usuarios-controller-test-secret';
  const usuariosService = {
    listar: jest.fn(),
  };

  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: jwtSecret })],
      controllers: [UsuariosController],
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
          provide: UsuariosService,
          useValue: usuariosService,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    jwtService = module.get(JwtService);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuariosService.listar.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 401 cuando no existe JWT', async () => {
    await request(app.getHttpServer()).get('/usuarios').expect(401);

    expect(usuariosService.listar).not.toHaveBeenCalled();
  });

  it.each([
    'COORDINADOR',
    'PROFESOR',
    'ESTUDIANTE',
  ])('responde 403 para %s', async (rol) => {
    const token = await jwtService.signAsync({
      sub: 2,
      correo: 'usuario@sgpa.local',
      roles: [rol],
    });

    await request(app.getHttpServer())
      .get('/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(usuariosService.listar).not.toHaveBeenCalled();
  });

  it('responde 200 para ADMIN_GLOBAL', async () => {
    const token = await jwtService.signAsync({
      sub: 1,
      correo: 'admin@sgpa.local',
      roles: ['ADMIN_GLOBAL'],
    });

    await request(app.getHttpServer())
      .get('/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(usuariosService.listar).toHaveBeenCalledTimes(1);
  });
});
