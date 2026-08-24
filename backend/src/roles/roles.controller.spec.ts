import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

describe('RolesController', () => {
  const jwtSecret = 'roles-controller-test-secret';
  const rolesService = {
    listar: jest.fn(),
  };

  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: jwtSecret })],
      controllers: [RolesController],
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
          provide: RolesService,
          useValue: rolesService,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    jwtService = module.get(JwtService);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    rolesService.listar.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 401 sin JWT', async () => {
    await request(app.getHttpServer()).get('/roles').expect(401);
  });

  it('responde 403 para COORDINADOR', async () => {
    const token = await jwtService.signAsync({
      sub: 2,
      correo: 'coordinador@sgpa.local',
      roles: ['COORDINADOR'],
    });

    await request(app.getHttpServer())
      .get('/roles')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('responde 200 para ADMIN_GLOBAL', async () => {
    const token = await jwtService.signAsync({
      sub: 1,
      correo: 'admin@sgpa.local',
      roles: ['ADMIN_GLOBAL'],
    });

    await request(app.getHttpServer())
      .get('/roles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(rolesService.listar).toHaveBeenCalledTimes(1);
  });
});
