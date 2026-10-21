import { QueryRunner, Table, TableColumn } from 'typeorm';
import { AddOptativeRuleCounts2026101500000 } from './2026101500000-AddOptativeRuleCounts';

describe('AddOptativeRuleCounts2026101500000', () => {
  const migration = new AddOptativeRuleCounts2026101500000();
  const createTable = (columns: TableColumn[]) =>
    new Table({ name: 'reglas_optativas_plan', columns });
  const expectedColumn = (name: string) =>
    new TableColumn({
      name,
      type: 'smallint',
      unsigned: true,
      isNullable: false,
      default: '0',
    });

  it('agrega solo las tres columnas ausentes con default 0 y sin nulabilidad', async () => {
    const queryRunner = {
      getTable: jest.fn().mockResolvedValue(
        createTable([
          new TableColumn({ name: 'id', type: 'int', isPrimary: true }),
          new TableColumn({
            name: 'minimo_disciplinarias_propias',
            type: 'smallint',
            unsigned: true,
            default: '0',
          }),
          new TableColumn({
            name: 'maximo_otras_areas',
            type: 'smallint',
            unsigned: true,
            isNullable: true,
          }),
        ]),
      ),
      addColumn: jest.fn().mockResolvedValue(undefined),
    };

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.addColumn).toHaveBeenCalledTimes(3);
    expect(queryRunner.addColumn.mock.calls.map(([, column]) => column.name)).toEqual([
      'cantidad_disciplinarias',
      'cantidad_abiertas',
      'cantidad_sede',
    ]);
    for (const [tableName, column] of queryRunner.addColumn.mock.calls) {
      expect(tableName).toBe('reglas_optativas_plan');
      expect(column).toEqual(
        expect.objectContaining({
          type: 'smallint',
          unsigned: true,
          isNullable: false,
          default: 0,
        }),
      );
    }
  });

  it('es idempotente y conserva columnas legadas cuando ya está alineada', async () => {
    const queryRunner = {
      getTable: jest.fn().mockResolvedValue(
        createTable([
          expectedColumn('cantidad_disciplinarias'),
          expectedColumn('cantidad_abiertas'),
          expectedColumn('cantidad_sede'),
          expectedColumn('minimo_disciplinarias_propias'),
          new TableColumn({
            name: 'maximo_otras_areas',
            type: 'smallint',
            unsigned: true,
            isNullable: true,
          }),
        ]),
      ),
      addColumn: jest.fn(),
    };

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.addColumn).not.toHaveBeenCalled();
  });

  it('ejecutada dos veces agrega las columnas una sola vez y deja los campos legados iguales', async () => {
    const legado = [
      new TableColumn({
        name: 'minimo_disciplinarias_propias',
        type: 'smallint',
        unsigned: true,
        default: '0',
      }),
      new TableColumn({
        name: 'maximo_otras_areas',
        type: 'smallint',
        unsigned: true,
        isNullable: true,
      }),
    ];
    let tabla = createTable([...legado]);
    const filas: Array<Record<string, number | null>> = [
      {
        id: 7,
        minimo_disciplinarias_propias: 4,
        maximo_otras_areas: 3,
      },
    ];
    const valoresLegados = filas.map((fila) => ({
      minimo_disciplinarias_propias: fila.minimo_disciplinarias_propias,
      maximo_otras_areas: fila.maximo_otras_areas,
    }));
    const queryRunner = {
      getTable: jest.fn(async () => tabla),
      addColumn: jest.fn(async (_nombre: string, columna: TableColumn) => {
        tabla.columns.push(columna);
        for (const fila of filas) fila[columna.name] = Number(columna.default);
      }),
      query: jest.fn(),
      dropColumn: jest.fn(),
      dropTable: jest.fn(),
    };

    await migration.up(queryRunner as unknown as QueryRunner);
    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.getTable).toHaveBeenCalledTimes(2);
    expect(queryRunner.addColumn).toHaveBeenCalledTimes(3);
    expect(tabla.columns.map(({ name }) => name)).toEqual([
      'minimo_disciplinarias_propias',
      'maximo_otras_areas',
      'cantidad_disciplinarias',
      'cantidad_abiertas',
      'cantidad_sede',
    ]);
    expect(
      filas.map((fila) => ({
        minimo_disciplinarias_propias: fila.minimo_disciplinarias_propias,
        maximo_otras_areas: fila.maximo_otras_areas,
      })),
    ).toEqual(valoresLegados);
    expect(filas[0]).toEqual({
      id: 7,
      minimo_disciplinarias_propias: 4,
      maximo_otras_areas: 3,
      cantidad_disciplinarias: 0,
      cantidad_abiertas: 0,
      cantidad_sede: 0,
    });
    expect(queryRunner.query).not.toHaveBeenCalled();
    expect(queryRunner.dropColumn).not.toHaveBeenCalled();
    expect(queryRunner.dropTable).not.toHaveBeenCalled();
  });

  it('se detiene sin modificar si la tabla no existe o una columna tiene otro tipo', async () => {
    const missingTable = {
      getTable: jest.fn().mockResolvedValue(undefined),
      addColumn: jest.fn(),
    };
    await expect(
      migration.up(missingTable as unknown as QueryRunner),
    ).rejects.toThrow('No existe la tabla');
    expect(missingTable.addColumn).not.toHaveBeenCalled();

    const invalidColumn = {
      getTable: jest.fn().mockResolvedValue(
        createTable([
          new TableColumn({
            name: 'cantidad_disciplinarias',
            type: 'int',
            unsigned: true,
            default: '0',
          }),
        ]),
      ),
      addColumn: jest.fn(),
    };
    await expect(
      migration.up(invalidColumn as unknown as QueryRunner),
    ).rejects.toThrow('definición inesperada');
    expect(invalidColumn.addColumn).not.toHaveBeenCalled();
  });

  it('rechaza down para no borrar valores que se hayan configurado', async () => {
    await expect(migration.down()).rejects.toThrow('no elimina columnas');
  });
});
