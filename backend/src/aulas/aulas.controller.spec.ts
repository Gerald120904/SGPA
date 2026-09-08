import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AulasController } from './aulas.controller';
import { AulasService } from './aulas.service';
import { OrigenAula } from './constants/origen-aula.constant';
import { TipoAula } from './constants/tipo-aula.constant';
import { TipoMobiliarioAula } from './constants/tipo-mobiliario-aula.constant';
import { TipoIndisponibilidadAula } from './constants/tipo-indisponibilidad-aula.constant';
import { TipoReservaAula } from './constants/tipo-reserva-aula.constant';

describe('AulasController', () => {
  const jwtSecret = 'aulas-test-secret';

  const aulasService = {
    listar: jest.fn(),
    obtenerPorId: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    cambiarEstado: jest.fn(),
    listarEquipamientos: jest.fn(),
    obtenerEquipamientoPorId: jest.fn(),
    crearEquipamiento: jest.fn(),
    actualizarEquipamiento: jest.fn(),
    cambiarEstadoEquipamiento: jest.fn(),
    listarEquipamientoAula: jest.fn(),
    asignarEquipamientoAula: jest.fn(),
    actualizarEquipamientoAula: jest.fn(),
    cambiarEstadoEquipamientoAula: jest.fn(),
    listarIndisponibilidadesAula: jest.fn(),
    obtenerIndisponibilidadPorId: jest.fn(),
    crearIndisponibilidadAula: jest.fn(),
    actualizarIndisponibilidadAula: jest.fn(),
    cambiarEstadoIndisponibilidadAula: jest.fn(),
    listarReservasAula: jest.fn(),
    obtenerReservaPorId: jest.fn(),
    crearReservaAula: jest.fn(),
    actualizarReservaAula: jest.fn(),
    cambiarEstadoReservaAula: jest.fn(),
    consultarOcupacionAula: jest.fn(),
    listarAuditoriaAula: jest.fn(),
    listarDisponibilidadesAula: jest.fn(),
    crearDisponibilidadAula: jest.fn(),
    actualizarDisponibilidadAula: jest.fn(),
    eliminarDisponibilidadAula: jest.fn(),
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
      controllers: [AulasController],
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
          provide: AulasService,
          useValue: aulasService,
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

    aulasService.listar.mockResolvedValue([]);
    aulasService.obtenerPorId.mockResolvedValue({
      id: 1,
    });
    aulasService.crear.mockResolvedValue({
      id: 1,
    });
    aulasService.actualizar.mockResolvedValue({
      id: 1,
    });
    aulasService.cambiarEstado.mockResolvedValue({
      id: 1,
    });
    aulasService.listarEquipamientos.mockResolvedValue([]);
    aulasService.obtenerEquipamientoPorId.mockResolvedValue({ id: 1 });
    aulasService.crearEquipamiento.mockResolvedValue({ id: 1 });
    aulasService.actualizarEquipamiento.mockResolvedValue({ id: 1 });
    aulasService.cambiarEstadoEquipamiento.mockResolvedValue({ id: 1 });
    aulasService.listarEquipamientoAula.mockResolvedValue([]);
    aulasService.asignarEquipamientoAula.mockResolvedValue({ id: 1 });
    aulasService.actualizarEquipamientoAula.mockResolvedValue({ id: 1 });
    aulasService.cambiarEstadoEquipamientoAula.mockResolvedValue({ id: 1 });
    aulasService.listarIndisponibilidadesAula.mockResolvedValue([]);
    aulasService.obtenerIndisponibilidadPorId.mockResolvedValue({ id: 1 });
    aulasService.crearIndisponibilidadAula.mockResolvedValue({ id: 1 });
    aulasService.actualizarIndisponibilidadAula.mockResolvedValue({ id: 1 });
    aulasService.cambiarEstadoIndisponibilidadAula.mockResolvedValue({ id: 1 });
    aulasService.listarReservasAula.mockResolvedValue([]);
    aulasService.obtenerReservaPorId.mockResolvedValue({ id: 1 });
    aulasService.crearReservaAula.mockResolvedValue({ id: 1 });
    aulasService.actualizarReservaAula.mockResolvedValue({ id: 1 });
    aulasService.cambiarEstadoReservaAula.mockResolvedValue({ id: 1 });
    aulasService.consultarOcupacionAula.mockResolvedValue({
      aula: {
        id: 1,
      },
      ocupaciones: [],
    });
    aulasService.listarAuditoriaAula.mockResolvedValue([]);
    aulasService.listarDisponibilidadesAula.mockResolvedValue([]);
    aulasService.crearDisponibilidadAula.mockResolvedValue({ id: 1 });
    aulasService.actualizarDisponibilidadAula.mockResolvedValue({ id: 1 });
    aulasService.eliminarDisponibilidadAula.mockResolvedValue({
      message: 'Bloque de disponibilidad eliminado correctamente.',
    });
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
    await request(app.getHttpServer()).get('/aulas').expect(401);

    expect(aulasService.listar).not.toHaveBeenCalled();
  });

  it('permite listar aulas a ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .get('/aulas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(aulasService.listar).toHaveBeenCalledTimes(1);
  });

  it('permite listar aulas a COORDINADOR', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .get('/aulas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(aulasService.listar).toHaveBeenCalledTimes(1);
  });

  it('permite listar aulas a PROFESOR', async () => {
    const token = await crearToken('PROFESOR');

    await request(app.getHttpServer())
      .get('/aulas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(aulasService.listar).toHaveBeenCalledTimes(1);
  });

  it('responde 403 al listar para ESTUDIANTE', async () => {
    const token = await crearToken('ESTUDIANTE');

    await request(app.getHttpServer())
      .get('/aulas')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(aulasService.listar).not.toHaveBeenCalled();
  });

  it('consulta un aula por id', async () => {
    const token = await crearToken('PROFESOR');

    await request(app.getHttpServer())
      .get('/aulas/1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, {
        id: 1,
      });

    expect(aulasService.obtenerPorId).toHaveBeenCalledWith(1);
  });

  it('rechaza un id inválido', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .get('/aulas/no-es-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(aulasService.obtenerPorId).not.toHaveBeenCalled();
  });

  it('permite crear un aula a ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    const dto = {
      codigo: 'AULA-01',
      nombre: 'Aula 1',
      ubicacion: 'Edificio principal',
      capacidad: 40,
      tipo: TipoAula.AULA,
      tipoMobiliario: TipoMobiliarioAula.PUPITRE,
      origen: OrigenAula.UNA,
    };

    await request(app.getHttpServer())
      .post('/aulas')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201, {
        id: 1,
      });

    expect(aulasService.crear).toHaveBeenCalledWith(dto, 1);
  });

  it.each(['COORDINADOR', 'PROFESOR', 'ESTUDIANTE'])(
    'responde 403 al crear para %s',
    async (rol) => {
      const token = await crearToken(rol);

      await request(app.getHttpServer())
        .post('/aulas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          codigo: 'AULA-01',
          nombre: 'Aula 1',
          capacidad: 40,
          tipo: TipoAula.AULA,
          tipoMobiliario: TipoMobiliarioAula.PUPITRE,
          origen: OrigenAula.UNA,
        })
        .expect(403);

      expect(aulasService.crear).not.toHaveBeenCalled();
    },
  );

  it('rechaza crear un aula sin código', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Aula 1',
        capacidad: 40,
        tipo: TipoAula.AULA,
        tipoMobiliario: TipoMobiliarioAula.PUPITRE,
        origen: OrigenAula.UNA,
      })
      .expect(400);

    expect(aulasService.crear).not.toHaveBeenCalled();
  });

  it('rechaza una capacidad menor a 1', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        codigo: 'AULA-01',
        nombre: 'Aula 1',
        capacidad: 0,
        tipo: TipoAula.AULA,
        tipoMobiliario: TipoMobiliarioAula.PUPITRE,
        origen: OrigenAula.UNA,
      })
      .expect(400);

    expect(aulasService.crear).not.toHaveBeenCalled();
  });

  it('rechaza un tipo de aula inválido', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        codigo: 'AULA-01',
        nombre: 'Aula 1',
        capacidad: 40,
        tipo: 'TIPO_INVENTADO',
        tipoMobiliario: TipoMobiliarioAula.PUPITRE,
        origen: OrigenAula.UNA,
      })
      .expect(400);

    expect(aulasService.crear).not.toHaveBeenCalled();
  });

  it('rechaza un tipo de mobiliario inválido', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        codigo: 'AULA-01',
        nombre: 'Aula 1',
        capacidad: 40,
        tipo: TipoAula.AULA,
        tipoMobiliario: 'MOBILIARIO_INVENTADO',
        origen: OrigenAula.UNA,
      })
      .expect(400);

    expect(aulasService.crear).not.toHaveBeenCalled();
  });

  it('rechaza crear un aula sin tipo de mobiliario', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        codigo: 'AULA-01',
        nombre: 'Aula 1',
        capacidad: 40,
        tipo: TipoAula.AULA,
        origen: OrigenAula.UNA,
      })
      .expect(400);

    expect(aulasService.crear).not.toHaveBeenCalled();
  });

  it('rechaza un origen inválido', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        codigo: 'AULA-01',
        nombre: 'Aula 1',
        capacidad: 40,
        tipo: TipoAula.AULA,
        tipoMobiliario: TipoMobiliarioAula.PUPITRE,
        origen: 'ORIGEN_INVENTADO',
      })
      .expect(400);

    expect(aulasService.crear).not.toHaveBeenCalled();
  });

  it('rechaza campos adicionales al crear', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        codigo: 'AULA-01',
        nombre: 'Aula 1',
        capacidad: 40,
        tipo: TipoAula.AULA,
        tipoMobiliario: TipoMobiliarioAula.PUPITRE,
        origen: OrigenAula.UNA,
        activo: false,
      })
      .expect(400);

    expect(aulasService.crear).not.toHaveBeenCalled();
  });

  it('permite actualizar un aula a ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    const dto = {
      nombre: 'Aula Principal',
      capacidad: 45,
    };

    await request(app.getHttpServer())
      .patch('/aulas/1')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200, {
        id: 1,
      });

    expect(aulasService.actualizar).toHaveBeenCalledWith(1, dto, 1);
  });

  it.each(['COORDINADOR', 'PROFESOR', 'ESTUDIANTE'])(
    'responde 403 al actualizar para %s',
    async (rol) => {
      const token = await crearToken(rol);

      await request(app.getHttpServer())
        .patch('/aulas/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Aula modificada',
        })
        .expect(403);

      expect(aulasService.actualizar).not.toHaveBeenCalled();
    },
  );

  it('permite cambiar estado a ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .patch('/aulas/1/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({
        activo: false,
      })
      .expect(200, {
        id: 1,
      });

    expect(aulasService.cambiarEstado).toHaveBeenCalledWith(1, false, 1);
  });

  it.each(['COORDINADOR', 'PROFESOR', 'ESTUDIANTE'])(
    'responde 403 al cambiar estado para %s',
    async (rol) => {
      const token = await crearToken(rol);

      await request(app.getHttpServer())
        .patch('/aulas/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activo: false,
        })
        .expect(403);

      expect(aulasService.cambiarEstado).not.toHaveBeenCalled();
    },
  );

  it('rechaza estado que no sea boolean', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .patch('/aulas/1/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({
        activo: 'no',
      })
      .expect(400);

    expect(aulasService.cambiarEstado).not.toHaveBeenCalled();
  });

  it.each(['ADMIN_GLOBAL', 'COORDINADOR', 'PROFESOR'])(
    'permite consultar el catálogo a %s',
    async (rol) => {
      const token = await crearToken(rol);

      await request(app.getHttpServer())
        .get('/aulas/equipamientos')
        .set('Authorization', `Bearer ${token}`)
        .expect(200, []);

      expect(aulasService.listarEquipamientos).toHaveBeenCalledTimes(1);
    },
  );

  it('deniega el catálogo a ESTUDIANTE', async () => {
    const token = await crearToken('ESTUDIANTE');

    await request(app.getHttpServer())
      .get('/aulas/equipamientos')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(aulasService.listarEquipamientos).not.toHaveBeenCalled();
  });

  it('crea equipamiento únicamente como ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');
    const dto = {
      nombre: 'Proyector',
      descripcion: 'Proyector multimedia',
    };

    await request(app.getHttpServer())
      .post('/aulas/equipamientos')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201, { id: 1 });

    expect(aulasService.crearEquipamiento).toHaveBeenCalledWith(dto, 1);
  });

  it('consulta un equipamiento por id', async () => {
    const token = await crearToken('PROFESOR');

    await request(app.getHttpServer())
      .get('/aulas/equipamientos/1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { id: 1 });

    expect(aulasService.obtenerEquipamientoPorId).toHaveBeenCalledWith(1);
  });

  it.each(['COORDINADOR', 'PROFESOR', 'ESTUDIANTE'])(
    'responde 403 al crear equipamiento para %s',
    async (rol) => {
      const token = await crearToken(rol);

      await request(app.getHttpServer())
        .post('/aulas/equipamientos')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Proyector' })
        .expect(403);

      expect(aulasService.crearEquipamiento).not.toHaveBeenCalled();
    },
  );

  it('rechaza crear equipamiento sin nombre', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas/equipamientos')
      .set('Authorization', `Bearer ${token}`)
      .send({ descripcion: 'Sin nombre' })
      .expect(400);

    expect(aulasService.crearEquipamiento).not.toHaveBeenCalled();
  });

  it('permite actualizar equipamiento a ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');
    const dto = { nombre: 'Proyector multimedia' };

    await request(app.getHttpServer())
      .patch('/aulas/equipamientos/1')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200, { id: 1 });

    expect(aulasService.actualizarEquipamiento).toHaveBeenCalledWith(1, dto, 1);
  });

  it('permite cambiar estado de equipamiento a ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .patch('/aulas/equipamientos/1/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: false })
      .expect(200, { id: 1 });

    expect(aulasService.cambiarEstadoEquipamiento).toHaveBeenCalledWith(
      1,
      false,
      1,
    );
  });

  it('no confunde equipamientos con el id de un aula', async () => {
    const token = await crearToken('PROFESOR');

    await request(app.getHttpServer())
      .get('/aulas/equipamientos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(aulasService.obtenerPorId).not.toHaveBeenCalled();
  });

  it('lista equipamiento de un aula para COORDINADOR', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .get('/aulas/1/equipamientos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(aulasService.listarEquipamientoAula).toHaveBeenCalledWith(1);
  });

  it('asigna equipamiento a un aula como ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');
    const dto = {
      equipamientoId: 1,
      cantidadTotal: 25,
      cantidadDisponible: 23,
      observaciones: '2 computadoras en reparación',
    };

    await request(app.getHttpServer())
      .post('/aulas/1/equipamientos')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201, { id: 1 });

    expect(aulasService.asignarEquipamientoAula).toHaveBeenCalledWith(
      1,
      dto,
      1,
    );
  });

  it('rechaza cantidades inválidas antes de llamar al servicio', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas/1/equipamientos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        equipamientoId: 1,
        cantidadTotal: 0,
        cantidadDisponible: 0,
      })
      .expect(400);

    expect(aulasService.asignarEquipamientoAula).not.toHaveBeenCalled();
  });

  it('rechaza cantidad disponible negativa', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas/1/equipamientos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        equipamientoId: 1,
        cantidadTotal: 10,
        cantidadDisponible: -1,
      })
      .expect(400);

    expect(aulasService.asignarEquipamientoAula).not.toHaveBeenCalled();
  });

  it.each(['COORDINADOR', 'PROFESOR', 'ESTUDIANTE'])(
    'responde 403 al asignar equipamiento para %s',
    async (rol) => {
      const token = await crearToken(rol);

      await request(app.getHttpServer())
        .post('/aulas/1/equipamientos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          equipamientoId: 1,
          cantidadTotal: 1,
          cantidadDisponible: 1,
        })
        .expect(403);

      expect(aulasService.asignarEquipamientoAula).not.toHaveBeenCalled();
    },
  );

  it('permite actualizar equipamiento de un aula a ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');
    const dto = {
      cantidadDisponible: 22,
      observaciones: '3 computadoras en reparación',
    };

    await request(app.getHttpServer())
      .patch('/aulas/1/equipamientos/1')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200, { id: 1 });

    expect(aulasService.actualizarEquipamientoAula).toHaveBeenCalledWith(
      1,
      1,
      dto,
      1,
    );
  });

  it('cambia el estado de una asignación de equipamiento', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .patch('/aulas/1/equipamientos/2/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: false })
      .expect(200, { id: 1 });

    expect(aulasService.cambiarEstadoEquipamientoAula).toHaveBeenCalledWith(
      1,
      2,
      false,
      1,
    );
  });

  it.each(['COORDINADOR', 'PROFESOR', 'ESTUDIANTE'])(
    'responde 403 al modificar equipamiento de aula para %s',
    async (rol) => {
      const token = await crearToken(rol);

      await request(app.getHttpServer())
        .patch('/aulas/1/equipamientos/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ cantidadDisponible: 0 })
        .expect(403);

      expect(aulasService.actualizarEquipamientoAula).not.toHaveBeenCalled();
    },
  );

  it.each(['ADMIN_GLOBAL', 'COORDINADOR', 'PROFESOR'])(
    'permite consultar indisponibilidades a %s',
    async (rol) => {
      const token = await crearToken(rol);

      await request(app.getHttpServer())
        .get('/aulas/1/indisponibilidades')
        .set('Authorization', `Bearer ${token}`)
        .expect(200, []);

      expect(aulasService.listarIndisponibilidadesAula).toHaveBeenCalledWith(1);
    },
  );

  it('deniega indisponibilidades a ESTUDIANTE', async () => {
    const token = await crearToken('ESTUDIANTE');

    await request(app.getHttpServer())
      .get('/aulas/1/indisponibilidades')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(aulasService.listarIndisponibilidadesAula).not.toHaveBeenCalled();
  });

  it('consulta una indisponibilidad por id', async () => {
    const token = await crearToken('PROFESOR');

    await request(app.getHttpServer())
      .get('/aulas/1/indisponibilidades/2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { id: 1 });

    expect(aulasService.obtenerIndisponibilidadPorId).toHaveBeenCalledWith(
      1,
      2,
    );
  });

  it.each(['ADMIN_GLOBAL', 'COORDINADOR'])(
    'permite crear una indisponibilidad a %s',
    async (rol) => {
      const token = await crearToken(rol);
      const dto = {
        tipo: TipoIndisponibilidadAula.MANTENIMIENTO,
        fechaHoraInicio: '2027-10-10T08:00:00',
        fechaHoraFin: '2027-10-12T17:00:00',
        motivo: 'Repair AC',
      };

      await request(app.getHttpServer())
        .post('/aulas/1/indisponibilidades')
        .set('Authorization', `Bearer ${token}`)
        .send(dto)
        .expect(201, { id: 1 });

      expect(aulasService.crearIndisponibilidadAula).toHaveBeenCalledWith(
        1,
        dto,
        1,
      );
    },
  );

  it.each(['PROFESOR', 'ESTUDIANTE'])(
    'deniega crear una indisponibilidad a %s',
    async (rol) => {
      const token = await crearToken(rol);

      await request(app.getHttpServer())
        .post('/aulas/1/indisponibilidades')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo: TipoIndisponibilidadAula.BLOQUEO,
          fechaHoraInicio: '2027-10-10T08:00:00',
          fechaHoraFin: '2027-10-10T10:00:00',
          motivo: 'Block',
        })
        .expect(403);

      expect(aulasService.crearIndisponibilidadAula).not.toHaveBeenCalled();
    },
  );

  it('validates an unavailability DTO before calling the service', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .post('/aulas/1/indisponibilidades')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo: 'INVALIDO',
        fechaHoraInicio: 'not-a-date',
        fechaHoraFin: '2027-10-10T10:00:00',
        motivo: '',
      })
      .expect(400);

    expect(aulasService.crearIndisponibilidadAula).not.toHaveBeenCalled();
  });

  it('allows COORDINADOR to update and change an unavailability status', async () => {
    const token = await crearToken('COORDINADOR');
    const dto = { motivo: 'Updated reason' };

    await request(app.getHttpServer())
      .patch('/aulas/1/indisponibilidades/2')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200, { id: 1 });
    await request(app.getHttpServer())
      .patch('/aulas/1/indisponibilidades/2/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: false })
      .expect(200, { id: 1 });

    expect(aulasService.actualizarIndisponibilidadAula).toHaveBeenCalledWith(
      1,
      2,
      dto,
      1,
    );
    expect(aulasService.cambiarEstadoIndisponibilidadAula).toHaveBeenCalledWith(
      1,
      2,
      false,
      1,
    );
  });

  it('rechaza una fecha inválida al crear una indisponibilidad', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas/1/indisponibilidades')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo: TipoIndisponibilidadAula.MANTENIMIENTO,
        fechaHoraInicio: 'esto-no-es-fecha',
        fechaHoraFin: '2027-10-10T10:00:00-06:00',
        motivo: 'Prueba',
      })
      .expect(400);

    expect(aulasService.crearIndisponibilidadAula).not.toHaveBeenCalled();
  });

  it('rechaza crear una indisponibilidad sin motivo', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas/1/indisponibilidades')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo: TipoIndisponibilidadAula.LIMPIEZA,
        fechaHoraInicio: '2027-10-10T08:00:00-06:00',
        fechaHoraFin: '2027-10-10T10:00:00-06:00',
      })
      .expect(400);

    expect(aulasService.crearIndisponibilidadAula).not.toHaveBeenCalled();
  });

  it('rechaza propiedades no permitidas al crear una indisponibilidad', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .post('/aulas/1/indisponibilidades')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo: TipoIndisponibilidadAula.BLOQUEO,
        fechaHoraInicio: '2027-10-10T08:00:00-06:00',
        fechaHoraFin: '2027-10-10T10:00:00-06:00',
        motivo: 'Bloqueo',
        activo: false,
      })
      .expect(400);

    expect(aulasService.crearIndisponibilidadAula).not.toHaveBeenCalled();
  });

  it('permite actualizar una indisponibilidad a ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');
    const dto = { motivo: 'Mantenimiento reprogramado' };

    await request(app.getHttpServer())
      .patch('/aulas/1/indisponibilidades/5')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200, { id: 1 });

    expect(aulasService.actualizarIndisponibilidadAula).toHaveBeenCalledWith(
      1,
      5,
      dto,
      1,
    );
  });

  it.each(['PROFESOR', 'ESTUDIANTE'])(
    'responde 403 al actualizar una indisponibilidad para %s',
    async (rol) => {
      const token = await crearToken(rol);

      await request(app.getHttpServer())
        .patch('/aulas/1/indisponibilidades/5')
        .set('Authorization', `Bearer ${token}`)
        .send({ motivo: 'Cambio no permitido' })
        .expect(403);

      expect(
        aulasService.actualizarIndisponibilidadAula,
      ).not.toHaveBeenCalled();
    },
  );

  it('permite inactivar una indisponibilidad a ADMIN_GLOBAL', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .patch('/aulas/1/indisponibilidades/5/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: false })
      .expect(200, { id: 1 });

    expect(aulasService.cambiarEstadoIndisponibilidadAula).toHaveBeenCalledWith(
      1,
      5,
      false,
      1,
    );
  });

  it('permite reactivar una indisponibilidad a COORDINADOR', async () => {
    const token = await crearToken('COORDINADOR');

    await request(app.getHttpServer())
      .patch('/aulas/1/indisponibilidades/5/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: true })
      .expect(200, { id: 1 });

    expect(aulasService.cambiarEstadoIndisponibilidadAula).toHaveBeenCalledWith(
      1,
      5,
      true,
      1,
    );
  });

  it.each(['PROFESOR', 'ESTUDIANTE'])(
    'responde 403 al cambiar estado de una indisponibilidad para %s',
    async (rol) => {
      const token = await crearToken(rol);

      await request(app.getHttpServer())
        .patch('/aulas/1/indisponibilidades/5/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false })
        .expect(403);

      expect(
        aulasService.cambiarEstadoIndisponibilidadAula,
      ).not.toHaveBeenCalled();
    },
  );

  it('rechaza un estado que no sea booleano', async () => {
    const token = await crearToken('ADMIN_GLOBAL');

    await request(app.getHttpServer())
      .patch('/aulas/1/indisponibilidades/5/estado')
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: 'no' })
      .expect(400);

    expect(
      aulasService.cambiarEstadoIndisponibilidadAula,
    ).not.toHaveBeenCalled();
  });

  describe('reservas extraordinarias', () => {
    const dto = {
      tipo: TipoReservaAula.EXAMEN,
      titulo: 'Examen final EIF223',
      descripcion: 'Aplicación del examen final',
      fechaHoraInicio: '2027-10-15T08:00:00-06:00',
      fechaHoraFin: '2027-10-15T10:00:00-06:00',
    };

    it.each(['ADMIN_GLOBAL', 'COORDINADOR', 'PROFESOR'])(
      'permite consultar reservas a %s',
      async (rol) => {
        const token = await crearToken(rol);

        await request(app.getHttpServer())
          .get('/aulas/1/reservas')
          .set('Authorization', `Bearer ${token}`)
          .expect(200, []);

        expect(aulasService.listarReservasAula).toHaveBeenCalledWith(1);
      },
    );

    it('deniega reservas a ESTUDIANTE', async () => {
      const token = await crearToken('ESTUDIANTE');

      await request(app.getHttpServer())
        .get('/aulas/1/reservas')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(aulasService.listarReservasAula).not.toHaveBeenCalled();
    });

    it('permite consultar una reserva por id a PROFESOR', async () => {
      const token = await crearToken('PROFESOR');

      await request(app.getHttpServer())
        .get('/aulas/1/reservas/2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200, { id: 1 });

      expect(aulasService.obtenerReservaPorId).toHaveBeenCalledWith(1, 2);
    });

    it.each(['ADMIN_GLOBAL', 'COORDINADOR'])(
      'permite crear una reserva a %s',
      async (rol) => {
        const token = await crearToken(rol);

        await request(app.getHttpServer())
          .post('/aulas/1/reservas')
          .set('Authorization', `Bearer ${token}`)
          .send(dto)
          .expect(201, { id: 1 });

        expect(aulasService.crearReservaAula).toHaveBeenCalledWith(1, dto, 1);
      },
    );

    it.each(['PROFESOR', 'ESTUDIANTE'])(
      'deniega crear una reserva a %s',
      async (rol) => {
        const token = await crearToken(rol);

        await request(app.getHttpServer())
          .post('/aulas/1/reservas')
          .set('Authorization', `Bearer ${token}`)
          .send(dto)
          .expect(403);

        expect(aulasService.crearReservaAula).not.toHaveBeenCalled();
      },
    );

    it('valida el DTO de reserva antes de llamar al servicio', async () => {
      const token = await crearToken('COORDINADOR');

      await request(app.getHttpServer())
        .post('/aulas/1/reservas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...dto,
          tipo: 'INVALIDO',
          titulo: '',
          fechaHoraInicio: 'fecha',
        })
        .expect(400);

      expect(aulasService.crearReservaAula).not.toHaveBeenCalled();
    });

    it('permite actualizar y cambiar el estado a COORDINADOR', async () => {
      const token = await crearToken('COORDINADOR');
      const cambios = { titulo: 'Examen reprogramado' };

      await request(app.getHttpServer())
        .patch('/aulas/1/reservas/2')
        .set('Authorization', `Bearer ${token}`)
        .send(cambios)
        .expect(200, { id: 1 });
      await request(app.getHttpServer())
        .patch('/aulas/1/reservas/2/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false })
        .expect(200, { id: 1 });

      expect(aulasService.actualizarReservaAula).toHaveBeenCalledWith(
        1,
        2,
        cambios,
        1,
      );
      expect(aulasService.cambiarEstadoReservaAula).toHaveBeenCalledWith(
        1,
        2,
        false,
        1,
      );
    });
  });

  describe('GET /aulas/:aulaId/ocupacion', () => {
    it('permite consultar ocupación a PROFESOR', async () => {
      const token = await crearToken('PROFESOR');

      await request(app.getHttpServer())
        .get(
          '/aulas/1/ocupacion?fechaHoraInicio=2027-10-10T00:00:00-06:00&fechaHoraFin=2027-10-20T23:59:59-06:00',
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200, {
          aula: { id: 1 },
          ocupaciones: [],
        });

      expect(aulasService.consultarOcupacionAula).toHaveBeenCalledWith(1, {
        fechaHoraInicio: '2027-10-10T00:00:00-06:00',
        fechaHoraFin: '2027-10-20T23:59:59-06:00',
      });
    });

    it('rechaza consultar ocupación con fechas inválidas', async () => {
      const token = await crearToken('COORDINADOR');

      await request(app.getHttpServer())
        .get(
          '/aulas/1/ocupacion?fechaHoraInicio=invalida&fechaHoraFin=2027-10-20T23:59:59-06:00',
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(aulasService.consultarOcupacionAula).not.toHaveBeenCalled();
    });
  });

  describe('GET /aulas/:aulaId/auditoria', () => {
    it('permite consultar auditoría a COORDINADOR', async () => {
      const token = await crearToken('COORDINADOR');

      await request(app.getHttpServer())
        .get('/aulas/1/auditoria')
        .set('Authorization', `Bearer ${token}`)
        .expect(200, []);

      expect(aulasService.listarAuditoriaAula).toHaveBeenCalledWith(1);
    });

    it('prohíbe consultar auditoría a PROFESOR', async () => {
      const token = await crearToken('PROFESOR');

      await request(app.getHttpServer())
        .get('/aulas/1/auditoria')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(aulasService.listarAuditoriaAula).not.toHaveBeenCalled();
    });
  });

  describe('disponibilidades de aulas', () => {
    it('permite listar disponibilidades a PROFESOR', async () => {
      const token = await crearToken('PROFESOR');

      await request(app.getHttpServer())
        .get('/aulas/1/disponibilidades?periodoId=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200, []);

      expect(aulasService.listarDisponibilidadesAula).toHaveBeenCalledWith(
        1,
        2,
      );
    });

    it('deniega listar disponibilidades a ESTUDIANTE', async () => {
      const token = await crearToken('ESTUDIANTE');

      await request(app.getHttpServer())
        .get('/aulas/1/disponibilidades?periodoId=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(aulasService.listarDisponibilidadesAula).not.toHaveBeenCalled();
    });

    it('permite crear disponibilidad a COORDINADOR', async () => {
      const token = await crearToken('COORDINADOR');
      const dto = {
        periodoId: 2,
        diaSemana: 1,
        horaInicio: '07:00',
        horaFin: '12:00',
      };

      await request(app.getHttpServer())
        .post('/aulas/1/disponibilidades')
        .set('Authorization', `Bearer ${token}`)
        .send(dto)
        .expect(201, { id: 1 });

      expect(aulasService.crearDisponibilidadAula).toHaveBeenCalledWith(
        1,
        dto,
        1,
      );
    });

    it('deniega crear disponibilidad a PROFESOR', async () => {
      const token = await crearToken('PROFESOR');

      await request(app.getHttpServer())
        .post('/aulas/1/disponibilidades')
        .set('Authorization', `Bearer ${token}`)
        .send({
          periodoId: 2,
          diaSemana: 1,
          horaInicio: '07:00',
          horaFin: '12:00',
        })
        .expect(403);

      expect(aulasService.crearDisponibilidadAula).not.toHaveBeenCalled();
    });

    it('permite actualizar disponibilidad a ADMIN_GLOBAL', async () => {
      const token = await crearToken('ADMIN_GLOBAL');
      const dto = {
        horaFin: '13:00',
      };

      await request(app.getHttpServer())
        .patch('/aulas/1/disponibilidades/5')
        .set('Authorization', `Bearer ${token}`)
        .send(dto)
        .expect(200, { id: 1 });

      expect(aulasService.actualizarDisponibilidadAula).toHaveBeenCalledWith(
        1,
        5,
        dto,
        1,
      );
    });

    it('permite eliminar disponibilidad a COORDINADOR', async () => {
      const token = await crearToken('COORDINADOR');

      await request(app.getHttpServer())
        .delete('/aulas/1/disponibilidades/5')
        .set('Authorization', `Bearer ${token}`)
        .expect(200, {
          message: 'Bloque de disponibilidad eliminado correctamente.',
        });

      expect(aulasService.eliminarDisponibilidadAula).toHaveBeenCalledWith(
        1,
        5,
        1,
      );
    });
  });
});
