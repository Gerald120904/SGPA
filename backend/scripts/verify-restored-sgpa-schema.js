// Read-only dump of sgpa; every DDL/DML statement targets a fresh, guarded copy.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const mysql = require('mysql2/promise');
const { DataSource, EntitySchema } = require('typeorm');
const { synchronizeDevelopmentSchemaSafely } = require('../dist/config/development-schema-sync');
require('reflect-metadata');
require('dotenv').config({ path: '.env', quiet: true });

const sourceDatabase = process.env.DB_DATABASE;
const copy = `sgpa_sync_codex_copy_${Date.now()}_${process.pid}`;
const host = process.env.DB_HOST;
const port = Number(process.env.DB_PORT || 3306);
const username = process.env.DB_USERNAME;
const password = process.env.DB_PASSWORD;
const dumpBinary = process.env.SGPA_MYSQLDUMP_PATH || 'mysqldump';
const mysqlBinary = process.env.SGPA_MYSQL_PATH || path.join(path.dirname(dumpBinary), 'mysql.exe');
const temporary = path.join(os.tmpdir(), `sgpa-restored-audit-${process.pid}`);
const dumpFile = path.join(temporary, 'source.sql');

function command(binary, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { env: { ...process.env, MYSQL_PWD: password || '' }, windowsHide: true,
      stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', (chunk) => { error += chunk.toString().slice(0, 2000); });
    child.on('error', reject);
    if (input) fs.createReadStream(input).pipe(child.stdin);
    child.on('exit', (code) => code === 0 ? resolve() : reject(Error(`${path.basename(binary)} falló (${code}): ${error}`)));
  });
}

async function counts(connection, database) {
  const [tables] = await connection.query(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME", [database]);
  const result = {};
  for (const { name } of tables) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) throw Error('Nombre de tabla inesperado.');
    const [[row]] = await connection.query(`SELECT COUNT(*) AS total FROM \`${database}\`.\`${name}\``);
    result[name] = Number(row.total);
  }
  return result;
}

async function constraints(connection, database) {
  const [rows] = await connection.query(
    `SELECT k.TABLE_NAME AS tableName, k.CONSTRAINT_NAME AS name, k.COLUMN_NAME AS columnName,
            k.REFERENCED_TABLE_NAME AS referencedTable, k.REFERENCED_COLUMN_NAME AS referencedColumn,
            r.DELETE_RULE AS onDelete, r.UPDATE_RULE AS onUpdate
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
      WHERE k.TABLE_SCHEMA=? AND k.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`, [database]);
  return rows;
}

async function indexes(connection, database) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS tableName, INDEX_NAME AS name, NON_UNIQUE AS nonUnique,
            COLUMN_NAME AS columnName, SEQ_IN_INDEX AS position
       FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=?
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`, [database]);
  return rows;
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const portNumber = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return portNumber;
}

async function startOnce(environment) {
  const portNumber = await freePort();
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, ...environment, PORT: String(portNumber) },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { log = (log + chunk.toString()).slice(-8000); });
  try {
    for (let i = 0; i < 240; i++) {
      if (child.exitCode !== null) throw Error(`El backend terminó antes de escuchar: ${log}`);
      const response = await new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${portNumber}/`, (res) => { res.resume(); resolve(res.statusCode); });
        req.on('error', () => resolve(undefined));
        req.setTimeout(1000, () => { req.destroy(); resolve(undefined); });
      });
      if (response === 200) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw Error(`El backend no escuchó en 120 segundos: ${log}`);
  } finally {
    child.kill();
    await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
  }
}

async function main() {
  if (sourceDatabase !== 'sgpa' || !['127.0.0.1', 'localhost', '::1'].includes(host) ||
    !/^sgpa_sync_codex_copy_\d+_\d+$/.test(copy)) throw Error('Destino de la auditoría no autorizado.');
  const admin = await mysql.createConnection({ host, port, user: username, password });
  const [[identity]] = await admin.query('SELECT @@datadir AS datadir, @@server_uuid AS uuid, @@read_only AS readOnly');
  if (Number(identity.readOnly) !== 0) throw Error('MySQL está en solo lectura.');
  const beforeCounts = await counts(admin, sourceDatabase);
  const beforeConstraints = await constraints(admin, sourceDatabase);
  const beforeIndexes = await indexes(admin, sourceDatabase);
  await fsp.mkdir(temporary, { recursive: true });
  try {
    await command(dumpBinary, ['--single-transaction', '--skip-lock-tables', '--set-gtid-purged=OFF', '--hex-blob', '--routines', '--triggers', '--events',
      `--host=${host}`, `--port=${port}`, `--user=${username}`, `--result-file=${dumpFile}`, sourceDatabase]);
    if ((await fsp.stat(dumpFile)).size < 100) throw Error('El dump de origen está vacío.');
    await admin.query(`CREATE DATABASE \`${copy}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await command(mysqlBinary, [`--host=${host}`, `--port=${port}`, `--user=${username}`, `--database=${copy}`], dumpFile);
    assert.deepEqual(await counts(admin, copy), beforeCounts, 'La restauración cambió el número de registros.');
    assert.deepEqual(await constraints(admin, copy), beforeConstraints, 'La restauración cambió las claves foráneas.');
    assert.deepEqual(await indexes(admin, copy), beforeIndexes, 'La restauración cambió los índices.');

    const values = {
      SGPA_START_PROFILE: 'development', SGPA_RUNTIME_ENV: 'development', NODE_ENV: 'development',
      SGPA_TEST_MODE: 'false', DB_SYNCHRONIZE: 'false', SGPA_AUTO_MIGRATE_DEV: 'true',
      SGPA_AUTO_SCHEMA_SYNC_DEV: 'true', SGPA_AUTO_MIGRATE_DATABASE: copy,
      SGPA_AUTO_MIGRATE_HOST: host, SGPA_AUTO_MIGRATE_PORT: String(port),
      SGPA_AUTO_MIGRATE_DATADIR: identity.datadir, SGPA_AUTO_MIGRATE_SERVER_UUID: identity.uuid,
      SGPA_SCHEMA_BACKUP_DIR: path.join(temporary, 'backups'), SGPA_MYSQLDUMP_PATH: dumpBinary,
      SGPA_INVITATION_OUTBOX_ENABLED: 'false', DB_DATABASE: copy,
    };
    const config = { get: (name) => values[name] };
    const source = async (extra = []) => {
      const ds = new DataSource({ type: 'mysql', host, port, username, password, database: copy,
        entities: ['dist/**/*.entity.js', ...extra], synchronize: false, migrationsRun: false });
      await ds.initialize();
      return ds;
    };
    let firstBackupPath;
    let ds = await source();
    try {
      const applied = await synchronizeDevelopmentSchemaSafely(ds, config);
      assert.equal(applied.length, 6, `Se esperaban seis ajustes de fecha, recibidos: ${applied.join('; ')}`);
      assert.deepEqual(await counts(admin, copy), beforeCounts);
      assert.deepEqual(await constraints(admin, copy), beforeConstraints);
      assert.deepEqual(await indexes(admin, copy), beforeIndexes);
      const backupFiles = await fsp.readdir(values.SGPA_SCHEMA_BACKUP_DIR);
      assert.equal(backupFiles.length, 1, 'El primer cambio debe crear exactamente un respaldo.');
      firstBackupPath = path.join(values.SGPA_SCHEMA_BACKUP_DIR, backupFiles[0]);
      const backupCount = backupFiles.length;
      assert.deepEqual(await synchronizeDevelopmentSchemaSafely(ds, config), []);
      assert.equal((await fsp.readdir(values.SGPA_SCHEMA_BACKUP_DIR)).length, backupCount);
      console.log(`Copia restaurada: ${Object.keys(beforeCounts).length} tablas; ${applied.length} ampliaciones datetime; cero cambios en registros, FK e índices.`);
    } finally { await ds.destroy(); }
    await admin.query(`DROP DATABASE \`${copy}\``);
    await command(mysqlBinary, [`--host=${host}`, `--port=${port}`, `--user=${username}`], firstBackupPath);
    assert.deepEqual(await counts(admin, copy), beforeCounts, 'El respaldo del sincronizador no restauró los registros.');
    assert.deepEqual(await constraints(admin, copy), beforeConstraints, 'El respaldo del sincronizador no restauró las FK.');
    assert.deepEqual(await indexes(admin, copy), beforeIndexes, 'El respaldo del sincronizador no restauró los índices.');
    console.log('Respaldo generado por el sincronizador: restaurado en la copia con registros, FK e índices intactos.');

    await startOnce(values);
    await startOnce(values);
    console.log('Dos arranques HTTP de la copia: 200 OK.');

    const probe = new EntitySchema({ name: 'SchemaSyncProbe', tableName: 'schema_sync_probe',
      columns: { id: { type: 'int', primary: true, generated: true }, note: { type: 'varchar', length: 30, nullable: true } } });
    ds = await source([probe]);
    try {
      assert.equal((await synchronizeDevelopmentSchemaSafely(ds, config)).length, 1);
      assert.deepEqual(await synchronizeDevelopmentSchemaSafely(ds, config), []);
      assert.deepEqual(await counts(admin, copy), { ...beforeCounts, schema_sync_probe: 0 });
      console.log('Cambio aditivo futuro: aplicado una vez; segundo arranque sin DDL.');
    } finally { await ds.destroy(); }
  } finally {
    if (/^sgpa_sync_codex_copy_\d+_\d+$/.test(copy)) await admin.query(`DROP DATABASE IF EXISTS \`${copy}\``);
    await admin.end();
    await fsp.rm(temporary, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
