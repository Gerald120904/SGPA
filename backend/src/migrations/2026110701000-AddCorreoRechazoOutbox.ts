import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

const OUTBOX = 'correos_rechazo_formularios';
const INTENTOS = 'correos_rechazo_formularios_intentos';

export class AddCorreoRechazoOutbox2026110701000 implements MigrationInterface {
  name = 'AddCorreoRechazoOutbox2026110701000';

  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable(OUTBOX) || await runner.hasTable(INTENTOS)) {
      throw new Error('El esquema de correo de rechazo ya existe parcialmente; requiere revisión manual.');
    }
    await runner.createTable(new Table({ name: OUTBOX, columns: [
      { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'respuesta_id', type: 'int', unsigned: true },
      { name: 'destinatario', type: 'varchar', length: '255', isNullable: true },
      { name: 'nombre_estudiante', type: 'varchar', length: '200' },
      { name: 'titulo_formulario', type: 'varchar', length: '255' },
      { name: 'carrera_nombre', type: 'varchar', length: '180', isNullable: true },
      { name: 'motivo_rechazo', type: 'varchar', length: '500' },
      { name: 'estado', type: 'varchar', length: '24' },
      { name: 'intentos', type: 'smallint', unsigned: true, default: 0 },
      { name: 'lease_id', type: 'char', length: '36', isNullable: true },
      { name: 'bloqueado_hasta', type: 'datetime', precision: 3, isNullable: true },
      { name: 'proximo_intento_at', type: 'datetime', precision: 3, isNullable: true },
      { name: 'ultimo_error', type: 'varchar', length: '1000', isNullable: true },
      { name: 'entregado_at', type: 'datetime', precision: 3, isNullable: true },
      { name: 'created_at', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)' },
      { name: 'updated_at', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)', onUpdate: 'CURRENT_TIMESTAMP(3)' },
    ] }), true);
    await runner.createIndex(OUTBOX, new TableIndex({ name: 'UQ_correo_rechazo_respuesta', columnNames: ['respuesta_id'], isUnique: true }));
    await runner.createIndex(OUTBOX, new TableIndex({ name: 'IDX_correo_rechazo_pendientes', columnNames: ['estado', 'proximo_intento_at'] }));
    await runner.createForeignKey(OUTBOX, new TableForeignKey({ name: 'FK_correo_rechazo_respuesta', columnNames: ['respuesta_id'],
      referencedTableName: 'respuestas_formularios_estudiantes', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }));
    await runner.createTable(new Table({ name: INTENTOS, columns: [
      { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'correo_id', type: 'int', unsigned: true },
      { name: 'numero', type: 'smallint', unsigned: true },
      { name: 'estado', type: 'varchar', length: '24' },
      { name: 'error', type: 'varchar', length: '1000', isNullable: true },
      { name: 'created_at', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)' },
    ] }), true);
    await runner.createIndex(INTENTOS, new TableIndex({ name: 'UQ_correo_rechazo_intento', columnNames: ['correo_id', 'numero'], isUnique: true }));
    await runner.createForeignKey(INTENTOS, new TableForeignKey({ name: 'FK_correo_rechazo_intento', columnNames: ['correo_id'],
      referencedTableName: OUTBOX, referencedColumnNames: ['id'], onDelete: 'RESTRICT' }));
  }

  async down(runner: QueryRunner): Promise<void> {
    for (const table of [INTENTOS, OUTBOX]) {
      if (!(await runner.hasTable(table))) continue;
      const [{ total }] = await runner.query(`SELECT COUNT(*) AS total FROM ${table}`) as Array<{ total: number }>;
      if (Number(total) !== 0) throw new Error(`No se elimina ${table} con datos; se requiere revisión manual.`);
      await runner.dropTable(table, true);
    }
  }
}
