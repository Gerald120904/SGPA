import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddEstudiantesRevisionYAuditoria2026103100000 implements MigrationInterface {
  name = 'AddEstudiantesRevisionYAuditoria2026103100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [identidad] = (await queryRunner.query(
      'SELECT DATABASE() AS db',
    )) as [{ db: string }];

    if (
      identidad.db !== 'sgpa_test' &&
      identidad.db !== 'sgpa' &&
      !identidad.db.startsWith('sgpa_')
    ) {
      throw new Error(
        'Migración de revisión y auditoría bloqueada fuera de sgpa o sgpa_test.',
      );
    }

    // 1. Tabla auditoria_historial_academico
    const tieneTablaAuditoria = await queryRunner.hasTable('auditoria_historial_academico');
    if (!tieneTablaAuditoria) {
      await queryRunner.createTable(
        new Table({
          name: 'auditoria_historial_academico',
          columns: [
            {
              name: 'id',
              type: 'int',
              unsigned: true,
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'estudiante_id',
              type: 'int',
              unsigned: true,
            },
            {
              name: 'historial_academico_id',
              type: 'int',
              unsigned: true,
            },
            {
              name: 'carrera_id',
              type: 'int',
              unsigned: true,
            },
            {
              name: 'plan_asignatura_id',
              type: 'int',
              unsigned: true,
            },
            {
              name: 'resultado_anterior',
              type: 'varchar',
              length: '20',
            },
            {
              name: 'resultado_nuevo',
              type: 'varchar',
              length: '20',
            },
            {
              name: 'origen_academico_anterior',
              type: 'varchar',
              length: '30',
            },
            {
              name: 'origen_academico_nuevo',
              type: 'varchar',
              length: '30',
            },
            {
              name: 'observaciones_anteriores',
              type: 'varchar',
              length: '1000',
              isNullable: true,
            },
            {
              name: 'observaciones_nuevas',
              type: 'varchar',
              length: '1000',
              isNullable: true,
            },
            {
              name: 'motivo',
              type: 'varchar',
              length: '500',
            },
            {
              name: 'usuario_responsable_id',
              type: 'int',
              unsigned: true,
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_auditoria_historial_estudiante',
              columnNames: ['estudiante_id'],
            }),
            new TableIndex({
              name: 'IDX_auditoria_historial_registro',
              columnNames: ['historial_academico_id'],
            }),
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_auditoria_historial_estudiante',
              columnNames: ['estudiante_id'],
              referencedTableName: 'estudiantes',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            }),
            new TableForeignKey({
              name: 'FK_auditoria_historial_usuario',
              columnNames: ['usuario_responsable_id'],
              referencedTableName: 'usuarios',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            }),
            new TableForeignKey({
              name: 'FK_auditoria_historial_plan_asignatura',
              columnNames: ['plan_asignatura_id'],
              referencedTableName: 'plan_asignaturas',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            }),
          ],
        }),
        true,
      );
    }

    // 2. Tabla lotes_importacion_estudiantes
    const tieneTablaLotes = await queryRunner.hasTable('lotes_importacion_estudiantes');
    if (!tieneTablaLotes) {
      await queryRunner.createTable(
        new Table({
          name: 'lotes_importacion_estudiantes',
          columns: [
            {
              name: 'id',
              type: 'int',
              unsigned: true,
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'carrera_id',
              type: 'int',
              unsigned: true,
            },
            {
              name: 'plan_estudio_id',
              type: 'int',
              unsigned: true,
            },
            {
              name: 'fuente',
              type: 'varchar',
              length: '30',
              default: "'EXCEL'",
            },
            {
              name: 'nombre_archivo',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'total_filas',
              type: 'int',
              default: 0,
            },
            {
              name: 'total_validas',
              type: 'int',
              default: 0,
            },
            {
              name: 'total_errores',
              type: 'int',
              default: 0,
            },
            {
              name: 'estado',
              type: 'varchar',
              length: '30',
              default: "'PENDIENTE'",
            },
            {
              name: 'creado_por_usuario_id',
              type: 'int',
              unsigned: true,
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'updated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_lote_carrera_plan',
              columnNames: ['carrera_id', 'plan_estudio_id'],
            }),
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_lote_carrera',
              columnNames: ['carrera_id'],
              referencedTableName: 'carreras',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            }),
            new TableForeignKey({
              name: 'FK_lote_plan',
              columnNames: ['plan_estudio_id'],
              referencedTableName: 'planes_estudio',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            }),
            new TableForeignKey({
              name: 'FK_lote_usuario',
              columnNames: ['creado_por_usuario_id'],
              referencedTableName: 'usuarios',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            }),
          ],
        }),
        true,
      );
    }

    // 3. Tabla registros_importacion_estudiantes
    const tieneTablaRegistros = await queryRunner.hasTable('registros_importacion_estudiantes');
    if (!tieneTablaRegistros) {
      await queryRunner.createTable(
        new Table({
          name: 'registros_importacion_estudiantes',
          columns: [
            {
              name: 'id',
              type: 'int',
              unsigned: true,
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'lote_id',
              type: 'int',
              unsigned: true,
            },
            {
              name: 'carrera_id',
              type: 'int',
              unsigned: true,
            },
            {
              name: 'plan_estudio_id',
              type: 'int',
              unsigned: true,
            },
            {
              name: 'fila',
              type: 'int',
            },
            {
              name: 'cedula',
              type: 'varchar',
              length: '30',
            },
            {
              name: 'accion',
              type: 'varchar',
              length: '20',
            },
            {
              name: 'datos_json',
              type: 'json',
            },
            {
              name: 'datos_existentes_json',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'cambios_detectados_json',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'aprobaciones_nuevas_json',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'errores_json',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'estado',
              type: 'varchar',
              length: '35',
              default: "'PENDIENTE'",
            },
            {
              name: 'motivo_rechazo',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'revisado_por_usuario_id',
              type: 'int',
              unsigned: true,
              isNullable: true,
            },
            {
              name: 'revisado_en',
              type: 'datetime',
              isNullable: true,
            },
            {
              name: 'estudiante_id_aplicado',
              type: 'int',
              unsigned: true,
              isNullable: true,
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'updated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_reg_importacion_lote',
              columnNames: ['lote_id'],
            }),
            new TableIndex({
              name: 'IDX_reg_importacion_estado',
              columnNames: ['estado'],
            }),
            new TableIndex({
              name: 'IDX_reg_importacion_carrera',
              columnNames: ['carrera_id'],
            }),
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_reg_lote',
              columnNames: ['lote_id'],
              referencedTableName: 'lotes_importacion_estudiantes',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
              onUpdate: 'CASCADE',
            }),
            new TableForeignKey({
              name: 'FK_reg_carrera',
              columnNames: ['carrera_id'],
              referencedTableName: 'carreras',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            }),
            new TableForeignKey({
              name: 'FK_reg_plan',
              columnNames: ['plan_estudio_id'],
              referencedTableName: 'planes_estudio',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            }),
            new TableForeignKey({
              name: 'FK_reg_usuario_revisor',
              columnNames: ['revisado_por_usuario_id'],
              referencedTableName: 'usuarios',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            }),
          ],
        }),
        true,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('registros_importacion_estudiantes')) {
      await queryRunner.dropTable('registros_importacion_estudiantes', true, true, true);
    }
    if (await queryRunner.hasTable('lotes_importacion_estudiantes')) {
      await queryRunner.dropTable('lotes_importacion_estudiantes', true, true, true);
    }
    if (await queryRunner.hasTable('auditoria_historial_academico')) {
      await queryRunner.dropTable('auditoria_historial_academico', true, true, true);
    }
  }
}
