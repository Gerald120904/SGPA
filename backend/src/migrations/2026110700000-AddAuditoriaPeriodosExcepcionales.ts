import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddAuditoriaPeriodosExcepcionales2026110700000 implements MigrationInterface {
  name = 'AddAuditoriaPeriodosExcepcionales2026110700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('auditoria_periodos_excepcionales')) return;
    await queryRunner.createTable(new Table({
      name: 'auditoria_periodos_excepcionales',
      columns: [
        { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'periodo_id', type: 'int', unsigned: true },
        { name: 'usuario_id', type: 'int', unsigned: true },
        { name: 'motivo', type: 'varchar', length: '500' },
        { name: 'cambios_json', type: 'json' },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
      ],
    }), true);
    await queryRunner.createIndex('auditoria_periodos_excepcionales', new TableIndex({
      name: 'IDX_auditoria_periodos_excepcionales_periodo', columnNames: ['periodo_id', 'created_at'],
    }));
    await queryRunner.createForeignKeys('auditoria_periodos_excepcionales', [
      new TableForeignKey({ name: 'FK_auditoria_periodos_excepcionales_periodo', columnNames: ['periodo_id'],
        referencedTableName: 'periodos_academicos', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
      new TableForeignKey({ name: 'FK_auditoria_periodos_excepcionales_usuario', columnNames: ['usuario_id'],
        referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('auditoria_periodos_excepcionales')) {
      await queryRunner.dropTable('auditoria_periodos_excepcionales', true);
    }
  }
}
