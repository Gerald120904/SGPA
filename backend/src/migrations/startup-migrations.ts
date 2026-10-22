import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';

type MysqlIdentity = {
  base: string;
  puerto: number;
  directorio: string;
  uuid: string;
  soloLectura: number;
};

type HistoryRow = { id: number; timestamp: string | number; name: string };

function setting(config: ConfigService, name: string): string {
  return String(config.get<string>(name) ?? '').trim();
}

function normalizeDirectory(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export function configuredMigrationNames(dataSource: DataSource): string[] {
  const names = dataSource.migrations.map((migration) => migration.name);
  if (!names.length || names.some((name) => !name) || new Set(names).size !== names.length) {
    throw new Error('La lista oficial de migraciones está vacía o contiene duplicados.');
  }
  return names as string[];
}

async function baseTableCount(executor: DataSource | QueryRunner): Promise<number> {
  const [row] = (await executor.query(
    "SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> 'migrations'",
  )) as Array<{ total: number | string }>;
  return Number(row?.total ?? 0);
}

async function migrationTableExists(executor: DataSource | QueryRunner): Promise<boolean> {
  const [row] = (await executor.query(
    "SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'migrations'",
  )) as Array<{ total: number | string }>;
  return Number(row?.total) === 1;
}

export function validateMigrationHistory(rows: HistoryRow[], officialNames: string[]): Set<string> {
  const names = rows.map((row) => row.name);
  if (new Set(names).size !== names.length) {
    throw new Error('El historial de migraciones contiene nombres duplicados.');
  }
  const timestamps = rows.map((row) => String(row.timestamp));
  if (new Set(timestamps).size !== timestamps.length) {
    throw new Error('El historial de migraciones contiene timestamps duplicados.');
  }
  const unknown = names.filter((name) => !officialNames.includes(name));
  if (unknown.length) {
    throw new Error(`El historial contiene migraciones ajenas a la lista oficial: ${unknown.join(', ')}.`);
  }
  for (const row of rows) {
    const expectedTimestamp = row.name.match(/(\d{13})$/)?.[1];
    if (!expectedTimestamp || expectedTimestamp !== String(row.timestamp)) {
      throw new Error(`El historial es incompatible: timestamp incorrecto para ${row.name}.`);
    }
  }

  const applied = new Set(names);
  const baseline = officialNames[0];
  const incremental = officialNames.slice(1);
  let foundGap = false;
  for (const name of incremental) {
    if (!applied.has(name)) foundGap = true;
    else if (foundGap) {
      throw new Error(`Historial incompatible: ${name} figura aplicada después de una migración faltante.`);
    }
  }
  // Existing installations may legitimately adopt the newly introduced baseline.
  if (applied.has(baseline) && rows.length > 1) {
    const baselineRows = rows.filter((row) => row.name === baseline);
    if (baselineRows.length !== 1) throw new Error('La migración base está duplicada.');
  }
  return applied;
}

async function pending(
  executor: DataSource | QueryRunner,
  officialNames: string[],
): Promise<string[]> {
  if (!(await migrationTableExists(executor))) {
    if ((await baseTableCount(executor)) === 0) return [...officialNames];
    throw new Error(
      'La base tiene tablas pero no posee un historial migrations. Requiere revisión controlada; no se modificó el esquema.',
    );
  }
  const rows = (await executor.query(
    'SELECT id, timestamp, name FROM migrations ORDER BY id',
  )) as HistoryRow[];
  const applied = validateMigrationHistory(rows, officialNames);
  return officialNames.filter((name) => !applied.has(name));
}

function assertSafeDataSource(dataSource: DataSource): void {
  if (dataSource.options.type !== 'mysql' || dataSource.options.synchronize !== false || dataSource.options.migrationsRun !== false) {
    throw new Error('La ejecución segura requiere MySQL, synchronize=false y migrationsRun=false.');
  }
}

function assertDevelopmentAuthorization(config: ConfigService): void {
  if (
    setting(config, 'SGPA_START_PROFILE') !== 'development' ||
    setting(config, 'SGPA_RUNTIME_ENV') !== 'development' ||
    setting(config, 'NODE_ENV') === 'production' ||
    setting(config, 'SGPA_TEST_MODE').toLowerCase() === 'true'
  ) {
    throw new Error('La migración automática solo está permitida por start:dev en desarrollo.');
  }
  if (setting(config, 'SGPA_AUTO_MIGRATE_DEV').toLowerCase() !== 'true') {
    throw new Error('Hay migraciones pendientes. Configure una vez SGPA_AUTO_MIGRATE_DEV=true y la identidad esperada del MySQL local.');
  }
}

function assertIdentityAuthorized(
  dataSource: DataSource,
  config: ConfigService,
  identity: MysqlIdentity,
): void {
  const expected = {
    base: setting(config, 'SGPA_AUTO_MIGRATE_DATABASE'),
    host: setting(config, 'SGPA_AUTO_MIGRATE_HOST').toLowerCase(),
    port: Number(setting(config, 'SGPA_AUTO_MIGRATE_PORT')),
    directory: setting(config, 'SGPA_AUTO_MIGRATE_DATADIR'),
    uuid: setting(config, 'SGPA_AUTO_MIGRATE_SERVER_UUID').toLowerCase(),
  };
  const mysqlOptions = dataSource.options as typeof dataSource.options & { host?: string; port?: number };
  const host = String(mysqlOptions.host ?? '').toLowerCase();
  const port = Number(mysqlOptions.port);
  if (
    !expected.base || !expected.host || !expected.port || !expected.directory || !expected.uuid ||
    !['localhost', '127.0.0.1', '::1'].includes(host) || expected.host !== host ||
    expected.base !== identity.base || expected.port !== port || expected.port !== Number(identity.puerto) ||
    normalizeDirectory(expected.directory) !== normalizeDirectory(identity.directorio) ||
    expected.uuid !== identity.uuid.toLowerCase() || Number(identity.soloLectura) !== 0
  ) {
    throw new Error('La identidad de MySQL no coincide con la autorización local; no se aplicó ninguna migración.');
  }
}

export type MigrationExecutionMode = 'development-startup' | 'manual';

export async function executeSafeOfficialMigrations(
  dataSource: DataSource,
  config: ConfigService,
  mode: MigrationExecutionMode,
): Promise<string[]> {
  if (!dataSource.isInitialized) throw new Error('La conexión TypeORM no está inicializada.');
  assertSafeDataSource(dataSource);
  const names = configuredMigrationNames(dataSource);
  const initialPending = await pending(dataSource, names);
  if (!initialPending.length) return [];

  if (mode === 'development-startup') assertDevelopmentAuthorization(config);
  else if (setting(config, 'NODE_ENV') === 'production') {
    throw new Error('El ejecutor manual no se habilita en producción mediante este comando local.');
  }

  const [identity] = (await dataSource.query(
    'SELECT DATABASE() AS base, @@port AS puerto, @@datadir AS directorio, @@server_uuid AS uuid, @@read_only AS soloLectura',
  )) as MysqlIdentity[];
  assertIdentityAuthorized(dataSource, config, identity);

  const lockName = `sgpa-migrate-${createHash('sha256')
    .update(`${identity.uuid}:${identity.base}`).digest('hex').slice(0, 40)}`;
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  let acquired = false;
  try {
    const [lock] = (await runner.query('SELECT GET_LOCK(?, 15) AS adquirido', [lockName])) as Array<{ adquirido: number }>;
    if (Number(lock?.adquirido) !== 1) throw new Error('Otra instancia está migrando esta base.');
    acquired = true;

    const currentPending = await pending(runner, names);
    if (!currentPending.length) return [];
    const executed = await dataSource.runMigrations({ transaction: 'each' });
    const executedNames = executed.map((migration) => migration.name);
    const remaining = await pending(runner, names);
    if (
      executedNames.length !== currentPending.length ||
      executedNames.some((name, index) => name !== currentPending[index]) ||
      remaining.length
    ) {
      throw new Error('El resultado no coincide con la lista de migraciones pendientes.');
    }
    console.log(`Migraciones de desarrollo aplicadas: ${executedNames.join(', ')}`);
    return executedNames;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`No se completaron las migraciones: ${message}. MySQL puede conservar DDL parcial; revise el esquema antes de reintentar.`);
  } finally {
    try {
      if (acquired) await runner.query('SELECT RELEASE_LOCK(?) AS liberado', [lockName]);
    } finally {
      await runner.release();
    }
  }
}

export async function verificarMigracionesAntesDeEscuchar(
  dataSource: DataSource,
  config: ConfigService,
): Promise<string[]> {
  return executeSafeOfficialMigrations(dataSource, config, 'development-startup');
}
