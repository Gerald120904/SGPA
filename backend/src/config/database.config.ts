import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const TEST_DATABASE = 'sgpa_test';

function esVerdadero(valor: string | undefined): boolean {
  return valor?.trim().toLowerCase() === 'true';
}

export function crearConfiguracionBaseDatos(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const database = configService.get<string>('DB_DATABASE')?.trim();
  const modoPruebas = esVerdadero(
    configService.get<string>('SGPA_TEST_MODE'),
  );
  const synchronize = esVerdadero(
    configService.get<string>('DB_SYNCHRONIZE'),
  );

  if (!database) {
    throw new Error('DB_DATABASE no está configurada.');
  }

  if (modoPruebas && database !== TEST_DATABASE) {
    throw new Error(
      `Modo de pruebas bloqueado: DB_DATABASE debe ser ${TEST_DATABASE}.`,
    );
  }

  if (database === TEST_DATABASE && !modoPruebas) {
    throw new Error(
      'La base sgpa_test solo puede utilizarse con SGPA_TEST_MODE=true.',
    );
  }

  if (synchronize && (!modoPruebas || database !== TEST_DATABASE)) {
    throw new Error(
      'DB_SYNCHRONIZE=true solo está permitido para sgpa_test en modo de pruebas.',
    );
  }

  return {
    type: 'mysql',
    host: configService.get<string>('DB_HOST'),
    port: Number(configService.get<string>('DB_PORT') || 3306),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database,
    autoLoadEntities: true,
    synchronize,
  };
}

