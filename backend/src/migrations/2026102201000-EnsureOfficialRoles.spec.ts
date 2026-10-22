import { QueryRunner } from 'typeorm';
import { EnsureOfficialRoles2026102201000 } from './2026102201000-EnsureOfficialRoles';

function runner(roles: Array<{ id: number; nombre: string; activo: number }>) {
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    if (sql.startsWith('SELECT id')) return roles;
    if (sql.startsWith('UPDATE roles')) {
      const [name, id] = params as [string, number];
      const role = roles.find((item) => item.id === id)!;
      role.nombre = name;
      return [];
    }
    if (sql.startsWith('INSERT INTO roles')) {
      const [nombre] = params as [string, string];
      roles.push({ id: roles.length + 1, nombre, activo: 1 });
      return [];
    }
    throw new Error(`SQL inesperado: ${sql}`);
  });
  return { hasTable: jest.fn().mockResolvedValue(true), query } as unknown as QueryRunner;
}

describe('EnsureOfficialRoles2026102201000', () => {
  it('agrega únicamente roles faltantes y no reactiva los existentes', async () => {
    const roles = [
      { id: 7, nombre: 'ADMIN_GLOBAL', activo: 0 },
      { id: 9, nombre: 'COORDINADOR', activo: 1 },
    ];
    const queryRunner = runner(roles);
    await new EnsureOfficialRoles2026102201000().up(queryRunner);
    expect(roles.find((role) => role.id === 7)?.activo).toBe(0);
    expect(roles.map((role) => role.nombre)).toEqual([
      'ADMIN_GLOBAL', 'COORDINADOR', 'PROFESOR', 'ASISTENTE_ESTUDIANTIL',
    ]);
  });

  it('conserva el id y estado al renombrar un rol legacy', async () => {
    const roles = [{ id: 12, nombre: 'ESTUDIANTE', activo: 0 }];
    await new EnsureOfficialRoles2026102201000().up(runner(roles));
    expect(roles.find((role) => role.nombre === 'ASISTENTE_ESTUDIANTIL')).toEqual(
      expect.objectContaining({ id: 12, activo: 0 }),
    );
  });

  it('detiene conflictos entre nombres legacy y oficiales', async () => {
    const roles = [
      { id: 1, nombre: 'ADMINISTRADOR', activo: 1 },
      { id: 2, nombre: 'ADMIN_GLOBAL', activo: 1 },
    ];
    await expect(new EnsureOfficialRoles2026102201000().up(runner(roles))).rejects.toThrow('Conflicto');
  });
});
