const path = require('node:path');
const dotenv = require('dotenv');

const TEST_DATABASE = 'sgpa_test';

function loadTestEnvironment({ synchronize = false } = {}) {
  const envPath = path.resolve(__dirname, '..', '.env.test');
  const result = dotenv.config({ path: envPath, override: true, quiet: true });

  if (result.error) {
    throw new Error(`No se pudo cargar ${envPath}: ${result.error.message}`);
  }

  process.env.SGPA_ENV_FILE = envPath;
  process.env.SGPA_TEST_MODE = 'true';
  process.env.DB_SYNCHRONIZE = synchronize ? 'true' : 'false';
  process.env.NODE_ENV = 'test';

  if (process.env.DB_DATABASE !== TEST_DATABASE) {
    throw new Error(
      `Ejecución bloqueada: DB_DATABASE debe ser ${TEST_DATABASE}.`,
    );
  }

  return envPath;
}

module.exports = {
  loadTestEnvironment,
};

