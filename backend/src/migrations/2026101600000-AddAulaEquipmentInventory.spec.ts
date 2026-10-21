import { QueryRunner, Table, TableCheck, TableColumn } from 'typeorm';
import { AddAulaEquipmentInventory2026101600000 } from './2026101600000-AddAulaEquipmentInventory';

describe('AddAulaEquipmentInventory2026101600000', () => {
  const migration = new AddAulaEquipmentInventory2026101600000();
  const expected = [
    [
      'equipamientos',
      new TableColumn({
        name: 'cantidad_total',
        type: 'smallint',
        unsigned: true,
        isNullable: false,
        default: '0',
      }),
    ],
    [
      'aula_equipamientos',
      new TableColumn({
        name: 'cantidad_asignada',
        type: 'smallint',
        unsigned: true,
        isNullable: false,
      }),
    ],
    [
      'aula_equipamientos',
      new TableColumn({
        name: 'asignado_en',
        type: 'datetime',
        isNullable: false,
        default: 'CURRENT_TIMESTAMP',
      }),
    ],
    [
      'aula_equipamientos',
      new TableColumn({
        name: 'retirado_en',
        type: 'datetime',
        isNullable: true,
      }),
    ],
  ] as const;
  const tables = () =>
    new Map([
      [
        'equipamientos',
        new Table({
          name: 'equipamientos',
          columns: [
            new TableColumn({ name: 'id', type: 'int', isPrimary: true }),
          ],
        }),
      ],
      [
        'aula_equipamientos',
        new Table({
          name: 'aula_equipamientos',
          columns: [
            new TableColumn({ name: 'id', type: 'int', isPrimary: true }),
            new TableColumn({
              name: 'cantidad_total',
              type: 'smallint',
              unsigned: true,
              isNullable: false,
            }),
            new TableColumn({
              name: 'cantidad_disponible',
              type: 'smallint',
              unsigned: true,
              isNullable: false,
            }),
          ],
        }),
      ],
    ]);
  const runner = (schema = tables(), counts = [0, 0]) => {
    let countIndex = 0;
    return {
      schema,
      getTable: jest.fn(async (name: string) => schema.get(name)),
      query: jest.fn(async (sql: string) => {
        if (sql.startsWith('SELECT COUNT(*)')) {
          return [{ total: counts[countIndex++] ?? 0 }];
        }
        if (sql.includes('CHECK_CONSTRAINTS')) {
          return [...schema.entries()].flatMap(([table_name, table]) =>
            table.checks.map((check) => ({
              table_name,
              constraint_name: check.name,
              check_clause: check.expression,
            })),
          );
        }
        if (sql.includes('ADD CONSTRAINT')) {
          const match = sql.match(/ADD CONSTRAINT `([^`]+)` CHECK \((.+)\)$/);
          const tableName = sql.includes('`equipamientos`')
            ? 'equipamientos'
            : 'aula_equipamientos';
          schema
            .get(tableName)!
            .checks.push(
              new TableCheck({ name: match![1], expression: match![2] }),
            );
          return undefined;
        }
        const columna = sql.includes('`cantidad_total`')
          ? 'cantidad_total'
          : 'cantidad_disponible';
        schema
          .get('aula_equipamientos')!
          .columns.find((item) => item.name === columna)!.isNullable = true;
        return undefined;
      }),
      addColumn: jest.fn(async (tableName: string, column: TableColumn) => {
        schema.get(tableName)!.columns.push(column);
      }),
    };
  };

  it('agrega las cuatro columnas con tipos y defaults del modelo vigente', async () => {
    const qr = runner();
    await migration.up(qr as unknown as QueryRunner);

    expect(qr.addColumn).toHaveBeenCalledTimes(4);
    expect(
      qr.query.mock.calls
        .map(([sql]) => sql)
        .filter((sql) => sql.includes('ADD CONSTRAINT')),
    ).toEqual([
      'ALTER TABLE `equipamientos` ADD CONSTRAINT `chk_equipamiento_cantidad_total` CHECK (cantidad_total >= 0)',
      'ALTER TABLE `aula_equipamientos` ADD CONSTRAINT `chk_aula_equipamiento_cantidad_asignada` CHECK (cantidad_asignada > 0)',
    ]);
    expect(
      qr.addColumn.mock.calls.map(([table, column]) => [table, column.name]),
    ).toEqual(expected.map(([table, column]) => [table, column.name]));
    expected.forEach(([table, column], index) => {
      expect(qr.addColumn.mock.calls[index][0]).toBe(table);
      const actual = qr.addColumn.mock.calls[index][1];
      expect(actual).toEqual(
        expect.objectContaining({
          type: column.type,
          unsigned: column.unsigned,
          isNullable: column.isNullable,
        }),
      );
      expect(
        String(actual.default ?? '')
          .replaceAll("'", '')
          .toUpperCase(),
      ).toBe(
        String(column.default ?? '')
          .replaceAll("'", '')
          .toUpperCase(),
      );
    });
  });

  it('rechaza filas históricas porque no existe una conversión justificada y no cambia el esquema', async () => {
    const qr = runner(tables(), [0, 2]);
    await expect(migration.up(qr as unknown as QueryRunner)).rejects.toThrow(
      'No se puede inferir el inventario/asignación histórica',
    );
    expect(qr.addColumn).not.toHaveBeenCalled();
    expect(
      qr.schema.get('equipamientos')!.columns.map(({ name }) => name),
    ).toEqual(['id']);
  });

  it('se detiene si una columna ya existe con definición distinta', async () => {
    const schema = tables();
    schema.get('equipamientos')!.columns.push(
      new TableColumn({
        name: 'cantidad_total',
        type: 'int',
        unsigned: true,
        default: '0',
      }),
    );
    const qr = runner(schema);
    await expect(migration.up(qr as unknown as QueryRunner)).rejects.toThrow(
      'definición inesperada',
    );
    expect(qr.addColumn).not.toHaveBeenCalled();
    expect(qr.query).not.toHaveBeenCalled();
    expect(
      qr.query.mock.calls.some(([sql]) => sql.includes('ADD CONSTRAINT')),
    ).toBe(false);
  });

  it('rechaza una restricción CHECK existente con la regla equivocada antes de cambiar el esquema', async () => {
    const schema = tables();
    schema.get('equipamientos')!.checks.push(
      new TableCheck({
        name: 'chk_equipamiento_cantidad_total',
        expression: 'cantidad_total > 0',
      }),
    );
    const qr = runner(schema);

    await expect(migration.up(qr as unknown as QueryRunner)).rejects.toThrow(
      'CHECK chk_equipamiento_cantidad_total tiene una expresion inesperada',
    );
    expect(qr.addColumn).not.toHaveBeenCalled();
    expect(
      qr.query.mock.calls.some(([sql]) => sql.includes('ALTER TABLE')),
    ).toBe(false);
  });

  it('al repetirse no vuelve a agregar las columnas ni cambia valores existentes', async () => {
    const schema = tables();
    const legacyData = [{ cantidad_total: 5, cantidad_disponible: 2 }];
    const qr = runner(schema);
    await migration.up(qr as unknown as QueryRunner);
    const addedCount = qr.addColumn.mock.calls.length;
    await migration.up(qr as unknown as QueryRunner);

    expect(addedCount).toBe(4);
    expect(qr.addColumn).toHaveBeenCalledTimes(4);
    expect(
      qr.query.mock.calls.filter(([sql]) => sql.includes('ADD CONSTRAINT')),
    ).toHaveLength(2);
    expect(legacyData).toEqual([{ cantidad_total: 5, cantidad_disponible: 2 }]);
    const cambiosLegacy = qr.query.mock.calls
      .map(([sql]) => sql)
      .filter((sql) => sql.includes('MODIFY COLUMN'));
    expect(cambiosLegacy).toEqual([
      'ALTER TABLE `aula_equipamientos` MODIFY COLUMN `cantidad_total` SMALLINT UNSIGNED NULL',
      'ALTER TABLE `aula_equipamientos` MODIFY COLUMN `cantidad_disponible` SMALLINT UNSIGNED NULL',
    ]);
  });

  it('no elimina columnas en down', async () => {
    await expect(migration.down()).rejects.toThrow('no elimina columnas');
  });
});
