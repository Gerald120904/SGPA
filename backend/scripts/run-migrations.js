const path = require('node:path');
const dotenv = require('dotenv');
const { ConfigService } = require('@nestjs/config');
const { DataSource, MigrationExecutor } = require('typeorm');

const QA004_MIGRATION = 'AddOptativeRuleCounts2026101500000';

function migrationName(migration) {
  if (typeof migration === 'function') return migration.name;
  return migration?.name;
}

function assertQa004OnlyConfigured(migrations) {
  const names = Array.isArray(migrations) ? migrations.map(migrationName) : [];

  if (names.length !== 1 || names[0] !== QA004_MIGRATION) {
    throw new Error(
      `Migraciones configuradas inesperadas (${names.join(', ') || 'ninguna'}); ` +
        `solo se permite ${QA004_MIGRATION}.`,
    );
  }
}

function assertOnlyQa004Pending(migrations) {
  const names = migrations.map(migrationName);

  if (names.length > 1 || names.some((name) => name !== QA004_MIGRATION)) {
    throw new Error(
      `Migraciones pendientes inesperadas (${names.join(', ') || 'ninguna'}); ` +
        `solo se permite ${QA004_MIGRATION}.`,
    );
  }
}

async function main() {
  if (!process.argv.includes('--apply')) {
    throw new Error(
      'No se hizo ningún cambio. Para aplicar migraciones, use el comando documentado con --apply después de liberar y respaldar la base de datos.',
    );
  }

  const confirmation = process.argv
    .find((argument) => argument.startsWith('--confirm-database='))
    ?.slice('--confirm-database='.length);

  if (!confirmation) {
    throw new Error(
      'No changes made. Provide --confirm-database=<DB_DATABASE> to confirm the target.',
    );
  }

  const envFile = path.resolve(
    process.env.SGPA_ENV_FILE || '.env',
  );
  const loaded = dotenv.config({ path: envFile, override: false, quiet: true });

  if (loaded.error) {
    throw new Error(`No se pudo cargar el archivo de entorno ${envFile}.`);
  }

  if (process.env.DB_DATABASE !== confirmation) {
    throw new Error(
      'Confirmed database does not match DB_DATABASE; no changes made.',
    );
  }

  if (process.env.DB_DATABASE === 'sgpa_test') {
    process.env.SGPA_TEST_MODE = 'true';
  }

  // Las migraciones se ejecutan explícitamente; synchronize nunca participa.
  process.env.DB_SYNCHRONIZE = 'false';

  const { crearConfiguracionBaseDatos } = require('../dist/config/database.config');
  const options = crearConfiguracionBaseDatos(new ConfigService(process.env));
  assertQa004OnlyConfigured(options.migrations);
  const dataSource = new DataSource({ ...options, synchronize: false });

  try {
    await dataSource.initialize();
    const pending = await new MigrationExecutor(dataSource).getPendingMigrations();
    assertOnlyQa004Pending(pending);

    if (pending.length === 0) {
      console.log('No hay migraciones pendientes.');
      return;
    }

    const executed = await dataSource.runMigrations({ transaction: 'each' });
    if (
      executed.length !== 1 ||
      executed[0].name !== QA004_MIGRATION
    ) {
      throw new Error(
        `Ejecución inesperada (${executed.map((item) => item.name).join(', ') || 'ninguna'}); ` +
          `solo se permite ${QA004_MIGRATION}.`,
      );
    }
    console.log(`Migraciones aplicadas: ${executed.map((item) => item.name).join(', ')}`);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`No se aplicaron las migraciones: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { assertOnlyQa004Pending, assertQa004OnlyConfigured };
