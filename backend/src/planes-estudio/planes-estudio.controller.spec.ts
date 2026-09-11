import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { GradoAcademico } from '../carreras/constants/grado-academico.constant';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisosService } from '../permisos/permisos.service';
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

  let permisosAsignados: Set<PermisoSistema>;

  const permisosService = {
    usuarioTienePermisos: jest.fn(),
  };

  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: jwtSecret })],
      controllers: [PlanesEstudioController],
      providers: [
        AuthGuard,
        PermisosGuard,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(jwtSecret) },
        },
        {
          provide: PermisosService,
          useValue: permisosService,
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
    permisosAsignados = new Set<PermisoSistema>();
    permisosService.usuarioTienePermisos.mockImplementation(
      async (_usuarioId, requeridos: PermisoSistema[]) =>
        requeridos.every((p) => permisosAsignados.has(p)),
    );
    service.listar.mockResolvedValue([]);
    service.obtenerPorId.mockResolvedValue({ id: 1 });
    service.crear.mockResolvedValue({ id: 1 });
    service.actualizar.mockResolvedValue({ id: 1 });
    service.cambiarEstado.mockResolvedValue({ id: 1 });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
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

  it('permite ADMIN_GLOBAL sin registros en usuario_permisos', async () => {
    await request(app.getHttpServer())
      .get('/planes-estudio')
      .set('Authorization', `Bearer ${await token('ADMIN_GLOBAL')}`)
      .expect(200, []);

    expect(service.listar).toHaveBeenCalledTimes(1);
    expect(permisosService.usuarioTienePermisos).not.toHaveBeenCalled();
  });

  it('permite listar planes con PLANES_ESTUDIO_VER', async () => {
    permisosAsignados.add(PermisoSistema.PLANES_ESTUDIO_VER);
    await request(app.getHttpServer())
      .get('/planes-estudio')
      .set('Authorization', `Bearer ${await token('ESTUDIANTE')}`)
      .expect(200, []);

    expect(service.listar).toHaveBeenCalledTimes(1);
  });

  it('responde 403 sin PLANES_ESTUDIO_VER', async () => {
    await request(app.getHttpServer())
      .get('/planes-estudio')
      .set('Authorization', `Bearer ${await token('ESTUDIANTE')}`)
      .expect(403);
  });

  it('crea un plan válido con PLANES_ESTUDIO_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.PLANES_ESTUDIO_GESTIONAR);
    const dto = {
      carreraId: 1,
      grado: GradoAcademico.BACHILLERATO,
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

  it('rechaza crear un plan sin permiso PLANES_ESTUDIO_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.PLANES_ESTUDIO_VER);
    const dto = {
      carreraId: 1,
      grado: GradoAcademico.BACHILLERATO,
      codigo: 'BA-INFORM 2012-10',
      nombre: 'Plan de Bachillerato 2012-10',
    };

    await request(app.getHttpServer())
      .post('/planes-estudio')
      .set('Authorization', `Bearer ${await token('ESTUDIANTE')}`)
      .send(dto)
      .expect(403);

    expect(service.crear).not.toHaveBeenCalled();
  });

  it('rechaza crear un plan sin carrera', async () => {
    permisosAsignados.add(PermisoSistema.PLANES_ESTUDIO_GESTIONAR);
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
    permisosAsignados.add(PermisoSistema.PLANES_ESTUDIO_GESTIONAR);
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

  it('consulta un plan por id con PLANES_ESTUDIO_VER', async () => {
    permisosAsignados.add(PermisoSistema.PLANES_ESTUDIO_VER);
    await request(app.getHttpServer())
      .get('/planes-estudio/1')
      .set('Authorization', `Bearer ${await token('ESTUDIANTE')}`)
      .expect(200, { id: 1 });

    expect(service.obtenerPorId).toHaveBeenCalledWith(1);
  });

  it('rechaza un id inválido', async () => {
    permisosAsignados.add(PermisoSistema.PLANES_ESTUDIO_VER);
    await request(app.getHttpServer())
      .get('/planes-estudio/no-es-id')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .expect(400);

    expect(service.obtenerPorId).not.toHaveBeenCalled();
  });

  it('actualiza un plan con PLANES_ESTUDIO_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.PLANES_ESTUDIO_GESTIONAR);
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
    permisosAsignados.add(PermisoSistema.PLANES_ESTUDIO_GESTIONAR);
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

  it('cambia el estado de un plan con PLANES_ESTUDIO_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.PLANES_ESTUDIO_GESTIONAR);
    await request(app.getHttpServer())
      .patch('/planes-estudio/1/estado')
      .set('Authorization', `Bearer ${await token('ADMIN_GLOBAL')}`)
      .send({ activo: false })
      .expect(200, { id: 1 });

    expect(service.cambiarEstado).toHaveBeenCalledWith(1, false);
  });

  it('rechaza estado que no sea boolean', async () => {
    permisosAsignados.add(PermisoSistema.PLANES_ESTUDIO_GESTIONAR);
    await request(app.getHttpServer())
      .patch('/planes-estudio/1/estado')
      .set('Authorization', `Bearer ${await token('ADMIN_GLOBAL')}`)
      .send({ activo: 'no' })
      .expect(400);

    expect(service.cambiarEstado).not.toHaveBeenCalled();
  });
});
