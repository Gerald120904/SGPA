import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddOptativaRealHistorialEstudiante2026110400000 implements MigrationInterface {
  name = 'AddOptativaRealHistorialEstudiante2026110400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'historial_academico_estudiantes';
    const columns: TableColumn[] = [
      new TableColumn({ name: 'curso_optativo_id', type: 'int', unsigned: true, isNullable: true }),
      new TableColumn({ name: 'plan_estudio_contexto_id', type: 'int', unsigned: true, isNullable: true }),
      new TableColumn({ name: 'codigo_optativa_real', type: 'varchar', length: '30', isNullable: true }),
      new TableColumn({ name: 'nombre_optativa_real', type: 'varchar', length: '150', isNullable: true }),
      new TableColumn({ name: 'tipo_optativa_real', type: 'varchar', length: '30', isNullable: true }),
      new TableColumn({ name: 'creditos_optativa_real', type: 'smallint', unsigned: true, isNullable: true }),
      new TableColumn({ name: 'reconocimiento_optativo', type: 'varchar', length: '20', isNullable: true }),
      new TableColumn({ name: 'creditos_reconocidos', type: 'smallint', unsigned: true, isNullable: true }),
      new TableColumn({ name: 'reconocido_por_usuario_id', type: 'int', unsigned: true, isNullable: true }),
      new TableColumn({ name: 'fecha_reconocimiento', type: 'datetime', isNullable: true }),
    ];
    for (const column of columns) {
      if (!(await queryRunner.hasColumn(table, column.name))) await queryRunner.addColumn(table, column);
    }
    const current = await queryRunner.getTable(table);
    if (!current?.indices.some((i) => i.name === 'IDX_historial_optativa_real')) {
      await queryRunner.createIndex(table, new TableIndex({
        name: 'IDX_historial_optativa_real', columnNames: ['estudiante_id', 'plan_estudio_contexto_id', 'curso_optativo_id'],
      }));
    }
    const foreignKeys = [
      new TableForeignKey({ name: 'FK_historial_optativa_real', columnNames: ['curso_optativo_id'], referencedTableName: 'curso_optativas', referencedColumnNames: ['id'], onDelete: 'RESTRICT', onUpdate: 'CASCADE' }),
      new TableForeignKey({ name: 'FK_historial_plan_contexto', columnNames: ['plan_estudio_contexto_id'], referencedTableName: 'planes_estudio', referencedColumnNames: ['id'], onDelete: 'RESTRICT', onUpdate: 'CASCADE' }),
      new TableForeignKey({ name: 'FK_historial_optativa_reconocido_por', columnNames: ['reconocido_por_usuario_id'], referencedTableName: 'usuarios', referencedColumnNames: ['id'], onDelete: 'RESTRICT', onUpdate: 'CASCADE' }),
    ];
    for (const fk of foreignKeys) {
      const actual = await queryRunner.getTable(table);
      if (!actual?.foreignKeys.some((item) => item.name === fk.name)) await queryRunner.createForeignKey(table, fk);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'historial_academico_estudiantes';
    const actual = await queryRunner.getTable(table);
    if (!actual) return;
    for (const name of ['FK_historial_optativa_real', 'FK_historial_plan_contexto', 'FK_historial_optativa_reconocido_por']) {
      if (actual.foreignKeys.some((fk) => fk.name === name)) await queryRunner.dropForeignKey(table, name);
    }
    if (actual.indices.some((index) => index.name === 'IDX_historial_optativa_real')) await queryRunner.dropIndex(table, 'IDX_historial_optativa_real');
    for (const name of ['fecha_reconocimiento', 'reconocido_por_usuario_id', 'creditos_reconocidos', 'reconocimiento_optativo', 'creditos_optativa_real', 'tipo_optativa_real', 'nombre_optativa_real', 'codigo_optativa_real', 'plan_estudio_contexto_id', 'curso_optativo_id']) {
      if (await queryRunner.hasColumn(table, name)) await queryRunner.dropColumn(table, name);
    }
  }
}
