import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisosService } from '../permisos/permisos.service';
import { EstudiantesController } from './estudiantes.controller';
import { EstudiantesService } from './estudiantes.service';

describe('EstudiantesController', () => {
  const jwtSecret = 'estudiantes-controller-secret';
  const service = {
    listar: jest.fn(),
    obtenerPorId: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    cambiarEstado: jest.fn(),
    listarHistorialAcademico: jest.fn(),
    registrarResultado: jest.fn(),
    listarHistorialPlanes: jest.fn(),
    cambiarPlan: jest.fn(),
    obtenerProgreso: jest.fn(),
  };
  const permisosService = { usuarioTienePermisos: jest.fn() };
  let app: INestApplication<App>;
  let jwt: JwtService;

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: jwtSecret })],
      controllers: [EstudiantesController],
      providers: [
        AuthGuard,
        PermisosGuard,
        { provide: EstudiantesService, useValue: service },
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
    service.listar.mockResolvedValue([]);
    service.crear.mockResolvedValue({ id: 7 });
    service.obtenerProgreso.mockResolvedValue({ resumen: {} });
  });

  afterAll(async () => app.close());

  const token = (roles: string[] = []) =>
    jwt.signAsync({ sub: 3, correo: 'gestor@una.cr', roles });

  it('requiere autenticación', async () => {
    await request(app.getHttpServer()).get('/estudiantes').expect(401);
  });

  it('requiere ESTUDIANTES_VER', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(false);
    await request(app.getHttpServer())
      .get('/estudiantes')
      .set('Authorization', `Bearer ${await token()}`)
      .expect(403);
    expect(service.listar).not.toHaveBeenCalled();
  });

  it('lista con filtros y el usuario autenticado', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    await request(app.getHttpServer())
      .get('/estudiantes?carreraId=1&texto=Ana')
      .set('Authorization', `Bearer ${await token()}`)
      .expect(200, []);
    expect(service.listar).toHaveBeenCalledWith(3, {
      carreraId: 1,
      texto: 'Ana',
    });
  });

  it('permite al ADMIN_GLOBAL sin consultar permisos', async () => {
    await request(app.getHttpServer())
      .get('/estudiantes')
      .set('Authorization', `Bearer ${await token(['ADMIN_GLOBAL'])}`)
      .expect(200);
    expect(permisosService.usuarioTienePermisos).not.toHaveBeenCalled();
  });

  it('crea y no admite carrera o plan en el PATCH general', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    const auth = `Bearer ${await token()}`;
    await request(app.getHttpServer())
      .post('/estudiantes')
      .set('Authorization', auth)
      .send({
        cedula: '001',
        nombres: 'Ana',
        apellido1: 'Mora',
        correoInstitucional: 'ana@una.cr',
        carreraId: 1,
        planEstudioId: 10,
        periodoIngresoId: 1,
      })
      .expect(201, { id: 7 });
    expect(service.crear).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ cedula: '001' }),
    );

    await request(app.getHttpServer())
      .patch('/estudiantes/7')
      .set('Authorization', auth)
      .send({ carreraId: 2 })
      .expect(400);
    expect(service.actualizar).not.toHaveBeenCalled();
  });

  it('rechaza strings requeridos con solo espacios y fuentes no manuales', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    const auth = `Bearer ${await token()}`;
    await request(app.getHttpServer())
      .post('/estudiantes')
      .set('Authorization', auth)
      .send({
        cedula: '   ',
        nombres: 'Ana',
        apellido1: 'Mora',
        correoInstitucional: 'ana@una.cr',
        carreraId: 1,
        planEstudioId: 10,
        periodoIngresoId: 1,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/estudiantes/7/historial-academico')
      .set('Authorization', auth)
      .send({
        planAsignaturaId: 20,
        periodoId: 1,
        resultado: 'APROBADO',
        origenAcademico: 'CURSADO',
        fuenteRegistro: 'GOOGLE_FORMS',
      })
      .expect(400);
    expect(service.registrarResultado).not.toHaveBeenCalled();
  });

  it('mantiene obligatorio el período en el registro manual', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    await request(app.getHttpServer())
      .post('/estudiantes/7/historial-academico')
      .set('Authorization', `Bearer ${await token()}`)
      .send({
        planAsignaturaId: 20,
        resultado: 'APROBADO',
        origenAcademico: 'CURSADO',
      })
      .expect(400);
    expect(service.registrarResultado).not.toHaveBeenCalled();
  });

  it('exige un período de referencia para calcular progreso', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    await request(app.getHttpServer())
      .get('/estudiantes/7/progreso')
      .set('Authorization', `Bearer ${await token()}`)
      .expect(400);
    expect(service.obtenerProgreso).not.toHaveBeenCalled();
  });

  it('envía el período de referencia al cálculo de progreso', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    await request(app.getHttpServer())
      .get('/estudiantes/7/progreso?periodoReferenciaId=4')
      .set('Authorization', `Bearer ${await token()}`)
      .expect(200);
    expect(service.obtenerProgreso).toHaveBeenCalledWith(3, 7, 4);
  });
});
