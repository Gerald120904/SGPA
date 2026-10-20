import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PlanValidacionesController } from './plan-validaciones.controller';
import { PlanValidacionesService } from './plan-validaciones.service';
import { PlanesAlcanceGuard } from './guards/planes-alcance.guard';

describe('PlanValidacionesController', () => {
  const service = { validar: jest.fn() };
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlanValidacionesController],
      providers: [{ provide: PlanValidacionesService, useValue: service },
        { provide: PlanesAlcanceGuard, useValue: { canActivate: () => true } }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermisosGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('GET /planes-estudio/:planId/validaciones devuelve 200 para un plan válido', async () => {
    const resultado = {
      valido: true,
      totalErrores: 0,
      totalAdvertencias: 0,
      errores: [],
      advertencias: [],
    };
    service.validar.mockResolvedValue(resultado);

    const response = await request(app.getHttpServer())
      .get('/planes-estudio/21/validaciones')
      .expect(200);

    expect(response.body).toEqual(resultado);
    expect(service.validar).toHaveBeenCalledWith(21);
  });

  it('GET /planes-estudio/:planId/validaciones rechaza un identificador no numérico', async () => {
    await request(app.getHttpServer())
      .get('/planes-estudio/no-es-numero/validaciones')
      .expect(400);

    expect(service.validar).not.toHaveBeenCalled();
  });
});
