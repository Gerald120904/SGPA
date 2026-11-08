import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

const CUENTAS = 'google_cuentas_institucionales';
const LOGS = 'google_sync_logs';

export class AddGoogleCuentaInstitucional2026110705000 implements MigrationInterface {
  name = 'AddGoogleCuentaInstitucional2026110705000';

  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable(CUENTAS) || await runner.hasTable(LOGS)) {
      throw new Error('El esquema de cuenta institucional Google ya existe parcialmente; requiere revisión manual.');
    }

    await runner.createTable(
      new Table({
        name: CUENTAS,
        columns: [
          { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'google_email', type: 'varchar', length: '150', isNullable: true },
          { name: 'google_subject', type: 'varchar', length: '255', isNullable: true },
          { name: 'refresh_token_cifrado', type: 'text', isNullable: true },
          { name: 'scopes', type: 'json', isNullable: true },
          { name: 'activo', type: 'boolean', default: true },
          { name: 'conectado_at', type: 'datetime', isNullable: true },
          { name: 'revocado_at', type: 'datetime', isNullable: true },
          { name: 'autorizado_por_usuario_id', type: 'int', unsigned: true, isNullable: true },
          { name: 'ultimo_error', type: 'varchar', length: '500', isNullable: true },
          { name: 'ultimo_sync_at', type: 'datetime', isNullable: true },
          { name: 'sync_exitosos', type: 'int', unsigned: true, default: 0 },
          { name: 'sync_fallidos', type: 'int', unsigned: true, default: 0 },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await runner.createForeignKey(
      CUENTAS,
      new TableForeignKey({
        name: 'FK_google_cuentas_autorizado_por',
        columnNames: ['autorizado_por_usuario_id'],
        referencedTableName: 'usuarios',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await runner.createTable(
      new Table({
        name: LOGS,
        columns: [
          { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'tipo', type: 'varchar', length: '20' },
          { name: 'resultado', type: 'varchar', length: '20' },
          { name: 'formularios_procesados', type: 'int', unsigned: true, default: 0 },
          { name: 'respuestas_nuevas', type: 'int', unsigned: true, default: 0 },
          { name: 'detalle_error', type: 'text', isNullable: true },
          { name: 'ejecutado_por_usuario_id', type: 'int', unsigned: true, isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await runner.createIndex(
      LOGS,
      new TableIndex({
        name: 'IDX_google_sync_logs_tipo_resultado',
        columnNames: ['tipo', 'resultado'],
      }),
    );

    await runner.createForeignKey(
      LOGS,
      new TableForeignKey({
        name: 'FK_google_sync_logs_ejecutado_por',
        columnNames: ['ejecutado_por_usuario_id'],
        referencedTableName: 'usuarios',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    for (const table of [LOGS, CUENTAS]) {
      if (!(await runner.hasTable(table))) continue;
      await runner.dropTable(table, true);
    }
  }
}

