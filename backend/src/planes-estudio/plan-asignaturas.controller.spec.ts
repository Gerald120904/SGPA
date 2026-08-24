import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TipoPlanAsignatura } from './constants/tipo-plan-asignatura.constant';
import { PlanAsignaturasController } from './plan-asignaturas.controller';
import { PlanAsignaturasService } from './plan-asignaturas.service';

describe('PlanAsignaturasController', () => {
  const jwtSecret = 'plan-asignaturas-test-secret';
  const service = {
    listar: jest.fn(),
    obtenerPorId: jest.fn(),
    crear: jest.fn(),
    cargaMasiva: jest.fn(),
    actualizar: jest.fn(),
    cambiarEstado: jest.fn(),
  };
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: jwtSecret })],
      controllers: [PlanAsignaturasController],
      providers: [
        AuthGuard,
        RolesGuard,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(jwtSecret) },
        },
        { provide: PlanAsignaturasService, useValue: service },
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
    service.obtenerPorId.mockResolvedValue({ id: 10 });
    service.crear.mockResolvedValue({ id: 10 });
    service.cargaMasiva.mockResolvedValue({ total: 2, asignaturas: [] });
    service.actualizar.mockResolvedValue({ id: 10 });
    service.cambiarEstado.mockResolvedValue({ id: 10 });
  });

  afterAll(async () => {
    await app.close();
  });

  async function token(rol: string) {
    return jwtService.signAsync({
      sub: 1,
      correo: 'usuario@sgpa.local',
      roles: [rol],
    });
  }

  it('responde 401 sin JWT', async () => {
    await request(app.getHttpServer())
      .get('/planes-estudio/1/asignaturas')
      .expect(401);
  });

  it.each(['ADMIN_GLOBAL', 'COORDINADOR'])('permite el rol %s', async (rol) => {
    await request(app.getHttpServer())
      .get('/planes-estudio/1/asignaturas')
      .set('Authorization', `Bearer ${await token(rol)}`)
      .expect(200, []);

    expect(service.listar).toHaveBeenCalledWith(1);
  });

  it.each(['PROFESOR', 'ESTUDIANTE'])('responde 403 para %s', async (rol) => {
    await request(app.getHttpServer())
      .get('/planes-estudio/1/asignaturas')
      .set('Authorization', `Bearer ${await token(rol)}`)
      .expect(403);

    expect(service.listar).not.toHaveBeenCalled();
  });

  it('crea una asignatura con curso real', async () => {
    const dto = {
      cursoId: 5,
      nivel: 1,
      ciclo: 1,
      orden: 1,
      creditos: 3,
      tipo: TipoPlanAsignatura.OBLIGATORIA,
    };

    await request(app.getHttpServer())
      .post('/planes-estudio/1/asignaturas')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send(dto)
      .expect(201, { id: 10 });

    expect(service.crear).toHaveBeenCalledWith(1, dto);
  });

  it('acepta horas académicas con hasta dos decimales', async () => {
    const dto = {
      cursoId: 5,
      nivel: 1,
      ciclo: 1,
      orden: 1,
      creditos: 3,
      tipo: TipoPlanAsignatura.OBLIGATORIA,
      horasTeoria: 2.5,
      horasPractica: 1.25,
      horasGira: 0,
      horasTotales: 7.75,
      observacionHoras: 'Según plan oficial',
    };

    await request(app.getHttpServer())
      .post('/planes-estudio/1/asignaturas')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send(dto)
      .expect(201, { id: 10 });

    expect(service.crear).toHaveBeenCalledWith(1, dto);
  });

  it('acepta una carga masiva válida', async () => {
    const dto = {
      asignaturas: [
        {
          cursoId: 5,
          nivel: 1,
          ciclo: 1,
          orden: 1,
          creditos: 3,
          tipo: TipoPlanAsignatura.OBLIGATORIA,
        },
        {
          cursoId: 11,
          nivel: 1,
          ciclo: 1,
          orden: 2,
          creditos: 4,
          tipo: TipoPlanAsignatura.OBLIGATORIA,
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/planes-estudio/1/asignaturas/carga-masiva')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send(dto)
      .expect(201, { total: 2, asignaturas: [] });

    expect(service.cargaMasiva).toHaveBeenCalledWith(1, dto);
  });

  it('rechaza elementos inválidos dentro de una carga masiva', async () => {
    await request(app.getHttpServer())
      .post('/planes-estudio/1/asignaturas/carga-masiva')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({
        asignaturas: [
          {
            cursoId: 5,
            nivel: 0,
          },
        ],
      })
      .expect(400);

    expect(service.cargaMasiva).not.toHaveBeenCalled();
  });

  it('rechaza cargas masivas de más de 200 asignaturas', async () => {
    const asignatura = {
      cursoId: 5,
      nivel: 1,
      ciclo: 1,
      orden: 1,
      creditos: 3,
      tipo: TipoPlanAsignatura.OBLIGATORIA,
    };

    await request(app.getHttpServer())
      .post('/planes-estudio/1/asignaturas/carga-masiva')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({
        asignaturas: Array.from({ length: 201 }, () => asignatura),
      })
      .expect(400);

    expect(service.cargaMasiva).not.toHaveBeenCalled();
  });

  it('rechaza horas negativas o con más de dos decimales', async () => {
    await request(app.getHttpServer())
      .post('/planes-estudio/1/asignaturas')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({
        cursoId: 5,
        nivel: 1,
        ciclo: 1,
        orden: 1,
        creditos: 3,
        tipo: TipoPlanAsignatura.OBLIGATORIA,
        horasTeoria: -1,
        horasTotales: 7.777,
      })
      .expect(400);

    expect(service.crear).not.toHaveBeenCalled();
  });

  it('crea un espacio curricular sin curso', async () => {
    const dto = {
      nivel: 4,
      ciclo: 1,
      orden: 3,
      creditos: 3,
      tipo: TipoPlanAsignatura.OPTATIVA,
      nombreReferencia: 'Optativa',
    };

    await request(app.getHttpServer())
      .post('/planes-estudio/1/asignaturas')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send(dto)
      .expect(201, { id: 10 });

    expect(service.crear).toHaveBeenCalledWith(1, dto);
  });

  it('rechaza valores curriculares fuera de rango', async () => {
    await request(app.getHttpServer())
      .post('/planes-estudio/1/asignaturas')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({
        nivel: 0,
        ciclo: 21,
        orden: 1000,
        creditos: 31,
        tipo: TipoPlanAsignatura.OBLIGATORIA,
        nombreReferencia: 'Prueba',
      })
      .expect(400);

    expect(service.crear).not.toHaveBeenCalled();
  });

  it('rechaza un tipo de asignatura inválido', async () => {
    await request(app.getHttpServer())
      .post('/planes-estudio/1/asignaturas')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({
        nivel: 1,
        ciclo: 1,
        orden: 1,
        creditos: 3,
        tipo: 'INVENTADA',
        nombreReferencia: 'Prueba',
      })
      .expect(400);
  });

  it('consulta una asignatura por id dentro del plan', async () => {
    await request(app.getHttpServer())
      .get('/planes-estudio/1/asignaturas/10')
      .set('Authorization', `Bearer ${await token('ADMIN_GLOBAL')}`)
      .expect(200, { id: 10 });

    expect(service.obtenerPorId).toHaveBeenCalledWith(1, 10);
  });

  it('actualiza una asignatura y permite cursoId null', async () => {
    const dto = {
      cursoId: null,
      nombreReferencia: 'Optativa',
      tipo: TipoPlanAsignatura.OPTATIVA,
    };

    await request(app.getHttpServer())
      .patch('/planes-estudio/1/asignaturas/10')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send(dto)
      .expect(200, { id: 10 });

    expect(service.actualizar).toHaveBeenCalledWith(1, 10, dto);
  });

  it('actualiza créditos y orden de una asignatura', async () => {
    const dto = {
      creditos: 4,
      orden: 2,
    };

    await request(app.getHttpServer())
      .patch('/planes-estudio/1/asignaturas/10')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send(dto)
      .expect(200, { id: 10 });

    expect(service.actualizar).toHaveBeenCalledWith(1, 10, dto);
  });

  it('permite limpiar horas académicas con null', async () => {
    const dto = {
      horasLaboratorio: null,
      observacionHoras: null,
    };

    await request(app.getHttpServer())
      .patch('/planes-estudio/1/asignaturas/10')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send(dto)
      .expect(200, { id: 10 });

    expect(service.actualizar).toHaveBeenCalledWith(1, 10, dto);
  });

  it('cambia el estado de una asignatura', async () => {
    await request(app.getHttpServer())
      .patch('/planes-estudio/1/asignaturas/10/estado')
      .set('Authorization', `Bearer ${await token('COORDINADOR')}`)
      .send({ activo: false })
      .expect(200, { id: 10 });

    expect(service.cambiarEstado).toHaveBeenCalledWith(1, 10, false);
  });
});
