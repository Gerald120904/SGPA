import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { verificarMigracionesAntesDeEscuchar } from './startup-migrations';

const NOMBRE = 'AddInternalFormSupport2026102100000';

function escenario(opciones: {
  autorizado?: boolean;
  uuid?: string;
  fallaMigracion?: boolean;
  tablaMigraciones?: boolean;
  esquemaIncompleto?: boolean;
  ddlParcial?: boolean;
} = {}) {
  const aplicadas = new Set<string>();
  const entorno: Record<string, string> = {
    SGPA_START_PROFILE: 'development',
    SGPA_RUNTIME_ENV: 'development',
    SGPA_AUTO_MIGRATE_DEV: opciones.autorizado ? 'true' : 'false',
    SGPA_AUTO_MIGRATE_DATABASE: 'sgpa',
    SGPA_AUTO_MIGRATE_HOST: '127.0.0.1',
    SGPA_AUTO_MIGRATE_PORT: '3319',
    SGPA_AUTO_MIGRATE_DATADIR: 'C:\\qa\\mysql',
    SGPA_AUTO_MIGRATE_SERVER_UUID: opciones.uuid ?? 'uuid-qa',
  };
  const config = {
    get: jest.fn((nombre: string) => entorno[nombre]),
  } as unknown as ConfigService;
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('information_schema.TABLES')) {
      return [{ total: opciones.tablaMigraciones === false ? 0 : 1 }];
    }
    if (sql === 'SELECT name FROM migrations') {
      return [...aplicadas].map((name) => ({ name }));
    }
    if (sql.includes('information_schema.COLUMNS')) {
      if (opciones.esquemaIncompleto) return [];
      if (!aplicadas.has(NOMBRE)) {
        return opciones.ddlParcial ? [{ nombre: 'proveedor' }] : [];
      }
      return [
        { nombre: 'proveedor', tipo: 'varchar', longitud: 20, nullable: 'NO', defecto: 'GOOGLE_FORMS' },
        { nombre: 'token_publico', tipo: 'varchar', longitud: 64, nullable: 'YES', defecto: null },
      ];
    }
    if (sql.includes('information_schema.STATISTICS')) {
      if (!aplicadas.has(NOMBRE)) return [];
      return [{ nombre: 'UQ_formularios_token_publico', columna: 'token_publico', noUnico: 0 }];
    }
    if (sql.includes('@@server_uuid')) {
      return [{ base: 'sgpa', puerto: 3319, directorio: 'C:\\qa\\mysql\\', uuid: 'uuid-qa', soloLectura: 0 }];
    }
    throw new Error(`Consulta inesperada: ${sql}`);
  });
  const runner = {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(async (sql: string) => sql.includes('GET_LOCK') ? [{ adquirido: 1 }] : [{ liberado: 1 }]),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const runMigrations = jest.fn(async () => {
    if (opciones.fallaMigracion) throw new Error('DDL de prueba falló');
    aplicadas.add(NOMBRE);
    return [{ name: NOMBRE }];
  });
  const dataSource = {
    isInitialized: true,
    options: { type: 'mysql', host: '127.0.0.1', port: 3319, synchronize: false, migrationsRun: false },
    migrations: [{ name: NOMBRE }],
    query,
    createQueryRunner: jest.fn(() => runner),
    runMigrations,
  } as unknown as DataSource;
  return { dataSource, config, entorno, aplicadas, runMigrations, runner };
}

describe('migraciones antes de escuchar', () => {
  it('se detiene sin autorización cuando hay migraciones pendientes', async () => {
    const caso = escenario();
    await expect(verificarMigracionesAntesDeEscuchar(caso.dataSource, caso.config))
      .rejects.toThrow('Hay migraciones pendientes');
    expect(caso.runMigrations).not.toHaveBeenCalled();
  });

  it('rechaza un servidor distinto aun con la opción de desarrollo activada', async () => {
    const caso = escenario({ autorizado: true, uuid: 'otro-servidor' });
    await expect(verificarMigracionesAntesDeEscuchar(caso.dataSource, caso.config))
      .rejects.toThrow('Identidad MySQL distinta');
    expect(caso.runMigrations).not.toHaveBeenCalled();
  });

  it('aplica pendientes una vez y no las repite en el segundo arranque', async () => {
    const caso = escenario({ autorizado: true });
    await expect(verificarMigracionesAntesDeEscuchar(caso.dataSource, caso.config))
      .resolves.toEqual([NOMBRE]);
    await expect(verificarMigracionesAntesDeEscuchar(caso.dataSource, caso.config))
      .resolves.toEqual([]);
    expect(caso.runMigrations).toHaveBeenCalledTimes(1);
    expect(caso.runner.release).toHaveBeenCalledTimes(1);
  });

  it('no arranca ni crea una tabla migrations ausente', async () => {
    const caso = escenario({ autorizado: true, tablaMigraciones: false });
    await expect(verificarMigracionesAntesDeEscuchar(caso.dataSource, caso.config))
      .rejects.toThrow('instalación inicial controlada');
    expect(caso.runMigrations).not.toHaveBeenCalled();
  });

  it('bloquea el arranque si la migración consta aplicada pero falta el esquema', async () => {
    const caso = escenario({ esquemaIncompleto: true });
    caso.aplicadas.add(NOMBRE);
    await expect(verificarMigracionesAntesDeEscuchar(caso.dataSource, caso.config))
      .rejects.toThrow('El esquema de formularios no coincide');
    expect(caso.runMigrations).not.toHaveBeenCalled();
  });

  it('no reintenta una migración con DDL parcial sin revisión', async () => {
    const caso = escenario({ autorizado: true, ddlParcial: true });
    await expect(verificarMigracionesAntesDeEscuchar(caso.dataSource, caso.config))
      .rejects.toThrow('Posible DDL parcial');
    expect(caso.runMigrations).not.toHaveBeenCalled();
  });

  it('propaga la falla DDL y libera el bloqueo sin continuar', async () => {
    const caso = escenario({ autorizado: true, fallaMigracion: true });
    await expect(verificarMigracionesAntesDeEscuchar(caso.dataSource, caso.config))
      .rejects.toThrow('MySQL DDL puede dejar cambios parciales');
    expect(caso.runner.release).toHaveBeenCalledTimes(1);
  });

  it('rechaza producción y QA aunque se solicite migración automática', async () => {
    for (const [campo, valor] of [['NODE_ENV', 'production'], ['SGPA_TEST_MODE', 'true']]) {
      const caso = escenario({ autorizado: true });
      caso.entorno[campo] = valor;
      await expect(verificarMigracionesAntesDeEscuchar(caso.dataSource, caso.config))
        .rejects.toThrow('solo en start:dev de desarrollo');
      expect(caso.runMigrations).not.toHaveBeenCalled();
    }
  });
});
