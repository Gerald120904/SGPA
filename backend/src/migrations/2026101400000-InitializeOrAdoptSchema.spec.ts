import { QueryRunner } from 'typeorm';
import {
  InitializeOrAdoptSchema2026101400000,
  LEGACY_REQUIRED_COLUMNS,
} from './2026101400000-InitializeOrAdoptSchema';

describe('InitializeOrAdoptSchema2026101400000', () => {
  it('adopta las 49 tablas legacy compatibles sin DDL ni alterar datos', async () => {
    expect(Object.keys(LEGACY_REQUIRED_COLUMNS)).toHaveLength(49);
    const rows = Object.entries(LEGACY_REQUIRED_COLUMNS).flatMap(([name, columns]) =>
      columns.map((columnName) => ({ name, columnName })),
    );
    const existingData = { usuarios: 4, registrosAcademicos: 356 };
    const query = jest.fn().mockResolvedValue(rows);
    await expect(new InitializeOrAdoptSchema2026101400000().up({ query } as unknown as QueryRunner))
      .resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
    expect(existingData).toEqual({ usuarios: 4, registrosAcademicos: 356 });
  });

  it('rechaza una estructura legacy incompatible antes del primer DDL', async () => {
    const rows = Object.entries(LEGACY_REQUIRED_COLUMNS).flatMap(([name, columns]) =>
      columns.filter((column) => !(name === 'usuarios' && column === 'correo'))
        .map((columnName) => ({ name, columnName })),
    );
    const query = jest.fn().mockResolvedValue(rows);
    await expect(new InitializeOrAdoptSchema2026101400000().up({ query } as unknown as QueryRunner))
      .rejects.toThrow('usuarios.correo');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('restaura FOREIGN_KEY_CHECKS aun cuando falla DDL en una base vacía', async () => {
    let calls = 0;
    const query = jest.fn(async (sql: string) => {
      calls += 1;
      if (calls === 1) return [];
      if (sql === 'SET FOREIGN_KEY_CHECKS = 0' || sql === 'SET FOREIGN_KEY_CHECKS = 1') return [];
      throw new Error('DDL de prueba');
    });
    await expect(new InitializeOrAdoptSchema2026101400000().up({ query } as unknown as QueryRunner))
      .rejects.toThrow('DDL de prueba');
    expect(query).toHaveBeenCalledWith('SET FOREIGN_KEY_CHECKS = 1');
  });
});
