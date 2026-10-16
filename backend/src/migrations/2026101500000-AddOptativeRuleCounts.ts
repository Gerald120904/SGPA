import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const TABLE = 'reglas_optativas_plan';

const COLUMNS = [
  'cantidad_disciplinarias',
  'cantidad_abiertas',
  'cantidad_sede',
] as const;

function esDefinicionEsperada(columna: TableColumn): boolean {
  const tipo = columna.type.toLowerCase().replace(/\s+/g, ' ').trim();
  const defaultValue = String(columna.default ?? '').replaceAll("'", '');

  return (
    tipo === 'smallint' &&
    columna.unsigned === true &&
    columna.isNullable === false &&
    defaultValue === '0'
  );
}

export class AddOptativeRuleCounts2026101500000
  implements MigrationInterface
{
  name = 'AddOptativeRuleCounts2026101500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable(TABLE);

    if (!table) {
      throw new Error(`No existe la tabla requerida ${TABLE}.`);
    }

    const existentes = new Map(
      table.columns.map((columna) => [columna.name, columna]),
    );

    // Comprobar cualquier columna ya presente antes de modificar el esquema.
    for (const name of COLUMNS) {
      const existente = existentes.get(name);

      if (existente && !esDefinicionEsperada(existente)) {
        throw new Error(
          `La columna ${TABLE}.${name} existe con una definición inesperada; ` +
            'la migración se detuvo sin alterar el esquema.',
        );
      }
    }

    for (const name of COLUMNS) {
      if (existentes.has(name)) continue;

      await queryRunner.addColumn(
        TABLE,
        new TableColumn({
          name,
          type: 'smallint',
          unsigned: true,
          isNullable: false,
          default: 0,
        }),
      );
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Esta migración no elimina columnas: podrían contener configuraciones ' +
        'guardadas después de aplicarla. Para recuperar, restaure el respaldo ' +
        'verificado y coordine una migración correctiva.',
    );
  }
}
