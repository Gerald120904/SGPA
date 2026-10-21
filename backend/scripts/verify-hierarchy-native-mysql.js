// Verificacion exclusiva de una instancia MySQL nativa efimera.
// Uso: node scripts/verify-hierarchy-native-mysql.js --port=... --uuid=... --datadir=...
const assert = require('node:assert/strict');
const path = require('node:path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { DataSource } = require('typeorm');
const { AddHierarchicalAccess2026101900000 } = require('../dist/migrations/2026101900000-AddHierarchicalAccess');

const arg = (key) => process.argv.find((value) => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const port = Number(arg('port'));
const uuid = arg('uuid');
const datadir = arg('datadir');
const schema = arg('schema') || 'sgpa_hierarquia_qa';

if (!Number.isInteger(port) || port < 1024 || port === 3306 || !uuid || !datadir ||
    !path.resolve(datadir).toLowerCase().includes('sgpa-jerarquia-') ||
    !/^sgpa_hierarquia_qa[a-z0-9_]*$/.test(schema)) {
  throw new Error('Se requieren puerto, UUID y directorio de instancia efimera explicitos.');
}
process.env.DB_SYNCHRONIZE = 'false';
process.env.MIGRATIONS_RUN = 'false';
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

async function identity(connection) {
  const [[row]] = await connection.query('SELECT DATABASE() db, @@port port, @@server_uuid uuid, @@datadir datadir');
  return row;
}

async function main() {
  const source = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  const target = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: '' });
  let dataSource;
  try {
    const src = await identity(source);
    const dst = await identity(target);
    assert.ok(['sgpa', 'sgpa_test'].includes(src.db));
    assert.equal(dst.db, null);
    assert.equal(Number(dst.port), port);
    assert.equal(dst.uuid, uuid);
    assert.equal(path.resolve(dst.datadir).toLowerCase(), path.resolve(datadir).toLowerCase());
    assert.notEqual(dst.uuid, src.uuid);
    assert.notEqual(path.resolve(dst.datadir).toLowerCase(), path.resolve(src.datadir).toLowerCase());
    console.log(`Instancia aislada: puerto ${port}, UUID ${uuid}`);

    const [schemas] = await target.query('SELECT SCHEMA_NAME name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [schema]);
    assert.equal(schemas.length, 0, 'El esquema temporal ya existe; no se modifica.');
    await target.query(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await target.changeUser({ database: schema });
    for (const table of ['usuarios', 'carreras']) {
      const [[row]] = await source.query(`SHOW CREATE TABLE \`${table}\``);
      await target.query(row['Create Table']);
    }

    dataSource = new DataSource({ type: 'mysql', host: '127.0.0.1', port,
      username: 'root', password: '', database: schema, synchronize: false, migrationsRun: false });
    await dataSource.initialize();
    const migration = new AddHierarchicalAccess2026101900000();
    const runner = dataSource.createQueryRunner();
    try {
      await migration.up(runner);
      for (const table of ['dependencias_usuario', 'permisos_carrera', 'solicitudes_cambio', 'auditoria_jerarquia']) {
        assert.equal(await runner.hasTable(table), true, `${table} no fue creada`);
      }
      const [u] = await target.query("INSERT INTO usuarios (cedula,nombres,apellido1,correo,password_hash) VALUES ('QA-J-1','Coord','Temporal','coord@qa.test','no-login'),('QA-J-2','Asistente','Temporal','asistente@qa.test','no-login')");
      const coordinatorId = u.insertId;
      const assistantId = coordinatorId + 1;
      const [c] = await target.query("INSERT INTO carreras (nombre,codigo) VALUES ('QA Jerarquia','QA-J')");
      const careerId = c.insertId;
      await target.query('INSERT INTO dependencias_usuario (asistente_id,coordinador_id,creado_por_usuario_id) VALUES (?,?,?)', [assistantId, coordinatorId, coordinatorId]);
      await assert.rejects(() => target.query('INSERT INTO dependencias_usuario (asistente_id,coordinador_id,creado_por_usuario_id) VALUES (?,?,?)', [assistantId, coordinatorId, coordinatorId]), (e) => e.code === 'ER_DUP_ENTRY');
      await target.query("INSERT INTO permisos_carrera (usuario_id,carrera_id,permiso) VALUES (?,?,'ESTUDIANTES_VER')", [assistantId, careerId]);
      await assert.rejects(() => target.query("INSERT INTO permisos_carrera (usuario_id,carrera_id,permiso) VALUES (?,?,'ESTUDIANTES_VER')", [assistantId, careerId]), (e) => e.code === 'ER_DUP_ENTRY');
      await assert.rejects(() => target.query("INSERT INTO permisos_carrera (usuario_id,carrera_id,permiso) VALUES (999999,?,'ESTUDIANTES_VER')", [careerId]), (e) => e.code === 'ER_NO_REFERENCED_ROW_2');
      await target.query("INSERT INTO auditoria_jerarquia (actor_usuario_id,objetivo_usuario_id,accion,detalle) VALUES (?,?,'QA',?)", [coordinatorId, assistantId, JSON.stringify({ prueba: true })]);
      await target.query("INSERT INTO solicitudes_cambio (solicitante_id,coordinador_id,carrera_id,modulo,operacion,datos_propuestos,estado,correlacion_id) VALUES (?,?,?,'ESTUDIANTES','CREAR',?,'PENDIENTE',?)", [assistantId, coordinatorId, careerId, JSON.stringify({ prueba: true }), '00000000-0000-4000-8000-000000000001']);
      await assert.rejects(() => migration.down(runner), /datos historicos/);
      assert.equal(await runner.hasTable('solicitudes_cambio'), true);
      console.log('PASS: tablas, FK, unicidad, JSON, persistencia y down() protegido con datos.');

      const second = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: '', database: schema });
      try {
        const secondIdentity = await identity(second);
        assert.equal(secondIdentity.uuid, uuid);
        assert.equal(Number(secondIdentity.port), port);
        assert.equal(path.resolve(secondIdentity.datadir).toLowerCase(), path.resolve(datadir).toLowerCase());

        // Dos revisores compiten por la misma solicitud. El segundo ve el estado confirmado.
        await target.beginTransaction();
        await second.beginTransaction();
        const [[primera]] = await target.query('SELECT estado FROM solicitudes_cambio WHERE id=1 FOR UPDATE');
        assert.equal(primera.estado, 'PENDIENTE');
        const segundaLectura = second.query('SELECT estado FROM solicitudes_cambio WHERE id=1 FOR UPDATE');
        await new Promise((resolve) => setTimeout(resolve, 100));
        await target.query("UPDATE solicitudes_cambio SET estado='APROBADA' WHERE id=1 AND estado='PENDIENTE'");
        await target.commit();
        const [[segunda]] = await segundaLectura;
        assert.equal(segunda.estado, 'APROBADA');
        await second.rollback();

        // La unicidad también resiste dos inserciones simultáneas, aun con una sin confirmar.
        const [otro] = await target.query("INSERT INTO usuarios (cedula,nombres,apellido1,correo,password_hash) VALUES ('QA-J-3','Otro','Temporal','otro@qa.test','no-login')");
        await target.beginTransaction();
        await second.beginTransaction();
        await target.query('INSERT INTO dependencias_usuario (asistente_id,coordinador_id,creado_por_usuario_id) VALUES (?,?,?)',
          [otro.insertId, coordinatorId, coordinatorId]);
        const duplicado = second.query('INSERT INTO dependencias_usuario (asistente_id,coordinador_id,creado_por_usuario_id) VALUES (?,?,?)',
          [otro.insertId, coordinatorId, coordinatorId]);
        await new Promise((resolve) => setTimeout(resolve, 100));
        await target.commit();
        await assert.rejects(() => duplicado, (e) => e.code === 'ER_DUP_ENTRY');
        await second.rollback();

        // Una falla de auditoria revierte el cambio de estado en la misma transaccion.
        await target.beginTransaction();
        await target.query("UPDATE solicitudes_cambio SET estado='RECHAZADA' WHERE id=1");
        await assert.rejects(() => target.query("INSERT INTO auditoria_jerarquia (actor_usuario_id,objetivo_usuario_id,accion,detalle) VALUES (999999,?,'QA_FALLO',?)",
          [assistantId, JSON.stringify({ prueba: true })]), (e) => e.code === 'ER_NO_REFERENCED_ROW_2');
        await target.rollback();
        const [[despues]] = await target.query('SELECT estado FROM solicitudes_cambio WHERE id=1');
        assert.equal(despues.estado, 'APROBADA');
        console.log('PASS: dos aprobaciones serializadas, dependencia concurrente y rollback por auditoria fallida.');
      } finally {
        await target.rollback();
        await second.rollback();
        await second.end();
      }

      await target.query('DELETE FROM solicitudes_cambio');
      await target.query('DELETE FROM auditoria_jerarquia');
      await target.query('DELETE FROM permisos_carrera');
      await target.query('DELETE FROM dependencias_usuario');
      await migration.down(runner);
      for (const table of ['dependencias_usuario', 'permisos_carrera', 'solicitudes_cambio', 'auditoria_jerarquia']) {
        assert.equal(await runner.hasTable(table), false);
      }
      console.log('PASS: down() en esquema temporal sin datos jerarquicos.');
    } finally {
      await runner.release();
    }
  } finally {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await target.end();
    await source.end();
  }
}

main().catch((error) => { console.error(`FAIL: ${error.message}`); process.exitCode = 1; });
