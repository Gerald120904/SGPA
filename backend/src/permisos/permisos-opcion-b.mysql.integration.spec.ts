import 'reflect-metadata';

import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { Carrera } from '../carreras/entities/carrera.entity';
import { Rol } from '../roles/entities/rol.entity';
import { ProfesorCarrera } from '../profesores/entities/profesor-carrera.entity';
import { PermisoSistema, PERMISOS_SISTEMA } from './constants/permisos.constant';
import { PERMISOS_PREDETERMINADOS_POR_ROL } from './constants/plantillas-permisos.constant';
import { PermisosGuard } from './guards/permisos.guard';
import { UsuarioPermiso } from './entities/usuario-permiso.entity';
import { UsuarioPermisoExcepcion } from './entities/usuario-permiso-excepcion.entity';
import { PermisosService } from './permisos.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuarioRol } from '../usuarios/entities/usuario-rol.entity';

const SUITE_ENABLED = process.env.SGPA_QA003_MYSQL_INTEGRATION === 'true';
const describeMysql = SUITE_ENABLED ? describe : describe.skip;
const EXPECTED_DATABASE = 'sgpa_qa003_ephemeral';

describeMysql('QA-003 persistencia MySQL aislada', () => {
  let dataSource: DataSource;
  let usuarioRepository: Repository<Usuario>;
  let rolRepository: Repository<Rol>;
  let usuarioRolRepository: Repository<UsuarioRol>;
  let usuarioPermisoRepository: Repository<UsuarioPermiso>;
  let excepcionRepository: Repository<UsuarioPermisoExcepcion>;
  let permisosService: PermisosService;

  async function verificarDestinoSeguro(): Promise<void> {
    const host = process.env.SGPA_QA003_MYSQL_HOST;
    const port = Number(process.env.SGPA_QA003_MYSQL_PORT);
    const database = process.env.SGPA_QA003_MYSQL_DATABASE;
    const expectedDatadir = process.env.SGPA_QA003_MYSQL_DATADIR;

    expect(host).toBe('127.0.0.1');
    expect(Number.isInteger(port)).toBe(true);
    expect(port).not.toBe(3306);
    expect(port).toBeGreaterThan(3306);
    expect(database).toBe(EXPECTED_DATABASE);
    expect(process.env.DB_DATABASE).toBe(EXPECTED_DATABASE);
    expect(['sgpa', 'sgpa_test']).not.toContain(database);
    expect(process.env.DB_SYNCHRONIZE).toBe('false');
    expect(process.env.SGPA_PERMISOS_OPCION_B_ENABLED).toBe('true');
    expect(expectedDatadir).toBeTruthy();

    const [identity] = await dataSource.query(
      'SELECT DATABASE() AS database_name, @@port AS port, @@datadir AS datadir',
    );
    expect(identity.database_name).toBe(EXPECTED_DATABASE);
    expect(Number(identity.port)).toBe(port);
    expect(require('node:path').resolve(identity.datadir).toLowerCase()).toBe(
      require('node:path').resolve(expectedDatadir).toLowerCase(),
    );
  }

  async function crearUsuarioYRol(): Promise<{
    usuario: Usuario;
    rol: Rol;
  }> {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const rol = await rolRepository.save(
      rolRepository.create({
        nombre: RolSistema.COORDINADOR,
        descripcion: 'Rol ficticio QA-003 temporal',
        activo: true,
      }),
    );
    const usuario = await usuarioRepository.save(
      usuarioRepository.create({
        cedula: `Q${suffix}`.slice(0, 20),
        nombres: 'QA003 Integración',
        apellido1: 'Temporal',
        apellido2: null,
        correo: `qa003-${suffix}@sgpa.test`,
        passwordHash: 'HASH-FICTICIO-NO-AUTENTICABLE',
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        activo: true,
        ultimoAcceso: null,
      }),
    );
    await usuarioRolRepository.save(
      usuarioRolRepository.create({ usuarioId: usuario.id, rolId: rol.id }),
    );

    return { usuario, rol };
  }

  async function limpiarDatosFicticios(): Promise<void> {
    await verificarDestinoSeguro();
    await dataSource.query('DELETE FROM usuario_permiso_excepciones');
    await dataSource.query('DELETE FROM usuario_permisos');
    await dataSource.query('DELETE FROM usuario_roles');
    await dataSource.query('DELETE FROM usuarios');
    await dataSource.query('DELETE FROM roles');
  }

  beforeAll(async () => {
    if (!SUITE_ENABLED) return;

    if (process.env.DB_SYNCHRONIZE !== 'false') {
      throw new Error('DB_SYNCHRONIZE debe ser false para esta suite.');
    }

    dataSource = new DataSource({
      type: 'mysql',
      host: process.env.SGPA_QA003_MYSQL_HOST,
      port: Number(process.env.SGPA_QA003_MYSQL_PORT),
      username: process.env.SGPA_QA003_MYSQL_USER,
      password: process.env.SGPA_QA003_MYSQL_PASSWORD || '',
      database: process.env.SGPA_QA003_MYSQL_DATABASE,
      entities: [
        Carrera,
        ProfesorCarrera,
        Usuario,
        Rol,
        UsuarioRol,
        UsuarioPermiso,
        UsuarioPermisoExcepcion,
      ],
      synchronize: false,
      migrationsRun: false,
      logging: false,
    });

    await dataSource.initialize();
    await verificarDestinoSeguro();

    await dataSource.query(`
      CREATE TABLE carreras (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        codigo VARCHAR(20) NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        descripcion VARCHAR(500) NULL,
        activo TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_carreras_codigo (codigo),
        UNIQUE KEY UQ_carreras_nombre (nombre)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await dataSource.query(`
      CREATE TABLE usuarios (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        cedula VARCHAR(20) NOT NULL,
        nombres VARCHAR(100) NOT NULL,
        apellido1 VARCHAR(100) NOT NULL,
        apellido2 VARCHAR(100) NULL,
        correo VARCHAR(150) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        password_reset_token_hash VARCHAR(64) NULL,
        password_reset_expires_at DATETIME NULL,
        activo TINYINT NOT NULL DEFAULT 1,
        ultimo_acceso DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_usuarios_cedula (cedula),
        UNIQUE KEY UQ_usuarios_correo (correo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await dataSource.query(`
      CREATE TABLE profesor_carreras (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        profesor_usuario_id INT UNSIGNED NOT NULL,
        carrera_id INT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_profesor_carreras_profesor_carrera (profesor_usuario_id, carrera_id),
        CONSTRAINT FK_qa003_profesor_carrera_usuario FOREIGN KEY (profesor_usuario_id)
          REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT FK_qa003_profesor_carrera_carrera FOREIGN KEY (carrera_id)
          REFERENCES carreras (id) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await dataSource.query(`
      CREATE TABLE roles (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre VARCHAR(50) NOT NULL,
        descripcion VARCHAR(255) NULL,
        activo TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_roles_nombre (nombre)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await dataSource.query(`
      CREATE TABLE usuario_roles (
        usuario_id INT UNSIGNED NOT NULL,
        rol_id INT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (usuario_id, rol_id),
        CONSTRAINT FK_qa003_usuario_rol_usuario FOREIGN KEY (usuario_id)
          REFERENCES usuarios (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT FK_qa003_usuario_rol_rol FOREIGN KEY (rol_id)
          REFERENCES roles (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await dataSource.query(`
      CREATE TABLE usuario_permisos (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        usuario_id INT UNSIGNED NOT NULL,
        permiso VARCHAR(80) NOT NULL,
        activo TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_usuario_permiso (usuario_id, permiso),
        CONSTRAINT FK_qa003_usuario_permiso_usuario FOREIGN KEY (usuario_id)
          REFERENCES usuarios (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await dataSource.query(`
      CREATE TABLE usuario_permiso_excepciones (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        usuario_id INT UNSIGNED NOT NULL,
        permiso VARCHAR(80) NOT NULL,
        tipo ENUM('CONCEDER', 'DENEGAR') NOT NULL,
        motivo VARCHAR(255) NULL,
        asignado_por_usuario_id INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_usuario_permiso_excepcion (usuario_id, permiso),
        CONSTRAINT FK_qa003_usuario_permiso_excepcion_usuario FOREIGN KEY (usuario_id)
          REFERENCES usuarios (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT FK_qa003_usuario_permiso_excepcion_asignador FOREIGN KEY (asignado_por_usuario_id)
          REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    usuarioRepository = dataSource.getRepository(Usuario);
    rolRepository = dataSource.getRepository(Rol);
    usuarioRolRepository = dataSource.getRepository(UsuarioRol);
    usuarioPermisoRepository = dataSource.getRepository(UsuarioPermiso);
    excepcionRepository = dataSource.getRepository(UsuarioPermisoExcepcion);
    permisosService = new PermisosService(
      usuarioPermisoRepository,
      usuarioRepository,
      dataSource,
      excepcionRepository,
    );
    permisosService.activarPoliticaOpcionB(true);
    expect(permisosService.esPoliticaOpcionBActiva()).toBe(true);
  });

  beforeEach(async () => {
    if (SUITE_ENABLED) await limpiarDatosFicticios();
  });

  afterEach(async () => {
    if (SUITE_ENABLED) await limpiarDatosFicticios();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('persiste la restricción UNIQUE (usuario_id, permiso) en MySQL', async () => {
    const { usuario } = await crearUsuarioYRol();
    const permiso = PermisoSistema.AULAS_VER;
    await excepcionRepository.save(
      excepcionRepository.create({
        usuarioId: usuario.id,
        permiso,
        tipo: 'CONCEDER',
        motivo: 'Prueba UNIQUE',
        asignadoPorUsuarioId: null,
      }),
    );

    let error: any;
    try {
      await excepcionRepository.insert({
        usuarioId: usuario.id,
        permiso,
        tipo: 'DENEGAR',
      });
    } catch (caught) {
      error = caught;
    }

    expect(error?.driverError?.code ?? error?.code).toBe('ER_DUP_ENTRY');
    expect(await excepcionRepository.count({ where: { usuarioId: usuario.id } })).toBe(1);
  });

  it('mapea columnas y relaciones de UsuarioPermisoExcepcion con TypeORM/MySQL', async () => {
    const { usuario } = await crearUsuarioYRol();
    const asignador = await usuarioRepository.save(
      usuarioRepository.create({
        cedula: `A${Date.now()}`.slice(0, 20),
        nombres: 'QA003 Asignador',
        apellido1: 'Temporal',
        apellido2: null,
        correo: `qa003-actor-${Date.now()}@sgpa.test`,
        passwordHash: 'HASH-FICTICIO-NO-AUTENTICABLE',
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        activo: true,
        ultimoAcceso: null,
      }),
    );
    const created = await excepcionRepository.save(
      excepcionRepository.create({
        usuarioId: usuario.id,
        permiso: PermisoSistema.AULAS_VER,
        tipo: 'DENEGAR',
        motivo: 'Mapeo real de columnas y relaciones',
        asignadoPorUsuarioId: asignador.id,
      }),
    );
    const loaded = await excepcionRepository.findOneOrFail({
      where: { id: created.id },
      relations: { usuario: true, asignadoPorUsuario: true },
    });

    expect(loaded.usuarioId).toBe(usuario.id);
    expect(loaded.permiso).toBe(PermisoSistema.AULAS_VER);
    expect(loaded.tipo).toBe('DENEGAR');
    expect(loaded.motivo).toBe('Mapeo real de columnas y relaciones');
    expect(loaded.asignadoPorUsuarioId).toBe(asignador.id);
    expect(loaded.usuario.id).toBe(usuario.id);
    expect(loaded.asignadoPorUsuario?.id).toBe(asignador.id);
    expect(loaded.createdAt).toBeInstanceOf(Date);
    expect(loaded.updatedAt).toBeInstanceOf(Date);
  });

  it('persiste reemplazo transaccional y revierte excepciones y permisos legacy ante error MySQL', async () => {
    const { usuario } = await crearUsuarioYRol();
    const asignador = await usuarioRepository.save(
      usuarioRepository.create({
        cedula: `T${Date.now()}`.slice(0, 20),
        nombres: 'QA003 Transacción',
        apellido1: 'Temporal',
        apellido2: null,
        correo: `qa003-tx-${Date.now()}@sgpa.test`,
        passwordHash: 'HASH-FICTICIO-NO-AUTENTICABLE',
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        activo: true,
        ultimoAcceso: null,
      }),
    );
    const base = [...PERMISOS_PREDETERMINADOS_POR_ROL[RolSistema.COORDINADOR]];
    expect(base.length).toBeGreaterThan(1);
    const denegado = base[0];
    const concedido = PERMISOS_SISTEMA.find((permiso) => !base.includes(permiso));
    expect(concedido).toBeDefined();
    const deseados = base.filter((permiso) => permiso !== denegado).concat(concedido!);

    await usuarioPermisoRepository.save(
      usuarioPermisoRepository.create({
        usuarioId: usuario.id,
        permiso: base[1],
        activo: true,
      }),
    );
    const resultado = await permisosService.reemplazarPermisos(
      usuario.id,
      deseados,
      asignador.id,
    );
    const excepciones = await excepcionRepository.find({
      where: { usuarioId: usuario.id },
      order: { permiso: 'ASC' },
    });
    expect(excepciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ permiso: denegado, tipo: 'DENEGAR' }),
        expect.objectContaining({ permiso: concedido, tipo: 'CONCEDER' }),
      ]),
    );
    expect(resultado.map(({ permiso }) => permiso).sort()).toEqual([...deseados].sort());

    const excepcionesPrevias = await excepcionRepository.find({
      where: { usuarioId: usuario.id },
      order: { permiso: 'ASC' },
    });
    const permisosLegacyPrevios = await usuarioPermisoRepository.find({
      where: { usuarioId: usuario.id },
      order: { permiso: 'ASC' },
    });

    await expect(
      permisosService.reemplazarPermisos(
        usuario.id,
        [concedido!, concedido!],
        asignador.id,
      ),
    ).rejects.toBeDefined();

    expect(
      await excepcionRepository.find({
        where: { usuarioId: usuario.id },
        order: { permiso: 'ASC' },
      }),
    ).toEqual(excepcionesPrevias);
    expect(
      await usuarioPermisoRepository.find({
        where: { usuarioId: usuario.id },
        order: { permiso: 'ASC' },
      }),
    ).toEqual(permisosLegacyPrevios);
  });

  it('PermisosGuard lee excepciones persistidas y falla cerrado si la lectura falla', async () => {
    const { usuario } = await crearUsuarioYRol();
    const base = [...PERMISOS_PREDETERMINADOS_POR_ROL[RolSistema.COORDINADOR]];
    const denegado = base[0];
    const concedido = PERMISOS_SISTEMA.find((permiso) => !base.includes(permiso));
    expect(concedido).toBeDefined();
    await excepcionRepository.save([
      excepcionRepository.create({
        usuarioId: usuario.id,
        permiso: denegado,
        tipo: 'DENEGAR',
        motivo: 'Debe denegarse aunque pertenezca a la plantilla',
        asignadoPorUsuarioId: null,
      }),
      excepcionRepository.create({
        usuarioId: usuario.id,
        permiso: concedido!,
        tipo: 'CONCEDER',
        motivo: 'Permiso excepcional de prueba',
        asignadoPorUsuarioId: null,
      }),
    ]);

    const guardFor = (required: PermisoSistema) => {
      const reflector = {
        getAllAndOverride: () => [required],
      } as unknown as Reflector;
      const guard = new PermisosGuard(reflector, permisosService);
      const request = {
        user: { sub: usuario.id, roles: [RolSistema.COORDINADOR] },
      };
      const context = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;
      return guard.canActivate(context);
    };

    await expect(guardFor(denegado)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guardFor(concedido!)).resolves.toBe(true);

    const readFailure = new Error('fallo de lectura simulado en MySQL');
    const readSpy = jest
      .spyOn(excepcionRepository, 'find')
      .mockRejectedValueOnce(readFailure);
    await expect(guardFor(concedido!)).rejects.toBe(readFailure);
    readSpy.mockRestore();
  });
});
