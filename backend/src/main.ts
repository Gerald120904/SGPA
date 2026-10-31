import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { config as cargarEntorno } from 'dotenv';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { acquireDevelopmentStartupGuard } from './config/development-startup-guard';
import { synchronizeDevelopmentSchemaSafely } from './config/development-schema-sync';
import { verificarMigracionesAntesDeEscuchar } from './migrations/startup-migrations';

async function bootstrap() {
  cargarEntorno({ path: process.env.SGPA_ENV_FILE || '.env', quiet: true });
  const guard = await acquireDevelopmentStartupGuard(process.env);
  let app;
  try {
    app = await NestFactory.create(AppModule);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await verificarMigracionesAntesDeEscuchar(
      app.get(DataSource),
      app.get(ConfigService),
    );
    await synchronizeDevelopmentSchemaSafely(app.get(DataSource), app.get(ConfigService));
    await guard?.releasePort();
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    const config = app.get(ConfigService);
    const dbName = config.get<string>('DB_DATABASE');
    console.log(`[SGPA] Servidor backend escuchando en http://127.0.0.1:${port} (Base de datos: ${dbName})`);
  } catch (error) {
    if (app) await app.close();
    throw error;
  } finally {
    await guard?.close();
  }
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`No se inició SGPA: ${message}`);
  process.exitCode = 1;
});
