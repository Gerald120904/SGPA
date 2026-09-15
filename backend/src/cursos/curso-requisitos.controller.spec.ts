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
import { TipoRequisito } from '../planes-estudio/constants/tipo-requisito.constant';
import { CursoRequisitosController } from './curso-requisitos.controller';
import { CursoRequisitosService } from './curso-requisitos.service';

describe('CursoRequisitosController', () => {
  const jwtSecret = 'test-secret';

  const requisitosService = {
    listar: jest.fn(),
    crear: jest.fn(),
    eliminar: jest.fn(),
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
      controllers: [CursoRequisitosController],
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
          provide: CursoRequisitosService,
          useValue: requisitosService,
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
    permisosAsignados.clear();
  });

  const generarToken = (rol = 'ADMIN_GLOBAL') =>
    jwtService.sign({
      sub: 1,
      email: 'admin@correo.una.ac.cr',
      roles: [rol],
    });

  it('GET /cursos/:cursoId/requisitos - lista requisitos con CURSOS_VER', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_VER);
    requisitosService.listar.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get('/cursos/1/requisitos')
      .set('Authorization', `Bearer ${generarToken('ASISTENTE_ESTUDIANTIL')}`)
      .expect(200);

    expect(response.body).toEqual([]);
    expect(requisitosService.listar).toHaveBeenCalledWith(1);
  });

  it('GET /cursos/:cursoId/requisitos - responde 403 sin CURSOS_VER', async () => {
    await request(app.getHttpServer())
      .get('/cursos/1/requisitos')
      .set('Authorization', `Bearer ${generarToken('ASISTENTE_ESTUDIANTIL')}`)
      .expect(403);

    expect(requisitosService.listar).not.toHaveBeenCalled();
  });

  it('POST /cursos/:cursoId/requisitos - responde 403 sin CURSOS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_VER);

    await request(app.getHttpServer())
      .post('/cursos/1/requisitos')
      .set('Authorization', `Bearer ${generarToken('ASISTENTE_ESTUDIANTIL')}`)
      .send({
        requisitoCursoId: 2,
        tipo: TipoRequisito.REQUISITO,
      })
      .expect(403);

    expect(requisitosService.crear).not.toHaveBeenCalled();
  });

  it('POST /cursos/:cursoId/requisitos - crea un requisito con CURSOS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_GESTIONAR);

    const nuevo = {
      id: 1,
      cursoId: 1,
      requisitoCursoId: 2,
      tipo: TipoRequisito.REQUISITO,
    };
    requisitosService.crear.mockResolvedValue(nuevo);

    const response = await request(app.getHttpServer())
      .post('/cursos/1/requisitos')
      .set('Authorization', `Bearer ${generarToken('COORDINADOR')}`)
      .send({
        requisitoCursoId: 2,
        tipo: TipoRequisito.REQUISITO,
      })
      .expect(201);

    expect(response.body).toEqual(nuevo);
    expect(requisitosService.crear).toHaveBeenCalledWith(1, {
      requisitoCursoId: 2,
      tipo: TipoRequisito.REQUISITO,
    });
  });

  it('DELETE /cursos/:cursoId/requisitos/:id - responde 403 sin CURSOS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_VER);

    await request(app.getHttpServer())
      .delete('/cursos/1/requisitos/5')
      .set('Authorization', `Bearer ${generarToken('ASISTENTE_ESTUDIANTIL')}`)
      .expect(403);

    expect(requisitosService.eliminar).not.toHaveBeenCalled();
  });

  it('DELETE /cursos/:cursoId/requisitos/:id - elimina un requisito con CURSOS_GESTIONAR', async () => {
    permisosAsignados.add(PermisoSistema.CURSOS_GESTIONAR);
    requisitosService.eliminar.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/cursos/1/requisitos/5')
      .set('Authorization', `Bearer ${generarToken('COORDINADOR')}`)
      .expect(204);

    expect(requisitosService.eliminar).toHaveBeenCalledWith(1, 5);
  });
});
