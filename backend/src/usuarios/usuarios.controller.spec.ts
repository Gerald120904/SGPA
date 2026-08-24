import { INestApplication, ValidationPipe } from '@nestjs/common';
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
    obtenerPorId: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    cambiarEstado: jest.fn(),
    asignarRol: jest.fn(),
    revocarRol: jest.fn(),
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
    usuariosService.listar.mockResolvedValue([]);
    usuariosService.obtenerPorId.mockResolvedValue({ id: 2 });
    usuariosService.crear.mockResolvedValue({ id: 2 });
    usuariosService.actualizar.mockResolvedValue({ id: 2 });
    usuariosService.cambiarEstado.mockResolvedValue({ id: 2 });
    usuariosService.asignarRol.mockResolvedValue({ id: 2 });
    usuariosService.revocarRol.mockResolvedValue({ id: 2 });
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

  it('crea un usuario válido como ADMIN_GLOBAL', async () => {
    const token = await jwtService.signAsync({
      sub: 1,
      correo: 'admin@sgpa.local',
      roles: ['ADMIN_GLOBAL'],
    });
    const dto = {
      cedula: '111111111',
      nombres: 'Usuario',
      apellido1: 'Prueba',
      correo: 'usuario@sgpa.local',
      password: 'ClaveSegura123',
      roles: ['PROFESOR'],
    };

    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201, { id: 2 });

    expect(usuariosService.crear).toHaveBeenCalledWith(dto);
  });

  it('consulta el detalle de un usuario', async () => {
    const token = await jwtService.signAsync({
      sub: 1,
      correo: 'admin@sgpa.local',
      roles: ['ADMIN_GLOBAL'],
    });

    await request(app.getHttpServer())
      .get('/usuarios/2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { id: 2 });

    expect(usuariosService.obtenerPorId).toHaveBeenCalledWith(2);
  });

  it('actualiza datos administrativos', async () => {
    const token = await jwtService.signAsync({
      sub: 1,
      correo: 'admin@sgpa.local',
      roles: ['ADMIN_GLOBAL'],
    });
    const dto = {
      nombres: 'Nombre actualizado',
      correo: 'actualizado@sgpa.local',
    };

    await request(app.getHttpServer())
      .patch('/usuarios/2')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200, { id: 2 });

    expect(usuariosService.actualizar).toHaveBeenCalledWith(2, dto);
  });

  it('asigna un rol oficial', async () => {
    const token = await jwtService.signAsync({
      sub: 1,
      correo: 'admin@sgpa.local',
      roles: ['ADMIN_GLOBAL'],
    });

    await request(app.getHttpServer())
      .post('/usuarios/2/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ rol: 'PROFESOR' })
      .expect(201, { id: 2 });

    expect(usuariosService.asignarRol).toHaveBeenCalledWith(2, 'PROFESOR');
  });

  it('rechaza un rol no oficial en el DTO de creación', async () => {
    const token = await jwtService.signAsync({
      sub: 1,
      correo: 'admin@sgpa.local',
      roles: ['ADMIN_GLOBAL'],
    });

    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cedula: '111111111',
        nombres: 'Usuario',
        apellido1: 'Prueba',
        correo: 'usuario@sgpa.local',
        password: 'ClaveSegura123',
        roles: ['ROL_INVENTADO'],
      })
      .expect(400);

    expect(usuariosService.crear).not.toHaveBeenCalled();
  });

  it('envía el usuario autenticado al cambiar estado', async () => {
    const token = await jwtService.signAsync({
      sub: 1,
      correo: 'admin@sgpa.local',
      roles: ['ADMIN_GLOBAL'],
    });

    await request(app.getHttpServer())
      .patch('/usuarios/2/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: false })
      .expect(200, { id: 2 });

    expect(usuariosService.cambiarEstado).toHaveBeenCalledWith(2, false, 1);
  });

  it('envía el usuario autenticado al revocar un rol', async () => {
    const token = await jwtService.signAsync({
      sub: 1,
      correo: 'admin@sgpa.local',
      roles: ['ADMIN_GLOBAL'],
    });

    await request(app.getHttpServer())
      .delete('/usuarios/2/roles/3')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { id: 2 });

    expect(usuariosService.revocarRol).toHaveBeenCalledWith(2, 3, 1);
  });
});
