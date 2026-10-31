import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddNotificationIdempotency2026103002000 implements MigrationInterface {
  name = 'AddNotificationIdempotency2026103002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('notificaciones', 'clave_idempotencia'))) {
      await queryRunner.addColumn('notificaciones', new TableColumn({
        name: 'clave_idempotencia', type: 'varchar', length: '180', isNullable: true,
      }));
    }
    const tabla = await queryRunner.getTable('notificaciones');
    if (!tabla?.indices.some((indice) => indice.name === 'UQ_notificaciones_clave_idempotencia')) {
      await queryRunner.createIndex('notificaciones', new TableIndex({
        name: 'UQ_notificaciones_clave_idempotencia',
        columnNames: ['clave_idempotencia'], isUnique: true,
      }));
    }
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere una revisión manual de las notificaciones.');
  }
}
