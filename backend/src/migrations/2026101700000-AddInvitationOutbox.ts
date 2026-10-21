import { MigrationInterface, QueryRunner, Table } from 'typeorm';

const NOMBRE = 'invitacion_outbox';

export class AddInvitationOutbox2026101700000 implements MigrationInterface {
  name = 'AddInvitationOutbox2026101700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [identidad] = (await queryRunner.query(
      'SELECT DATABASE() AS db',
    )) as [{ db: string }];
    if (identidad.db !== 'sgpa_test' && identidad.db !== 'sgpa') {
      throw new Error(
        'Migración de invitaciones bloqueada fuera de sgpa o sgpa_test.',
      );
    }
    if (await queryRunner.hasTable(NOMBRE)) {
      throw new Error('La tabla de invitaciones ya existe; revise su esquema.');
    }
    await queryRunner.createTable(
      new Table({
        name: NOMBRE,
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
            isUnique: true,
          },
          { name: 'token_hash', type: 'char', length: '64', isNullable: false },
          { name: 'enlace_cifrado', type: 'text', isNullable: true },
          { name: 'estado', type: 'varchar', length: '16', isNullable: false },
          {
            name: 'intentos',
            type: 'smallint',
            unsigned: true,
            isNullable: false,
            default: 0,
          },
          { name: 'lease_id', type: 'char', length: '36', isNullable: true },
          { name: 'bloqueado_hasta', type: 'datetime(3)', isNullable: true },
          { name: 'expira_en', type: 'datetime(3)', isNullable: false },
          { name: 'enviado_en', type: 'datetime(3)', isNullable: true },
          {
            name: 'created_at',
            type: 'datetime(3)',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP(3)',
          },
          {
            name: 'updated_at',
            type: 'datetime(3)',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP(3)',
            onUpdate: 'CURRENT_TIMESTAMP(3)',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_invitacion_outbox_usuario',
            columnNames: ['usuario_id'],
            referencedTableName: 'usuarios',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [identidad] = (await queryRunner.query(
      'SELECT DATABASE() AS db',
    )) as [{ db: string }];
    if (identidad.db !== 'sgpa_test' && identidad.db !== 'sgpa')
      throw new Error('Reversión bloqueada fuera de sgpa o sgpa_test.');
    if (!(await queryRunner.hasTable(NOMBRE))) return;
    const [conteo] = (await queryRunner.query(
      `SELECT COUNT(*) AS total FROM ${NOMBRE}`,
    )) as [{ total: number }];
    if (Number(conteo.total) !== 0) {
      throw new Error(
        'No se elimina un outbox con invitaciones; retire los registros de prueba explícitamente.',
      );
    }
    await queryRunner.dropTable(NOMBRE);
  }
}
