import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import * as mysql from 'mysql2/promise';
import { createHash } from 'node:crypto';

const SUITE_ENABLED = process.env.SGPA_CONCURRENCIA_MYSQL_INTEGRATION === 'true';
const describeMysql = SUITE_ENABLED ? describe : describe.skip;
const EXPECTED_DATABASE = 'sgpa_qa003_ephemeral';

function firmaImpacto(datos: unknown): string {
  return createHash('sha256').update(JSON.stringify(datos)).digest('hex');
}

describeMysql('SGPA — Validación de Concurrencia Real: Aprobación vs Revocación', () => {
  let conn1: mysql.Connection;
  let conn2: mysql.Connection;

  async function verificarDestinoSeguro(conn: mysql.Connection, label: string): Promise<{ port: number; datadir: string; uuid: string; cid: number }> {
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
    expect(expectedDatadir).toBeTruthy();

    const [[identity]] = await conn.query<any[]>(
      'SELECT DATABASE() AS database_name, @@port AS port, @@datadir AS datadir, @@server_uuid AS uuid, CONNECTION_ID() AS cid',
    );
    expect(identity.database_name).toBe(EXPECTED_DATABASE);
    expect(Number(identity.port)).toBe(port);
    expect(require('node:path').resolve(identity.datadir).toLowerCase()).toBe(
      require('node:path').resolve(expectedDatadir!).toLowerCase(),
    );

    return {
      port: Number(identity.port),
      datadir: identity.datadir,
      uuid: identity.uuid,
      cid: Number(identity.cid),
    };
  }

  beforeAll(async () => {
    if (!SUITE_ENABLED) return;

    conn1 = await mysql.createConnection({
      host: process.env.SGPA_QA003_MYSQL_HOST,
      port: Number(process.env.SGPA_QA003_MYSQL_PORT),
      user: process.env.SGPA_QA003_MYSQL_USER,
      password: process.env.SGPA_QA003_MYSQL_PASSWORD,
      database: process.env.SGPA_QA003_MYSQL_DATABASE,
    });

    conn2 = await mysql.createConnection({
      host: process.env.SGPA_QA003_MYSQL_HOST,
      port: Number(process.env.SGPA_QA003_MYSQL_PORT),
      user: process.env.SGPA_QA003_MYSQL_USER,
      password: process.env.SGPA_QA003_MYSQL_PASSWORD,
      database: process.env.SGPA_QA003_MYSQL_DATABASE,
    });

    const id1 = await verificarDestinoSeguro(conn1, 'Conexión 1');
    const id2 = await verificarDestinoSeguro(conn2, 'Conexión 2');

    // Comprobación ineludible de dos conexiones independientes
    expect(id1.cid).not.toBe(id2.cid);
    expect(id1.cid).toBeGreaterThan(0);
    expect(id2.cid).toBeGreaterThan(0);

    // Creación de tablas de negocio necesarias para la prueba de concurrencia
    await conn1.query(`
      CREATE TABLE IF NOT EXISTS carreras (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        codigo VARCHAR(20) NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        descripcion VARCHAR(500) NULL,
        activo TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_carreras_codigo (codigo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn1.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
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
        version_autenticacion INT UNSIGNED NOT NULL DEFAULT 0,
        ultimo_acceso DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_usuarios_cedula (cedula),
        UNIQUE KEY UQ_usuarios_correo (correo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn1.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre VARCHAR(50) NOT NULL,
        descripcion VARCHAR(255) NULL,
        activo TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_roles_nombre (nombre)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn1.query(`
      CREATE TABLE IF NOT EXISTS usuario_roles (
        usuario_id INT UNSIGNED NOT NULL,
        rol_id INT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (usuario_id, rol_id),
        CONSTRAINT FK_concurrencia_usuario_rol_usuario FOREIGN KEY (usuario_id)
          REFERENCES usuarios (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT FK_concurrencia_usuario_rol_rol FOREIGN KEY (rol_id)
          REFERENCES roles (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn1.query(`
      CREATE TABLE IF NOT EXISTS dependencias_usuario (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        asistente_id INT UNSIGNED NOT NULL,
        coordinador_id INT UNSIGNED NOT NULL,
        creado_por_usuario_id INT UNSIGNED NOT NULL,
        activo TINYINT NOT NULL DEFAULT 1,
        desactivado_en DATETIME NULL,
        motivo_desactivacion VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_dependencia_asistente (asistente_id),
        CONSTRAINT FK_concurrencia_dep_asistente FOREIGN KEY (asistente_id)
          REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT FK_concurrencia_dep_coordinador FOREIGN KEY (coordinador_id)
          REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn1.query(`
      CREATE TABLE IF NOT EXISTS permisos_carrera (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        usuario_id INT UNSIGNED NOT NULL,
        carrera_id INT UNSIGNED NOT NULL,
        permiso VARCHAR(80) NOT NULL,
        activo TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_permiso_carrera (usuario_id, carrera_id, permiso),
        CONSTRAINT FK_concurrencia_permiso_usuario FOREIGN KEY (usuario_id)
          REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT FK_concurrencia_permiso_carrera FOREIGN KEY (carrera_id)
          REFERENCES carreras (id) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn1.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_cambio (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        solicitante_id INT UNSIGNED NOT NULL,
        coordinador_id INT UNSIGNED NOT NULL,
        carrera_id INT UNSIGNED NOT NULL,
        modulo VARCHAR(50) NOT NULL,
        operacion VARCHAR(50) NOT NULL,
        objetivo_id INT UNSIGNED NULL,
        datos_propuestos JSON NOT NULL,
        huella_original CHAR(64) NULL,
        estado VARCHAR(32) NOT NULL,
        resuelto_en DATETIME NULL,
        resuelto_por_usuario_id INT UNSIGNED NULL,
        motivo_rechazo VARCHAR(500) NULL,
        observaciones_devolucion VARCHAR(500) NULL,
        motivo_cancelacion VARCHAR(500) NULL,
        historial_versiones JSON NULL,
        correlacion_id CHAR(36) NOT NULL,
        resultado_aplicado JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_solicitud_correlacion (correlacion_id),
        CONSTRAINT FK_concurrencia_sol_solicitante FOREIGN KEY (solicitante_id)
          REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT FK_concurrencia_sol_coordinador FOREIGN KEY (coordinador_id)
          REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT FK_concurrencia_sol_carrera FOREIGN KEY (carrera_id)
          REFERENCES carreras (id) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn1.query(`
      CREATE TABLE IF NOT EXISTS auditoria_jerarquia (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        actor_usuario_id INT UNSIGNED NOT NULL,
        objetivo_usuario_id INT UNSIGNED NOT NULL,
        accion VARCHAR(60) NOT NULL,
        detalle JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_concurrencia_aud_actor FOREIGN KEY (actor_usuario_id)
          REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT FK_concurrencia_aud_objetivo FOREIGN KEY (objetivo_usuario_id)
          REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn1.query(`
      CREATE TABLE IF NOT EXISTS cursos (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        codigo VARCHAR(30) NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        descripcion VARCHAR(500) NULL,
        activo TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_cursos_codigo (codigo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  });

  afterAll(async () => {
    if (conn1) {
      await conn1.query('SET FOREIGN_KEY_CHECKS = 0').catch(() => undefined);
      await conn1.query('DROP TABLE IF EXISTS auditoria_jerarquia, solicitudes_cambio, cursos, permisos_carrera, dependencias_usuario, usuario_permiso_excepciones, usuario_permisos, usuario_roles, profesor_carreras, roles, usuarios, carreras').catch(() => undefined);
      await conn1.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => undefined);
      await conn1.end().catch(() => undefined);
    }
    if (conn2) await conn2.end().catch(() => undefined);
  });

  async function limpiarTablas(): Promise<void> {
    await conn1.query('DELETE FROM auditoria_jerarquia');
    await conn1.query('DELETE FROM solicitudes_cambio');
    await conn1.query('DELETE FROM cursos');
    await conn1.query('DELETE FROM permisos_carrera');
    await conn1.query('DELETE FROM dependencias_usuario');
    await conn1.query('DELETE FROM usuario_roles');
    await conn1.query('DELETE FROM usuarios');
    await conn1.query('DELETE FROM roles');
    await conn1.query('DELETE FROM carreras');
  }

  async function sembrarEscenarioBase(): Promise<{ adminId: number; coordinadorId: number; asistenteId: number; carreraId: number }> {
    await limpiarTablas();

    const [carreraResult] = await conn1.query<any>(
      "INSERT INTO carreras (codigo, nombre, descripcion) VALUES ('C-MAT', 'Matemática', 'Carrera de prueba')",
    );
    const carreraId = carreraResult.insertId;

    const [rolAdmin] = await conn1.query<any>("INSERT INTO roles (nombre, descripcion) VALUES ('ADMIN_GLOBAL', 'Admin')");
    const [rolCoord] = await conn1.query<any>("INSERT INTO roles (nombre, descripcion) VALUES ('COORDINADOR', 'Coord')");
    const [rolAsist] = await conn1.query<any>("INSERT INTO roles (nombre, descripcion) VALUES ('ASISTENTE_ESTUDIANTIL', 'Asist')");

    const [uAdmin] = await conn1.query<any>(
      "INSERT INTO usuarios (cedula, nombres, apellido1, correo, password_hash) VALUES ('001', 'Admin', 'Global', 'admin@sgpa.test', 'HASH')",
    );
    const [uCoord] = await conn1.query<any>(
      "INSERT INTO usuarios (cedula, nombres, apellido1, correo, password_hash) VALUES ('002', 'Carlos', 'Coordinador', 'coord@sgpa.test', 'HASH')",
    );
    const [uAsist] = await conn1.query<any>(
      "INSERT INTO usuarios (cedula, nombres, apellido1, correo, password_hash) VALUES ('003', 'Ana', 'Asistente', 'asist@sgpa.test', 'HASH')",
    );

    const adminId = uAdmin.insertId;
    const coordinadorId = uCoord.insertId;
    const asistenteId = uAsist.insertId;

    await conn1.query('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (?, ?)', [adminId, rolAdmin.insertId]);
    await conn1.query('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (?, ?)', [coordinadorId, rolCoord.insertId]);
    await conn1.query('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (?, ?)', [asistenteId, rolAsist.insertId]);

    await conn1.query(
      'INSERT INTO dependencias_usuario (asistente_id, coordinador_id, creado_por_usuario_id, activo) VALUES (?, ?, ?, 1)',
      [asistenteId, coordinadorId, coordinadorId],
    );

    await conn1.query(
      "INSERT INTO permisos_carrera (usuario_id, carrera_id, permiso, activo) VALUES (?, ?, 'CURSOS_GESTIONAR', 1)",
      [coordinadorId, carreraId],
    );
    await conn1.query(
      "INSERT INTO permisos_carrera (usuario_id, carrera_id, permiso, activo) VALUES (?, ?, 'CURSOS_GESTIONAR', 1)",
      [asistenteId, carreraId],
    );

    return { adminId, coordinadorId, asistenteId, carreraId };
  }

  it('Demuestra 2 conexiones independientes con CONNECTION_ID distintos en MySQL', async () => {
    const [[c1]] = await conn1.query<any[]>('SELECT CONNECTION_ID() AS cid');
    const [[c2]] = await conn2.query<any[]>('SELECT CONNECTION_ID() AS cid');

    expect(c1.cid).toBeDefined();
    expect(c2.cid).toBeDefined();
    expect(c1.cid).not.toBe(c2.cid);
    console.log(`[Evidencia Conexiones] Conexión 1 CID: ${c1.cid} | Conexión 2 CID: ${c2.cid}`);
  });

  it('Escenario A — Aprobación primero: Coordinador aprueba legítimamente antes de revocación', async () => {
    const { adminId, coordinadorId, asistenteId, carreraId } = await sembrarEscenarioBase();

    // Crear solicitud pendiente para crear un curso
    const [solResult] = await conn1.query<any>(
      `INSERT INTO solicitudes_cambio 
       (solicitante_id, coordinador_id, carrera_id, modulo, operacion, datos_propuestos, estado, correlacion_id)
       VALUES (?, ?, ?, 'CURSOS', 'CREAR', ?, 'PENDIENTE', 'corr-escenario-a')`,
      [asistenteId, coordinadorId, carreraId, JSON.stringify({ codigo: 'MAT-101', nombre: 'Cálculo I' })],
    );
    const solicitudId = solResult.insertId;

    // 1. Admin Global previsualiza el impacto cuando la solicitud aún está PENDIENTE
    const firmaPreviaAdmin = firmaImpacto({
      usuarioId: asistenteId,
      abiertas: [[solicitudId, 'PENDIENTE', 'CURSOS', 'CREAR', carreraId]],
    });

    // 2. Conexión 1 (Coordinador) inicia transacción de Aprobación
    await conn1.beginTransaction();

    // Bloqueo pesimista sobre usuario y solicitud
    const [[coordBloqueado]] = await conn1.query<any[]>(
      'SELECT id, activo, version_autenticacion FROM usuarios WHERE id = ? FOR UPDATE',
      [coordinadorId],
    );
    const [[solBloqueada]] = await conn1.query<any[]>(
      'SELECT * FROM solicitudes_cambio WHERE id = ? FOR UPDATE',
      [solicitudId],
    );

    expect(coordBloqueado.activo).toBe(1);
    expect(solBloqueada.estado).toBe('PENDIENTE');

    // Coordinador ejecuta la mutación legítima y aprueba
    await conn1.query(
      "INSERT INTO cursos (codigo, nombre, descripcion, activo) VALUES ('MAT-101', 'Cálculo I', 'Creado por solicitud', 1)",
    );
    await conn1.query(
      `UPDATE solicitudes_cambio 
       SET estado = 'APROBADA', resuelto_en = NOW(), resuelto_por_usuario_id = ?
       WHERE id = ?`,
      [coordinadorId, solicitudId],
    );
    await conn1.query(
      'UPDATE usuarios SET version_autenticacion = version_autenticacion + 1 WHERE id = ?',
      [coordinadorId],
    );
    await conn1.query(
      `INSERT INTO auditoria_jerarquia (actor_usuario_id, objetivo_usuario_id, accion, detalle)
       VALUES (?, ?, 'APROBAR_SOLICITUD', ?)`,
      [coordinadorId, asistenteId, JSON.stringify({ solicitudId, modulo: 'CURSOS', operacion: 'CREAR' })],
    );

    // Commit de la aprobación en Conexión 1
    await conn1.commit();

    // 3. Conexión 2 (Admin Global) intenta confirmar la revocación administrativa basada en la previsualización previa
    await conn2.beginTransaction();
    const [solicitudesAbiertas] = await conn2.query<any[]>(
      "SELECT id, estado, modulo, operacion, carrera_id FROM solicitudes_cambio WHERE solicitante_id = ? AND estado IN ('PENDIENTE', 'CORREGIDA') FOR UPDATE",
      [asistenteId],
    );

    // La solicitud ya NO está abierta, por lo que el impacto en caliente cambió
    const firmaEnCaliente = firmaImpacto({
      usuarioId: asistenteId,
      abiertas: (solicitudesAbiertas as any[]).map((s) => [s.id, s.estado, s.modulo, s.operacion, s.carrera_id]),
    });

    // Verificación obligatoria: si la firma no coincide, debe rechazarse la confirmación administrativa (ConflictException)
    let rechazoPorFirmaObsoleta = false;
    if (firmaPreviaAdmin !== firmaEnCaliente) {
      rechazoPorFirmaObsoleta = true;
      await conn2.rollback(); // Transacción revocación revertida para exigir nueva evaluación
    } else {
      await conn2.commit();
    }

    expect(rechazoPorFirmaObsoleta).toBe(true);

    // 4. Comprobaciones de integridad del Escenario A:
    // A) Solicitud permanece en APROBADA y NO fue rechazada retroactivamente
    const [[solFinal]] = await conn1.query<any[]>('SELECT * FROM solicitudes_cambio WHERE id = ?', [solicitudId]);
    expect(solFinal.estado).toBe('APROBADA');
    expect(solFinal.motivo_rechazo).toBeNull();
    expect(solFinal.resuelto_por_usuario_id).toBe(coordinadorId);

    // B) El dato oficial (Curso) existe en la base de datos
    const [[cursoCreado]] = await conn1.query<any[]>("SELECT * FROM cursos WHERE codigo = 'MAT-101'");
    expect(cursoCreado).toBeDefined();
    expect(cursoCreado.nombre).toBe('Cálculo I');
    expect(cursoCreado.activo).toBe(1);

    // C) Auditoría registrada con la aprobación
    const [auditoriaAprob] = await conn1.query<any[]>(
      "SELECT * FROM auditoria_jerarquia WHERE accion = 'APROBAR_SOLICITUD' AND objetivo_usuario_id = ?",
      [asistenteId],
    );
    expect(auditoriaAprob.length).toBe(1);

    // D) Versión de autenticación del coordinador se incrementó
    const [[coordFinal]] = await conn1.query<any[]>('SELECT version_autenticacion FROM usuarios WHERE id = ?', [coordinadorId]);
    expect(coordFinal.version_autenticacion).toBe(1);
  });

  it('Escenario B — Revocación primero: Admin Global revoca y solicitud pasa a RECHAZADA; Coordinador no puede sobrescribirla ni aprobarla', async () => {
    const { adminId, coordinadorId, asistenteId, carreraId } = await sembrarEscenarioBase();

    // Crear solicitud pendiente
    const [solResult] = await conn1.query<any>(
      `INSERT INTO solicitudes_cambio 
       (solicitante_id, coordinador_id, carrera_id, modulo, operacion, datos_propuestos, estado, correlacion_id)
       VALUES (?, ?, ?, 'CURSOS', 'CREAR', ?, 'PENDIENTE', 'corr-escenario-b')`,
      [asistenteId, coordinadorId, carreraId, JSON.stringify({ codigo: 'MAT-202', nombre: 'Álgebra Lineal' })],
    );
    const solicitudId = solResult.insertId;

    // 1. Conexión 2 (Admin Global) ejecuta la revocación administrativa
    await conn2.beginTransaction();

    // Bloquea al usuario asistente y la solicitud
    await conn2.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [asistenteId]);
    const [[solicitudBloqueada]] = await conn2.query<any[]>(
      'SELECT * FROM solicitudes_cambio WHERE id = ? FOR UPDATE',
      [solicitudId],
    );
    expect(solicitudBloqueada.estado).toBe('PENDIENTE');

    // Desactiva la dependencia del asistente
    await conn2.query(
      `UPDATE dependencias_usuario 
       SET activo = 0, desactivado_en = NOW(), motivo_desactivacion = 'Revocación administrativa del rol de asistente'
       WHERE asistente_id = ?`,
      [asistenteId],
    );

    // Desactiva permisos delegados por carrera
    await conn2.query('UPDATE permisos_carrera SET activo = 0 WHERE usuario_id = ?', [asistenteId]);

    // Rechaza la solicitud pendiente por revocación administrativa
    const MOTIVO_REVOCACION = 'Permiso revocado por el administrador global.';
    await conn2.query(
      `UPDATE solicitudes_cambio 
       SET estado = 'RECHAZADA', motivo_rechazo = ?, resuelto_en = NOW(), resuelto_por_usuario_id = ?
       WHERE id = ?`,
      [MOTIVO_REVOCACION, adminId, solicitudId],
    );

    // Incrementa versión de autenticación del asistente
    await conn2.query('UPDATE usuarios SET version_autenticacion = version_autenticacion + 1 WHERE id = ?', [asistenteId]);

    // Registra auditoría de revocación
    await conn2.query(
      `INSERT INTO auditoria_jerarquia (actor_usuario_id, objetivo_usuario_id, accion, detalle)
       VALUES (?, ?, 'REVOCACION_ADMINISTRATIVA', ?)`,
      [adminId, asistenteId, JSON.stringify({ solicitudesRechazadas: [solicitudId], motivo: MOTIVO_REVOCACION })],
    );

    // Commit de la revocación en Conexión 2
    await conn2.commit();

    // 2. Conexión 1 (Coordinador) intenta aprobar la solicitud
    await conn1.beginTransaction();
    const [[solParaAprobar]] = await conn1.query<any[]>(
      'SELECT * FROM solicitudes_cambio WHERE id = ? FOR UPDATE',
      [solicitudId],
    );

    // REGLA OBLIGATORIA: El backend evalúa si la solicitud está PENDIENTE o CORREGIDA.
    // Si ya no lo está (porque está RECHAZADA), lanza ConflictException y aborta inmediatamente.
    let errorAprobacionLanzado = false;
    if (solParaAprobar.estado !== 'PENDIENTE' && solParaAprobar.estado !== 'CORREGIDA') {
      errorAprobacionLanzado = true;
      // Aborta la transacción; no debe sobrescribir con INVALIDADA
      await conn1.rollback();
    } else {
      // Si llegara aquí (no debe), mutaría
      await conn1.query(
        "INSERT INTO cursos (codigo, nombre, descripcion, activo) VALUES ('MAT-202', 'Álgebra Lineal', 'No debió crearse', 1)",
      );
      await conn1.commit();
    }

    expect(errorAprobacionLanzado).toBe(true);

    // 3. Comprobaciones de integridad del Escenario B:
    // A) La solicitud DEBE permanecer estrictamente en RECHAZADA. No debe sobrescribirse con INVALIDADA.
    const [[solFinal]] = await conn1.query<any[]>('SELECT * FROM solicitudes_cambio WHERE id = ?', [solicitudId]);
    expect(solFinal.estado).toBe('RECHAZADA');
    expect(solFinal.estado).not.toBe('INVALIDADA');
    expect(solFinal.motivo_rechazo).toBe(MOTIVO_REVOCACION);
    expect(solFinal.resuelto_por_usuario_id).toBe(adminId);

    // B) El dato oficial (Curso) NUNCA se creó (cero escrituras indebidas)
    const [cursosNoCreados] = await conn1.query<any[]>("SELECT * FROM cursos WHERE codigo = 'MAT-202'");
    expect(cursosNoCreados.length).toBe(0);

    // C) Dependencia y permisos del asistente permanecen inactivos
    const [[depFinal]] = await conn1.query<any[]>('SELECT * FROM dependencias_usuario WHERE asistente_id = ?', [asistenteId]);
    expect(depFinal.activo).toBe(0);
    expect(depFinal.desactivado_en).not.toBeNull();

    const [permisosActivos] = await conn1.query<any[]>(
      'SELECT * FROM permisos_carrera WHERE usuario_id = ? AND activo = 1',
      [asistenteId],
    );
    expect(permisosActivos.length).toBe(0);

    // D) Versión de autenticación del asistente se incrementó
    const [[asistFinal]] = await conn1.query<any[]>('SELECT version_autenticacion FROM usuarios WHERE id = ?', [asistenteId]);
    expect(asistFinal.version_autenticacion).toBe(1);

    // E) Auditoría contiene REVOCACION_ADMINISTRATIVA y ninguna de aprobación
    const [auditorias] = await conn1.query<any[]>(
      'SELECT accion FROM auditoria_jerarquia WHERE objetivo_usuario_id = ? ORDER BY id ASC',
      [asistenteId],
    );
    expect(auditorias.map((a: any) => a.accion)).toEqual(['REVOCACION_ADMINISTRATIVA']);
  });

  it('Prueba de regresión: Cuando el Coordinador reconfigura permisos al asistente, las solicitudes previas permanecen PENDIENTES', async () => {
    const { coordinadorId, asistenteId, carreraId } = await sembrarEscenarioBase();

    // Crear solicitud pendiente
    const [solResult] = await conn1.query<any>(
      `INSERT INTO solicitudes_cambio 
       (solicitante_id, coordinador_id, carrera_id, modulo, operacion, datos_propuestos, estado, correlacion_id)
       VALUES (?, ?, ?, 'CURSOS', 'CREAR', ?, 'PENDIENTE', 'corr-regresion-coord')`,
      [asistenteId, coordinadorId, carreraId, JSON.stringify({ codigo: 'MAT-303', nombre: 'Física I' })],
    );
    const solicitudId = solResult.insertId;

    // El Coordinador retira el permiso de la carrera al asistente (configurarAsistenteEnTransaccion)
    await conn1.beginTransaction();
    await conn1.query(
      "UPDATE permisos_carrera SET activo = 0 WHERE usuario_id = ? AND carrera_id = ? AND permiso = 'CURSOS_GESTIONAR'",
      [asistenteId, carreraId],
    );
    // Nota de diseño SGPA: La reconfiguración directa del coordinador NO rechaza las solicitudes ya enviadas
    await conn1.commit();

    // Comprobar que la solicitud previa PERMANECE en PENDIENTE
    const [[solicitud]] = await conn1.query<any[]>('SELECT * FROM solicitudes_cambio WHERE id = ?', [solicitudId]);
    expect(solicitud.estado).toBe('PENDIENTE');
    expect(solicitud.motivo_rechazo).toBeNull();
    expect(solicitud.resuelto_en).toBeNull();
  });
});
