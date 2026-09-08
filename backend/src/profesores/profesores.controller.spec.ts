import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EstadoPerfilProfesor } from '../perfiles-academicos/constants/estado-perfil-profesor.constant';
import { EstadoAtestadoProfesor } from './constants/estado-atestado-profesor.constant';
import { TipoAtestadoProfesor } from './constants/tipo-atestado-profesor.constant';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { PermisosService } from '../permisos/permisos.service';
import { ProfesoresController } from './profesores.controller';
import { ProfesoresService } from './profesores.service';

describe('ProfesoresController', () => {
  const jwtSecret = 'profesores-test-secret';

  const permisosService = {
    usuarioTienePermisos: jest.fn().mockResolvedValue(true),
  };

  const profesoresService = {
    listar: jest.fn(),
    obtenerPorId: jest.fn(),
    obtenerMiPerfil: jest.fn(),
    actualizarCarrerasMiPerfil: jest.fn(),
    listarPerfilesMiPerfil: jest.fn(),
    solicitarPerfilMiPerfil: jest.fn(),
    revisarPerfilProfesor: jest.fn(),
    inactivarPerfilProfesor: jest.fn(),
    listarCursosHabilitadosMiPerfil: jest.fn(),
    obtenerHistorialPerfil: jest.fn(),
    listarAtestadosMiPerfil: jest.fn(),
    crearAtestadoMiPerfil: jest.fn(),
    actualizarAtestadoMiPerfil: jest.fn(),
    inactivarAtestadoMiPerfil: jest.fn(),
    revisarAtestadoProfesor: jest.fn(),
    listarProyectosMiPerfil: jest.fn(),
    crearProyectoMiPerfil: jest.fn(),
    actualizarProyectoMiPerfil: jest.fn(),
    cambiarEstadoProyectoMiPerfil: jest.fn(),
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
      controllers: [ProfesoresController],
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
          provide: ProfesoresService,
          useValue: profesoresService,
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

    profesoresService.listar.mockResolvedValue([]);
    profesoresService.obtenerPorId.mockResolvedValue({
      id: 10,
    });

    profesoresService.obtenerMiPerfil.mockResolvedValue({
      id: 10,
    });

    profesoresService.actualizarCarrerasMiPerfil.mockResolvedValue({
      id: 10,
    });

    profesoresService.listarPerfilesMiPerfil.mockResolvedValue([]);
    profesoresService.solicitarPerfilMiPerfil.mockResolvedValue({ id: 100 });
    profesoresService.revisarPerfilProfesor.mockResolvedValue({ id: 100 });
    profesoresService.inactivarPerfilProfesor.mockResolvedValue({
      id: 100,
      estado: EstadoPerfilProfesor.INACTIVO,
    });

    profesoresService.listarCursosHabilitadosMiPerfil.mockResolvedValue([]);
    profesoresService.obtenerHistorialPerfil.mockResolvedValue([]);

    profesoresService.listarAtestadosMiPerfil.mockResolvedValue([]);
    profesoresService.crearAtestadoMiPerfil.mockResolvedValue({ id: 1 });
    profesoresService.actualizarAtestadoMiPerfil.mockResolvedValue({ id: 1 });
    profesoresService.inactivarAtestadoMiPerfil.mockResolvedValue({ id: 1 });
    profesoresService.revisarAtestadoProfesor.mockResolvedValue({ id: 1 });

    profesoresService.listarProyectosMiPerfil.mockResolvedValue([]);
    profesoresService.crearProyectoMiPerfil.mockResolvedValue({ id: 1 });
    profesoresService.actualizarProyectoMiPerfil.mockResolvedValue({ id: 1 });
    profesoresService.cambiarEstadoProyectoMiPerfil.mockResolvedValue({
      id: 1,
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
    await request(app.getHttpServer()).get('/profesores').expect(401);

    expect(profesoresService.listar).not.toHaveBeenCalled();
  });

  it('permite listar a ADMIN_GLOBAL', async () => {
    const token = await crearToken(['ADMIN_GLOBAL']);

    await request(app.getHttpServer())
      .get('/profesores')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(profesoresService.listar).toHaveBeenCalledTimes(1);
  });

  it('permite listar a COORDINADOR', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/profesores')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);
  });

  it('impide listar profesores a PROFESOR', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .get('/profesores')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(profesoresService.listar).not.toHaveBeenCalled();
  });

  it('permite al profesor consultar su propio perfil', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .get('/profesores/mi-perfil')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, {
        id: 10,
      });

    expect(profesoresService.obtenerMiPerfil).toHaveBeenCalledWith(10);
  });

  it('permite usuario COORDINADOR + PROFESOR usar su perfil', async () => {
    const token = await crearToken(['COORDINADOR', 'PROFESOR']);

    await request(app.getHttpServer())
      .get('/profesores/mi-perfil')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profesoresService.obtenerMiPerfil).toHaveBeenCalledWith(10);
  });

  it('rechaza acceder a mi-perfil sin rol PROFESOR', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/profesores/mi-perfil')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('actualiza carreras del propio perfil', async () => {
    const token = await crearToken(['PROFESOR']);

    const dto = {
      carreraIds: [1, 2],
    };

    await request(app.getHttpServer())
      .put('/profesores/mi-perfil/carreras')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200, {
        id: 10,
      });

    expect(profesoresService.actualizarCarrerasMiPerfil).toHaveBeenCalledWith(
      10,
      dto,
    );
  });

  it('rechaza carreras duplicadas', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .put('/profesores/mi-perfil/carreras')
      .set('Authorization', `Bearer ${token}`)
      .send({
        carreraIds: [1, 1],
      })
      .expect(400);

    expect(profesoresService.actualizarCarrerasMiPerfil).not.toHaveBeenCalled();
  });

  it('consulta un profesor por id', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/profesores/10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, {
        id: 10,
      });

    expect(profesoresService.obtenerPorId).toHaveBeenCalledWith(10);
  });

  it('rechaza id inválido', async () => {
    const token = await crearToken(['ADMIN_GLOBAL']);

    await request(app.getHttpServer())
      .get('/profesores/no-es-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('transforma correctamente los filtros recibidos por query', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get(
        '/profesores?activo=true&carreraId=1&cursoId=5&perfilAcademicoId=3&periodoAcademicoId=2&dia=LUNES&hora=10:00',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profesoresService.listar).toHaveBeenCalledWith({
      activo: true,
      carreraId: 1,
      cursoId: 5,
      perfilAcademicoId: 3,
      periodoAcademicoId: 2,
      dia: 'LUNES',
      hora: '10:00',
    });
  });

  it('rechaza activo inválido', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/profesores?activo=talvez')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(profesoresService.listar).not.toHaveBeenCalled();
  });

  it('rechaza hora con formato inválido', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/profesores?periodoAcademicoId=2&dia=LUNES&hora=10:00AM')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(profesoresService.listar).not.toHaveBeenCalled();
  });

  it('rechaza día inválido en filtros', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/profesores?periodoAcademicoId=2&dia=FUNDAY&hora=10:00')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('rechaza filtros desconocidos', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/profesores?campoInventado=123')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(profesoresService.listar).not.toHaveBeenCalled();
  });

  it('permite al PROFESOR consultar el historial de su propio perfil', async () => {
    const token = await crearToken(['PROFESOR'], 10);

    await request(app.getHttpServer())
      .get('/profesores/mi-perfil/historial')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(profesoresService.obtenerHistorialPerfil).toHaveBeenCalledWith(10);
  });

  it('permite a COORDINADOR consultar el historial del perfil de un profesor', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/profesores/10/historial-perfil')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(profesoresService.obtenerHistorialPerfil).toHaveBeenCalledWith(10);
  });

  it('permite a ADMIN_GLOBAL consultar el historial del perfil de un profesor', async () => {
    const token = await crearToken(['ADMIN_GLOBAL']);

    await request(app.getHttpServer())
      .get('/profesores/10/historial-perfil')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(profesoresService.obtenerHistorialPerfil).toHaveBeenCalledWith(10);
  });

  it('impide a PROFESOR consultar el historial del perfil de otro profesor', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .get('/profesores/99/historial-perfil')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(profesoresService.obtenerHistorialPerfil).not.toHaveBeenCalled();
  });

  it('rechaza profesorId inválido al consultar historial administrativo', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/profesores/no-es-id/historial-perfil')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  // --- Cursos Habilitados Endpoint ---

  it('permite al PROFESOR consultar sus cursos habilitados', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .get('/profesores/mi-perfil/cursos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(
      profesoresService.listarCursosHabilitadosMiPerfil,
    ).toHaveBeenCalledWith(10);
  });

  // --- Perfiles Académicos Endpoints ---

  it('permite al PROFESOR listar sus perfiles académicos', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .get('/profesores/mi-perfil/perfiles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(profesoresService.listarPerfilesMiPerfil).toHaveBeenCalledWith(10);
  });

  it('permite al PROFESOR solicitar un perfil académico', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .post('/profesores/mi-perfil/perfiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ perfilAcademicoId: 1 })
      .expect(201);

    expect(profesoresService.solicitarPerfilMiPerfil).toHaveBeenCalledWith(10, {
      perfilAcademicoId: 1,
    });
  });

  it('permite a COORDINADOR revisar perfil docente', async () => {
    const token = await crearToken(['COORDINADOR'], 2);

    await request(app.getHttpServer())
      .patch('/profesores/10/perfiles/1/revision')
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: EstadoPerfilProfesor.APROBADO, observacion: 'Aprobado' })
      .expect(200);

    expect(profesoresService.revisarPerfilProfesor).toHaveBeenCalledWith(
      10,
      1,
      2,
      {
        estado: EstadoPerfilProfesor.APROBADO,
        observacion: 'Aprobado',
      },
    );
  });

  it('permite a COORDINADOR inactivar perfil docente', async () => {
    const token = await crearToken(['COORDINADOR'], 2);

    await request(app.getHttpServer())
      .patch('/profesores/10/perfiles/1/inactivar')
      .set('Authorization', `Bearer ${token}`)
      .send({ observacion: 'Inactivado' })
      .expect(200);

    expect(profesoresService.inactivarPerfilProfesor).toHaveBeenCalledWith(
      10,
      1,
      2,
      'Inactivado',
    );
  });

  it('permite a PROFESOR inactivar su propio perfil', async () => {
    const token = await crearToken(['PROFESOR'], 10);

    await request(app.getHttpServer())
      .patch('/profesores/mi-perfil/perfiles/1/inactivar')
      .set('Authorization', `Bearer ${token}`)
      .send({ observacion: 'Ya no imparto este núcleo' })
      .expect(200);

    expect(profesoresService.inactivarPerfilProfesor).toHaveBeenCalledWith(
      10,
      1,
      10,
      'Ya no imparto este núcleo',
    );
  });

  it('permite filtrar profesores por perfilAcademicoId', async () => {
    const token = await crearToken(['COORDINADOR']);

    await request(app.getHttpServer())
      .get('/profesores?perfilAcademicoId=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profesoresService.listar).toHaveBeenCalledWith(
      expect.objectContaining({
        perfilAcademicoId: 1,
      }),
    );
  });

  // --- Atestados Endpoints ---

  it('permite al PROFESOR listar sus atestados', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .get('/profesores/mi-perfil/atestados')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(profesoresService.listarAtestadosMiPerfil).toHaveBeenCalledWith(10);
  });

  it('permite al PROFESOR crear un atestado', async () => {
    const token = await crearToken(['PROFESOR']);

    const dto = {
      tipo: TipoAtestadoProfesor.TITULO_ACADEMICO,
      nombre: 'Maestría en Computación',
      institucion: 'UNA',
      fechaObtencion: '2020-05-15',
      descripcion: 'Título de posgrado',
    };

    await request(app.getHttpServer())
      .post('/profesores/mi-perfil/atestados')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201);

    expect(profesoresService.crearAtestadoMiPerfil).toHaveBeenCalledWith(
      10,
      dto,
    );
  });

  it('permite al PROFESOR actualizar un atestado', async () => {
    const token = await crearToken(['PROFESOR']);

    const dto = {
      nombre: 'Maestría en Ciberseguridad',
    };

    await request(app.getHttpServer())
      .patch('/profesores/mi-perfil/atestados/1')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200);

    expect(profesoresService.actualizarAtestadoMiPerfil).toHaveBeenCalledWith(
      10,
      1,
      dto,
    );
  });

  it('permite al PROFESOR inactivar su atestado', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .patch('/profesores/mi-perfil/atestados/1/inactivar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profesoresService.inactivarAtestadoMiPerfil).toHaveBeenCalledWith(
      10,
      1,
    );
  });

  it('permite a COORDINADOR revisar un atestado', async () => {
    const token = await crearToken(['COORDINADOR'], 2);

    const dto = {
      estado: EstadoAtestadoProfesor.APROBADO,
      observacion: 'Cumple con requisitos',
    };

    await request(app.getHttpServer())
      .patch('/profesores/10/atestados/1/revision')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200);

    expect(profesoresService.revisarAtestadoProfesor).toHaveBeenCalledWith(
      10,
      1,
      2,
      dto,
    );
  });

  // --- Proyectos Endpoints ---

  it('permite al PROFESOR listar sus proyectos', async () => {
    const token = await crearToken(['PROFESOR']);

    await request(app.getHttpServer())
      .get('/profesores/mi-perfil/proyectos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);

    expect(profesoresService.listarProyectosMiPerfil).toHaveBeenCalledWith(10);
  });

  it('permite al PROFESOR crear un proyecto', async () => {
    const token = await crearToken(['PROFESOR']);

    const dto = {
      nombre: 'Proyecto de Ciberseguridad',
      unidad: 'CENTIC',
      rol: 'Investigador',
      fechaInicio: '2024-01-01',
      fechaFin: '2024-12-31',
      descripcion: 'Investigación en redes',
    };

    await request(app.getHttpServer())
      .post('/profesores/mi-perfil/proyectos')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(201);

    expect(profesoresService.crearProyectoMiPerfil).toHaveBeenCalledWith(
      10,
      dto,
    );
  });

  it('permite al PROFESOR actualizar un proyecto', async () => {
    const token = await crearToken(['PROFESOR']);

    const dto = {
      rol: 'Coordinador Técnico',
    };

    await request(app.getHttpServer())
      .patch('/profesores/mi-perfil/proyectos/1')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200);

    expect(profesoresService.actualizarProyectoMiPerfil).toHaveBeenCalledWith(
      10,
      1,
      dto,
    );
  });

  it('permite al PROFESOR cambiar estado de un proyecto', async () => {
    const token = await crearToken(['PROFESOR']);

    const dto = {
      activo: false,
    };

    await request(app.getHttpServer())
      .patch('/profesores/mi-perfil/proyectos/1/estado')
      .set('Authorization', `Bearer ${token}`)
      .send(dto)
      .expect(200);

    expect(
      profesoresService.cambiarEstadoProyectoMiPerfil,
    ).toHaveBeenCalledWith(10, 1, dto);
  });
});
