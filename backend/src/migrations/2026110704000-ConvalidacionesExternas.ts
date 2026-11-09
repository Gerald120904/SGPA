import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class ConvalidacionesExternas2026110704000 implements MigrationInterface {
  name = 'ConvalidacionesExternas2026110704000';

  async up(q: QueryRunner): Promise<void> {
    if (!(await q.hasTable('convalidaciones_externas'))) {
      await q.createTable(new Table({ name: 'convalidaciones_externas', columns: [
        { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'estudiante_id', type: 'int', unsigned: true }, { name: 'carrera_id', type: 'int', unsigned: true },
        { name: 'plan_destino_id', type: 'int', unsigned: true }, { name: 'plan_asignatura_destino_id', type: 'int', unsigned: true },
        { name: 'institucion_origen', type: 'varchar', length: '180' }, { name: 'asignatura_origen', type: 'varchar', length: '180' },
        { name: 'identificacion_asignatura', type: 'varchar', length: '80' }, { name: 'creditos_origen', type: 'smallint', unsigned: true },
        { name: 'documentacion_json', type: 'json' }, { name: 'estado', type: 'varchar', length: '20', default: "'PENDIENTE'" },
        { name: 'motivo_solicitud', type: 'varchar', length: '500' }, { name: 'solicitada_por_usuario_id', type: 'int', unsigned: true },
        { name: 'idempotency_key', type: 'varchar', length: '36' }, { name: 'payload_hash', type: 'char', length: '64' },
        { name: 'revisada_por_usuario_id', type: 'int', unsigned: true, isNullable: true },
        { name: 'rol_revisor', type: 'varchar', length: '50', isNullable: true },
        { name: 'permiso_revisor', type: 'varchar', length: '80', isNullable: true },
        { name: 'fecha_revision', type: 'datetime', isNullable: true },
        { name: 'motivo_decision', type: 'varchar', length: '500', isNullable: true },
        { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
        { name: 'updated_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
      ], indices: [
        new TableIndex({ name: 'UQ_convalidacion_externa_idempotency', columnNames: ['idempotency_key'], isUnique: true }),
        new TableIndex({ name: 'IDX_convalidacion_externa_estudiante_destino_estado', columnNames: ['estudiante_id', 'plan_destino_id', 'estado'] }),
      ], foreignKeys: [
        new TableForeignKey({ name: 'FK_convalidacion_ext_estudiante', columnNames: ['estudiante_id'], referencedTableName: 'estudiantes', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
        new TableForeignKey({ name: 'FK_convalidacion_ext_carrera', columnNames: ['carrera_id'], referencedTableName: 'carreras', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
        new TableForeignKey({ name: 'FK_convalidacion_ext_plan', columnNames: ['plan_destino_id'], referencedTableName: 'planes_estudio', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
        new TableForeignKey({ name: 'FK_convalidacion_ext_asignatura', columnNames: ['plan_asignatura_destino_id'], referencedTableName: 'plan_asignaturas', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
        new TableForeignKey({ name: 'FK_convalidacion_ext_solicitante', columnNames: ['solicitada_por_usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
        new TableForeignKey({ name: 'FK_convalidacion_ext_revisor', columnNames: ['revisada_por_usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
      ] }), true);
    }
    if (!(await q.hasTable('auditoria_convalidaciones_externas'))) {
      await q.createTable(new Table({ name: 'auditoria_convalidaciones_externas', columns: [
        { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'convalidacion_id', type: 'int', unsigned: true }, { name: 'accion', type: 'varchar', length: '30' },
        { name: 'usuario_id', type: 'int', unsigned: true }, { name: 'rol_activo', type: 'varchar', length: '50' },
        { name: 'permiso', type: 'varchar', length: '80', isNullable: true }, { name: 'motivo', type: 'varchar', length: '500', isNullable: true },
        { name: 'snapshot_json', type: 'json' }, { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
      ], indices: [new TableIndex({ name: 'IDX_auditoria_convalidacion_id', columnNames: ['convalidacion_id', 'created_at'] })], foreignKeys: [
        new TableForeignKey({ name: 'FK_auditoria_convalidacion', columnNames: ['convalidacion_id'], referencedTableName: 'convalidaciones_externas', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
        new TableForeignKey({ name: 'FK_auditoria_convalidacion_usuario', columnNames: ['usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
      ] }), true);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    if (await q.hasTable('auditoria_convalidaciones_externas')) {
      const [{ total }] = await q.query('SELECT COUNT(*) total FROM auditoria_convalidaciones_externas');
      if (Number(total) > 0) throw new Error('No se puede revertir: la auditoría contiene decisiones de convalidación externa.');
      await q.dropTable('auditoria_convalidaciones_externas', true);
    }
    if (await q.hasTable('convalidaciones_externas')) {
      const [{ total }] = await q.query('SELECT COUNT(*) total FROM convalidaciones_externas');
      if (Number(total) > 0) throw new Error('No se puede revertir: hay solicitudes y evidencia de convalidaciones externas.');
      await q.dropTable('convalidaciones_externas', true);
    }
  }
}
