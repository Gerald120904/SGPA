import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { config as cargarEntorno } from 'dotenv';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { verificarMigracionesAntesDeEscuchar } from './migrations/startup-migrations';

async function bootstrap() {
  cargarEntorno({ path: process.env.SGPA_ENV_FILE || '.env', quiet: true });
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  try {
    await verificarMigracionesAntesDeEscuchar(
      app.get(DataSource),
      app.get(ConfigService),
    );
    await app.listen(process.env.PORT ?? 3000);
  } catch (error) {
    await app.close();
    throw error;
  }
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`No se inició SGPA: ${message}`);
  process.exitCode = 1;
});
