import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAuthenticationVersion2026103001000 implements MigrationInterface {
  name = 'AddAuthenticationVersion2026103001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('usuarios', 'version_autenticacion'))) {
      await queryRunner.addColumn('usuarios', new TableColumn({
        name: 'version_autenticacion', type: 'int', unsigned: true, default: 0,
        isNullable: false,
      }));
    }
  }

  async down(): Promise<void> {
    throw new Error('La reversión requiere una revisión manual de las sesiones existentes.');
  }
}
