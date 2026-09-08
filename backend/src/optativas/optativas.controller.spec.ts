import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { RolSistema } from '../auth/constants/roles.constants';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TipoOptativa } from './constants/tipo-optativa.constant';
import { OptativasController } from './optativas.controller';
import { OptativasService } from './optativas.service';

describe('OptativasController', () => {
  const jwtSecret = 'test-secret';

  const optativasService = {
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
      imports: [
        JwtModule.register({
          secret: jwtSecret,
        }),
      ],
      controllers: [OptativasController],
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
          provide: OptativasService,
          useValue: optativasService,
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

    await app.init();
    jwtService = module.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const generarToken = (rol: RolSistema = RolSistema.ADMIN_GLOBAL) =>
    jwtService.sign({
      sub: 1,
      email: 'admin@correo.una.ac.cr',
      roles: [rol],
    });

  it('GET /optativas - lista las optativas', async () => {
    optativasService.listar.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get('/optativas')
      .set('Authorization', `Bearer ${generarToken()}`)
      .expect(200);

    expect(response.body).toEqual([]);
    expect(optativasService.listar).toHaveBeenCalled();
  });

  it('GET /optativas/:id - obtiene una optativa', async () => {
    const optativa = { id: 1, tipo: TipoOptativa.DISCIPLINARIA };
    optativasService.obtenerPorId.mockResolvedValue(optativa);

    const response = await request(app.getHttpServer())
      .get('/optativas/1')
      .set('Authorization', `Bearer ${generarToken()}`)
      .expect(200);

    expect(response.body).toEqual(optativa);
    expect(optativasService.obtenerPorId).toHaveBeenCalledWith(1);
  });

  it('POST /optativas - crea una optativa', async () => {
    const nueva = { id: 1, tipo: TipoOptativa.DISCIPLINARIA };
    optativasService.crear.mockResolvedValue(nueva);

    const response = await request(app.getHttpServer())
      .post('/optativas')
      .set('Authorization', `Bearer ${generarToken()}`)
      .send({
        codigo: 'EIF472',
        nombre: 'Seguridad Informática',
        tipo: TipoOptativa.DISCIPLINARIA,
        carreraOrigenId: 1,
      })
      .expect(201);

    expect(response.body).toEqual(nueva);
    expect(optativasService.crear).toHaveBeenCalledWith({
      codigo: 'EIF472',
      nombre: 'Seguridad Informática',
      tipo: TipoOptativa.DISCIPLINARIA,
      carreraOrigenId: 1,
    });
  });

  it('PATCH /optativas/:id - actualiza una optativa', async () => {
    const actualizada = { id: 1, tipo: TipoOptativa.ABIERTA };
    optativasService.actualizar.mockResolvedValue(actualizada);

    const response = await request(app.getHttpServer())
      .patch('/optativas/1')
      .set('Authorization', `Bearer ${generarToken()}`)
      .send({
        tipo: TipoOptativa.ABIERTA,
      })
      .expect(200);

    expect(response.body).toEqual(actualizada);
    expect(optativasService.actualizar).toHaveBeenCalledWith(1, {
      tipo: TipoOptativa.ABIERTA,
    });
  });

  it('PATCH /optativas/:id/estado - cambia el estado de una optativa', async () => {
    const actualizada = { id: 1, activo: false };
    optativasService.cambiarEstado.mockResolvedValue(actualizada);

    const response = await request(app.getHttpServer())
      .patch('/optativas/1/estado')
      .set('Authorization', `Bearer ${generarToken()}`)
      .send({
        activo: false,
      })
      .expect(200);

    expect(response.body).toEqual(actualizada);
    expect(optativasService.cambiarEstado).toHaveBeenCalledWith(1, false);
  });
});
