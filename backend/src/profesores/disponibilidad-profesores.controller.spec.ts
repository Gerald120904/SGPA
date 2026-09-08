import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DiaSemana } from './constants/dia-semana.constant';
import { DisponibilidadProfesoresController } from './disponibilidad-profesores.controller';
import { DisponibilidadProfesoresService } from './disponibilidad-profesores.service';

describe('DisponibilidadProfesoresController', () => {
  const jwtSecret = 'disponibilidad-profesores-test-secret';

  const disponibilidadService = {
    consultarMiDisponibilidad: jest.fn(),

    guardarMiDisponibilidad: jest.fn(),

    copiarDisponibilidadAnterior: jest.fn(),

    obtenerHistorialMiDisponibilidad: jest.fn(),

    obtenerDisponibilidadProfesor: jest.fn(),
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

      controllers: [DisponibilidadProfesoresController],

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
          provide: DisponibilidadProfesoresService,

          useValue: disponibilidadService,
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

    disponibilidadService.consultarMiDisponibilidad.mockResolvedValue({
      registrada: true,
      profesorUsuarioId: 10,
      periodoAcademicoId: 2,
      bloques: [],
    });

    disponibilidadService.guardarMiDisponibilidad.mockResolvedValue({
      id: 50,
      profesorUsuarioId: 10,
      periodoAcademicoId: 2,
      bloques: [],
    });

    disponibilidadService.copiarDisponibilidadAnterior.mockResolvedValue({
      id: 51,
      profesorUsuarioId: 10,
      periodoAcademicoId: 2,
      bloques: [],
    });

    disponibilidadService.obtenerHistorialMiDisponibilidad.mockResolvedValue(
      [],
    );

    disponibilidadService.obtenerDisponibilidadProfesor.mockResolvedValue({
      registrada: true,
      profesorUsuarioId: 10,
      periodoAcademicoId: 2,
      bloques: [],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function crearToken(roles: string[], sub = 10) {
    return jwtService.signAsync({
      sub,
      correo: 'usuario@sgpa.local',
      roles,
    });
  }

  it('responde 401 sin JWT', async () => {
    await request(app.getHttpServer())
      .get('/profesores/mi-disponibilidad/2')
      .expect(401);

    expect(
      disponibilidadService.consultarMiDisponibilidad,
    ).not.toHaveBeenCalled();
  });

  it('permite al PROFESOR consultar su propia disponibilidad', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .get('/profesores/mi-disponibilidad/2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      disponibilidadService.consultarMiDisponibilidad,
    ).toHaveBeenCalledWith(10, 2);
  });

  it('permite al PROFESOR guardar su propia disponibilidad', async () => {
    const token = await crearToken(['PROFESOR']);

    const dto = {
      periodoAcademicoId: 2,

      bloques: [
        {
          dia: DiaSemana.LUNES,
          horaInicio: '08:00',
          horaFin: '11:00',
        },

        {
          dia: DiaSemana.MIERCOLES,
          horaInicio: '13:00',
          horaFin: '17:00',
        },
      ],

      observaciones: 'Disponibilidad del ciclo',
    };

    await request(app.getHttpServer())
      .put('/profesores/mi-disponibilidad')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200);

    expect(disponibilidadService.guardarMiDisponibilidad).toHaveBeenCalledWith(
      10,
      dto,
    );
  });

  it('permite registrar disponibilidad sin bloques', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .put('/profesores/mi-disponibilidad')
      .set('Authorization', `Bearer ${token}`)
      .send({
        periodoAcademicoId: 2,
        bloques: [],
        observaciones: 'No disponible',
      })
      .expect(200);

    expect(disponibilidadService.guardarMiDisponibilidad).toHaveBeenCalled();
  });

  it('rechaza formato de hora inválido', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .put('/profesores/mi-disponibilidad')
      .set('Authorization', `Bearer ${token}`)
      .send({
        periodoAcademicoId: 2,

        bloques: [
          {
            dia: DiaSemana.LUNES,

            horaInicio: '8:00 AM',

            horaFin: '11:00',
          },
        ],
      })
      .expect(400);

    expect(
      disponibilidadService.guardarMiDisponibilidad,
    ).not.toHaveBeenCalled();
  });

  it('rechaza día inválido', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .put('/profesores/mi-disponibilidad')
      .set('Authorization', `Bearer ${token}`)
      .send({
        periodoAcademicoId: 2,

        bloques: [
          {
            dia: 'FUNDAY',
            horaInicio: '08:00',
            horaFin: '10:00',
          },
        ],
      })
      .expect(400);

    expect(
      disponibilidadService.guardarMiDisponibilidad,
    ).not.toHaveBeenCalled();
  });

  it('rechaza campos adicionales', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .put('/profesores/mi-disponibilidad')
      .set('Authorization', `Bearer ${token}`)
      .send({
        periodoAcademicoId: 2,
        bloques: [],
        profesorUsuarioId: 999,
      })
      .expect(400);

    expect(
      disponibilidadService.guardarMiDisponibilidad,
    ).not.toHaveBeenCalled();
  });

  it('permite copiar disponibilidad anterior', async () => {
    const token = await crearToken(['PROFESOR']);

    const dto = {
      periodoOrigenId: 1,
      periodoDestinoId: 2,
    };

    await request(app.getHttpServer())
      .post('/profesores/mi-disponibilidad/copiar')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201);

    expect(
      disponibilidadService.copiarDisponibilidadAnterior,
    ).toHaveBeenCalledWith(10, dto);
  });

  it('rechaza copiar con ids inválidos', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .post('/profesores/mi-disponibilidad/copiar')
      .set('Authorization', `Bearer ${token}`)
      .send({
        periodoOrigenId: 0,
        periodoDestinoId: -1,
      })
      .expect(400);

    expect(
      disponibilidadService.copiarDisponibilidadAnterior,
    ).not.toHaveBeenCalled();
  });

  it('permite al PROFESOR consultar su historial', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .get('/profesores/mi-disponibilidad/2/historial')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(
      disponibilidadService.obtenerHistorialMiDisponibilidad,
    ).toHaveBeenCalledWith(10, 2);
  });

  it('permite a COORDINADOR consultar disponibilidad de un profesor', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/profesores/10/disponibilidad/2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      disponibilidadService.obtenerDisponibilidadProfesor,
    ).toHaveBeenCalledWith(10, 2);
  });

  it('permite a ADMIN_GLOBAL consultar disponibilidad de un profesor', async () => {
    const token = await crearToken(['ADMIN_GLOBAL']);

    await request(app.getHttpServer())
      .get('/profesores/10/disponibilidad/2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      disponibilidadService.obtenerDisponibilidadProfesor,
    ).toHaveBeenCalledWith(10, 2);
  });

  it('impide a PROFESOR consultar la disponibilidad de otro profesor', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .get('/profesores/99/disponibilidad/2')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(
      disponibilidadService.obtenerDisponibilidadProfesor,
    ).not.toHaveBeenCalled();
  });

  it('impide a COORDINADOR modificar disponibilidad si no posee rol PROFESOR', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .put('/profesores/mi-disponibilidad')
      .set('Authorization', `Bearer ${token}`)
      .send({
        periodoAcademicoId: 2,
        bloques: [],
      })
      .expect(403);

    expect(
      disponibilidadService.guardarMiDisponibilidad,
    ).not.toHaveBeenCalled();
  });

  it('impide a ADMIN_GLOBAL modificar disponibilidad si no posee rol PROFESOR', async () => {
    const token = await crearToken(['ADMIN_GLOBAL']);

    await request(app.getHttpServer())
      .put('/profesores/mi-disponibilidad')
      .set('Authorization', `Bearer ${token}`)
      .send({
        periodoAcademicoId: 2,
        bloques: [],
      })
      .expect(403);

    expect(
      disponibilidadService.guardarMiDisponibilidad,
    ).not.toHaveBeenCalled();
  });

  it('permite a COORDINADOR + PROFESOR modificar únicamente su propia disponibilidad', async () => {
    const token = await crearToken(['COORDINADOR', 'PROFESOR'], 25);

    await request(app.getHttpServer())
      .put('/profesores/mi-disponibilidad')
      .set('Authorization', `Bearer ${token}`)
      .send({
        periodoAcademicoId: 2,

        bloques: [
          {
            dia: DiaSemana.VIERNES,
            horaInicio: '08:00',
            horaFin: '12:00',
          },
        ],
      })
      .expect(200);

    expect(disponibilidadService.guardarMiDisponibilidad).toHaveBeenCalledWith(
      25,
      expect.objectContaining({
        periodoAcademicoId: 2,
      }),
    );
  });

  it('rechaza periodoId no numérico en mi disponibilidad', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .get('/profesores/mi-disponibilidad/no-es-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('rechaza profesorId inválido para consulta administrativa', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/profesores/no-es-id/disponibilidad/2')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
