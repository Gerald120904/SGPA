// Integration audit. Creates and deletes only databases prefixed sgpa_sync_codex_.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { DataSource, EntitySchema } = require('typeorm');
const { synchronizeDevelopmentSchemaSafely } = require('../dist/config/development-schema-sync');
const { officialSchemaLockName } = require('../dist/migrations/startup-migrations');
require('dotenv').config({ path: '.env', quiet: true });

const host = process.env.DB_HOST;
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USERNAME;
const password = process.env.DB_PASSWORD;
const prefix = 'sgpa_sync_codex_';
const testDatabase = `${prefix}${Date.now()}_${process.pid}`;
const dump = process.env.SGPA_MYSQLDUMP_PATH || 'mysqldump';
const backupDirectory = path.join(os.tmpdir(), `sgpa-schema-audit-${process.pid}`);
const base = (length = 30) => new EntitySchema({
  name: 'Parent', tableName: 'parent',
  columns: { id: { type: 'int', primary: true, generated: true }, code: { type: 'varchar', length, nullable: true } },
});
const withNote = () => new EntitySchema({
  name: 'Parent', tableName: 'parent',
  columns: { id: { type: 'int', primary: true, generated: true }, code: { type: 'varchar', length: 30, nullable: true }, note: { type: 'varchar', length: 40, nullable: true } },
});
const child = (relation = false) => new EntitySchema({
  name: 'Child', tableName: 'child',
  columns: { id: { type: 'int', primary: true, generated: true }, parentId: { name: 'parent_id', type: 'int', nullable: true } },
  ...(relation ? { relations: { parent: { type: 'many-to-one', target: 'Parent', joinColumn: { name: 'parent_id', referencedColumnName: 'id', foreignKeyConstraintName: 'FK_child_parent' }, nullable: true, onDelete: 'SET NULL', onUpdate: 'CASCADE' } } } : {}),
});
const extra = (name) => new EntitySchema({ name, tableName: name.toLowerCase(), columns: { id: { type: 'int', primary: true, generated: true } } });

async function run() {
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw Error('La auditoría exige MySQL local.');
  if (!testDatabase.startsWith(prefix)) throw Error('Nombre de base de pruebas inválido.');
  const admin = await mysql.createConnection({ host, port, user, password });
  const [[identity]] = await admin.query('SELECT @@datadir AS datadir, @@server_uuid AS uuid, @@read_only AS readOnly');
  if (Number(identity.readOnly) !== 0) throw Error('MySQL está en solo lectura.');
  const config = { get: (name) => ({
    SGPA_START_PROFILE: 'development', SGPA_RUNTIME_ENV: 'development', NODE_ENV: 'development',
    SGPA_TEST_MODE: 'false', SGPA_AUTO_SCHEMA_SYNC_DEV: 'true',
    SGPA_AUTO_MIGRATE_DATABASE: testDatabase, SGPA_AUTO_MIGRATE_HOST: host,
    SGPA_AUTO_MIGRATE_PORT: String(port), SGPA_AUTO_MIGRATE_DATADIR: identity.datadir,
    SGPA_AUTO_MIGRATE_SERVER_UUID: identity.uuid,
    SGPA_SCHEMA_BACKUP_DIR: backupDirectory, SGPA_MYSQLDUMP_PATH: dump,
  })[name] };
  const source = async (entities) => {
    const ds = new DataSource({ type: 'mysql', host, port, username: user, password, database: testDatabase,
      synchronize: false, migrationsRun: false, entities });
    await ds.initialize();
    return ds;
  };
  const reset = async () => {
    await admin.query(`DROP DATABASE IF EXISTS \`${testDatabase}\``);
    await admin.query(`CREATE DATABASE \`${testDatabase}\``);
  };
  const sync = (ds) => synchronizeDevelopmentSchemaSafely(ds, config);
  let passed = 0;
  const scenario = async (label, fn) => {
    await reset();
    await fn();
    passed++;
    console.log(`OK ${passed}: ${label}`);
  };
  try {
    await scenario('base vacía y entidad nueva', async () => {
      const ds = await source([base()]);
      try { assert.equal((await sync(ds)).length, 1); assert.equal(Number(await ds.query('SELECT COUNT(*) AS total FROM parent').then((x) => x[0].total)), 0); }
      finally { await ds.destroy(); }
    });
    await scenario('base antigua con datos y columna nueva', async () => {
      let ds = await source([base()]); await sync(ds); await ds.query("INSERT INTO parent (code) VALUES ('conservado')"); await ds.destroy();
      ds = await source([withNote()]);
      try { assert.equal((await sync(ds)).length, 1); assert.equal((await ds.query('SELECT code FROM parent'))[0].code, 'conservado'); }
      finally { await ds.destroy(); }
    });
    await scenario('datetime(0) con datos se amplía sin cambiar fechas', async () => {
      await admin.query(`CREATE TABLE \`${testDatabase}\`.\`dates\` (\`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY, \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB`);
      await admin.query(`INSERT INTO \`${testDatabase}\`.\`dates\` (created_at, updated_at) VALUES ('2024-03-04 05:06:07', '2024-03-04 05:06:07')`);
      const dates = new EntitySchema({ name: 'Dates', tableName: 'dates', columns: {
        id: { type: 'int', primary: true, generated: true },
        createdAt: { name: 'created_at', type: 'datetime', createDate: true },
        updatedAt: { name: 'updated_at', type: 'datetime', updateDate: true },
      } });
      const ds = await source([dates]);
      try {
        assert.equal((await sync(ds)).length, 2);
        const [row] = await ds.query("SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s.%f') AS created, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s.%f') AS updated FROM dates");
        assert.equal(row.created, '2024-03-04 05:06:07.000000');
        assert.equal(row.updated, '2024-03-04 05:06:07.000000');
        assert.deepEqual(await sync(ds), []);
      } finally { await ds.destroy(); }
    });
    await scenario('base parcialmente actualizada', async () => {
      let ds = await source([base()]); await sync(ds); await ds.query('ALTER TABLE parent ADD note varchar(40) NULL'); await ds.destroy();
      ds = await source([withNote(), extra('Extra')]);
      try { assert.equal((await sync(ds)).length, 1); assert.equal(Number((await ds.query('SELECT COUNT(*) AS total FROM extra'))[0].total), 0); }
      finally { await ds.destroy(); }
    });
    await scenario('nueva relación válida', async () => {
      let ds = await source([base(), child()]); await sync(ds);
      await ds.query("INSERT INTO parent (code) VALUES ('p')"); await ds.query('INSERT INTO child (parent_id) VALUES (1)'); await ds.destroy();
      ds = await source([base(), child(true)]);
      try { assert.ok((await sync(ds)).length > 0); assert.equal((await ds.query('SELECT parent_id FROM child'))[0].parent_id, 1); }
      finally { await ds.destroy(); }
    });
    await scenario('índice único con duplicados bloqueado', async () => {
      let ds = await source([base()]); await sync(ds); await ds.query("INSERT INTO parent (code) VALUES ('x'), ('x')"); await ds.destroy();
      const indexed = new EntitySchema({ ...base().options, columns: { ...base().options.columns, code: { ...base().options.columns.code, unique: true } } });
      ds = await source([indexed]);
      try { await assert.rejects(sync(ds), /duplicados/); assert.equal(Number((await ds.query('SELECT COUNT(*) AS total FROM parent'))[0].total), 2); }
      finally { await ds.destroy(); }
    });
    await scenario('índice único con datos válidos', async () => {
      let ds = await source([base()]); await sync(ds); await ds.query("INSERT INTO parent (code) VALUES ('a'), ('b')"); await ds.destroy();
      const indexed = new EntitySchema({ ...base().options, columns: { ...base().options.columns, code: { ...base().options.columns.code, unique: true } } });
      ds = await source([indexed]);
      try { assert.equal((await sync(ds)).length, 1); assert.equal(Number((await ds.query('SELECT COUNT(*) AS total FROM parent'))[0].total), 2); }
      finally { await ds.destroy(); }
    });
    await scenario('clave foránea con huérfanos bloqueada', async () => {
      let ds = await source([base(), child()]); await sync(ds); await ds.query('INSERT INTO child (parent_id) VALUES (999)'); await ds.destroy();
      ds = await source([base(), child(true)]);
      try { await assert.rejects(sync(ds), /huérfanos/); assert.equal((await ds.query('SELECT parent_id FROM child'))[0].parent_id, 999); }
      finally { await ds.destroy(); }
    });
    await scenario('columna nueva opcional y relación en tabla con datos', async () => {
      let ds = await source([base(), extra('Child')]); await sync(ds);
      await ds.query('INSERT INTO child () VALUES ()'); await ds.destroy();
      ds = await source([base(), child(true)]);
      try { assert.ok((await sync(ds)).length >= 2); assert.equal((await ds.query('SELECT parent_id FROM child'))[0].parent_id, null); }
      finally { await ds.destroy(); }
    });
    await scenario('cambio de tipo destructivo bloqueado', async () => {
      let ds = await source([base()]); await sync(ds); await ds.destroy();
      ds = await source([base(20)]);
      try { await assert.rejects(sync(ds), /intervención/); }
      finally { await ds.destroy(); }
    });
    await scenario('dos arranques sin cambios', async () => {
      const ds = await source([base()]);
      try { await sync(ds); const before = (await fs.readdir(backupDirectory)).length;
        assert.deepEqual(await sync(ds), []); assert.deepEqual(await sync(ds), []);
        assert.equal((await fs.readdir(backupDirectory)).length, before);
      } finally { await ds.destroy(); }
    });
    await scenario('fallo a mitad de actualización conserva respaldo', async () => {
      const ds = await source([extra('First'), extra('Second')]);
      const original = ds.createQueryRunner.bind(ds);
      ds.createQueryRunner = (...args) => {
        const runner = original(...args);
        const query = runner.query.bind(runner);
        runner.query = (sql, ...rest) => /^CREATE TABLE `second`/.test(sql) ? Promise.reject(Error('fallo inducido')) : query(sql, ...rest);
        return runner;
      };
      try { await assert.rejects(sync(ds), /Respaldo para restauración manual/); assert.equal(Number((await ds.query("SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='first'"))[0].total), 1); }
      finally { await ds.destroy(); }
    });
    await scenario('dos procesos compiten por el bloqueo', async () => {
      const ds = await source([base()]);
      const lock = officialSchemaLockName({ uuid: identity.uuid, base: testDatabase });
      const [[acquired]] = await admin.query('SELECT GET_LOCK(?, 1) AS ok', [lock]);
      assert.equal(acquired.ok, 1);
      try { await assert.rejects(sync(ds), /Otra instancia/); }
      finally { await admin.query('SELECT RELEASE_LOCK(?)', [lock]); await ds.destroy(); }
    });
    console.log(`${passed} escenarios aislados pasaron.`);
  } finally {
    if (testDatabase.startsWith(prefix)) await admin.query(`DROP DATABASE IF EXISTS \`${testDatabase}\``);
    await admin.end();
    await fs.rm(backupDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
