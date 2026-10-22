import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

type IdentidadMySql = {
  base: string;
  puerto: number;
  directorio: string;
  uuid: string;
  soloLectura: number;
};

function configuracion(config: ConfigService, nombre: string): string {
  return String(config.get<string>(nombre) ?? '').trim();
}

function normalizarDirectorio(valor: string): string {
  return valor.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function nombresConfigurados(dataSource: DataSource): string[] {
  const nombres = dataSource.migrations.map((migration) => migration.name);
  if (
    !nombres.length || nombres.some((nombre) => !nombre) ||
    new Set(nombres).size !== nombres.length
  ) {
    throw new Error('La lista de migraciones TypeORM está vacía o duplicada.');
  }
  return nombres as string[];
}

async function pendientes(dataSource: DataSource, nombres: string[]): Promise<string[]> {
  const tablas = (await dataSource.query(
    "SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'migrations'",
  )) as Array<{ total: number | string }>;
  if (Number(tablas[0]?.total) !== 1) {
    throw new Error(
      'La base no tiene tabla migrations. Requiere instalación inicial controlada; no se creará automáticamente al arrancar.',
    );
  }
  const filas = (await dataSource.query('SELECT name FROM migrations')) as Array<{
    name: string;
  }>;
  const aplicadas = new Set(filas.map((fila) => fila.name));
  return nombres.filter((nombre) => !aplicadas.has(nombre));
}

async function comprobarEsquemaFormulario(dataSource: DataSource): Promise<void> {
  const columnas = (await dataSource.query(
    "SELECT COLUMN_NAME AS nombre, DATA_TYPE AS tipo, CHARACTER_MAXIMUM_LENGTH AS longitud, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defecto FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'formularios_estudiantes' AND COLUMN_NAME IN ('proveedor', 'token_publico')",
  )) as Array<{
    nombre: string;
    tipo: string;
    longitud: number | string;
    nullable: string;
    defecto: string | null;
  }>;
  const proveedor = columnas.find((columna) => columna.nombre === 'proveedor');
  const token = columnas.find((columna) => columna.nombre === 'token_publico');
  const indices = (await dataSource.query(
    "SELECT INDEX_NAME AS nombre, COLUMN_NAME AS columna, NON_UNIQUE AS noUnico FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'formularios_estudiantes' AND INDEX_NAME = 'UQ_formularios_token_publico'",
  )) as Array<{ nombre: string; columna: string; noUnico: number }>;
  if (
    proveedor?.tipo !== 'varchar' || Number(proveedor.longitud) !== 20 ||
    proveedor.nullable !== 'NO' || proveedor.defecto !== 'GOOGLE_FORMS' ||
    token?.tipo !== 'varchar' || Number(token.longitud) !== 64 ||
    token.nullable !== 'YES' ||
    indices.length !== 1 || indices[0].columna !== 'token_publico' ||
    Number(indices[0].noUnico) !== 0
  ) {
    throw new Error('El esquema de formularios no coincide con la entidad y la migración; se canceló el arranque.');
  }
}

async function comprobarAusenciaDeDdlParcial(
  dataSource: DataSource,
  nombresPendientes: string[],
): Promise<void> {
  if (!nombresPendientes.includes('AddInternalFormSupport2026102100000')) return;
  const [columnas, indices] = await Promise.all([
    dataSource.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'formularios_estudiantes' AND COLUMN_NAME IN ('proveedor', 'token_publico')",
    ) as Promise<unknown[]>,
    dataSource.query(
      "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'formularios_estudiantes' AND INDEX_NAME = 'UQ_formularios_token_publico'",
    ) as Promise<unknown[]>,
  ]);
  if (columnas.length || indices.length) {
    throw new Error('La migración de formularios está pendiente pero ya existen columnas o índice nuevos. Posible DDL parcial: inspeccione el esquema antes de reintentar.');
  }
}

function comprobarAutorizacion(
  dataSource: DataSource,
  config: ConfigService,
  identidad: IdentidadMySql,
): void {
  if (
    configuracion(config, 'SGPA_START_PROFILE') !== 'development' ||
    configuracion(config, 'SGPA_RUNTIME_ENV') !== 'development' ||
    configuracion(config, 'NODE_ENV') === 'production' ||
    configuracion(config, 'SGPA_TEST_MODE').toLowerCase() === 'true'
  ) {
    throw new Error('Migración automática permitida solo en start:dev de desarrollo; QA y producción requieren despliegue explícito.');
  }
  if (configuracion(config, 'SGPA_AUTO_MIGRATE_DEV').toLowerCase() !== 'true') {
    throw new Error('Hay migraciones pendientes. Configure la autorización de desarrollo SGPA_AUTO_MIGRATE_DEV y la identidad esperada, o ejecute el despliegue controlado.');
  }
  if (dataSource.options.type !== 'mysql' || dataSource.options.synchronize !== false || dataSource.options.migrationsRun !== false) {
    throw new Error('La migración automática requiere MySQL, synchronize=false y migrationsRun=false.');
  }
  const host = String(dataSource.options.host ?? '').toLowerCase();
  const puerto = Number(dataSource.options.port);
  const esperados = {
    base: configuracion(config, 'SGPA_AUTO_MIGRATE_DATABASE'),
    host: configuracion(config, 'SGPA_AUTO_MIGRATE_HOST').toLowerCase(),
    puerto: Number(configuracion(config, 'SGPA_AUTO_MIGRATE_PORT')),
    directorio: configuracion(config, 'SGPA_AUTO_MIGRATE_DATADIR'),
    uuid: configuracion(config, 'SGPA_AUTO_MIGRATE_SERVER_UUID').toLowerCase(),
  };
  if (
    !esperados.base || !esperados.host || !esperados.puerto ||
    !esperados.directorio || !esperados.uuid ||
    !['localhost', '127.0.0.1', '::1'].includes(host) ||
    esperados.host !== host ||
    esperados.base !== identidad.base ||
    esperados.puerto !== puerto ||
    esperados.puerto !== Number(identidad.puerto) ||
    normalizarDirectorio(esperados.directorio) !== normalizarDirectorio(identidad.directorio) ||
    esperados.uuid !== identidad.uuid.toLowerCase() ||
    Number(identidad.soloLectura) !== 0
  ) {
    throw new Error('Identidad MySQL distinta de la autorización de desarrollo: base, host, puerto, directorio, UUID o modo de lectura. No se aplicó ninguna migración.');
  }
}

export async function verificarMigracionesAntesDeEscuchar(
  dataSource: DataSource,
  config: ConfigService,
): Promise<string[]> {
  if (!dataSource.isInitialized) {
    throw new Error('La conexión TypeORM no está inicializada.');
  }
  const nombres = nombresConfigurados(dataSource);
  const iniciales = await pendientes(dataSource, nombres);
  if (!iniciales.length) {
    await comprobarEsquemaFormulario(dataSource);
    return [];
  }
  await comprobarAusenciaDeDdlParcial(dataSource, iniciales);

  const [identidad] = (await dataSource.query(
    'SELECT DATABASE() AS base, @@port AS puerto, @@datadir AS directorio, @@server_uuid AS uuid, @@read_only AS soloLectura',
  )) as IdentidadMySql[];
  comprobarAutorizacion(dataSource, config, identidad);

  const bloqueo = `sgpa-migrate-${createHash('sha256')
    .update(`${identidad.uuid}:${identidad.base}`)
    .digest('hex')
    .slice(0, 40)}`;
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  let adquirido = false;
  try {
    const [resultado] = (await queryRunner.query('SELECT GET_LOCK(?, 15) AS adquirido', [bloqueo])) as Array<{
      adquirido: number;
    }>;
    if (Number(resultado?.adquirido) !== 1) {
      throw new Error('Otra instancia está migrando esta base; se canceló el arranque.');
    }
    adquirido = true;
    const actuales = await pendientes(dataSource, nombres);
    if (!actuales.length) {
      await comprobarEsquemaFormulario(dataSource);
      return [];
    }
    await comprobarAusenciaDeDdlParcial(dataSource, actuales);
    const ejecutadas = await dataSource.runMigrations({ transaction: 'each' });
    const ejecutadasNombres = ejecutadas.map((item) => item.name);
    const restantes = await pendientes(dataSource, nombres);
    if (
      ejecutadasNombres.length !== actuales.length ||
      ejecutadasNombres.some((nombre, indice) => nombre !== actuales[indice]) ||
      restantes.length
    ) {
      throw new Error('El resultado de migraciones no coincide con las pendientes; se canceló el arranque.');
    }
    await comprobarEsquemaFormulario(dataSource);
    console.log(`Migraciones de desarrollo aplicadas: ${ejecutadasNombres.join(', ')}`);
    return ejecutadasNombres;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`No se completaron las migraciones de desarrollo: ${message}. Revise el esquema antes de reintentar; MySQL DDL puede dejar cambios parciales.`);
  } finally {
    if (adquirido) await queryRunner.query('SELECT RELEASE_LOCK(?)', [bloqueo]);
    await queryRunner.release();
  }
}
