import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { TipoAsignacionAcademica } from './constants/tipo-asignacion-academica.constant';
import { EstructuraAcademicaController } from './estructura-academica.controller';
import { EstructuraAcademicaService } from './estructura-academica.service';

describe('EstructuraAcademicaController', () => {
  const jwtSecret = 'estructura-test-secret';

  const estructuraService = {
    crearArea: jest.fn(),
    listarAreas: jest.fn(),
    obtenerAreaPorId: jest.fn(),
    actualizarArea: jest.fn(),
    asociarCarreraArea: jest.fn(),
    desasociarCarreraArea: jest.fn(),
    listarCarrerasDeArea: jest.fn(),
    crearAsignacion: jest.fn(),
    listarAsignaciones: jest.fn(),
    obtenerAsignacionPorId: jest.fn(),
    actualizarAsignacion: jest.fn(),
    inactivarAsignacion: jest.fn(),
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
      controllers: [EstructuraAcademicaController],
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
          provide: getRepositoryToken(Usuario),
          useValue: {
            findOne: jest.fn().mockImplementation(async ({ where }) => ({
              id: where?.id ?? 1,
              activo: true,
              versionAutenticacion: 1,
              usuarioRoles: rolesActuales.map((r, i) => ({
                usuarioId: where?.id ?? 1,
                rolId: i + 1,
                rol: { id: i + 1, nombre: r, activo: true },
              })),
            })),
          },
        },
        {
          provide: EstructuraAcademicaService,
          useValue: estructuraService,
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
    estructuraService.listarAreas.mockResolvedValue([]);
    estructuraService.crearArea.mockResolvedValue({ id: 1 });
    estructuraService.asociarCarreraArea.mockResolvedValue({ id: 1 });
    estructuraService.crearAsignacion.mockResolvedValue({ id: 1 });
    estructuraService.listarAsignaciones.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  let rolesActuales: string[] = ['COORDINADOR'];

  async function crearToken(roles: string[], sub = 1) {
    rolesActuales = roles && roles.length > 0 ? roles : ['COORDINADOR'];
    return jwtService.signAsync({
      sub,
      correo: 'admin@sgpa.local',
      roles: rolesActuales,

      rolActivo: rolesActuales[0],
      av: 1,});
  }

  it('GET /estructura-academica/areas - permite a COORDINADOR legacy', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/estructura-academica/areas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(estructuraService.listarAreas).toHaveBeenCalled();
  });

  it('POST /estructura-academica/areas - permite a ADMIN_GLOBAL', async () => {
    const token = await crearToken(['ADMIN_GLOBAL']);

    await request(app.getHttpServer())
      .post('/estructura-academica/areas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        codigo: 'INF',
        nombre: 'Informática',
      })
      .expect(201);

    expect(estructuraService.crearArea).toHaveBeenCalled();
  });

  it('POST /estructura-academica/asignaciones - permite a ADMIN_GLOBAL', async () => {
    const token = await crearToken(['ADMIN_GLOBAL']);

    await request(app.getHttpServer())
      .post('/estructura-academica/asignaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({
        usuarioId: 10,
        tipo: TipoAsignacionAcademica.COORDINADOR_CARRERA,
        carreraId: 1,
        fechaInicio: '2025-01-01',
      })
      .expect(201);

    expect(estructuraService.crearAsignacion).toHaveBeenCalled();
  });
});
