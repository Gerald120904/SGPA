import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddPlanesEstudioTransicionesYAuditoria2026110101000
  implements MigrationInterface
{
  name = 'AddPlanesEstudioTransicionesYAuditoria2026110101000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Table: auditoria_planes_estudio
    const auditoriaExists = await queryRunner.hasTable('auditoria_planes_estudio');
    if (!auditoriaExists) {
      await queryRunner.createTable(
        new Table({
          name: 'auditoria_planes_estudio',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
              unsigned: true,
            },
            {
              name: 'plan_estudio_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'tipo_modificacion',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'valor_anterior',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'valor_nuevo',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'motivo',
              type: 'varchar',
              length: '500',
              isNullable: false,
            },
            {
              name: 'usuario_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'metadata_json',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
          ],
        }),
        true,
      );

      await queryRunner.createIndices('auditoria_planes_estudio', [
        new TableIndex({
          name: 'IDX_auditoria_planes_estudio_plan_id',
          columnNames: ['plan_estudio_id'],
        }),
        new TableIndex({
          name: 'IDX_auditoria_planes_estudio_tipo',
          columnNames: ['tipo_modificacion'],
        }),
      ]);

      await queryRunner.createForeignKey(
        'auditoria_planes_estudio',
        new TableForeignKey({
          name: 'FK_auditoria_planes_estudio_plan',
          columnNames: ['plan_estudio_id'],
          referencedTableName: 'planes_estudio',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        }),
      );
      await queryRunner.createForeignKey(
        'auditoria_planes_estudio',
        new TableForeignKey({
          name: 'FK_auditoria_planes_estudio_usuario',
          columnNames: ['usuario_id'],
          referencedTableName: 'usuarios',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        }),
      );
    }

    // 2. Table: historial_nombres_asignaturas
    const historialExists = await queryRunner.hasTable('historial_nombres_asignaturas');
    if (!historialExists) {
      await queryRunner.createTable(
        new Table({
          name: 'historial_nombres_asignaturas',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
              unsigned: true,
            },
            {
              name: 'plan_asignatura_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'nombre_anterior',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'nombre_nuevo',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'motivo',
              type: 'varchar',
              length: '500',
              isNullable: false,
            },
            {
              name: 'usuario_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'historial_nombres_asignaturas',
        new TableIndex({
          name: 'IDX_historial_nombres_plan_asignatura_id',
          columnNames: ['plan_asignatura_id'],
        }),
      );

      await queryRunner.createForeignKey(
        'historial_nombres_asignaturas',
        new TableForeignKey({
          name: 'FK_historial_nombres_plan_asignatura',
          columnNames: ['plan_asignatura_id'],
          referencedTableName: 'plan_asignaturas',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        }),
      );
      await queryRunner.createForeignKey(
        'historial_nombres_asignaturas',
        new TableForeignKey({
          name: 'FK_historial_nombres_usuario',
          columnNames: ['usuario_id'],
          referencedTableName: 'usuarios',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        }),
      );
    }

    // 3. Optional columns in planes_estudio
        const planesTable = await queryRunner.getTable('planes_estudio');
    if (planesTable) {
      if (!planesTable.findColumnByName('motivo_ultimo_cambio')) {
        await queryRunner.addColumn(
          'planes_estudio',
          new TableColumn({
            name: 'motivo_ultimo_cambio',
            type: 'text',
            isNullable: true,
          }),
        );
      }
      if (!planesTable.findColumnByName('estado')) {
        await queryRunner.addColumn(
          'planes_estudio',
          new TableColumn({
            name: 'estado',
            type: 'varchar',
            length: '20',
            default: "'VIGENTE'",
            isNullable: false,
          }),
        );

        // Migración de datos compatible: los planes existentes inactivos se inicializan como 'CERRADO'
        // para preservar su estado histórico y no convertirlos erróneamente en 'VIGENTE'.
        await queryRunner.query(
          "UPDATE `planes_estudio` SET `estado` = 'CERRADO', `motivo_ultimo_cambio` = 'Plan inactivo archivado' WHERE `activo` = 0 OR `activo` = false",
        );
      }
    }

    // 4. Table: titulos_estudiantes (Preservación persistente oficial de titulaciones independientes)
    const titulosExists = await queryRunner.hasTable('titulos_estudiantes');
    if (!titulosExists) {
      await queryRunner.createTable(
        new Table({
          name: 'titulos_estudiantes',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
              unsigned: true,
            },
            {
              name: 'estudiante_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'plan_estudio_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'carrera_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'salida_academica_id',
              type: 'int',
              unsigned: true,
              isNullable: true,
            },
            {
              name: 'grado',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'nombre_titulo',
              type: 'varchar',
              length: '200',
              isNullable: false,
            },
            {
              name: 'fecha_graduacion',
              type: 'datetime',
              isNullable: false,
            },
            {
              name: 'graduado_por_usuario_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'observaciones',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
          ],
        }),
        true,
      );

            await queryRunner.createIndices('titulos_estudiantes', [
        new TableIndex({
          name: 'IDX_titulos_estudiantes_estudiante',
          columnNames: ['estudiante_id'],
        }),
        new TableIndex({
          name: 'IDX_titulos_estudiantes_plan',
          columnNames: ['plan_estudio_id'],
        }),
      ]);

      // Índice único funcional que distingue salidas académicas intermedias y el título principal
      await queryRunner.query(
        'CREATE UNIQUE INDEX `UQ_titulos_estudiante_plan_grado_salida` ON `titulos_estudiantes` (`estudiante_id`, `plan_estudio_id`, `grado`, (COALESCE(`salida_academica_id`, 0)))',
      );

      await queryRunner.createForeignKeys('titulos_estudiantes', [
        new TableForeignKey({
          name: 'FK_titulos_estudiantes_estudiante',
          columnNames: ['estudiante_id'],
          referencedTableName: 'estudiantes',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        }),
        new TableForeignKey({
          name: 'FK_titulos_estudiantes_plan',
          columnNames: ['plan_estudio_id'],
          referencedTableName: 'planes_estudio',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        }),
        new TableForeignKey({
          name: 'FK_titulos_estudiantes_carrera',
          columnNames: ['carrera_id'],
          referencedTableName: 'carreras',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        }),
        new TableForeignKey({
          name: 'FK_titulos_estudiantes_salida',
          columnNames: ['salida_academica_id'],
          referencedTableName: 'salidas_academicas',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        }),
                new TableForeignKey({
          name: 'FK_titulos_estudiantes_usuario',
          columnNames: ['graduado_por_usuario_id'],
          referencedTableName: 'usuarios',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        }),
      ]);

      // 5. Migración idempotente de graduaciones oficiales existentes en estudiantes
      await queryRunner.query(`
        INSERT INTO \`titulos_estudiantes\`
          (\`estudiante_id\`, \`plan_estudio_id\`, \`carrera_id\`, \`salida_academica_id\`, \`grado\`, \`nombre_titulo\`, \`fecha_graduacion\`, \`graduado_por_usuario_id\`, \`observaciones\`, \`created_at\`)
        SELECT
          e.\`id\`,
          e.\`plan_estudio_id\`,
          e.\`carrera_id\`,
          NULL,
          COALESCE(p.\`grado\`, 'BACHILLERATO'),
          COALESCE(p.\`nombre\`, 'Título Oficial'),
          e.\`fecha_graduacion\`,
          e.\`graduado_por_usuario_id\`,
          e.\`observacion_graduacion\`,
          e.\`fecha_graduacion\`
        FROM \`estudiantes\` e
        INNER JOIN \`planes_estudio\` p ON p.\`id\` = e.\`plan_estudio_id\`
        WHERE e.\`fecha_graduacion\` IS NOT NULL
          AND e.\`graduado_por_usuario_id\` IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM \`titulos_estudiantes\` t
            WHERE t.\`estudiante_id\` = e.\`id\`
              AND t.\`plan_estudio_id\` = e.\`plan_estudio_id\`
              AND t.\`grado\` = COALESCE(p.\`grado\`, 'BACHILLERATO')
              AND t.\`salida_academica_id\` IS NULL
          )
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const titulosExists = await queryRunner.hasTable('titulos_estudiantes');
    if (titulosExists) {
      await queryRunner.dropTable('titulos_estudiantes', true);
    }

    const planesTable = await queryRunner.getTable('planes_estudio');
    if (planesTable) {
      if (planesTable.findColumnByName('motivo_ultimo_cambio')) {
        await queryRunner.dropColumn('planes_estudio', 'motivo_ultimo_cambio');
      }
      if (planesTable.findColumnByName('estado')) {
        await queryRunner.dropColumn('planes_estudio', 'estado');
      }
    }

    const historialExists = await queryRunner.hasTable('historial_nombres_asignaturas');
    if (historialExists) {
      await queryRunner.dropTable('historial_nombres_asignaturas', true);
    }

    const auditoriaExists = await queryRunner.hasTable('auditoria_planes_estudio');
    if (auditoriaExists) {
      await queryRunner.dropTable('auditoria_planes_estudio', true);
    }
  }
}
