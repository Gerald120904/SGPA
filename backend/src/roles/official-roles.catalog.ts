import { QueryRunner } from 'typeorm';

export const OFFICIAL_ROLES = [
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

export async function ensureOfficialRoles(queryRunner: QueryRunner): Promise<string[]> {
  if (!(await queryRunner.hasTable('roles'))) {
    throw new Error('Falta la tabla roles; no se puede inicializar el catálogo oficial.');
  }
  const roles = (await queryRunner.query(
    'SELECT id, nombre, activo FROM roles ORDER BY id FOR UPDATE',
  )) as RoleRow[];
  const byName = new Map(roles.map((role) => [role.nombre, role]));
  const changes: string[] = [];

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
    changes.push(`${legacy} -> ${official}`);
  }
  for (const [name, description] of OFFICIAL_ROLES) {
    if (byName.has(name)) continue;
    await queryRunner.query(
      'INSERT INTO roles (nombre, descripcion, activo) VALUES (?, ?, 1)',
      [name, description],
    );
    changes.push(name);
  }
  return changes;
}
