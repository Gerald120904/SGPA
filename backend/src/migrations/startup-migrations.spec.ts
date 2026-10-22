import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { executeSafeOfficialMigrations, validateMigrationHistory, verificarMigracionesAntesDeEscuchar } from './startup-migrations';

const MIGRATION = 'Change2026101500000';

function scenario(options: {
  authorized?: boolean;
  migrationTable?: boolean;
  baseTables?: number;
  applied?: string[];
  fail?: boolean;
  history?: Array<{ id: number; timestamp: string; name: string }>;
} = {}) {
  let migrationTable = options.migrationTable ?? true;
  const applied = new Set(options.applied ?? []);
  const environment: Record<string, string> = {
    SGPA_START_PROFILE: 'development', SGPA_RUNTIME_ENV: 'development', NODE_ENV: 'development',
    SGPA_AUTO_MIGRATE_DEV: options.authorized ? 'true' : 'false',
    SGPA_AUTO_MIGRATE_DATABASE: 'sgpa', SGPA_AUTO_MIGRATE_HOST: '127.0.0.1',
    SGPA_AUTO_MIGRATE_PORT: '3319', SGPA_AUTO_MIGRATE_DATADIR: 'C:\\qa\\mysql',
    SGPA_AUTO_MIGRATE_SERVER_UUID: 'uuid-qa',
  };
  const config = { get: jest.fn((name: string) => environment[name]) } as unknown as ConfigService;
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("TABLE_NAME = 'migrations'")) return [{ total: migrationTable ? 1 : 0 }];
    if (sql.includes("TABLE_NAME <> 'migrations'")) return [{ total: options.baseTables ?? 0 }];
    if (sql.startsWith('SELECT id, timestamp')) {
      return options.history ?? [...applied].map((name, index) => ({ id: index + 1, timestamp: 2026101500000 + index, name }));
    }
    if (sql.includes('@@server_uuid')) {
      return [{ base: 'sgpa', puerto: 3319, directorio: 'C:\\qa\\mysql\\', uuid: 'uuid-qa', soloLectura: 0 }];
    }
    throw new Error(`Consulta inesperada: ${sql}`);
  });
  const runner = {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('GET_LOCK')) return [{ adquirido: 1 }];
      if (sql.includes('RELEASE_LOCK')) return [{ liberado: 1 }];
      return query(sql, params);
    }),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const runMigrations = jest.fn(async () => {
    if (options.fail) throw new Error('DDL falló');
    migrationTable = true;
    applied.add(MIGRATION);
    return [{ name: MIGRATION }];
  });
  const dataSource = {
    isInitialized: true,
    options: { type: 'mysql', host: '127.0.0.1', port: 3319, synchronize: false, migrationsRun: false },
    migrations: [{ name: MIGRATION }], query,
    createQueryRunner: jest.fn(() => runner), runMigrations,
  } as unknown as DataSource;
  return { dataSource, config, environment, applied, runner, runMigrations };
}

describe('migraciones automáticas antes de escuchar', () => {
  it('rechaza huecos lógicos aunque los nombres y timestamps sean oficiales', () => {
    const official = ['Base2026101400000', 'First2026101500000', 'Second2026101600000'];
    expect(() => validateMigrationHistory([
      { id: 1, timestamp: '2026101600000', name: official[2] },
    ], official)).toThrow('después de una migración faltante');
  });

  it('adopta un historial legacy de cinco migraciones, ejecuta solo tres pendientes y no repite', async () => {
    const official = [
      'InitializeOrAdoptSchema2026101400000', 'AddOptativeRuleCounts2026101500000',
      'AddAulaEquipmentInventory2026101600000', 'AddInvitationOutbox2026101700000',
      'AddHierarchicalAccess2026101900000', 'AddInternalFormSupport2026102100000',
      'AddMissingRuntimeTables2026102200000', 'EnsureOfficialRoles2026102201000',
    ];
    const applied = new Set(official.slice(1, 6));
    const existingData = { usuarios: 4, registrosAcademicos: 356 };
    const environment: Record<string, string> = {
      SGPA_START_PROFILE: 'development', SGPA_RUNTIME_ENV: 'development', NODE_ENV: 'development', SGPA_AUTO_MIGRATE_DEV: 'true',
      SGPA_AUTO_MIGRATE_DATABASE: 'sgpa', SGPA_AUTO_MIGRATE_HOST: '127.0.0.1', SGPA_AUTO_MIGRATE_PORT: '3319',
      SGPA_AUTO_MIGRATE_DATADIR: 'C:\\qa\\mysql', SGPA_AUTO_MIGRATE_SERVER_UUID: 'uuid-qa',
    };
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("TABLE_NAME = 'migrations'")) return [{ total: 1 }];
      if (sql.startsWith('SELECT id, timestamp')) return [...applied].map((name, index) => ({ id: index + 1, timestamp: name.slice(-13), name }));
      if (sql.includes('@@server_uuid')) return [{ base: 'sgpa', puerto: 3319, directorio: 'C:\\qa\\mysql\\', uuid: 'uuid-qa', soloLectura: 0 }];
      throw new Error(`Consulta inesperada: ${sql}`);
    });
    const runner = { connect: jest.fn(), query: jest.fn(async (sql: string) => {
      if (sql.includes('GET_LOCK')) return [{ adquirido: 1 }];
      if (sql.includes('RELEASE_LOCK')) return [{ liberado: 1 }];
      return query(sql);
    }), release: jest.fn() };
    const expectedPending = [official[0], official[6], official[7]];
    const runMigrations = jest.fn(async () => {
      expectedPending.forEach((name) => applied.add(name));
      return expectedPending.map((name) => ({ name }));
    });
    const dataSource = {
      isInitialized: true, options: { type: 'mysql', host: '127.0.0.1', port: 3319, synchronize: false, migrationsRun: false },
      migrations: official.map((name) => ({ name })), query, createQueryRunner: () => runner, runMigrations,
    } as unknown as DataSource;
    const config = { get: (name: string) => environment[name] } as unknown as ConfigService;

    await expect(verificarMigracionesAntesDeEscuchar(dataSource, config)).resolves.toEqual(expectedPending);
    await expect(verificarMigracionesAntesDeEscuchar(dataSource, config)).resolves.toEqual([]);
    expect(runMigrations).toHaveBeenCalledTimes(1);
    expect(existingData).toEqual({ usuarios: 4, registrosAcademicos: 356 });
  });

  it('aplica pendientes una sola vez y conserva el bloqueo en una conexión dedicada', async () => {
    const test = scenario({ authorized: true });
    await expect(verificarMigracionesAntesDeEscuchar(test.dataSource, test.config)).resolves.toEqual([MIGRATION]);
    await expect(verificarMigracionesAntesDeEscuchar(test.dataSource, test.config)).resolves.toEqual([]);
    expect(test.runMigrations).toHaveBeenCalledTimes(1);
    expect(test.runner.query).toHaveBeenCalledWith(expect.stringContaining('RELEASE_LOCK'), expect.any(Array));
    expect(test.runner.release).toHaveBeenCalledTimes(1);
  });

  it('permite instalar una base completamente vacía', async () => {
    const test = scenario({ authorized: true, migrationTable: false, baseTables: 0 });
    await expect(verificarMigracionesAntesDeEscuchar(test.dataSource, test.config)).resolves.toEqual([MIGRATION]);
  });

  it('detiene una base con tablas pero sin historial', async () => {
    const test = scenario({ authorized: true, migrationTable: false, baseTables: 4 });
    await expect(verificarMigracionesAntesDeEscuchar(test.dataSource, test.config)).rejects.toThrow('tiene tablas pero no posee');
    expect(test.runMigrations).not.toHaveBeenCalled();
  });

  it('rechaza historial desconocido, duplicado o con huecos', async () => {
    const unknown = scenario({ history: [{ id: 1, timestamp: '1', name: 'Unknown1' }] });
    await expect(verificarMigracionesAntesDeEscuchar(unknown.dataSource, unknown.config)).rejects.toThrow('ajenas');
    const duplicated = scenario({ history: [
      { id: 1, timestamp: '1', name: MIGRATION }, { id: 2, timestamp: '2', name: MIGRATION },
    ] });
    await expect(verificarMigracionesAntesDeEscuchar(duplicated.dataSource, duplicated.config)).rejects.toThrow('duplicados');
  });

  it('no migra sin autorización y bloquea producción', async () => {
    const unauthorized = scenario();
    await expect(verificarMigracionesAntesDeEscuchar(unauthorized.dataSource, unauthorized.config)).rejects.toThrow('Configure una vez');
    const production = scenario({ authorized: true });
    production.environment.NODE_ENV = 'production';
    await expect(verificarMigracionesAntesDeEscuchar(production.dataSource, production.config)).rejects.toThrow('solo está permitida');
  });

  it('libera el bloqueo y reporta posible DDL parcial si una migración falla', async () => {
    const test = scenario({ authorized: true, fail: true });
    await expect(verificarMigracionesAntesDeEscuchar(test.dataSource, test.config)).rejects.toThrow('DDL parcial');
    expect(test.runner.release).toHaveBeenCalledTimes(1);
  });

  it('el modo manual reutiliza la validación de historial antes de ejecutar', async () => {
    const test = scenario({ authorized: false, history: [{ id: 1, timestamp: '1', name: 'Unknown1' }] });
    await expect(executeSafeOfficialMigrations(test.dataSource, test.config, 'manual')).rejects.toThrow('ajenas');
    expect(test.runMigrations).not.toHaveBeenCalled();
  });
});
