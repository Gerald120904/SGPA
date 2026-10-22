import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { assertTableCompatible } from './schema-compatibility';

export function hierarchicalTables(): Table[] {
  return [
    new Table({ name: 'dependencias_usuario', columns: [
      { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'asistente_id', type: 'int', unsigned: true }, { name: 'coordinador_id', type: 'int', unsigned: true },
      { name: 'creado_por_usuario_id', type: 'int', unsigned: true }, { name: 'activo', type: 'boolean', default: true },
      { name: 'desactivado_en', type: 'datetime', isNullable: true }, { name: 'motivo_desactivacion', type: 'varchar', length: '255', isNullable: true },
      { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' }, { name: 'updated_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
    ], uniques: [{ name: 'UQ_dependencia_asistente', columnNames: ['asistente_id'] }], foreignKeys: [
      { name: 'FK_dependencia_asistente', columnNames: ['asistente_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      { name: 'FK_dependencia_coordinador', columnNames: ['coordinador_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      { name: 'FK_dependencia_creador', columnNames: ['creado_por_usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
    ] }),
    new Table({ name: 'permisos_carrera', columns: [
      { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'usuario_id', type: 'int', unsigned: true }, { name: 'carrera_id', type: 'int', unsigned: true },
      { name: 'permiso', type: 'varchar', length: '80' }, { name: 'activo', type: 'boolean', default: true },
      { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' }, { name: 'updated_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
    ], uniques: [{ name: 'UQ_permiso_carrera', columnNames: ['usuario_id', 'carrera_id', 'permiso'] }],
    foreignKeys: [
      { name: 'FK_permiso_carrera_usuario', columnNames: ['usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      { name: 'FK_permiso_carrera_carrera', columnNames: ['carrera_id'], referencedTableName: 'carreras', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
    ] }),
    new Table({ name: 'auditoria_jerarquia', columns: [
      { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'actor_usuario_id', type: 'int', unsigned: true }, { name: 'objetivo_usuario_id', type: 'int', unsigned: true },
      { name: 'accion', type: 'varchar', length: '60' }, { name: 'detalle', type: 'json' },
      { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
    ], indices: [{ name: 'IDX_auditoria_jerarquia_objetivo', columnNames: ['objetivo_usuario_id', 'created_at'] }], foreignKeys: [
      { name: 'FK_auditoria_actor', columnNames: ['actor_usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      { name: 'FK_auditoria_objetivo', columnNames: ['objetivo_usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
    ] }),
    new Table({ name: 'solicitudes_cambio', columns: [
      { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'solicitante_id', type: 'int', unsigned: true }, { name: 'coordinador_id', type: 'int', unsigned: true }, { name: 'carrera_id', type: 'int', unsigned: true },
      { name: 'modulo', type: 'varchar', length: '50' }, { name: 'operacion', type: 'varchar', length: '50' }, { name: 'objetivo_id', type: 'int', unsigned: true, isNullable: true },
      { name: 'datos_propuestos', type: 'json' }, { name: 'huella_original', type: 'char', length: '64', isNullable: true }, { name: 'estado', type: 'varchar', length: '16' },
      { name: 'resuelto_en', type: 'datetime', isNullable: true }, { name: 'resuelto_por_usuario_id', type: 'int', unsigned: true, isNullable: true },
      { name: 'motivo_rechazo', type: 'varchar', length: '500', isNullable: true }, { name: 'correlacion_id', type: 'char', length: '36', isUnique: true },
      { name: 'resultado_aplicado', type: 'json', isNullable: true }, { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
    ], indices: [
      { name: 'IDX_12811adaa586cfd56925a295d2', columnNames: ['correlacion_id'], isUnique: true },
      { name: 'IDX_solicitud_responsable_estado', columnNames: ['coordinador_id', 'estado'] }, { name: 'IDX_solicitud_solicitante', columnNames: ['solicitante_id'] },
    ], foreignKeys: [
      { name: 'FK_solicitud_solicitante', columnNames: ['solicitante_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      { name: 'FK_solicitud_coordinador', columnNames: ['coordinador_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      { name: 'FK_solicitud_carrera', columnNames: ['carrera_id'], referencedTableName: 'carreras', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      { name: 'FK_solicitud_resolutor', columnNames: ['resuelto_por_usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
    ] }),
  ];
}

/** Schema only. Never run against an institutional database without a verified backup. */
export class AddHierarchicalAccess2026101900000 implements MigrationInterface {
  name = 'AddHierarchicalAccess2026101900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const definitions = hierarchicalTables();
    const tables = await Promise.all(definitions.map((table) => queryRunner.getTable(table.name)));
    const existingCount = tables.filter(Boolean).length;
    if (existingCount > 0 && existingCount < tables.length) {
      throw new Error('El esquema jerárquico está parcialmente instalado; se requiere revisión manual.');
    }
    if (existingCount === tables.length) {
      for (const definition of definitions) await assertTableCompatible(queryRunner, definition);
      return;
    }    await queryRunner.createTable(new Table({
      name: 'dependencias_usuario',
      columns: [
        { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'asistente_id', type: 'int', unsigned: true },
        { name: 'coordinador_id', type: 'int', unsigned: true },
        { name: 'creado_por_usuario_id', type: 'int', unsigned: true },
        { name: 'activo', type: 'boolean', default: true },
        { name: 'desactivado_en', type: 'datetime', isNullable: true },
        { name: 'motivo_desactivacion', type: 'varchar', length: '255', isNullable: true },
        { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
        { name: 'updated_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
      ],
      foreignKeys: [
        { name: 'FK_dependencia_asistente', columnNames: ['asistente_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
        { name: 'FK_dependencia_coordinador', columnNames: ['coordinador_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
        { name: 'FK_dependencia_creador', columnNames: ['creado_por_usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      ],
      uniques: [{ name: 'UQ_dependencia_asistente', columnNames: ['asistente_id'] }],
    }));
    await queryRunner.createTable(new Table({
      name: 'permisos_carrera',
      columns: [
        { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'usuario_id', type: 'int', unsigned: true },
        { name: 'carrera_id', type: 'int', unsigned: true },
        { name: 'permiso', type: 'varchar', length: '80' },
        { name: 'activo', type: 'boolean', default: true },
        { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
        { name: 'updated_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
      ],
      uniques: [{ name: 'UQ_permiso_carrera', columnNames: ['usuario_id', 'carrera_id', 'permiso'] }],
      foreignKeys: [
        { name: 'FK_permiso_carrera_usuario', columnNames: ['usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
        { name: 'FK_permiso_carrera_carrera', columnNames: ['carrera_id'], referencedTableName: 'carreras', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      ],
    }));
    await queryRunner.createTable(new Table({
      name: 'auditoria_jerarquia',
      columns: [
        { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'actor_usuario_id', type: 'int', unsigned: true },
        { name: 'objetivo_usuario_id', type: 'int', unsigned: true },
        { name: 'accion', type: 'varchar', length: '60' },
        { name: 'detalle', type: 'json' },
        { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
      ],
      indices: [{ name: 'IDX_auditoria_jerarquia_objetivo', columnNames: ['objetivo_usuario_id', 'created_at'] }],
      foreignKeys: [
        { name: 'FK_auditoria_actor', columnNames: ['actor_usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
        { name: 'FK_auditoria_objetivo', columnNames: ['objetivo_usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      ],
    }));
    await queryRunner.createTable(new Table({
      name: 'solicitudes_cambio',
      columns: [
        { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'solicitante_id', type: 'int', unsigned: true },
        { name: 'coordinador_id', type: 'int', unsigned: true },
        { name: 'carrera_id', type: 'int', unsigned: true },
        { name: 'modulo', type: 'varchar', length: '50' },
        { name: 'operacion', type: 'varchar', length: '50' },
        { name: 'objetivo_id', type: 'int', unsigned: true, isNullable: true },
        { name: 'datos_propuestos', type: 'json' },
        { name: 'huella_original', type: 'char', length: '64', isNullable: true },
        { name: 'estado', type: 'varchar', length: '16' },
        { name: 'resuelto_en', type: 'datetime', isNullable: true },
        { name: 'resuelto_por_usuario_id', type: 'int', unsigned: true, isNullable: true },
        { name: 'motivo_rechazo', type: 'varchar', length: '500', isNullable: true },
        { name: 'correlacion_id', type: 'char', length: '36', isUnique: true },
        { name: 'resultado_aplicado', type: 'json', isNullable: true },
        { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
      ],
      indices: [
        { name: 'IDX_solicitud_responsable_estado', columnNames: ['coordinador_id', 'estado'] },
        { name: 'IDX_solicitud_solicitante', columnNames: ['solicitante_id'] },
      ],
      foreignKeys: [
        { name: 'FK_solicitud_solicitante', columnNames: ['solicitante_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
        { name: 'FK_solicitud_coordinador', columnNames: ['coordinador_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
        { name: 'FK_solicitud_carrera', columnNames: ['carrera_id'], referencedTableName: 'carreras', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
        { name: 'FK_solicitud_resolutor', columnNames: ['resuelto_por_usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
      ],
    }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tablas = ['solicitudes_cambio', 'auditoria_jerarquia', 'permisos_carrera', 'dependencias_usuario'];
    for (const nombre of tablas) {
      if (!(await queryRunner.hasTable(nombre))) continue;
      const [fila] = (await queryRunner.query(`SELECT COUNT(*) AS total FROM ${nombre}`)) as [{ total: number }];
      if (Number(fila.total) > 0) throw new Error(`No se elimina ${nombre} con datos historicos.`);
    }
    for (const nombre of tablas) {
      if (!(await queryRunner.hasTable(nombre))) continue;
      await queryRunner.dropTable(nombre);
    }
  }
}
