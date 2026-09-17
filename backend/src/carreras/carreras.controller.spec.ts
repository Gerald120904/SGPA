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
import { CarrerasController } from './carreras.controller';
import { CarrerasService } from './carreras.service';

describe('CarrerasController', () => {
  const jwtSecret = 'test-secret';

  const carrerasService = {
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
      imports: [
        JwtModule.register({
          secret: jwtSecret,
        }),
      ],
      controllers: [CarrerasController],
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
          provide: CarrerasService,
          useValue: carrerasService,
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

    permisosAsignados = new Set<PermisoSistema>();

    permisosService.usuarioTienePermisos.mockImplementation(
      async (_usuarioId, requeridos: PermisoSistema[]) =>
        requeridos.every((permiso) => permisosAsignados.has(permiso)),
    );

    carrerasService.listar.mockResolvedValue([]);
    carrerasService.obtenerPorId.mockResolvedValue({ id: 1 });
    carrerasService.crear.mockResolvedValue({ id: 1 });
    carrerasService.actualizar.mockResolvedValue({ id: 1 });
    carrerasService.cambiarEstado.mockResolvedValue({ id: 1 });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function crearToken(rol: string) {
    return jwtService.signAsync({
      sub: 1,
      correo: 'usuario@sgpa.local',
      roles: [rol],
    });
  }

  it('responde 401 sin JWT', async () => {
    await request(app.getHttpServer()).get('/carreras').expect(401);

    expect(carrerasService.listar).not.toHaveBeenCalled();
  });

  it('permite ADMIN_GLOBAL sin registros en usuario_permisos', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .get('/carreras')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(carrerasService.listar).toHaveBeenCalledTimes(1);
    expect(permisosService.usuarioTienePermisos).not.toHaveBeenCalled();
  });

  it('permite consultar carreras a un ASISTENTE_ESTUDIANTIL con CARRERAS_VER', async () => {
    permisosAsignados.add(PermisoSistema.CARRERAS_VER);

    const token = await crearToken('ASISTENTE_ESTUDIANTIL');

    await request(app.getHttpServer())
      .get('/carreras')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(carrerasService.listar).toHaveBeenCalledTimes(1);
  });

  it('rechaza consultar carreras sin CARRERAS_VER', async () => {
    const token = await crearToken('ASISTENTE_ESTUDIANTIL');

    await request(app.getHttpServer())
      .get('/carreras')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(carrerasService.listar).not.toHaveBeenCalled();
  });

  it('no permite crear con solo CARRERAS_VER', async () => {
    permisosAsignados.add(PermisoSistema.CARRERAS_VER);

    const token = await crearToken('ASISTENTE_ESTUDIANTIL');

    await request(app.getHttpServer())
      .post('/carreras')
      .set('Authorization', `Bearer ${token}`)
      .send({
        codigo: 'EIF',
        nombre: 'Ingeniería en Sistemas',
      })
      .expect(403);

    expect(carrerasService.crear).not.toHaveBeenCalled();
  });

  it('permite crear con CARRERAS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CARRERAS_GESTIONAR);

    const token = await crearToken('ASISTENTE_ESTUDIANTIL');

    const dto = {
      codigo: 'EIF',
      nombre: 'Ingeniería en Sistemas',
      descripcion: 'Carrera de informática',
    };

    await request(app.getHttpServer())
      .post('/carreras')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201, { id: 1 });

    expect(carrerasService.crear).toHaveBeenCalledWith(dto);
  });

  it('consulta una carrera por id con CARRERAS_VER', async () => {
    permisosAsignados.add(PermisoSistema.CARRERAS_VER);
    const token = await crearToken('PROFESOR');

    await request(app.getHttpServer())
      .get('/carreras/1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { id: 1 });

    expect(carrerasService.obtenerPorId).toHaveBeenCalledWith(1);
  });

  it('actualiza una carrera con CARRERAS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CARRERAS_GESTIONAR);
    const token = await crearToken('PROFESOR');

    const dto = {
      nombre: 'Ingeniería en Sistemas',
    };

    await request(app.getHttpServer())
      .patch('/carreras/1')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200, { id: 1 });

    expect(carrerasService.actualizar).toHaveBeenCalledWith(1, dto);
  });

  it('cambia el estado de una carrera con CARRERAS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CARRERAS_GESTIONAR);
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .patch('/carreras/1/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: false })
      .expect(200, { id: 1 });

    expect(carrerasService.cambiarEstado).toHaveBeenCalledWith(1, false);
  });

  it('rechaza estado que no sea boolean', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .patch('/carreras/1/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: 'no' })
      .expect(400);

    expect(carrerasService.cambiarEstado).not.toHaveBeenCalled();
  });
});
