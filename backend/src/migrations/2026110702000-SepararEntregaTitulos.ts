import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class SepararEntregaTitulos2026110702000 implements MigrationInterface {
  name = 'SepararEntregaTitulos2026110702000';

  async up(runner: QueryRunner): Promise<void> {
    const table = await runner.getTable('titulos_estudiantes');
    if (!table) throw new Error('No existe titulos_estudiantes; no se modificó el esquema.');
    if (table.findColumnByName('estado_entrega') || await runner.hasTable('auditoria_titulos_estudiantes')) {
      throw new Error('El esquema de entrega de títulos existe parcialmente; requiere revisión manual.');
    }
    await runner.addColumns('titulos_estudiantes', [
      new TableColumn({ name: 'estado_entrega', type: 'varchar', length: '24', default: "'PENDIENTE'" }),
      new TableColumn({ name: 'entregado_at', type: 'datetime', precision: 3, isNullable: true }),
      new TableColumn({ name: 'entregado_por_usuario_id', type: 'int', unsigned: true, isNullable: true }),
      new TableColumn({ name: 'motivo_entrega', type: 'varchar', length: '500', isNullable: true }),
    ]);
    await runner.createForeignKey('titulos_estudiantes', new TableForeignKey({
      name: 'FK_titulos_entregado_por', columnNames: ['entregado_por_usuario_id'],
      referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT',
    }));
    await runner.createTable(new Table({ name: 'auditoria_titulos_estudiantes', columns: [
      { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'titulo_id', type: 'int', unsigned: true },
      { name: 'usuario_id', type: 'int', unsigned: true },
      { name: 'accion', type: 'varchar', length: '32' },
      { name: 'motivo', type: 'varchar', length: '500' },
      { name: 'datos_json', type: 'json' },
      { name: 'created_at', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)' },
    ] }), true);
    await runner.createIndex('auditoria_titulos_estudiantes', new TableIndex({
      name: 'IDX_auditoria_titulo_fecha', columnNames: ['titulo_id', 'created_at'],
    }));
    await runner.createForeignKeys('auditoria_titulos_estudiantes', [
      new TableForeignKey({ name: 'FK_auditoria_titulo', columnNames: ['titulo_id'],
        referencedTableName: 'titulos_estudiantes', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
      new TableForeignKey({ name: 'FK_auditoria_titulo_usuario', columnNames: ['usuario_id'],
        referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
    ]);
  }

  async down(runner: QueryRunner): Promise<void> {
    const table = await runner.getTable('titulos_estudiantes');
    if (!table?.findColumnByName('estado_entrega')) return;
    const [{ total }] = await runner.query('SELECT COUNT(*) total FROM titulos_estudiantes') as Array<{ total: number }>;
    if (Number(total) > 0) throw new Error('No se revierte la separación de entrega con títulos existentes.');
    if (await runner.hasTable('auditoria_titulos_estudiantes')) {
      await runner.dropTable('auditoria_titulos_estudiantes', true);
    }
    await runner.dropForeignKey('titulos_estudiantes', 'FK_titulos_entregado_por');
    for (const name of ['motivo_entrega', 'entregado_por_usuario_id', 'entregado_at', 'estado_entrega']) {
      await runner.dropColumn('titulos_estudiantes', name);
    }
  }
}
