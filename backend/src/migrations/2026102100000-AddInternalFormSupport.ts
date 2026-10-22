import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

const TABLA = 'formularios_estudiantes';
const COLUMNA_PROVEEDOR = 'proveedor';
const COLUMNA_TOKEN = 'token_publico';
const INDICE_TOKEN = 'UQ_formularios_token_publico';

export class AddInternalFormSupport2026102100000 implements MigrationInterface {
  name = 'AddInternalFormSupport2026102100000';

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
        'Migración de formularios internos bloqueada fuera de sgpa o sgpa_test.',
      );
    }

    const table = await queryRunner.getTable(TABLA);
    if (!table) {
      throw new Error(`No existe la tabla requerida ${TABLA}.`);
    }

    const tieneColumnaProveedor = table.columns.some(
      (c) => c.name === COLUMNA_PROVEEDOR,
    );

    if (!tieneColumnaProveedor) {
      await queryRunner.addColumn(
        TABLA,
        new TableColumn({
          name: COLUMNA_PROVEEDOR,
          type: 'varchar',
          length: '20',
          isNullable: false,
          default: "'GOOGLE_FORMS'",
        }),
      );

      // Backfill explícito e idempotente para registros históricos
      await queryRunner.query(
        `UPDATE ${TABLA} SET ${COLUMNA_PROVEEDOR} = 'GOOGLE_FORMS' WHERE ${COLUMNA_PROVEEDOR} IS NULL OR ${COLUMNA_PROVEEDOR} = ''`,
      );
    }

    const tieneColumnaToken = table.columns.some(
      (c) => c.name === COLUMNA_TOKEN,
    );

    if (!tieneColumnaToken) {
      await queryRunner.addColumn(
        TABLA,
        new TableColumn({
          name: COLUMNA_TOKEN,
          type: 'varchar',
          length: '64',
          isNullable: true,
        }),
      );
    }

    const tieneIndiceToken = table.indices.some(
      (idx) => idx.name === INDICE_TOKEN,
    );

    if (!tieneIndiceToken) {
      await queryRunner.createIndex(
        TABLA,
        new TableIndex({
          name: INDICE_TOKEN,
          columnNames: [COLUMNA_TOKEN],
          isUnique: true,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [identidad] = (await queryRunner.query(
      'SELECT DATABASE() AS db',
    )) as [{ db: string }];

    if (
      identidad.db !== 'sgpa_test' &&
      identidad.db !== 'sgpa' &&
      !identidad.db.startsWith('sgpa_')
    ) {
      throw new Error('Reversión bloqueada fuera de sgpa o sgpa_test.');
    }

    const table = await queryRunner.getTable(TABLA);
    if (!table) return;

    // Protección de datos: impedir reversión si existen formularios INTERNO
    const tieneColumnaProveedor = table.columns.some(
      (c) => c.name === COLUMNA_PROVEEDOR,
    );

    if (tieneColumnaProveedor) {
      const [conteoInternos] = (await queryRunner.query(
        `SELECT COUNT(*) AS total FROM ${TABLA} WHERE ${COLUMNA_PROVEEDOR} = 'INTERNO'`,
      )) as [{ total: number }];

      if (Number(conteoInternos.total) > 0) {
        throw new Error(
          'No se puede revertir la migración: existen formularios de proveedor INTERNO registrados. ' +
            'Elimínelos o archívelos explícitamente antes de revertir.',
        );
      }
    }

    const tieneIndiceToken = table.indices.some(
      (idx) => idx.name === INDICE_TOKEN,
    );
    if (tieneIndiceToken) {
      await queryRunner.dropIndex(TABLA, INDICE_TOKEN);
    }

    const tieneColumnaToken = table.columns.some(
      (c) => c.name === COLUMNA_TOKEN,
    );
    if (tieneColumnaToken) {
      await queryRunner.dropColumn(TABLA, COLUMNA_TOKEN);
    }

    if (tieneColumnaProveedor) {
      await queryRunner.dropColumn(TABLA, COLUMNA_PROVEEDOR);
    }
  }
}
