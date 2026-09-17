import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisosService } from '../permisos/permisos.service';
import { EstudiantesImportacionController } from './estudiantes-importacion.controller';
import { EstudiantesImportacionService } from './estudiantes-importacion.service';

describe('EstudiantesImportacionController', () => {
  const jwtSecret = 'estudiantes-importacion-controller-secret';
  const service = {
    validar: jest.fn(),
    ejecutar: jest.fn(),
  };
  const permisosService = { usuarioTienePermisos: jest.fn() };
  let app: INestApplication<App>;
  let jwt: JwtService;

  const validDto = {
    carreraId: 1,
    planEstudioId: 2,
    estudiantes: [
      {
        fila: 2,
        cedula: '001234567',
        nombres: 'Ana',
        apellido1: 'Solís',
        apellido2: null,
        correoInstitucional: 'ana@una.ac.cr',
        telefono: '88880000',
        periodoIngresoCodigo: '2026-I',
        asignaturasAprobadas: ['EIF101'],
      },
    ],
  };

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: jwtSecret })],
      controllers: [EstudiantesImportacionController],
      providers: [
        AuthGuard,
        PermisosGuard,
        { provide: EstudiantesImportacionService, useValue: service },
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
    service.validar.mockResolvedValue({ resumen: { total: 1 }, filas: [] });
    service.ejecutar.mockResolvedValue({ creados: 1, actualizados: 0 });
  });

  afterAll(async () => app.close());

  const token = (roles: string[] = []) =>
    jwt.signAsync({ sub: 3, correo: 'gestor@una.cr', roles });

  it('requiere autenticación', async () => {
    await request(app.getHttpServer())
      .post('/estudiantes/importacion/excel/validar')
      .send(validDto)
      .expect(401);

    await request(app.getHttpServer())
      .post('/estudiantes/importacion/excel/ejecutar')
      .send(validDto)
      .expect(401);
  });

  it('requiere ESTUDIANTES_GESTIONAR', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(false);
    await request(app.getHttpServer())
      .post('/estudiantes/importacion/excel/validar')
      .set('Authorization', `Bearer ${await token()}`)
      .send(validDto)
      .expect(403);
    expect(service.validar).not.toHaveBeenCalled();
  });

  it('permite al ADMIN_GLOBAL sin consultar permisos', async () => {
    await request(app.getHttpServer())
      .post('/estudiantes/importacion/excel/validar')
      .set('Authorization', `Bearer ${await token(['ADMIN_GLOBAL'])}`)
      .send(validDto)
      .expect(201);
    expect(permisosService.usuarioTienePermisos).not.toHaveBeenCalled();
    expect(service.validar).toHaveBeenCalledWith(3, validDto);
  });

  it('acceso correcto con el permiso a /validar', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    await request(app.getHttpServer())
      .post('/estudiantes/importacion/excel/validar')
      .set('Authorization', `Bearer ${await token()}`)
      .send(validDto)
      .expect(201);
    expect(service.validar).toHaveBeenCalledWith(3, validDto);
  });

  it('acceso correcto con el permiso a /ejecutar', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    await request(app.getHttpServer())
      .post('/estudiantes/importacion/excel/ejecutar')
      .set('Authorization', `Bearer ${await token()}`)
      .send(validDto)
      .expect(201);
    expect(service.ejecutar).toHaveBeenCalledWith(3, validDto);
  });

  it('rechaza DTO inválido cuando estudiantes está vacío o contiene solo espacios', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValue(true);
    const auth = `Bearer ${await token()}`;

    // Estudiantes vacío (rechazado por @ArrayMinSize(1))
    await request(app.getHttpServer())
      .post('/estudiantes/importacion/excel/validar')
      .set('Authorization', auth)
      .send({
        carreraId: 1,
        planEstudioId: 2,
        estudiantes: [],
      })
      .expect(400);

    // Cédula solo espacios
    await request(app.getHttpServer())
      .post('/estudiantes/importacion/excel/validar')
      .set('Authorization', auth)
      .send({
        ...validDto,
        estudiantes: [{ ...validDto.estudiantes[0], cedula: '   ' }],
      })
      .expect(400);

    // Nombres solo espacios
    await request(app.getHttpServer())
      .post('/estudiantes/importacion/excel/validar')
      .set('Authorization', auth)
      .send({
        ...validDto,
        estudiantes: [{ ...validDto.estudiantes[0], nombres: '   ' }],
      })
      .expect(400);

    // Primer apellido solo espacios
    await request(app.getHttpServer())
      .post('/estudiantes/importacion/excel/validar')
      .set('Authorization', auth)
      .send({
        ...validDto,
        estudiantes: [{ ...validDto.estudiantes[0], apellido1: '   ' }],
      })
      .expect(400);

    // Período de ingreso solo espacios
    await request(app.getHttpServer())
      .post('/estudiantes/importacion/excel/validar')
      .set('Authorization', auth)
      .send({
        ...validDto,
        estudiantes: [
          { ...validDto.estudiantes[0], periodoIngresoCodigo: '   ' },
        ],
      })
      .expect(400);

    expect(service.validar).not.toHaveBeenCalled();
    expect(service.ejecutar).not.toHaveBeenCalled();
  });
});
