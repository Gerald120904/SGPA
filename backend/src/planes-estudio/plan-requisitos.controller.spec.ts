import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TipoRequisito } from './constants/tipo-requisito.constant';
import { PlanRequisitosController } from './plan-requisitos.controller';
import { PlanRequisitosService } from './plan-requisitos.service';

describe('PlanRequisitosController', () => {
  const jwtSecret = 'plan-requisitos-test-secret';
  const service = {
    listar: jest.fn(),
    crear: jest.fn(),
    cargaMasiva: jest.fn(),
    eliminar: jest.fn(),
  };
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: jwtSecret })],
      controllers: [PlanRequisitosController],
      providers: [
        AuthGuard,
        RolesGuard,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(jwtSecret) },
        },
        { provide: PlanRequisitosService, useValue: service },
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
    service.crear.mockResolvedValue({ id: 5 });
    service.cargaMasiva.mockResolvedValue({ total: 2 });
    service.eliminar.mockResolvedValue({
      message: 'Relación académica eliminada correctamente.',
    });
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
    await request(app.getHttpServer())
      .get('/planes-estudio/1/requisitos')
      .expect(401);

    expect(service.listar).not.toHaveBeenCalled();
  });

  it.each(['ADMIN_GLOBAL', 'COORDINADOR'])('permite el rol %s', async (rol) => {
    await request(app.getHttpServer())
      .get('/planes-estudio/1/requisitos')
      .set('Authorization', `Bearer ${await token(rol)}`)
      .expect(200, []);

    expect(service.listar).toHaveBeenCalledWith(1);
  });

  it.each(['PROFESOR', 'ESTUDIANTE'])('responde 403 para %s', async (rol) => {
    await request(app.getHttpServer())
      .get('/planes-estudio/1/requisitos')
      .set('Authorization', `Bearer ${await token(rol)}`)
      .expect(403);

    expect(service.listar).not.toHaveBeenCalled();
  });

  it('crea un requisito válido', async () => {
    const dto = {
      asignaturaId: 20,
      requisitoAsignaturaId: 10,
      tipo: TipoRequisito.REQUISITO,
    };

    await request(app.getHttpServer())
      .post('/planes-estudio/1/requisitos')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send(dto)
      .expect(201, { id: 5 });

    expect(service.crear).toHaveBeenCalledWith(1, dto);
  });

  it('crea un correquisito válido', async () => {
    const dto = {
      asignaturaId: 20,
      requisitoAsignaturaId: 10,
      tipo: TipoRequisito.CORREQUISITO,
    };

    await request(app.getHttpServer())
      .post('/planes-estudio/1/requisitos')
      .set('Authorization', `Bearer ${await token('ADMIN_GLOBAL')}`)
      .send(dto)
      .expect(201, { id: 5 });

    expect(service.crear).toHaveBeenCalledWith(1, dto);
  });

  it('rechaza un tipo de relación inválido', async () => {
    await request(app.getHttpServer())
      .post('/planes-estudio/1/requisitos')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({
        asignaturaId: 20,
        requisitoAsignaturaId: 10,
        tipo: 'INVENTADO',
      })
      .expect(400);

    expect(service.crear).not.toHaveBeenCalled();
  });

  it('rechaza identificadores fuera de rango', async () => {
    await request(app.getHttpServer())
      .post('/planes-estudio/1/requisitos')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({
        asignaturaId: 0,
        requisitoAsignaturaId: -1,
        tipo: TipoRequisito.REQUISITO,
      })
      .expect(400);

    expect(service.crear).not.toHaveBeenCalled();
  });

  it('carga varias relaciones válidas', async () => {
    const dto = {
      requisitos: [
        {
          asignaturaId: 20,
          requisitoAsignaturaId: 10,
          tipo: TipoRequisito.REQUISITO,
        },
        {
          asignaturaId: 30,
          requisitoAsignaturaId: 20,
          tipo: TipoRequisito.CORREQUISITO,
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/planes-estudio/1/requisitos/carga-masiva')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send(dto)
      .expect(201, { total: 2 });

    expect(service.cargaMasiva).toHaveBeenCalledWith(1, dto);
  });

  it('rechaza una carga masiva vacía', async () => {
    await request(app.getHttpServer())
      .post('/planes-estudio/1/requisitos/carga-masiva')
      .set('Authorization', `Bearer ${await token('ADMIN_GLOBAL')}`)
      .send({ requisitos: [] })
      .expect(400);

    expect(service.cargaMasiva).not.toHaveBeenCalled();
  });

  it('elimina una relación por id', async () => {
    await request(app.getHttpServer())
      .delete('/planes-estudio/1/requisitos/5')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .expect(200, {
        message: 'Relación académica eliminada correctamente.',
      });

    expect(service.eliminar).toHaveBeenCalledWith(1, 5);
  });

  it('rechaza un planId no numérico', async () => {
    await request(app.getHttpServer())
      .delete('/planes-estudio/no-es-id/requisitos/5')
      .set('Authorization', `Bearer ${await token('ADMIN_GLOBAL')}`)
      .expect(400);

    expect(service.eliminar).not.toHaveBeenCalled();
  });

  it('rechaza parámetros de ruta inválidos', async () => {
    await request(app.getHttpServer())
      .delete('/planes-estudio/1/requisitos/no-es-id')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .expect(400);

    expect(service.eliminar).not.toHaveBeenCalled();
  });
});
