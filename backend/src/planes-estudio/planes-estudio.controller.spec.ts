import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PlanesEstudioController } from './planes-estudio.controller';
import { PlanesEstudioService } from './planes-estudio.service';

describe('PlanesEstudioController', () => {
  const jwtSecret = 'planes-estudio-controller-test-secret';
  const service = {
    listar: jest.fn(),
    obtenerPorId: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    cambiarEstado: jest.fn(),
  };

  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: jwtSecret })],
      controllers: [PlanesEstudioController],
      providers: [
        AuthGuard,
        RolesGuard,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(jwtSecret) },
        },
        { provide: PlanesEstudioService, useValue: service },
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
    service.listar.mockResolvedValue([]);
    service.obtenerPorId.mockResolvedValue({ id: 1 });
    service.crear.mockResolvedValue({ id: 1 });
    service.actualizar.mockResolvedValue({ id: 1 });
    service.cambiarEstado.mockResolvedValue({ id: 1 });
  });

  afterAll(async () => {
    await app.close();
  });

  async function token(rol: string) {
    return jwtService.signAsync({
      sub: 1,
      correo: 'usuario@sgpa.local',
      roles: [rol],
    });
  }

  it('responde 401 sin JWT', async () => {
    await request(app.getHttpServer()).get('/planes-estudio').expect(401);
  });

  it.each(['ADMIN_GLOBAL', 'COORDINADOR'])('permite el rol %s', async (rol) => {
    await request(app.getHttpServer())
      .get('/planes-estudio')
      .set('Authorization', `Bearer ${await token(rol)}`)
      .expect(200, []);
  });

  it.each(['PROFESOR', 'ESTUDIANTE'])('responde 403 para %s', async (rol) => {
    await request(app.getHttpServer())
      .get('/planes-estudio')
      .set('Authorization', `Bearer ${await token(rol)}`)
      .expect(403);
  });

  it('crea un plan válido', async () => {
    const dto = {
      carreraId: 1,
      codigo: 'BA-INFORM 2012-10',
      nombre: 'Plan de Bachillerato 2012-10',
    };

    await request(app.getHttpServer())
      .post('/planes-estudio')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send(dto)
      .expect(201, { id: 1 });

    expect(service.crear).toHaveBeenCalledWith(dto);
  });

  it('rechaza crear un plan sin carrera', async () => {
    await request(app.getHttpServer())
      .post('/planes-estudio')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({
        codigo: 'BA-INFORM 2012-10',
        nombre: 'Plan de Bachillerato',
      })
      .expect(400);

    expect(service.crear).not.toHaveBeenCalled();
  });

  it('rechaza carreraId menor a 1', async () => {
    await request(app.getHttpServer())
      .post('/planes-estudio')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({
        carreraId: 0,
        codigo: 'BA-INFORM 2012-10',
        nombre: 'Plan de Bachillerato',
      })
      .expect(400);

    expect(service.crear).not.toHaveBeenCalled();
  });

  it('consulta un plan por id', async () => {
    await request(app.getHttpServer())
      .get('/planes-estudio/1')
      .set('Authorization', `Bearer ${await token('ADMIN_GLOBAL')}`)
      .expect(200, { id: 1 });

    expect(service.obtenerPorId).toHaveBeenCalledWith(1);
  });

  it('rechaza un id inválido', async () => {
    await request(app.getHttpServer())
      .get('/planes-estudio/no-es-id')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .expect(400);

    expect(service.obtenerPorId).not.toHaveBeenCalled();
  });

  it('actualiza un plan', async () => {
    const dto = {
      nombre: 'Plan actualizado',
    };

    await request(app.getHttpServer())
      .patch('/planes-estudio/1')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send(dto)
      .expect(200, { id: 1 });

    expect(service.actualizar).toHaveBeenCalledWith(1, dto);
  });

  it('rechaza carreraId durante la actualización', async () => {
    await request(app.getHttpServer())
      .patch('/planes-estudio/1')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({
        nombre: 'Plan actualizado',
        carreraId: 2,
      })
      .expect(400);

    expect(service.actualizar).not.toHaveBeenCalled();
  });

  it('cambia el estado de un plan', async () => {
    await request(app.getHttpServer())
      .patch('/planes-estudio/1/estado')
      .set('Authorization', `Bearer ${await token('ADMIN_GLOBAL')}`)
      .send({ activo: false })
      .expect(200, { id: 1 });

    expect(service.cambiarEstado).toHaveBeenCalledWith(1, false);
  });

  it('rechaza estado que no sea boolean', async () => {
    await request(app.getHttpServer())
      .patch('/planes-estudio/1/estado')
      .set('Authorization', `Bearer ${await token('ADMIN_GLOBAL')}`)
      .send({ activo: 'no' })
      .expect(400);

    expect(service.cambiarEstado).not.toHaveBeenCalled();
  });
});
