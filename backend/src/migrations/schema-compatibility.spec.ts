import { QueryRunner, Table } from 'typeorm';
import { assertTableCompatible } from './schema-compatibility';

function expected(): Table {
  return new Table({
    name: 'detalle',
    columns: [
      { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'codigo', type: 'varchar', length: '20' },
      { name: 'total', type: 'decimal', precision: 10, scale: 2, default: 0 },
    ],
    indices: [{ name: 'UQ_detalle_codigo', columnNames: ['codigo'], isUnique: true }],
    foreignKeys: [{
      name: 'FK_detalle_padre', columnNames: ['id'], referencedTableName: 'padres',
      referencedColumnNames: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE',
    }],
  });
}

describe('assertTableCompatible', () => {
  it('acepta columnas, PK, índices, FK y CHECK equivalentes', async () => {
    const table = expected();
    const runner = {
      getTable: jest.fn().mockResolvedValue(table),
      query: jest.fn().mockResolvedValue([{ name: 'CHK_detalle_total', expression: '(`total` >= 0)' }]),
    };
    await expect(assertTableCompatible(
      runner as unknown as QueryRunner,
      expected(),
      [{ name: 'CHK_detalle_total', expression: 'total >= 0' }],
    )).resolves.toBeUndefined();
  });

  it('informa diferencias estructurales antes de que la migración escriba', async () => {
    const table = expected();
    table.findColumnByName('codigo')!.length = '10';
    table.foreignKeys[0].onDelete = 'RESTRICT';
    const runner = { getTable: jest.fn().mockResolvedValue(table), query: jest.fn().mockResolvedValue([]) };
    await expect(assertTableCompatible(runner as unknown as QueryRunner, expected()))
      .rejects.toThrow(/longitud.*ON DELETE/);
    expect(runner.query.mock.calls.some(([sql]) => /^(ALTER|CREATE|DROP|UPDATE|DELETE|INSERT)/i.test(String(sql).trim()))).toBe(false);
  });
});
