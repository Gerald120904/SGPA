import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

/** Adds an auditable parent/version link without changing existing plans or curricula. */
export class VersionadoPlanesEstudio2026110703000 implements MigrationInterface {
  name = 'VersionadoPlanesEstudio2026110703000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('planes_estudio');
    if (!table) return;
    if (!table.findColumnByName('version_anterior_id')) {
      await queryRunner.addColumn('planes_estudio', new TableColumn({
        name: 'version_anterior_id', type: 'int', unsigned: true, isNullable: true,
      }));
    }
    if (!table.findColumnByName('numero_version')) {
      await queryRunner.addColumn('planes_estudio', new TableColumn({
        name: 'numero_version', type: 'int', unsigned: true, default: '1', isNullable: false,
      }));
    }
    const refreshed = await queryRunner.getTable('planes_estudio');
    if (refreshed && !refreshed.indices.some((index) => index.name === 'UQ_planes_estudio_version')) {
      await queryRunner.createIndex('planes_estudio', new TableIndex({
        name: 'UQ_planes_estudio_version', columnNames: ['version_anterior_id', 'numero_version'], isUnique: true,
      }));
    }
    if (refreshed && !refreshed.foreignKeys.some((key) => key.name === 'FK_planes_estudio_version_anterior')) {
      await queryRunner.createForeignKey('planes_estudio', new TableForeignKey({
        name: 'FK_planes_estudio_version_anterior', columnNames: ['version_anterior_id'],
        referencedTableName: 'planes_estudio', referencedColumnNames: ['id'], onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('planes_estudio');
    if (!table) return;
    const [versions] = await queryRunner.query('SELECT COUNT(*) AS total FROM `planes_estudio` WHERE `version_anterior_id` IS NOT NULL');
    if (Number(versions?.total || 0) > 0) {
      throw new Error('No se revierte el versionado mientras existan versiones vinculadas; preserve su historial.');
    }
    const fk = table.foreignKeys.find((key) => key.name === 'FK_planes_estudio_version_anterior');
    if (fk) await queryRunner.dropForeignKey('planes_estudio', fk);
    const index = table.indices.find((item) => item.name === 'UQ_planes_estudio_version');
    if (index) await queryRunner.dropIndex('planes_estudio', index);
    if (table.findColumnByName('version_anterior_id')) await queryRunner.dropColumn('planes_estudio', 'version_anterior_id');
    if (table.findColumnByName('numero_version')) await queryRunner.dropColumn('planes_estudio', 'numero_version');
  }
}
