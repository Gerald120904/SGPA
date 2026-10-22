import { QueryRunner, Table } from 'typeorm';
import { AddMissingRuntimeTables2026102200000, missingRuntimeTables } from './2026102200000-AddMissingRuntimeTables';

describe('AddMissingRuntimeTables', () => {
  const migration = new AddMissingRuntimeTables2026102200000();

  it.each(['usuario_permiso_excepciones', 'grupos', 'horarios_grupo'])(
    'rechaza una tabla parcial incompatible (%s) antes de escribir', async (existing) => {
      const runner = {
        hasTable: jest.fn(async (name: string) =>
          ['usuarios', 'cursos', 'periodos_academicos', 'aulas', existing].includes(name)),
        getTable: jest.fn(async (name: string) => {
          if (name !== existing) return undefined;
          const expected = missingRuntimeTables().find((item) => item.table.name === name)!.table;
          return new Table({
            name,
            columns: expected.columns.filter((column) => column.name !== 'id'),
            indices: expected.indices,
            uniques: expected.uniques,
            foreignKeys: expected.foreignKeys,
          });
        }),
        createTable: jest.fn(), query: jest.fn().mockResolvedValue([]),
      };
      await expect(migration.up(runner as unknown as QueryRunner)).rejects.toThrow('es incompatible');
      expect(runner.createTable).not.toHaveBeenCalled();
      expect(runner.query.mock.calls.some(([sql]) => String(sql).startsWith('ALTER TABLE'))).toBe(false);
    },
  );

  it('no funciona como instalador de una base vacía', async () => {
    const runner = { hasTable: jest.fn(async () => false), createTable: jest.fn() };
    await expect(migration.up(runner as unknown as QueryRunner)).rejects.toThrow('no es un instalador');
    expect(runner.createTable).not.toHaveBeenCalled();
  });

  it('rechaza una reversión destructiva', async () => {
    await expect(migration.down()).rejects.toThrow('No se eliminan tablas');
  });
});
