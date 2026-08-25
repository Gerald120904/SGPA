import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
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
        RolesGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(jwtSecret),
          },
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

  it('permite ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .get('/cursos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(cursosService.listar).toHaveBeenCalledTimes(1);
  });

  it('permite COORDINADOR', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .get('/cursos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);
  });

  it.each(['PROFESOR', 'ESTUDIANTE'])('responde 403 para %s', async (rol) => {
    const token = await crearToken(rol);

    await request(app.getHttpServer())
      .get('/cursos')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(cursosService.listar).not.toHaveBeenCalled();
  });

  it('crea un curso desde una asignatura del plan', async () => {
    const token = await crearToken('COORDINADOR');

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

  it('lista asignaturas disponibles para crear curso', async () => {
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

  it('consulta un curso por id', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .get('/cursos/1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, {
        id: 1,
      });

    expect(cursosService.obtenerPorId).toHaveBeenCalledWith(1);
  });

  it('rechaza un id inválido', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .get('/cursos/no-es-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(cursosService.obtenerPorId).not.toHaveBeenCalled();
  });

  it('actualiza la descripción de un curso', async () => {
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

  it('cambia el estado del curso', async () => {
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
