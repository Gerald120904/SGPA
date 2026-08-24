import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TipoSalidaAcademica } from './entities/salida-academica.entity';
import { SalidasAcademicasController } from './salidas-academicas.controller';
import { SalidasAcademicasService } from './salidas-academicas.service';

describe('SalidasAcademicasController', () => {
  const jwtSecret = 'salidas-academicas-test-secret';
  const service = {
    listar: jest.fn(),
    obtenerPorId: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    reemplazarAsignaturas: jest.fn(),
    cambiarEstado: jest.fn(),
  };
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: jwtSecret })],
      controllers: [SalidasAcademicasController],
      providers: [
        AuthGuard,
        RolesGuard,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(jwtSecret) },
        },
        { provide: SalidasAcademicasService, useValue: service },
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
    service.reemplazarAsignaturas.mockResolvedValue({ id: 1 });
    service.cambiarEstado.mockResolvedValue({ id: 1 });
  });

  afterAll(async () => app.close());

  const token = (rol: string) =>
    jwtService.signAsync({
      sub: 1,
      correo: 'usuario@sgpa.local',
      roles: [rol],
    });

  it('requiere autenticación', async () => {
    await request(app.getHttpServer())
      .get('/planes-estudio/1/salidas-academicas')
      .expect(401);
  });

  it.each(['ADMIN_GLOBAL', 'COORDINADOR'])('permite el rol %s', async (rol) => {
    await request(app.getHttpServer())
      .get('/planes-estudio/1/salidas-academicas')
      .set('Authorization', `Bearer ${await token(rol)}`)
      .expect(200, []);
  });

  it('rechaza roles sin permiso', async () => {
    await request(app.getHttpServer())
      .get('/planes-estudio/1/salidas-academicas')
      .set('Authorization', `Bearer ${await token('PROFESOR')}`)
      .expect(403);
  });

  it('crea una salida válida', async () => {
    const dto = {
      codigo: 'DIP',
      nombre: 'Diplomado',
      tipo: TipoSalidaAcademica.DIPLOMADO,
      creditosRequeridos: 88,
      orden: 1,
    };

    await request(app.getHttpServer())
      .post('/planes-estudio/1/salidas-academicas')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send(dto)
      .expect(201, { id: 1 });

    expect(service.crear).toHaveBeenCalledWith(1, dto);
  });

  it('rechaza un tipo inválido', async () => {
    await request(app.getHttpServer())
      .post('/planes-estudio/1/salidas-academicas')
      .set('Authorization', `Bearer ${await token('ADMIN_GLOBAL')}`)
      .send({
        codigo: 'DIP',
        nombre: 'Diplomado',
        tipo: 'INVENTADO',
        creditosRequeridos: 88,
        orden: 1,
      })
      .expect(400);

    expect(service.crear).not.toHaveBeenCalled();
  });

  it('rechaza una salida con créditos inválidos', async () => {
    await request(app.getHttpServer())
      .post('/planes-estudio/1/salidas-academicas')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({
        codigo: 'DIP',
        nombre: 'Diplomado',
        tipo: TipoSalidaAcademica.DIPLOMADO,
        creditosRequeridos: 0,
        orden: 1,
      })
      .expect(400);

    expect(service.crear).not.toHaveBeenCalled();
  });

  it.each([
    { codigo: '', nombre: 'Diplomado' },
    { codigo: 'DIP', nombre: '' },
  ])('rechaza código o nombre vacío: %o', async (campos) => {
    await request(app.getHttpServer())
      .post('/planes-estudio/1/salidas-academicas')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({
        ...campos,
        tipo: TipoSalidaAcademica.DIPLOMADO,
        creditosRequeridos: 88,
        orden: 1,
      })
      .expect(400);

    expect(service.crear).not.toHaveBeenCalled();
  });

  it('permite reemplazar las asignaturas de una salida', async () => {
    await request(app.getHttpServer())
      .put('/planes-estudio/1/salidas-academicas/5/asignaturas')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({ asignaturaIds: [10, 11, 12] })
      .expect(200, { id: 1 });

    expect(service.reemplazarAsignaturas).toHaveBeenCalledWith(1, 5, {
      asignaturaIds: [10, 11, 12],
    });
  });

  it('permite limpiar las asignaturas de una salida', async () => {
    await request(app.getHttpServer())
      .put('/planes-estudio/1/salidas-academicas/2/asignaturas')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({ asignaturaIds: [] })
      .expect(200, { id: 1 });

    expect(service.reemplazarAsignaturas).toHaveBeenCalledWith(1, 2, {
      asignaturaIds: [],
    });
  });

  it('valida el cambio de estado', async () => {
    await request(app.getHttpServer())
      .patch('/planes-estudio/1/salidas-academicas/2/estado')
      .set('Authorization', `Bearer ${await token('ADMIN_GLOBAL')}`)
      .send({ activo: 'no' })
      .expect(400);

    expect(service.cambiarEstado).not.toHaveBeenCalled();
  });

  it('no permite administrar salidas académicas a un estudiante', async () => {
    await request(app.getHttpServer())
      .post('/planes-estudio/1/salidas-academicas')
      .set('Authorization', `Bearer ${await token('ESTUDIANTE')}`)
      .send({
        codigo: 'DIP',
        nombre: 'Diplomado',
        tipo: TipoSalidaAcademica.DIPLOMADO,
        creditosRequeridos: 88,
        orden: 1,
      })
      .expect(403);

    expect(service.crear).not.toHaveBeenCalled();
  });
});
