import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { config as cargarEntorno } from 'dotenv';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { verificarMigracionesAntesDeEscuchar, verificarMigracionesSinAplicar } from './migrations/startup-migrations';

async function bootstrap() {
  cargarEntorno({ path: process.env.SGPA_ENV_FILE || '.env', quiet: true });
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

    const dataSource = app.get(DataSource);
    if (dataSource.options.database === 'sgpa') {
      await verificarMigracionesSinAplicar(dataSource);
    } else if (dataSource.options.synchronize !== true) {
      await verificarMigracionesAntesDeEscuchar(dataSource, app.get(ConfigService));
    }
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    const config = app.get(ConfigService);
    const dbName = config.get<string>('DB_DATABASE');
    console.log(`[SGPA] Servidor backend escuchando en http://127.0.0.1:${port} (Base de datos: ${dbName})`);
  } catch (error) {
    if (app) await app.close();
    throw error;
  }
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`No se inició SGPA: ${message}`);
  process.exitCode = 1;
});
