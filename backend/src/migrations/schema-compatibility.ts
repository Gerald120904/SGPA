import { QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export type ExpectedCheck = { name: string; expression: string };

export async function inspectChecks(
  queryRunner: QueryRunner,
  tableName: string,
  checks: ExpectedCheck[],
  allowMissing = false,
): Promise<string[]> {
  const rows = (await queryRunner.query(
    `SELECT tc.CONSTRAINT_NAME AS name, cc.CHECK_CLAUSE AS expression
       FROM information_schema.TABLE_CONSTRAINTS tc
       JOIN information_schema.CHECK_CONSTRAINTS cc
         ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = ? AND tc.CONSTRAINT_TYPE = 'CHECK'`,
    [tableName],
  )) as Array<{ name: string; expression: string }>;
  const missing: string[] = [];
  for (const expectedCheck of checks) {
    const actualCheck = rows.find((row) => row.name === expectedCheck.name);
    if (!actualCheck) missing.push(expectedCheck.name);
    else if (compact(actualCheck.expression) !== compact(expectedCheck.expression)) {
      throw new Error(`La tabla ${tableName} es incompatible: CHECK ${expectedCheck.name} tiene una expresión distinta.`);
    }
  }
  if (missing.length && !allowMissing) throw new Error(`La tabla ${tableName} es incompatible: faltan CHECK ${missing.join(', ')}.`);
  return missing;
}

function compact(value: unknown): string {
  return String(value ?? '')
    .replace(/[`'"()\s]/g, '')
    .replace(/^b([01])$/i, '$1')
    .toLowerCase();
}

function typeParts(column: TableColumn): { type: string; precision?: number } {
  const match = String(column.type).toLowerCase().match(/^([^()]+)(?:\((\d+)\))?$/);
  return {
    type: match?.[1] ?? String(column.type).toLowerCase(),
    precision: column.precision ?? (match?.[2] ? Number(match[2]) : undefined),
  };
}

type ColumnMetadata = {
  name: string;
  type: string;
  columnType: string;
  length: number | null;
  columnPrecision: number | null;
  columnScale: number | null;
  datetimePrecision: number | null;
  nullable: 'YES' | 'NO';
  defaultValue: unknown;
  extra: string;
};

function sameNames(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((name, index) => name === expected[index]);
}

function describeColumnMismatch(actual: TableColumn, expected: TableColumn, metadata?: ColumnMetadata): string[] {
  const errors: string[] = [];
  const actualType = metadata
    ? { type: metadata.type.toLowerCase(), precision: metadata.datetimePrecision ?? undefined }
    : typeParts(actual);
  const expectedType = typeParts(expected);
  const expectedTypeName = expectedType.type === 'boolean' ? 'tinyint' : expectedType.type;
  if (actualType.type !== expectedTypeName) errors.push(`tipo ${actualType.type} (esperado ${expectedTypeName})`);
  const actualLength = metadata?.length ?? actual.length;
  if (expected.length && String(actualLength || '') !== String(expected.length)) errors.push(`longitud ${actualLength || '-'} (esperada ${expected.length})`);
  const actualPrecision = metadata?.columnPrecision ?? actualType.precision;
  if (expectedType.precision !== undefined && (actualPrecision ?? 0) !== expectedType.precision) errors.push(`precisión ${actualPrecision ?? '-'} (esperada ${expectedType.precision})`);
  const actualScale = metadata?.columnScale ?? actual.scale;
  if (expected.scale !== undefined && (actualScale ?? 0) !== expected.scale) errors.push(`escala ${actualScale ?? '-'} (esperada ${expected.scale})`);
  const actualUnsigned = metadata ? metadata.columnType.toLowerCase().includes('unsigned') : Boolean(actual.unsigned);
  if (actualUnsigned !== Boolean(expected.unsigned)) errors.push('atributo UNSIGNED distinto');
  const actualNullable = metadata ? metadata.nullable === 'YES' : Boolean(actual.isNullable);
  if (actualNullable !== Boolean(expected.isNullable)) errors.push('nulabilidad distinta');
  if (Boolean(actual.isPrimary) !== Boolean(expected.isPrimary)) errors.push('clave primaria distinta');
  if (Boolean(actual.isGenerated) !== Boolean(expected.isGenerated)) errors.push('generación automática distinta');
  if ((actual.generationStrategy ?? '') !== (expected.generationStrategy ?? '')) errors.push('estrategia de generación distinta');
  const expectedDefault = expected.default === true ? '1' : expected.default === false ? '0' : compact(expected.default);
  const rawActualDefault = metadata ? metadata.defaultValue : actual.default;
  const actualDefault = rawActualDefault === true ? '1' : rawActualDefault === false ? '0' : compact(rawActualDefault);
  if (actualDefault !== expectedDefault) errors.push(`valor por defecto ${actual.default ?? 'NULL'} (esperado ${expected.default ?? 'NULL'})`);
  const actualOnUpdate = metadata?.extra.match(/on update\s+(.+)$/i)?.[1] ?? actual.onUpdate;
  if (compact(actualOnUpdate) !== compact(expected.onUpdate)) errors.push('regla ON UPDATE distinta');
  if ((actual.enum ?? []).join('|') !== (expected.enum ?? []).join('|')) errors.push('valores ENUM distintos');
  return errors;
}

function findIndex(table: Table, expected: TableIndex): TableIndex | undefined {
  const indexes = [
    ...table.indices,
    ...table.uniques.map((unique) => new TableIndex({ name: unique.name, columnNames: unique.columnNames, isUnique: true })),
  ];
  const named = indexes.find((index) => index.name === expected.name);
  if (named) return named;
  // MySQL creates an index for each foreign key. TypeORM omits those indexes
  // from Table.indices when it reads an existing table.
  if (!expected.isUnique && table.foreignKeys.some((key) => sameNames(key.columnNames, expected.columnNames))) {
    return new TableIndex({ name: expected.name, columnNames: expected.columnNames });
  }
  return undefined;
}

function foreignKeyErrors(actual: TableForeignKey, expected: TableForeignKey): string[] {
  const errors: string[] = [];
  if (!sameNames(actual.columnNames, expected.columnNames)) errors.push('columnas locales distintas');
  if (actual.referencedTableName !== expected.referencedTableName) errors.push('tabla referenciada distinta');
  if (!sameNames(actual.referencedColumnNames, expected.referencedColumnNames)) errors.push('columnas referenciadas distintas');
  const normalizeRule = (value: unknown) => ['noaction', 'restrict', ''].includes(compact(value)) ? 'restrict' : compact(value);
  if (normalizeRule(actual.onDelete) !== normalizeRule(expected.onDelete)) errors.push('ON DELETE distinto');
  if (normalizeRule(actual.onUpdate) !== normalizeRule(expected.onUpdate)) errors.push('ON UPDATE distinto');
  return errors;
}

export async function assertTableCompatible(
  queryRunner: QueryRunner,
  expected: Table,
  checks: ExpectedCheck[] = [],
): Promise<void> {
  const actual = await queryRunner.getTable(expected.name);
  if (!actual) throw new Error(`No existe la tabla requerida ${expected.name}.`);
  const problems: string[] = [];
  const metadataRows = (await queryRunner.query(
    `SELECT COLUMN_NAME AS name, DATA_TYPE AS type, COLUMN_TYPE AS columnType,
            CHARACTER_MAXIMUM_LENGTH AS length, NUMERIC_PRECISION AS columnPrecision,
            NUMERIC_SCALE AS columnScale, DATETIME_PRECISION AS datetimePrecision,
            IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [expected.name],
  )) as ColumnMetadata[];
  const metadata = new Map(metadataRows.map((row) => [row.name, row]));

  for (const expectedColumn of expected.columns) {
    const actualColumn = actual.findColumnByName(expectedColumn.name);
    if (!actualColumn) {
      problems.push(`falta columna ${expectedColumn.name}`);
      continue;
    }
    const differences = describeColumnMismatch(actualColumn, expectedColumn, metadata.get(expectedColumn.name));
    if (differences.length) problems.push(`columna ${expectedColumn.name}: ${differences.join(', ')}`);
  }

  const actualPrimary = actual.primaryColumns.map((column) => column.name);
  const expectedPrimary = expected.primaryColumns.map((column) => column.name);
  if (!sameNames(actualPrimary, expectedPrimary)) problems.push(`PK [${actualPrimary}] (esperada [${expectedPrimary}])`);

  for (const expectedIndex of expected.indices) {
    const actualIndex = findIndex(actual, expectedIndex);
    if (!actualIndex) problems.push(`falta índice ${expectedIndex.name}`);
    else if (!sameNames(actualIndex.columnNames, expectedIndex.columnNames) || Boolean(actualIndex.isUnique) !== Boolean(expectedIndex.isUnique)) {
      problems.push(`índice ${expectedIndex.name} tiene columnas o unicidad distintas`);
    }
  }
  for (const expectedUnique of expected.uniques) {
    const actualIndex = findIndex(actual, new TableIndex({ name: expectedUnique.name, columnNames: expectedUnique.columnNames, isUnique: true }));
    if (!actualIndex) problems.push(`falta restricción única ${expectedUnique.name}`);
    else if (!sameNames(actualIndex.columnNames, expectedUnique.columnNames) || !actualIndex.isUnique) problems.push(`restricción única ${expectedUnique.name} incompatible`);
  }
  for (const expectedForeignKey of expected.foreignKeys) {
    const actualForeignKey = actual.foreignKeys.find((foreignKey) => foreignKey.name === expectedForeignKey.name);
    if (!actualForeignKey) problems.push(`falta clave foránea ${expectedForeignKey.name}`);
    else {
      const differences = foreignKeyErrors(actualForeignKey, expectedForeignKey);
      if (differences.length) problems.push(`clave foránea ${expectedForeignKey.name}: ${differences.join(', ')}`);
    }
  }

  if (checks.length) {
    try {
      await inspectChecks(queryRunner, expected.name, checks);
    } catch (error) {
      problems.push(error instanceof Error ? error.message.replace(`La tabla ${expected.name} es incompatible: `, '').replace(/\.$/, '') : String(error));
    }
  }

  if (problems.length) {
    throw new Error(`La tabla ${expected.name} es incompatible: ${problems.join('; ')}.`);
  }
}
