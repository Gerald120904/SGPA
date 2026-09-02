import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EstadoPeriodoAcademico } from './constants/estado-periodo-academico.constant';
import { PeriodosAcademicosController } from './periodos-academicos.controller';
import { PeriodosAcademicosService } from './periodos-academicos.service';

describe('PeriodosAcademicosController', () => {
  const jwtSecret = 'periodos-academicos-test-secret';

  const periodosAcademicosService = {
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
      controllers: [PeriodosAcademicosController],
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
          provide: PeriodosAcademicosService,
          useValue: periodosAcademicosService,
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

    periodosAcademicosService.listar.mockResolvedValue([]);
    periodosAcademicosService.obtenerPorId.mockResolvedValue({ id: 1 });
    periodosAcademicosService.crear.mockResolvedValue({ id: 1 });
    periodosAcademicosService.actualizar.mockResolvedValue({ id: 1 });
    periodosAcademicosService.cambiarEstado.mockResolvedValue({ id: 1 });
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

  it('responde 401 al listar sin JWT', async () => {
    await request(app.getHttpServer()).get('/periodos-academicos').expect(401);

    expect(periodosAcademicosService.listar).not.toHaveBeenCalled();
  });

  it('permite listar periodos a ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .get('/periodos-academicos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(periodosAcademicosService.listar).toHaveBeenCalledTimes(1);
  });

  it('permite listar periodos a COORDINADOR', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .get('/periodos-academicos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(periodosAcademicosService.listar).toHaveBeenCalledTimes(1);
  });

  it.each(['PROFESOR', 'ESTUDIANTE'])('responde 403 para %s', async (rol) => {
    const token = await crearToken(rol);

    await request(app.getHttpServer())
      .get('/periodos-academicos')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(periodosAcademicosService.listar).not.toHaveBeenCalled();
  });

  it('consulta un periodo por id', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .get('/periodos-academicos/1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { id: 1 });

    expect(periodosAcademicosService.obtenerPorId).toHaveBeenCalledWith(1);
  });

  it('rechaza un id inválido', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .get('/periodos-academicos/no-es-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(periodosAcademicosService.obtenerPorId).not.toHaveBeenCalled();
  });

  it('crea un periodo académico válido', async () => {
    const token = await crearToken('COORDINADOR');

    const dto = {
      anio: 2027,
      ciclo: 1,
      fechaInicio: '2027-02-15',
      fechaFin: '2027-06-25',
      fechaLimiteDisponibilidad: '2027-01-20',
      observaciones: 'Primer ciclo lectivo',
    };

    await request(app.getHttpServer())
      .post('/periodos-academicos')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201, { id: 1 });

    expect(periodosAcademicosService.crear).toHaveBeenCalledWith(dto);
  });

  it('rechaza crear un periodo sin año', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .post('/periodos-academicos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ciclo: 1,
        fechaInicio: '2027-02-15',
        fechaFin: '2027-06-25',
        fechaLimiteDisponibilidad: '2027-01-20',
      })
      .expect(400);

    expect(periodosAcademicosService.crear).not.toHaveBeenCalled();
  });

  it('rechaza un ciclo menor a 1', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .post('/periodos-academicos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anio: 2027,
        ciclo: 0,
        fechaInicio: '2027-02-15',
        fechaFin: '2027-06-25',
        fechaLimiteDisponibilidad: '2027-01-20',
      })
      .expect(400);

    expect(periodosAcademicosService.crear).not.toHaveBeenCalled();
  });

  it('rechaza un ciclo mayor a 2', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .post('/periodos-academicos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anio: 2027,
        ciclo: 3,
        fechaInicio: '2027-02-15',
        fechaFin: '2027-06-25',
        fechaLimiteDisponibilidad: '2027-01-20',
      })
      .expect(400);

    expect(periodosAcademicosService.crear).not.toHaveBeenCalled();
  });

  it('rechaza un año fuera del rango permitido', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/periodos-academicos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anio: 1999,
        ciclo: 1,
        fechaInicio: '1999-02-15',
        fechaFin: '1999-06-25',
        fechaLimiteDisponibilidad: '1999-01-20',
      })
      .expect(400);

    expect(periodosAcademicosService.crear).not.toHaveBeenCalled();
  });

  it('rechaza fechas con formato inválido', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .post('/periodos-academicos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anio: 2027,
        ciclo: 1,
        fechaInicio: 'fecha-inventada',
        fechaFin: '2027-06-25',
        fechaLimiteDisponibilidad: '2027-01-20',
      })
      .expect(400);

    expect(periodosAcademicosService.crear).not.toHaveBeenCalled();
  });

  it('rechaza código, nombre y estado enviados manualmente al crear', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .post('/periodos-academicos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anio: 2027,
        ciclo: 1,
        fechaInicio: '2027-02-15',
        fechaFin: '2027-06-25',
        fechaLimiteDisponibilidad: '2027-01-20',
        codigo: 'CODIGO-MANUAL',
        nombre: 'Nombre manual',
        estado: 'EN_CURSO',
      })
      .expect(400);

    expect(periodosAcademicosService.crear).not.toHaveBeenCalled();
  });

  it('actualiza un periodo académico', async () => {
    const token = await crearToken('COORDINADOR');

    const dto = {
      fechaInicio: '2027-02-17',
      fechaFin: '2027-06-27',
      observaciones: 'Fechas modificadas',
    };

    await request(app.getHttpServer())
      .patch('/periodos-academicos/1')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200, { id: 1 });

    expect(periodosAcademicosService.actualizar).toHaveBeenCalledWith(1, dto);
  });

  it('rechaza modificar manualmente código, nombre o estado', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .patch('/periodos-academicos/1')
      .set('Authorization', `Bearer ${token}`)
      .send({
        codigo: '2028-C2',
        nombre: 'II Ciclo 2028',
        estado: 'CERRADO',
      })
      .expect(400);

    expect(periodosAcademicosService.actualizar).not.toHaveBeenCalled();
  });

  it('cambia el estado de un periodo', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .patch('/periodos-academicos/1/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({
        estado: EstadoPeriodoAcademico.EN_PREPARACION,
      })
      .expect(200, { id: 1 });

    expect(periodosAcademicosService.cambiarEstado).toHaveBeenCalledWith(
      1,
      EstadoPeriodoAcademico.EN_PREPARACION,
    );
  });

  it('rechaza un estado académico inválido', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .patch('/periodos-academicos/1/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({
        estado: 'ESTADO_INVENTADO',
      })
      .expect(400);

    expect(periodosAcademicosService.cambiarEstado).not.toHaveBeenCalled();
  });

  it('rechaza campos adicionales al cambiar estado', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .patch('/periodos-academicos/1/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({
        estado: EstadoPeriodoAcademico.EN_PREPARACION,
        nombre: 'No debería aceptarse',
      })
      .expect(400);

    expect(periodosAcademicosService.cambiarEstado).not.toHaveBeenCalled();
  });
});
