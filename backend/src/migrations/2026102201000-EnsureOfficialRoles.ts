import { MigrationInterface, QueryRunner } from 'typeorm';

const OFFICIAL_ROLES = [
  ['ADMIN_GLOBAL', 'Administrador global del sistema'],
  ['COORDINADOR', 'Coordinador académico'],
  ['PROFESOR', 'Profesor'],
  ['ASISTENTE_ESTUDIANTIL', 'Estudiante asistente'],
] as const;

const LEGACY_NAMES = new Map<string, string>([
  ['ADMINISTRADOR', 'ADMIN_GLOBAL'],
  ['COORDINADOR_ACADEMICO', 'COORDINADOR'],
  ['ESTUDIANTE', 'ASISTENTE_ESTUDIANTIL'],
]);

type RoleRow = { id: number; nombre: string; activo: number | boolean };

export class EnsureOfficialRoles2026102201000 implements MigrationInterface {
  name = 'EnsureOfficialRoles2026102201000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('roles'))) {
      throw new Error('Falta la tabla roles; no se puede inicializar el catálogo oficial.');
    }
    const roles = (await queryRunner.query(
      'SELECT id, nombre, activo FROM roles ORDER BY id FOR UPDATE',
    )) as RoleRow[];
    const byName = new Map(roles.map((role) => [role.nombre, role]));

    for (const [legacy, official] of LEGACY_NAMES) {
      if (byName.has(legacy) && byName.has(official)) {
        throw new Error(`Conflicto de roles: existen ${legacy} y ${official}. No se modificó ningún registro.`);
      }
    }
    for (const [legacy, official] of LEGACY_NAMES) {
      const role = byName.get(legacy);
      if (!role) continue;
      await queryRunner.query('UPDATE roles SET nombre = ? WHERE id = ?', [official, role.id]);
      byName.delete(legacy);
      byName.set(official, { ...role, nombre: official });
    }
    for (const [name, description] of OFFICIAL_ROLES) {
      if (byName.has(name)) continue;
      await queryRunner.query(
        'INSERT INTO roles (nombre, descripcion, activo) VALUES (?, ?, 1)',
        [name, description],
      );
    }
  }

  async down(): Promise<void> {
    throw new Error('El catálogo de roles no admite reversión destructiva.');
  }
}
