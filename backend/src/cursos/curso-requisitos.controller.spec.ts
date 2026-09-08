import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { RolSistema } from '../auth/constants/roles.constants';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
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
        RolesGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(jwtSecret),
          },
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
  });

  const generarToken = (rol: RolSistema = RolSistema.ADMIN_GLOBAL) =>
    jwtService.sign({
      sub: 1,
      email: 'admin@correo.una.ac.cr',
      roles: [rol],
    });

  it('GET /cursos/:cursoId/requisitos - lista los requisitos de un curso', async () => {
    requisitosService.listar.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get('/cursos/1/requisitos')
      .set('Authorization', `Bearer ${generarToken()}`)
      .expect(200);

    expect(response.body).toEqual([]);
    expect(requisitosService.listar).toHaveBeenCalledWith(1);
  });

  it('POST /cursos/:cursoId/requisitos - crea un requisito para el curso', async () => {
    const nuevo = {
      id: 1,
      cursoId: 1,
      requisitoCursoId: 2,
      tipo: TipoRequisito.REQUISITO,
    };
    requisitosService.crear.mockResolvedValue(nuevo);

    const response = await request(app.getHttpServer())
      .post('/cursos/1/requisitos')
      .set('Authorization', `Bearer ${generarToken()}`)
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

  it('DELETE /cursos/:cursoId/requisitos/:id - elimina un requisito', async () => {
    requisitosService.eliminar.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/cursos/1/requisitos/5')
      .set('Authorization', `Bearer ${generarToken()}`)
      .expect(204);

    expect(requisitosService.eliminar).toHaveBeenCalledWith(1, 5);
  });
});
