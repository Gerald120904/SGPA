const path = require('node:path');
const dotenv = require('dotenv');
const { ConfigService } = require('@nestjs/config');
const { DataSource } = require('typeorm');

function assertManualConfirmation(argv, database) {
  if (!argv.includes('--apply')) {
    throw new Error('No se hizo ningún cambio. Use --apply con confirmación explícita del destino.');
  }
  const confirmation = argv.find((value) => value.startsWith('--confirm-database='))
    ?.slice('--confirm-database='.length);
  if (!confirmation) throw new Error('Falta --confirm-database=<DB_DATABASE>.');
  if (database !== confirmation) {
    throw new Error('La confirmación no coincide con DB_DATABASE; no se hicieron cambios.');
  }
}

async function main() {
  const envFile = path.resolve(process.env.SGPA_ENV_FILE || '.env');
  const loaded = dotenv.config({ path: envFile, override: false, quiet: true });
  if (loaded.error) throw new Error(`No se pudo cargar ${envFile}.`);
  assertManualConfirmation(process.argv, process.env.DB_DATABASE);
  if (process.env.DB_DATABASE === 'sgpa_test') process.env.SGPA_TEST_MODE = 'true';
  process.env.DB_SYNCHRONIZE = 'false';

  const { crearConfiguracionBaseDatos } = require('../dist/config/database.config');
  const { executeSafeOfficialMigrations } = require('../dist/migrations/startup-migrations');
  const options = crearConfiguracionBaseDatos(new ConfigService(process.env));
  const dataSource = new DataSource({ ...options, synchronize: false });
  try {
    await dataSource.initialize();
    const executedNames = await executeSafeOfficialMigrations(
      dataSource,
      new ConfigService(process.env),
      'manual',
    );
    if (!executedNames.length) return console.log('No hay migraciones pendientes.');
    console.log(`Migraciones aplicadas: ${executedNames.join(', ')}`);
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

module.exports = { assertManualConfirmation };
