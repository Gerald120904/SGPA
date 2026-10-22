import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ensureOfficialRoles } from '../roles/official-roles.catalog';

type SchemaQuery = { query: string; parameters?: unknown[] };
type ForeignKeyShape = { table: string; columns: string; referencedTable: string; referencedColumns: string };

function setting(config: ConfigService, name: string): string {
  return String(config.get<string>(name) ?? '').trim();
}

function names(value: string): string {
  return value.replace(/`/g, '').replace(/\s+/g, '').toLowerCase();
}

function addedForeignKey(sql: string): ForeignKeyShape | undefined {
  const match = sql.match(
    /^ALTER TABLE `([^`]+)` ADD CONSTRAINT `[^`]+` FOREIGN KEY \(([^)]+)\) REFERENCES `([^`]+)`\(([^)]+)\)/i,
  );
  if (!match) return undefined;
  return { table: match[1], columns: names(match[2]), referencedTable: match[3], referencedColumns: names(match[4]) };
}

function droppedForeignKey(sql: string): { table: string; name: string } | undefined {
  const match = sql.match(/^ALTER TABLE `([^`]+)` DROP FOREIGN KEY `([^`]+)`$/i);
  return match ? { table: match[1], name: match[2] } : undefined;
}

function sameForeignKey(left: ForeignKeyShape, right: ForeignKeyShape): boolean {
  return left.table === right.table && left.columns === right.columns &&
    left.referencedTable === right.referencedTable && left.referencedColumns === right.referencedColumns;
}

export type SafeSchemaPlan = {
  executable: SchemaQuery[];
  preserved: string[];
  blocked: string[];
};

export function classifySchemaPlan(upQueries: SchemaQuery[], downQueries: SchemaQuery[]): SafeSchemaPlan {
  const ignored = new Set<number>();
  const preserved: string[] = [];

  upQueries.forEach((item, index) => {
    const dropped = droppedForeignKey(item.query.trim());
    if (!dropped) return;
    const previousShape = addedForeignKey(downQueries[index]?.query?.trim() ?? '');
    if (!previousShape) return;
    const replacementIndex = upQueries.findIndex((candidate, candidateIndex) =>
      candidateIndex !== index && Boolean(addedForeignKey(candidate.query.trim())) &&
      sameForeignKey(previousShape, addedForeignKey(candidate.query.trim())!),
    );
    if (replacementIndex < 0) return;
    ignored.add(index);
    ignored.add(replacementIndex);
    preserved.push(`${dropped.table}.${dropped.name}`);
  });

  const executable: SchemaQuery[] = [];
  const blocked: string[] = [];
  upQueries.forEach((item, index) => {
    if (ignored.has(index)) return;
    const sql = item.query.trim();
    const additive = /^CREATE TABLE\b/i.test(sql) ||
      /^CREATE (?:UNIQUE )?INDEX\b/i.test(sql) ||
      /^ALTER TABLE\b.*\bADD\b/i.test(sql);
    if (additive && !/\bDROP\b|\bCHANGE\b|\bMODIFY\b|\bRENAME\b/i.test(sql)) executable.push(item);
    else blocked.push(sql);
  });
  return { executable, preserved, blocked };
}

export async function synchronizeDevelopmentSchemaSafely(
  dataSource: DataSource,
  config: ConfigService,
): Promise<string[]> {
  if (setting(config, 'SGPA_START_PROFILE') !== 'development') return [];
  if (setting(config, 'NODE_ENV').toLowerCase() === 'production') return [];
  if (setting(config, 'SGPA_TEST_MODE').toLowerCase() === 'true') return [];
  if (!dataSource.isInitialized || dataSource.options.type !== 'mysql' || dataSource.options.synchronize !== false) {
    throw new Error('La sincronización segura de desarrollo requiere MySQL inicializado y synchronize=false.');
  }

  const [identity] = (await dataSource.query(
    'SELECT DATABASE() AS base, @@server_uuid AS uuid, @@read_only AS soloLectura',
  )) as Array<{ base: string; uuid: string; soloLectura: number }>;
  if (!identity?.base || Number(identity.soloLectura) !== 0) throw new Error('MySQL no permite actualizar el esquema de desarrollo.');

  const lockName = `sgpa-schema-${createHash('sha256').update(`${identity.uuid}:${identity.base}`).digest('hex').slice(0, 40)}`;
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  let acquired = false;
  try {
    const [lock] = (await runner.query('SELECT GET_LOCK(?, 15) AS adquirido', [lockName])) as Array<{ adquirido: number }>;
    if (Number(lock?.adquirido) !== 1) throw new Error('Otra instancia está actualizando el esquema.');
    acquired = true;

    const sql = await dataSource.driver.createSchemaBuilder().log();
    const plan = classifySchemaPlan(sql.upQueries, sql.downQueries);
    if (plan.blocked.length) {
      throw new Error(
        `TypeORM propuso cambios potencialmente destructivos y fueron bloqueados:\n${plan.blocked.map((query) => `- ${query}`).join('\n')}`,
      );
    }
    for (const query of plan.executable) await runner.query(query.query, query.parameters);
    const roleChanges = await ensureOfficialRoles(runner);
    const applied = plan.executable.map((query) => query.query);
    if (plan.preserved.length) console.log(`Relaciones existentes conservadas: ${plan.preserved.join(', ')}`);
    if (applied.length) console.log(`Esquema de desarrollo actualizado con ${applied.length} operación(es) aditiva(s).`);
    if (roleChanges.length) console.log(`Catálogo de roles actualizado: ${roleChanges.join(', ')}`);
    return applied;
  } finally {
    try {
      if (acquired) await runner.query('SELECT RELEASE_LOCK(?) AS liberado', [lockName]);
    } finally {
      await runner.release();
    }
  }
}
