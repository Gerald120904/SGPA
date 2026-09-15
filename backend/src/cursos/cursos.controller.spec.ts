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
import { CursosController } from './cursos.controller';
import { CursosService } from './cursos.service';

describe('CursosController', () => {
  const jwtSecret = 'test-secret';

  const cursosService = {
    listar: jest.fn(),
    listarAsignaturasDisponibles: jest.fn(),
    obtenerPorId: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    cambiarEstado: jest.fn(),
  };

  const permisosAsignados = new Set<string>();
  const permisosService = {
    usuarioTienePermisos: jest
      .fn()
      .mockImplementation(async (_usuarioId: number, permisos: string[]) =>
        permisos.every((p) => permisosAsignados.has(p)),
      ),
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
      controllers: [CursosController],
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
          provide: CursosService,
          useValue: cursosService,
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
    permisosAsignados.clear();

    cursosService.listar.mockResolvedValue([]);
    cursosService.listarAsignaturasDisponibles.mockResolvedValue([]);
    cursosService.obtenerPorId.mockResolvedValue({ id: 1 });
    cursosService.crear.mockResolvedValue({ id: 1 });
    cursosService.actualizar.mockResolvedValue({ id: 1 });
    cursosService.cambiarEstado.mockResolvedValue({ id: 1 });
  });

  afterAll(async () => {
    await app.close();
  });

  async function crearToken(rol: string) {
    return jwtService.signAsync({
      sub: 1,
      correo: 'usuario@sgpa.local',
      roles: [rol],
    });
  }

  it('responde 401 sin JWT', async () => {
    await request(app.getHttpServer()).get('/cursos').expect(401);

    expect(cursosService.listar).not.toHaveBeenCalled();
  });

  it('permite ADMIN_GLOBAL sin permisos explícitos en BD', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .get('/cursos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(cursosService.listar).toHaveBeenCalledTimes(1);
  });

  it('permite consultar cursos con CURSOS_VER (incluso rol ASISTENTE_ESTUDIANTIL)', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_VER);
    const token = await crearToken('ASISTENTE_ESTUDIANTIL');

    await request(app.getHttpServer())
      .get('/cursos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(cursosService.listar).toHaveBeenCalledTimes(1);
  });

  it('responde 403 al listar cursos si el usuario no tiene CURSOS_VER', async () => {
    const token = await crearToken('ASISTENTE_ESTUDIANTIL');

    await request(app.getHttpServer())
      .get('/cursos')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(cursosService.listar).not.toHaveBeenCalled();
  });

  it('permite consultar un curso por id con CURSOS_VER', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_VER);
    const token = await crearToken('ASISTENTE_ESTUDIANTIL');

    await request(app.getHttpServer())
      .get('/cursos/1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { id: 1 });

    expect(cursosService.obtenerPorId).toHaveBeenCalledWith(1);
  });

  it('responde 403 al consultar asignaturas disponibles sin CURSOS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_VER);
    const token = await crearToken('ASISTENTE_ESTUDIANTIL');

    await request(app.getHttpServer())
      .get('/cursos/asignaturas-disponibles?carreraId=1&planId=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(cursosService.listarAsignaturasDisponibles).not.toHaveBeenCalled();
  });

  it('permite listar asignaturas disponibles con CURSOS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_GESTIONAR);
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .get(
        '/cursos/asignaturas-disponibles?carreraId=1&planId=2&nivel=1&ciclo=2',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(cursosService.listarAsignaturasDisponibles).toHaveBeenCalledWith({
      carreraId: 1,
      planId: 2,
      nivel: 1,
      ciclo: 2,
    });
  });

  it('responde 403 al crear un curso sin CURSOS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_VER);
    const token = await crearToken('ASISTENTE_ESTUDIANTIL');

    await request(app.getHttpServer())
      .post('/cursos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        planAsignaturaId: 17,
        descripcion: 'Curso introductorio',
      })
      .expect(403);

    expect(cursosService.crear).not.toHaveBeenCalled();
  });

  it('crea un curso desde una asignatura del plan con CURSOS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_GESTIONAR);
    const token = await crearToken('ASISTENTE_ESTUDIANTIL');

    const dto = {
      planAsignaturaId: 17,
      descripcion: 'Curso introductorio',
    };

    await request(app.getHttpServer())
      .post('/cursos')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201, {
        id: 1,
      });

    expect(cursosService.crear).toHaveBeenCalledWith(dto);
  });

  it('rechaza crear un curso sin planAsignaturaId', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_GESTIONAR);
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .post('/cursos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        descripcion: 'Curso de prueba',
      })
      .expect(400);

    expect(cursosService.crear).not.toHaveBeenCalled();
  });

  it('rechaza planAsignaturaId menor a 1', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_GESTIONAR);
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .post('/cursos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        planAsignaturaId: 0,
      })
      .expect(400);

    expect(cursosService.crear).not.toHaveBeenCalled();
  });

  it('rechaza código, nombre y carreraIds enviados manualmente', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_GESTIONAR);
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .post('/cursos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        planAsignaturaId: 17,
        codigo: 'EIF201',
        nombre: 'Programación I',
        carreraIds: [1],
      })
      .expect(400);

    expect(cursosService.crear).not.toHaveBeenCalled();
  });

  it('rechaza un id inválido en GET /cursos/:id', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_VER);
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .get('/cursos/no-es-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(cursosService.obtenerPorId).not.toHaveBeenCalled();
  });

  it('responde 403 al actualizar un curso sin CURSOS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_VER);
    const token = await crearToken('ASISTENTE_ESTUDIANTIL');

    await request(app.getHttpServer())
      .patch('/cursos/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ descripcion: 'Test' })
      .expect(403);

    expect(cursosService.actualizar).not.toHaveBeenCalled();
  });

  it('actualiza la descripción de un curso con CURSOS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_GESTIONAR);
    const token = await crearToken('COORDINADOR');

    const dto = {
      descripcion: 'Descripción actualizada',
    };

    await request(app.getHttpServer())
      .patch('/cursos/1')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200, {
        id: 1,
      });

    expect(cursosService.actualizar).toHaveBeenCalledWith(1, dto);
  });

  it('rechaza modificar manualmente el código de un curso', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_GESTIONAR);
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .patch('/cursos/1')
      .set('Authorization', `Bearer ${token}`)
      .send({
        codigo: 'OTRO101',
      })
      .expect(400);

    expect(cursosService.actualizar).not.toHaveBeenCalled();
  });

  it('responde 403 al cambiar estado sin CURSOS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_VER);
    const token = await crearToken('ASISTENTE_ESTUDIANTIL');

    await request(app.getHttpServer())
      .patch('/cursos/1/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: false })
      .expect(403);

    expect(cursosService.cambiarEstado).not.toHaveBeenCalled();
  });

  it('cambia el estado del curso con CURSOS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_GESTIONAR);
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .patch('/cursos/1/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({
        activo: false,
      })
      .expect(200, {
        id: 1,
      });

    expect(cursosService.cambiarEstado).toHaveBeenCalledWith(1, false);
  });

  it('rechaza estado que no sea boolean', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_GESTIONAR);
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .patch('/cursos/1/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({
        activo: 'no',
      })
      .expect(400);

    expect(cursosService.cambiarEstado).not.toHaveBeenCalled();
  });
});
