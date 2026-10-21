import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const EQUIPAMIENTOS = 'equipamientos';
const AULA_EQUIPAMIENTOS = 'aula_equipamientos';
const CHECKS = [
  {
    tabla: EQUIPAMIENTOS,
    nombre: 'chk_equipamiento_cantidad_total',
    expresion: 'cantidad_total >= 0',
  },
  {
    tabla: AULA_EQUIPAMIENTOS,
    nombre: 'chk_aula_equipamiento_cantidad_asignada',
    expresion: 'cantidad_asignada > 0',
  },
] as const;

const COLUMNAS = [
  {
    tabla: EQUIPAMIENTOS,
    columna: new TableColumn({
      name: 'cantidad_total',
      type: 'smallint',
      unsigned: true,
      isNullable: false,
      default: 0,
    }),
  },
  {
    tabla: AULA_EQUIPAMIENTOS,
    columna: new TableColumn({
      name: 'cantidad_asignada',
      type: 'smallint',
      unsigned: true,
      isNullable: false,
    }),
  },
  {
    tabla: AULA_EQUIPAMIENTOS,
    columna: new TableColumn({
      name: 'asignado_en',
      type: 'datetime',
      isNullable: false,
      default: 'CURRENT_TIMESTAMP',
    }),
  },
  {
    tabla: AULA_EQUIPAMIENTOS,
    columna: new TableColumn({
      name: 'retirado_en',
      type: 'datetime',
      isNullable: true,
    }),
  },
] as const;

function definicionEsperada(
  actual: TableColumn,
  esperada: TableColumn,
): boolean {
  const tipoActual = actual.type.toLowerCase().replace(/\s+/g, ' ').trim();
  const tipoEsperado = esperada.type.toLowerCase().replace(/\s+/g, ' ').trim();
  const defaultActual = String(actual.default ?? '')
    .replaceAll("'", '')
    .toUpperCase();
  const defaultEsperado = String(esperada.default ?? '')
    .replaceAll("'", '')
    .toUpperCase();

  return (
    tipoActual === tipoEsperado &&
    actual.unsigned === esperada.unsigned &&
    actual.isNullable === esperada.isNullable &&
    defaultActual === defaultEsperado
  );
}

function definicionLegacyEsperada(actual: TableColumn): boolean {
  return (
    actual.type.toLowerCase() === 'smallint' &&
    actual.unsigned === true &&
    actual.default == null
  );
}

function normalizarCheck(expresion: string): string {
  return expresion
    .replaceAll('`', '')
    .replace(/[()\s]/g, '')
    .toLowerCase();
}

export class AddAulaEquipmentInventory2026101600000 implements MigrationInterface {
  name = 'AddAulaEquipmentInventory2026101600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const tablas = new Map<
      string,
      Awaited<ReturnType<QueryRunner['getTable']>>
    >();
    for (const nombre of [EQUIPAMIENTOS, AULA_EQUIPAMIENTOS]) {
      const tabla = await queryRunner.getTable(nombre);
      if (!tabla) throw new Error(`No existe la tabla requerida ${nombre}.`);
      tablas.set(nombre, tabla);
    }

    // Check all existing target columns before making any change.
    for (const { tabla: nombre, columna } of COLUMNAS) {
      const actual = tablas
        .get(nombre)!
        .columns.find(({ name }) => name === columna.name);
      if (actual && !definicionEsperada(actual, columna)) {
        throw new Error(
          `La columna ${nombre}.${columna.name} ya existe con una definición inesperada; ` +
            'la migración se detuvo sin alterar el esquema.',
        );
      }
    }

    const tablaLegacy = tablas.get(AULA_EQUIPAMIENTOS)!;
    const columnasLegacy = ['cantidad_total', 'cantidad_disponible'].map(
      (name) => tablaLegacy.columns.find((columna) => columna.name === name),
    );
    for (const columna of columnasLegacy) {
      if (
        columna &&
        !columna.isNullable &&
        !definicionLegacyEsperada(columna)
      ) {
        throw new Error(
          `La columna legacy ${AULA_EQUIPAMIENTOS}.${columna.name} tiene una definicion ` +
            'inesperada; la migracion se detuvo sin alterar el esquema.',
        );
      }
    }

    const checksActuales = (await queryRunner.query(
      `SELECT tc.TABLE_NAME AS table_name, tc.CONSTRAINT_NAME AS constraint_name, ` +
        `cc.CHECK_CLAUSE AS check_clause FROM information_schema.TABLE_CONSTRAINTS tc ` +
        `JOIN information_schema.CHECK_CONSTRAINTS cc ` +
        `ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA ` +
        `AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME ` +
        `WHERE tc.CONSTRAINT_SCHEMA = DATABASE() ` +
        `AND tc.TABLE_NAME IN (?, ?) AND tc.CONSTRAINT_TYPE = 'CHECK'`,
      [EQUIPAMIENTOS, AULA_EQUIPAMIENTOS],
    )) as Array<{
      table_name: string;
      constraint_name: string;
      check_clause: string;
    }>;
    for (const esperado of CHECKS) {
      const existente = checksActuales.find(
        ({ table_name, constraint_name }) =>
          table_name === esperado.tabla && constraint_name === esperado.nombre,
      );
      if (
        existente &&
        normalizarCheck(existente.check_clause) !==
          normalizarCheck(esperado.expresion)
      ) {
        throw new Error(
          `El CHECK ${esperado.nombre} tiene una expresion inesperada; ` +
            'la migracion se detuvo sin alterar el esquema.',
        );
      }
    }

    const faltantes = COLUMNAS.filter(
      ({ tabla, columna }) =>
        !tablas.get(tabla)!.columns.some(({ name }) => name === columna.name),
    );

    // Historical room-level totals do not provide enough information to infer
    // the new central inventory or assignment timestamps. Never fabricate them.
    if (faltantes.length > 0) {
      for (const nombre of [EQUIPAMIENTOS, AULA_EQUIPAMIENTOS]) {
        const rows = await queryRunner.query(
          `SELECT COUNT(*) AS total FROM \`${nombre}\``,
        );
        const total = Number(rows?.[0]?.total ?? 0);
        if (total > 0) {
          throw new Error(
            `La tabla ${nombre} contiene ${total} registros y faltan columnas QA-005. ` +
              'No se puede inferir el inventario/asignación histórica sin una regla aprobada; ' +
              'no se modificó el esquema.',
          );
        }
      }
    }

    for (const { tabla, columna } of faltantes) {
      await queryRunner.addColumn(tabla, columna);
    }

    for (const check of CHECKS) {
      const existente = checksActuales.some(
        ({ table_name, constraint_name }) =>
          table_name === check.tabla && constraint_name === check.nombre,
      );
      if (!existente) {
        await queryRunner.query(
          `ALTER TABLE \`${check.tabla}\` ADD CONSTRAINT \`${check.nombre}\` ` +
            `CHECK (${check.expresion})`,
        );
      }
    }

    // These legacy columns are absent from the current entity. Preserve every
    // stored value while allowing current-model inserts to omit them as NULL.
    for (const columna of columnasLegacy) {
      if (columna && !columna.isNullable) {
        await queryRunner.query(
          `ALTER TABLE \`${AULA_EQUIPAMIENTOS}\` MODIFY COLUMN \`${columna.name}\` SMALLINT UNSIGNED NULL`,
        );
      }
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'QA-005 no elimina columnas ni revierte defaults legacy automáticamente; ' +
        'podrían contener datos o ser necesarios para las inserciones actuales.',
    );
  }
}
