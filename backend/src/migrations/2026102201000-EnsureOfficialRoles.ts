import { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureOfficialRoles } from '../roles/official-roles.catalog';

export class EnsureOfficialRoles2026102201000 implements MigrationInterface {
  name = 'EnsureOfficialRoles2026102201000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await ensureOfficialRoles(queryRunner);
  }

  async down(): Promise<void> {
    throw new Error('El catálogo de roles no admite reversión destructiva.');
  }
}
