import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { PermisosGuard } from '../../permisos/guards/permisos.guard';
import { PermisosService } from '../../permisos/permisos.service';
import { GoogleFormsController } from './google-forms.controller';
import { GoogleFormsSyncService } from './google-forms-sync.service';
import { GoogleFormsService } from './google-forms.service';

describe('GoogleFormsController', () => {
  const jwtSecret = 'google-forms-controller-secret';
  const googleFormsService = {
    crearConfiguracion: jest.fn(),
    listarConfiguraciones: jest.fn(),
    obtenerConfiguracionPorId: jest.fn(),
    actualizarConfiguracion: jest.fn(),
    cambiarEstado: jest.fn(),
    listarRespuestas: jest.fn(),
  };
  const googleFormsSyncService = {
    sincronizarRespuestasCrudas: jest.fn(),
  };
  const permisosService = { usuarioTienePermisos: jest.fn() };
  let app: INestApplication<App>;
  let jwt: JwtService;

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: jwtSecret })],
      controllers: [GoogleFormsController],
      providers: [
        AuthGuard,
        PermisosGuard,
        { provide: GoogleFormsService, useValue: googleFormsService },
        { provide: GoogleFormsSyncService, useValue: googleFormsSyncService },
        { provide: PermisosService, useValue: permisosService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(jwtSecret) },
        },
      ],
    }).compile();

    app = modulo.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    jwt = modulo.get(JwtService);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    googleFormsService.crearConfiguracion.mockResolvedValue({ id: 1 });
    googleFormsService.listarConfiguraciones.mockResolvedValue([]);
    googleFormsService.obtenerConfiguracionPorId.mockResolvedValue({ id: 1 });
    googleFormsService.actualizarConfiguracion.mockResolvedValue({ id: 1 });
    googleFormsService.cambiarEstado.mockResolvedValue({ id: 1, activo: false });
    googleFormsService.listarRespuestas.mockResolvedValue([]);
    googleFormsSyncService.sincronizarRespuestasCrudas.mockResolvedValue({
      totalRecibidas: 1,
      procesadas: 1,
    });
  });

  afterAll(async () => app.close());

  const token = (roles: string[] = []) =>
    jwt.signAsync({ sub: 7, correo: 'coordinador@una.cr', roles });

  it('requiere autenticación', async () => {
    await request(app.getHttpServer())
      .get('/estudiantes/importacion/google-forms/configuraciones')
      .expect(401);
  });

  it('requiere ESTUDIANTES_GESTIONAR', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(false);
    await request(app.getHttpServer())
      .get('/estudiantes/importacion/google-forms/configuraciones')
      .set('Authorization', `Bearer ${await token()}`)
      .expect(403);
    expect(googleFormsService.listarConfiguraciones).not.toHaveBeenCalled();
  });

  it('permite al ADMIN_GLOBAL sin consultar permisos', async () => {
    await request(app.getHttpServer())
      .get('/estudiantes/importacion/google-forms/configuraciones')
      .set('Authorization', `Bearer ${await token(['ADMIN_GLOBAL'])}`)
      .expect(200);
    expect(permisosService.usuarioTienePermisos).not.toHaveBeenCalled();
    expect(googleFormsService.listarConfiguraciones).toHaveBeenCalledWith(7, {
      carreraId: undefined,
      activo: undefined,
    });
  });

  it('crea una configuración con usuario y DTO válidos', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    const dto = {
      nombre: 'Formulario Informática',
      googleFormId: 'form-123',
      googleSheetId: 'sheet-456',
      carreraId: 10,
      planEstudioId: 20,
    };

    await request(app.getHttpServer())
      .post('/estudiantes/importacion/google-forms/configuraciones')
      .set('Authorization', `Bearer ${await token()}`)
      .send(dto)
      .expect(201, { id: 1 });

    expect(googleFormsService.crearConfiguracion).toHaveBeenCalledWith(7, dto);
  });

  it('rechaza DTO de creación con campos de solo espacios', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);

    await request(app.getHttpServer())
      .post('/estudiantes/importacion/google-forms/configuraciones')
      .set('Authorization', `Bearer ${await token()}`)
      .send({
        nombre: '   ',
        googleFormId: 'form-123',
        googleSheetId: 'sheet-456',
        carreraId: 10,
        planEstudioId: 20,
      })
      .expect(400);

    expect(googleFormsService.crearConfiguracion).not.toHaveBeenCalled();
  });

  it('ejecuta sincronización simulada', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    const dto = {
      respuestas: [
        {
          filaOrigen: 2,
          payload: { cedula: '123' },
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/estudiantes/importacion/google-forms/configuraciones/1/sincronizar-simulado')
      .set('Authorization', `Bearer ${await token()}`)
      .send(dto)
      .expect(201);

    expect(
      googleFormsSyncService.sincronizarRespuestasCrudas,
    ).toHaveBeenCalledWith(7, 1, dto.respuestas);
  });
});
