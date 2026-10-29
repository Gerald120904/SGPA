import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { mkdir, stat, unlink } from 'fs/promises';
import { isAbsolute, resolve, sep } from 'path';
import { promisify } from 'util';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';
import { assertIdentityAuthorized, officialSchemaLockName } from '../migrations/startup-migrations';

type SchemaQuery = { query: string; parameters?: unknown[] };
type ForeignKeyShape = {
  table: string; name: string; columns: string[]; referencedTable: string;
  referencedColumns: string[]; onDelete: string; onUpdate: string;
};
type Operation =
  | { kind: 'table'; sql: SchemaQuery; table: string }
  | { kind: 'column'; sql: SchemaQuery; table: string; column: string; definition: string }
  | { kind: 'index'; sql: SchemaQuery; table: string; name: string; columns: string[]; unique: boolean }
  | { kind: 'foreignKey'; sql: SchemaQuery; foreignKey: ForeignKeyShape }
  | { kind: 'datePrecision'; sql: SchemaQuery; table: string; column: string; onUpdate: boolean };

const execFileAsync = promisify(execFile);

function setting(config: ConfigService, name: string): string {
  return String(config.get<string>(name) ?? '').trim();
}

function columns(value: string): string[] | undefined {
  const parts = value.split(',').map((part) => part.trim());
  if (!parts.length || parts.some((part) => !/^`[A-Za-z0-9_]+`$/.test(part))) return undefined;
  return parts.map((part) => part.slice(1, -1));
}

function rule(sql: string, action: 'DELETE' | 'UPDATE'): string {
  return sql.match(new RegExp(`\\bON ${action} (CASCADE|RESTRICT|NO ACTION|SET NULL)\\b`, 'i'))?.[1].toUpperCase().replace('NO ACTION', 'RESTRICT') ?? 'RESTRICT';
}

function foreignKey(sql: string): ForeignKeyShape | undefined {
  const match = sql.match(/^ALTER TABLE `([A-Za-z0-9_]+)` ADD CONSTRAINT `([A-Za-z0-9_]+)` FOREIGN KEY \(([^)]+)\) REFERENCES `([A-Za-z0-9_]+)`\(([^)]+)\)(.*)$/i);
  if (!match || !/^\s*(?:ON (?:DELETE|UPDATE) (?:CASCADE|RESTRICT|NO ACTION|SET NULL)\s*){0,2}$/i.test(match[6])) return undefined;
  const local = columns(match[3]);
  const referenced = columns(match[5]);
  if (!local || !referenced || local.length !== referenced.length ||
    (match[6].match(/\bON DELETE\b/gi)?.length ?? 0) > 1 ||
    (match[6].match(/\bON UPDATE\b/gi)?.length ?? 0) > 1) return undefined;
  return { table: match[1], name: match[2], columns: local, referencedTable: match[4], referencedColumns: referenced,
    onDelete: rule(match[6], 'DELETE'), onUpdate: rule(match[6], 'UPDATE') };
}

function sameForeignKey(a: ForeignKeyShape, b: ForeignKeyShape): boolean {
  return a.table === b.table && a.columns.join(',') === b.columns.join(',') &&
    a.referencedTable === b.referencedTable && a.referencedColumns.join(',') === b.referencedColumns.join(',') &&
    a.onDelete === b.onDelete && a.onUpdate === b.onUpdate;
}

function dateChange(sql: string, precision: 0 | 6): { table: string; column: string; onUpdate: boolean } | undefined {
  const match = sql.match(/^ALTER TABLE `([A-Za-z0-9_]+)` CHANGE `([A-Za-z0-9_]+)` `\2` datetime\((0|6)\) NOT NULL DEFAULT CURRENT_TIMESTAMP(?:\((6)\))?( ON UPDATE CURRENT_TIMESTAMP(?:\((6)\))?)?$/i);
  if (!match || Number(match[3]) !== precision || (precision === 6) !== (match[4] === '6') ||
    (Boolean(match[5]) && ((precision === 6) !== (match[6] === '6')))) return undefined;
  return { table: match[1], column: match[2], onUpdate: Boolean(match[5]) };
}

function operation(item: SchemaQuery): Operation | undefined {
  const sql = item.query.trim();
  if (item.parameters?.length || sql.includes(';')) return undefined;
  let match = sql.match(/^CREATE TABLE `([A-Za-z0-9_]+)` \([\s\S]+\) ENGINE=InnoDB$/i);
  if (match && !/\b(?:DROP|RENAME|CHANGE|MODIFY)\b/i.test(sql)) return { kind: 'table', sql: item, table: match[1] };
  match = sql.match(/^ALTER TABLE `([A-Za-z0-9_]+)` ADD `([A-Za-z0-9_]+)` ([\s\S]+)$/i);
  if (match && !/\b(?:DROP|RENAME|CHANGE|MODIFY|ADD CONSTRAINT)\b/i.test(match[3]) && !match[3].includes(',')) {
    return { kind: 'column', sql: item, table: match[1], column: match[2], definition: match[3] };
  }
  match = sql.match(/^CREATE (UNIQUE )?INDEX `([A-Za-z0-9_]+)` ON `([A-Za-z0-9_]+)` \(([^)]+)\)$/i);
  if (match) {
    const parsed = columns(match[4]);
    if (parsed) return { kind: 'index', sql: item, table: match[3], name: match[2], columns: parsed, unique: Boolean(match[1]) };
  }
  match = sql.match(/^ALTER TABLE `([A-Za-z0-9_]+)` ADD (UNIQUE )?INDEX `([A-Za-z0-9_]+)` \(([^)]+)\)$/i);
  if (match) {
    const parsed = columns(match[4]);
    if (parsed) return { kind: 'index', sql: item, table: match[1], name: match[3], columns: parsed, unique: Boolean(match[2]) };
  }
  const parsedForeignKey = foreignKey(sql);
  if (parsedForeignKey) return { kind: 'foreignKey', sql: item, foreignKey: parsedForeignKey };
  const date = dateChange(sql, 6);
  if (date) return { kind: 'datePrecision', sql: item, ...date };
  return undefined;
}

export type SafeSchemaPlan = { executable: SchemaQuery[]; preserved: string[]; blocked: string[] };

export function classifySchemaPlan(upQueries: SchemaQuery[], downQueries: SchemaQuery[]): SafeSchemaPlan {
  const ignored = new Set<number>();
  const preserved: string[] = [];
  upQueries.forEach((item, index) => {
    const drop = item.query.trim().match(/^ALTER TABLE `([A-Za-z0-9_]+)` DROP FOREIGN KEY `([A-Za-z0-9_]+)`$/i);
    if (!drop) return;
    const previous = foreignKey(downQueries[index]?.query?.trim() ?? '');
    if (!previous || previous.table !== drop[1] || previous.name !== drop[2]) return;
    const replacement = upQueries.findIndex((candidate, candidateIndex) => {
      if (candidateIndex === index) return false;
      const next = foreignKey(candidate.query.trim());
      return Boolean(next && sameForeignKey(previous, next));
    });
    if (replacement < 0) return;
    ignored.add(index);
    ignored.add(replacement);
    preserved.push(`${drop[1]}.${drop[2]}`);
  });
  upQueries.forEach((item, index) => {
    const drop = item.query.trim().match(/^DROP INDEX `([A-Za-z0-9_]+)` ON `([A-Za-z0-9_]+)`$/i);
    if (!drop) return;
    const previous = operation(downQueries[index] ?? { query: '' });
    if (previous?.kind !== 'index' || previous.table !== drop[2] || previous.name !== drop[1]) return;
    const replacement = upQueries.findIndex((candidate, candidateIndex) => {
      if (candidateIndex === index || ignored.has(candidateIndex)) return false;
      const next = operation(candidate);
      return next?.kind === 'index' && next.table === previous.table &&
        next.columns.join(',') === previous.columns.join(',') && next.unique === previous.unique;
    });
    if (replacement < 0) return;
    ignored.add(index);
    ignored.add(replacement);
    preserved.push(`${drop[2]}.${drop[1]}`);
  });
  const executable: SchemaQuery[] = [];
  const blocked: string[] = [];
  upQueries.forEach((item, index) => {
    if (ignored.has(index)) return;
    const parsed = operation(item);
    if (parsed?.kind === 'datePrecision') {
      const previous = dateChange(downQueries[index]?.query?.trim() ?? '', 0);
      if (previous?.table === parsed.table && previous.column === parsed.column && previous.onUpdate === parsed.onUpdate) executable.push(item);
      else blocked.push(item.query.trim());
    } else if (parsed) executable.push(item);
    else blocked.push(item.query.trim());
  });
  return { executable, preserved, blocked };
}

async function count(runner: QueryRunner, table: string): Promise<number> {
  const [row] = await runner.query(`SELECT COUNT(*) AS total FROM \`${table}\``) as Array<{ total: number | string }>;
  return Number(row?.total ?? 0);
}

async function preflight(runner: QueryRunner, queries: SchemaQuery[]): Promise<void> {
  const operations = queries.map((query) => operation(query)!);
  const newTables = new Set(operations.filter((item) => item.kind === 'table').map((item) => item.table));
  const newColumns = new Map<string, Operation & { kind: 'column' }>();
  for (const item of operations) if (item.kind === 'column') newColumns.set(`${item.table}.${item.column}`, item);
  const counts = new Map<string, number>();
  const tableRows = async (table: string) => {
    if (newTables.has(table)) return 0;
    if (!counts.has(table)) counts.set(table, await count(runner, table));
    return counts.get(table)!;
  };
  for (const item of operations) {
    if (item.kind === 'foreignKey' && !newTables.has(item.foreignKey.referencedTable) &&
      !(await runner.hasTable(item.foreignKey.referencedTable))) {
      throw new Error(`La relación ${item.foreignKey.name} requiere la tabla ${item.foreignKey.referencedTable}, que no existe en esta base.`);
    }
    if (item.kind === 'datePrecision') {
      const [column] = await runner.query(
        'SELECT DATA_TYPE AS type, DATETIME_PRECISION AS precisionValue, IS_NULLABLE AS nullableValue, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',
        [item.table, item.column],
      ) as Array<{ type: string; precisionValue: number; nullableValue: string; defaultValue: string; extra: string }>;
      if (!column || column.type.toLowerCase() !== 'datetime' || Number(column.precisionValue) !== 0 ||
        column.nullableValue !== 'NO' || !/^current_timestamp(?:\(\))?$/i.test(column.defaultValue) ||
        /on update/i.test(column.extra) !== item.onUpdate) {
        throw new Error(`La columna ${item.table}.${item.column} no coincide con datetime(0) esperado; requiere revisión manual.`);
      }
    }
    if (item.kind === 'column' && await tableRows(item.table) > 0 &&
      /\bNOT NULL\b/i.test(item.definition) && !/\bDEFAULT\b/i.test(item.definition)) {
      throw new Error(`La columna ${item.table}.${item.column} es obligatoria y la tabla tiene datos; defina un valor inicial mediante una migración revisada.`);
    }
    if (item.kind === 'index' && item.unique && await tableRows(item.table) > 0) {
      if (item.columns.some((column) => newColumns.has(`${item.table}.${column}`))) {
        throw new Error(`El índice único sobre ${item.table} incluye columnas nuevas; requiere revisión de datos.`);
      }
      const keys = item.columns.map((column) => `\`${column}\``).join(', ');
      const nonNull = item.columns.map((column) => `\`${column}\` IS NOT NULL`).join(' AND ');
      const rows = await runner.query(`SELECT 1 FROM \`${item.table}\` WHERE ${nonNull} GROUP BY ${keys} HAVING COUNT(*) > 1 LIMIT 1`) as unknown[];
      if (rows.length) throw new Error(`El índice único sobre ${item.table} tiene valores duplicados; corrija los datos antes de arrancar.`);
    }
    if (item.kind === 'foreignKey' && await tableRows(item.foreignKey.table) > 0) {
      const fk = item.foreignKey;
      const newLocal = fk.columns.map((column) => newColumns.get(`${fk.table}.${column}`)).filter((value) => value !== undefined);
      if (newLocal.length) {
        if (newLocal.some((column) => /\bNOT NULL\b|\bDEFAULT\b/i.test(column.definition))) {
          throw new Error(`La relación ${fk.name} usa columnas nuevas con valores iniciales; requiere revisión de datos.`);
        }
        continue;
      }
      const join = fk.columns.map((column, i) => `child.\`${column}\` = parent.\`${fk.referencedColumns[i]}\``).join(' AND ');
      const nonNull = fk.columns.map((column) => `child.\`${column}\` IS NOT NULL`).join(' AND ');
      const rows = await runner.query(`SELECT 1 FROM \`${fk.table}\` child LEFT JOIN \`${fk.referencedTable}\` parent ON ${join} WHERE ${nonNull} AND parent.\`${fk.referencedColumns[0]}\` IS NULL LIMIT 1`) as unknown[];
      if (rows.length) throw new Error(`La relación ${fk.name} tiene registros huérfanos; corrija los datos antes de arrancar.`);
    }
  }
}

async function backup(config: ConfigService, identity: { base: string }, options: DataSource['options']): Promise<string> {
  const directory = setting(config, 'SGPA_SCHEMA_BACKUP_DIR');
  if (!directory) throw new Error('Configure SGPA_SCHEMA_BACKUP_DIR para crear un respaldo antes de cambiar el esquema.');
  const workspace = resolve(__dirname, '../../..').toLowerCase();
  const destination = resolve(directory).toLowerCase();
  if (!isAbsolute(directory) || destination === workspace || destination.startsWith(`${workspace}${sep}`)) {
    throw new Error('SGPA_SCHEMA_BACKUP_DIR debe ser una ruta absoluta fuera del repositorio.');
  }
  const mysql = options as typeof options & { host?: string; port?: number; username?: string; password?: string };
  const target = resolve(directory, `${identity.base}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.sql`);
  await mkdir(resolve(directory), { recursive: true });
  try {
    await execFileAsync(setting(config, 'SGPA_MYSQLDUMP_PATH') || 'mysqldump', [
      '--single-transaction', '--set-gtid-purged=OFF', '--hex-blob', '--routines', '--triggers', '--events',
      `--host=${mysql.host}`, `--port=${mysql.port}`, `--user=${mysql.username}`,
      `--result-file=${target}`, '--databases', identity.base,
    ], { env: { ...process.env, MYSQL_PWD: mysql.password ?? '' }, maxBuffer: 1024 * 1024 });
    if ((await stat(target)).size < 100) throw new Error('El archivo de respaldo está vacío.');
    return target;
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw new Error(`No se pudo crear un respaldo restaurable con mysqldump: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function synchronizeDevelopmentSchemaSafely(dataSource: DataSource, config: ConfigService): Promise<string[]> {
  if (setting(config, 'SGPA_START_PROFILE') !== 'development') return [];
  if (setting(config, 'SGPA_RUNTIME_ENV') !== 'development' || setting(config, 'NODE_ENV') !== 'development' ||
    setting(config, 'SGPA_TEST_MODE').toLowerCase() === 'true') return [];
  if (!dataSource.isInitialized || dataSource.options.type !== 'mysql' || dataSource.options.synchronize !== false ||
    dataSource.options.migrationsRun !== false) throw new Error('La sincronización requiere MySQL y synchronize=false.');
  if (setting(config, 'SGPA_AUTO_SCHEMA_SYNC_DEV').toLowerCase() !== 'true') return [];

  const [identity] = await dataSource.query(
    'SELECT DATABASE() AS base, @@port AS puerto, @@datadir AS directorio, @@server_uuid AS uuid, @@read_only AS soloLectura',
  ) as Array<{ base: string; puerto: number; directorio: string; uuid: string; soloLectura: number }>;
  assertIdentityAuthorized(dataSource, config, identity);
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  let locked = false;
  try {
    const lockName = officialSchemaLockName(identity);
    const [lock] = await runner.query('SELECT GET_LOCK(?, 15) AS adquirido', [lockName]) as Array<{ adquirido: number }>;
    if (Number(lock?.adquirido) !== 1) throw new Error('Otra instancia está actualizando el esquema.');
    locked = true;
    const schema = await dataSource.driver.createSchemaBuilder().log();
    const plan = classifySchemaPlan(schema.upQueries, schema.downQueries);
    if (plan.blocked.length) throw new Error(`Cambios de esquema que requieren intervención:\n${plan.blocked.map((sql) => `- ${sql}`).join('\n')}`);
    if (plan.preserved.length) console.log(`Índices o relaciones equivalentes conservados: ${plan.preserved.join(', ')}`);
    if (!plan.executable.length) return [];
    await preflight(runner, plan.executable);
    const backupPath = await backup(config, identity, dataSource.options);
    let attempted = false;
    try {
      for (const query of plan.executable) {
        attempted = true;
        await runner.query(query.query, query.parameters);
      }
      const after = await dataSource.driver.createSchemaBuilder().log();
      const remaining = classifySchemaPlan(after.upQueries, after.downQueries);
      if (remaining.executable.length || remaining.blocked.length) throw new Error('El esquema aún difiere de las entidades tras la actualización.');
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}. ${attempted ? 'MySQL puede conservar DDL parcial. ' : ''}Respaldo para restauración manual: ${backupPath}`);
    }
    console.log(`Esquema de desarrollo actualizado con ${plan.executable.length} operación(es). Respaldo: ${backupPath}`);
    return plan.executable.map((query) => query.query);
  } finally {
    try { if (locked) await runner.query('SELECT RELEASE_LOCK(?) AS liberado', [officialSchemaLockName(identity)]); }
    finally { await runner.release(); }
  }
}
