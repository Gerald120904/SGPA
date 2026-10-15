const { loadTestEnvironment } = require('./test-environment');

async function main() {
  loadTestEnvironment({ synchronize: true });

  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  await app.close();
  console.log('Esquema de sgpa_test preparado correctamente.');
}

main().catch((error) => {
  console.error(`No se pudo preparar sgpa_test: ${error.message}`);
  process.exit(1);
});

