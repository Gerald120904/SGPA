import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from './auth/guards/auth.guard';
import { PermisosGuard } from './permisos/guards/permisos.guard';
import { EstudiantesModule } from './estudiantes/estudiantes.module';
import { EstudiantesController } from './estudiantes/estudiantes.controller';
import { EstudiantesService } from './estudiantes/estudiantes.service';
import { BandejaRevisionEstudiantesController } from './estudiantes/bandeja-revision-estudiantes.controller';
import { BandejaRevisionEstudiantesService } from './estudiantes/bandeja-revision-estudiantes.service';
import { PlanesEstudioModule } from './planes-estudio/planes-estudio.module';
import { PlanesEstudioController } from './planes-estudio/planes-estudio.controller';
import { PlanesEstudioService } from './planes-estudio/planes-estudio.service';
import { EquivalenciasController } from './planes-estudio/equivalencias.controller';
import { EquivalenciasService } from './planes-estudio/equivalencias.service';
import { PlanesAlcanceGuard } from './planes-estudio/guards/planes-alcance.guard';

describe('rutas de bandeja y equivalencias', () => {
  let app: INestApplication;
  const listarBandeja = jest.fn().mockResolvedValue([]);
  const listarPorPlanes = jest.fn().mockResolvedValue([]);

  beforeAll(async () => {
    const estudiantes = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, EstudiantesModule) as Function[];
    const planes = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PlanesEstudioModule) as Function[];
    expect(estudiantes.indexOf(BandejaRevisionEstudiantesController)).toBeLessThan(estudiantes.indexOf(EstudiantesController));
    expect(planes.indexOf(EquivalenciasController)).toBeLessThan(planes.indexOf(PlanesEstudioController));

    const module = await Test.createTestingModule({
      controllers: [
        ...estudiantes.filter((controller) => [BandejaRevisionEstudiantesController, EstudiantesController].includes(controller as never)),
        ...planes.filter((controller) => [EquivalenciasController, PlanesEstudioController].includes(controller as never)),
      ] as never[],
      providers: [
        { provide: BandejaRevisionEstudiantesService, useValue: { listarBandeja } },
        { provide: EstudiantesService, useValue: {} },
        { provide: EquivalenciasService, useValue: { listarPorPlanes } },
        { provide: PlanesEstudioService, useValue: {} },
        { provide: PlanesAlcanceGuard, useValue: { canActivate: () => true } },
      ],
    })
      .overrideGuard(AuthGuard).useValue({ canActivate: (context: any) => {
        context.switchToHttp().getRequest().user = { sub: 1 };
        return true;
      } })
      .overrideGuard(PermisosGuard).useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { await app?.close(); });
  beforeEach(() => { listarBandeja.mockClear(); listarPorPlanes.mockClear(); });

  it('lista la bandeja sin filtros y sin registros', async () => {
    const response = await request(app.getHttpServer()).get('/estudiantes/bandeja-revision').expect(200);
    expect(response.body).toEqual([]);
    expect(listarBandeja).toHaveBeenCalledWith(1, {});
  });

  it('acepta filtros válidos y rechaza los inválidos', async () => {
    await request(app.getHttpServer()).get('/estudiantes/bandeja-revision?carreraId=2&planEstudioId=3&estado=PENDIENTE').expect(200);
    expect(listarBandeja).toHaveBeenCalledWith(1, expect.objectContaining({ carreraId: 2, planEstudioId: 3, estado: 'PENDIENTE' }));
    await request(app.getHttpServer()).get('/estudiantes/bandeja-revision?carreraId=abc').expect(400);
    expect(listarBandeja).toHaveBeenCalledTimes(1);
  });

  it('lista equivalencias válidas sin registros y rechaza parámetros inválidos o ausentes', async () => {
    const response = await request(app.getHttpServer()).get('/planes-estudio/equivalencias?planOrigenId=1&planDestinoId=2').expect(200);
    expect(response.body).toEqual([]);
    expect(listarPorPlanes).toHaveBeenCalledWith(1, 2);
    await request(app.getHttpServer()).get('/planes-estudio/equivalencias?planOrigenId=abc&planDestinoId=2').expect(400);
    await request(app.getHttpServer()).get('/planes-estudio/equivalencias?planOrigenId=1').expect(400);
    expect(listarPorPlanes).toHaveBeenCalledTimes(1);
  });
});
