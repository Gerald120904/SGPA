import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisosService } from '../permisos/permisos.service';
import { PerfilesAcademicosController } from './perfiles-academicos.controller';
import { PerfilesAcademicosService } from './perfiles-academicos.service';

describe('PerfilesAcademicosController', () => {
  const jwtSecret = 'perfiles-test-secret';

  const perfilesService = {
    listar: jest.fn(),
    obtenerPorId: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    cambiarEstado: jest.fn(),
    listarCursosPorPerfil: jest.fn(),
    asociarCurso: jest.fn(),
    desasociarCurso: jest.fn(),
  };

  const permisosService = {
    usuarioTienePermisos: jest.fn().mockResolvedValue(true),
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
      controllers: [PerfilesAcademicosController],
      providers: [
        AuthGuard,
        RolesGuard,
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
          provide: PerfilesAcademicosService,
          useValue: perfilesService,
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

    perfilesService.listar.mockResolvedValue([]);
    perfilesService.obtenerPorId.mockResolvedValue({ id: 1 });
    perfilesService.crear.mockResolvedValue({ id: 1 });
    perfilesService.actualizar.mockResolvedValue({ id: 1 });
    perfilesService.cambiarEstado.mockResolvedValue({ id: 1 });
    perfilesService.listarCursosPorPerfil.mockResolvedValue([]);
    perfilesService.asociarCurso.mockResolvedValue({ id: 1 });
    perfilesService.desasociarCurso.mockResolvedValue(undefined);
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
    await request(app.getHttpServer()).get('/perfiles-academicos').expect(401);
    expect(perfilesService.listar).not.toHaveBeenCalled();
  });

  it('permite ADMIN_GLOBAL listar', async () => {
    const token = await crearToken('ADMIN_GLOBAL');
    await request(app.getHttpServer())
      .get('/perfiles-academicos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);
    expect(perfilesService.listar).toHaveBeenCalled();
  });

  it('permite COORDINADOR crear perfil', async () => {
    const token = await crearToken('COORDINADOR');
    const dto = {
      carreraId: 1,
      codigo: 'INF-SEG',
      nombre: 'Seguridad Informática',
      descripcion: 'Área de seguridad',
    };

    await request(app.getHttpServer())
      .post('/perfiles-academicos')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201, { id: 1 });

    expect(perfilesService.crear).toHaveBeenCalledWith(dto, 1, false);
  });

  it('asocia y desasocia curso a perfil', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .post('/perfiles-academicos/1/cursos/50')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(perfilesService.asociarCurso).toHaveBeenCalledWith(1, 50, 1, false);

    await request(app.getHttpServer())
      .delete('/perfiles-academicos/1/cursos/50')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(perfilesService.desasociarCurso).toHaveBeenCalledWith(
      1,
      50,
      1,
      false,
    );
  });

  it('rechaza crear perfil si el usuario carece del permiso PERFILES_ACADEMICOS_GESTIONAR', async () => {
    permisosService.usuarioTienePermisos.mockResolvedValueOnce(false);
    const token = await crearToken('COORDINADOR');
    const dto = {
      carreraId: 1,
      codigo: 'INF-SEG',
      nombre: 'Seguridad Informática',
    };

    await request(app.getHttpServer())
      .post('/perfiles-academicos')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(403);

    expect(perfilesService.crear).not.toHaveBeenCalled();
  });
});
