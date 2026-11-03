import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddSolicitudesActivasEstudiantes2026110100000 implements MigrationInterface {
  name = 'AddSolicitudesActivasEstudiantes2026110100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('solicitudes_activas_estudiantes');
    if (!tableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'solicitudes_activas_estudiantes',
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
              name: 'carrera_id',
              type: 'int',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'clave_identidad',
              type: 'varchar',
              length: '120',
              isNullable: false,
            },
            {
              name: 'tipo',
              type: 'varchar',
              length: '20',
              isNullable: false,
            },
            {
              name: 'origen',
              type: 'varchar',
              length: '40',
              isNullable: false,
            },
            {
              name: 'referencia_id',
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
        'solicitudes_activas_estudiantes',
        new TableIndex({
          name: 'UQ_solicitudes_activas_carrera_identidad',
          columnNames: ['carrera_id', 'clave_identidad'],
          isUnique: true,
        }),
      );

      await queryRunner.createForeignKey(
        'solicitudes_activas_estudiantes',
        new TableForeignKey({
          name: 'FK_solicitudes_activas_carrera',
          columnNames: ['carrera_id'],
          referencedTableName: 'carreras',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('solicitudes_activas_estudiantes');
    if (tableExists) {
      await queryRunner.dropTable('solicitudes_activas_estudiantes', true);
    }
  }
}

