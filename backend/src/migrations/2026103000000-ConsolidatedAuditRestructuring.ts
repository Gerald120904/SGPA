import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class ConsolidatedAuditRestructuring2026103000000 implements MigrationInterface {
  name = 'ConsolidatedAuditRestructuring2026103000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tabla notificaciones
    if (!(await queryRunner.hasTable('notificaciones'))) {
      await queryRunner.createTable(
        new Table({
          name: 'notificaciones',
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
              name: 'usuario_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'carrera_id',
              type: 'int',
              unsigned: true,
              isNullable: true,
            },
            {
              name: 'titulo',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'mensaje',
              type: 'varchar',
              length: '1000',
              isNullable: false,
            },
            {
              name: 'tipo',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'enlace',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'metadatos',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'leido',
              type: 'tinyint',
              default: 0,
              isNullable: false,
            },
            {
              name: 'leido_at',
              type: 'datetime',
              isNullable: true,
            },
            {
              name: 'created_at',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
            },
          ],
          indices: [
            {
              name: 'IDX_notificaciones_usuario_leido',
              columnNames: ['usuario_id', 'leido'],
            },
            {
              name: 'IDX_notificaciones_carrera',
              columnNames: ['carrera_id'],
            },
          ],
          foreignKeys: [
            {
              name: 'FK_notificacion_usuario',
              columnNames: ['usuario_id'],
              referencedTableName: 'usuarios',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
              onUpdate: 'CASCADE',
            },
            {
              name: 'FK_notificacion_carrera',
              columnNames: ['carrera_id'],
              referencedTableName: 'carreras',
              referencedColumnNames: ['id'],
              onDelete: 'SET NULL',
              onUpdate: 'CASCADE',
            },
          ],
        }),
      );
    }

    // 2. Tabla equivalencias_plan
    if (!(await queryRunner.hasTable('equivalencias_plan'))) {
      await queryRunner.createTable(
        new Table({
          name: 'equivalencias_plan',
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
              name: 'carrera_origen_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'plan_origen_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'asignatura_origen_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'carrera_destino_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'plan_destino_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'asignatura_destino_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'justificacion',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'autorizado_por_usuario_id',
              type: 'int',
              unsigned: true,
              isNullable: true,
            },
            {
              name: 'activo',
              type: 'tinyint',
              default: 1,
              isNullable: false,
            },
            {
              name: 'created_at',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
            },
            {
              name: 'updated_at',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
              onUpdate: 'CURRENT_TIMESTAMP(6)',
            },
          ],
          indices: [
            {
              name: 'IDX_equivalencia_origen',
              columnNames: ['plan_origen_id', 'asignatura_origen_id'],
            },
            {
              name: 'IDX_equivalencia_destino',
              columnNames: ['plan_destino_id', 'asignatura_destino_id'],
            },
          ],
          foreignKeys: [
            {
              name: 'FK_eq_carrera_origen',
              columnNames: ['carrera_origen_id'],
              referencedTableName: 'carreras',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            },
            {
              name: 'FK_eq_plan_origen',
              columnNames: ['plan_origen_id'],
              referencedTableName: 'planes_estudio',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            },
            {
              name: 'FK_eq_asignatura_origen',
              columnNames: ['asignatura_origen_id'],
              referencedTableName: 'plan_asignaturas',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            },
            {
              name: 'FK_eq_carrera_destino',
              columnNames: ['carrera_destino_id'],
              referencedTableName: 'carreras',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            },
            {
              name: 'FK_eq_plan_destino',
              columnNames: ['plan_destino_id'],
              referencedTableName: 'planes_estudio',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            },
            {
              name: 'FK_eq_asignatura_destino',
              columnNames: ['asignatura_destino_id'],
              referencedTableName: 'plan_asignaturas',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
              onUpdate: 'CASCADE',
            },
            {
              name: 'FK_eq_autorizador',
              columnNames: ['autorizado_por_usuario_id'],
              referencedTableName: 'usuarios',
              referencedColumnNames: ['id'],
              onDelete: 'SET NULL',
              onUpdate: 'CASCADE',
            },
          ],
        }),
      );
    }

    // 3. Modificaciones a la tabla estudiantes
    if (await queryRunner.hasTable('estudiantes')) {
      const estudiantesTable = await queryRunner.getTable('estudiantes');
      if (estudiantesTable) {
        if (!estudiantesTable.findColumnByName('fecha_graduacion')) {
          await queryRunner.addColumn(
            'estudiantes',
            new TableColumn({
              name: 'fecha_graduacion',
              type: 'datetime',
              isNullable: true,
            }),
          );
        }

        if (!estudiantesTable.findColumnByName('graduado_por_usuario_id')) {
          await queryRunner.addColumn(
            'estudiantes',
            new TableColumn({
              name: 'graduado_por_usuario_id',
              type: 'int',
              unsigned: true,
              isNullable: true,
            }),
          );
          await queryRunner.createForeignKey(
            'estudiantes',
            new TableForeignKey({
              name: 'FK_estudiante_graduador',
              columnNames: ['graduado_por_usuario_id'],
              referencedTableName: 'usuarios',
              referencedColumnNames: ['id'],
              onDelete: 'SET NULL',
              onUpdate: 'CASCADE',
            }),
          );
        }

        if (!estudiantesTable.findColumnByName('observacion_graduacion')) {
          await queryRunner.addColumn(
            'estudiantes',
            new TableColumn({
              name: 'observacion_graduacion',
              type: 'varchar',
              length: '500',
              isNullable: true,
            }),
          );
        }

        // Eliminar restricción de unicidad global en cedula y correo_institucional si existen
        const indices = estudiantesTable.indices;
        for (const idx of indices) {
          if (idx.isUnique) {
            const cols = idx.columnNames;
            if (cols.length === 1 && (cols[0] === 'cedula' || cols[0] === 'correo_institucional')) {
              await queryRunner.dropIndex('estudiantes', idx);
            }
          }
        }

        const uniques = estudiantesTable.uniques || [];
        for (const uq of uniques) {
          const cols = uq.columnNames;
          if (cols.length === 1 && (cols[0] === 'cedula' || cols[0] === 'correo_institucional')) {
            await queryRunner.dropUniqueConstraint('estudiantes', uq);
          }
        }

        try {
          const statsRows = (await queryRunner.query(
            `SELECT INDEX_NAME as indexName
               FROM information_schema.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'estudiantes'
                AND NON_UNIQUE = 0
                AND COLUMN_NAME IN ('cedula', 'correo_institucional')
                AND INDEX_NAME <> 'UQ_estudiantes_carrera_cedula'`,
          )) as Array<{ indexName?: string; INDEXNAME?: string }>;
          if (Array.isArray(statsRows)) {
            const toDrop = [
              ...new Set(
                statsRows
                  .map((r) => r.indexName || r.INDEXNAME)
                  .filter((n): n is string => Boolean(n)),
              ),
            ];
            for (const name of toDrop) {
              await queryRunner.query(
                `ALTER TABLE \`estudiantes\` DROP INDEX \`${name}\``,
              );
            }
          }
        } catch {
          // En entornos mock o sin information_schema se ignora
        }

        // Asegurar índice compuesto único (carrera_id, cedula)
        const hasCompositeUnique = estudiantesTable.indices.some(
          (idx) =>
            idx.isUnique &&
            idx.columnNames.length === 2 &&
            idx.columnNames.includes('carrera_id') &&
            idx.columnNames.includes('cedula'),
        );
        if (!hasCompositeUnique) {
          await queryRunner.createIndex(
            'estudiantes',
            new TableIndex({
              name: 'UQ_estudiantes_carrera_cedula',
              columnNames: ['carrera_id', 'cedula'],
              isUnique: true,
            }),
          );
        }
      }
    }

    // 4. Modificaciones a la tabla solicitudes_cambio
    if (await queryRunner.hasTable('solicitudes_cambio')) {
      const solicitudesTable = await queryRunner.getTable('solicitudes_cambio');
      if (solicitudesTable) {
        const estadoCol = solicitudesTable.findColumnByName('estado');
        if (estadoCol && String(estadoCol.length) !== '32') {
          await queryRunner.changeColumn(
            'solicitudes_cambio',
            estadoCol,
            new TableColumn({
              name: 'estado',
              type: 'varchar',
              length: '32',
              isNullable: false,
            }),
          );
        }

        if (!solicitudesTable.findColumnByName('observaciones_devolucion')) {
          await queryRunner.addColumn(
            'solicitudes_cambio',
            new TableColumn({
              name: 'observaciones_devolucion',
              type: 'varchar',
              length: '500',
              isNullable: true,
            }),
          );
        }

        if (!solicitudesTable.findColumnByName('motivo_cancelacion')) {
          await queryRunner.addColumn(
            'solicitudes_cambio',
            new TableColumn({
              name: 'motivo_cancelacion',
              type: 'varchar',
              length: '500',
              isNullable: true,
            }),
          );
        }

        if (!solicitudesTable.findColumnByName('historial_versiones')) {
          await queryRunner.addColumn(
            'solicitudes_cambio',
            new TableColumn({
              name: 'historial_versiones',
              type: 'json',
              isNullable: true,
            }),
          );
        }
      }
    }

    // 5. Modificaciones a la tabla periodos_academicos
    if (await queryRunner.hasTable('periodos_academicos')) {
      const periodosTable = await queryRunner.getTable('periodos_academicos');
      if (periodosTable) {
        if (!periodosTable.findColumnByName('fecha_apertura_actualizacion_docente')) {
          await queryRunner.addColumn(
            'periodos_academicos',
            new TableColumn({
              name: 'fecha_apertura_actualizacion_docente',
              type: 'date',
              isNullable: true,
            }),
          );
        }

        if (!periodosTable.findColumnByName('fecha_limite_entrega_docente')) {
          await queryRunner.addColumn(
            'periodos_academicos',
            new TableColumn({
              name: 'fecha_limite_entrega_docente',
              type: 'date',
              isNullable: true,
            }),
          );
        }

        if (!periodosTable.findColumnByName('fecha_limite_revision_docente')) {
          await queryRunner.addColumn(
            'periodos_academicos',
            new TableColumn({
              name: 'fecha_limite_revision_docente',
              type: 'date',
              isNullable: true,
            }),
          );
        }
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'Esta migración no se revierte automáticamente sin un plan controlado de restauración; ' +
        'utilice un respaldo previo verificado para regresar el esquema.',
    );
  }
}
