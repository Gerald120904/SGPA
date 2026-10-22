const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: process.env.SGPA_ENV_FILE || '.env', quiet: true });

const OFFICIAL = ['ADMIN_GLOBAL', 'COORDINADOR', 'PROFESOR', 'ASISTENTE_ESTUDIANTIL'];
const LEGACY = new Map([
  ['ADMINISTRADOR', 'ADMIN_GLOBAL'],
  ['COORDINADOR_ACADEMICO', 'COORDINADOR'],
  ['ESTUDIANTE', 'ASISTENTE_ESTUDIANTIL'],
]);

async function main() {
  const database = process.env.DB_DATABASE?.trim();
  if (!database) throw new Error('DB_DATABASE no está configurada.');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  });
  try {
    const [[identity]] = await connection.query(
      'SELECT DATABASE() AS base, @@hostname AS servidor, @@port AS puerto, @@server_uuid AS uuid',
    );
    const [roles] = await connection.query(
      'SELECT id, nombre, descripcion, activo FROM roles ORDER BY id',
    );
    const names = new Set(roles.map((role) => role.nombre));
    const conflicts = [...LEGACY].filter(([legacy, official]) => names.has(legacy) && names.has(official));
    const legacyRenames = [...LEGACY].filter(([legacy, official]) => names.has(legacy) && !names.has(official));
    const missing = OFFICIAL.filter((name) => !names.has(name) && !legacyRenames.some(([, official]) => official === name));
    console.log(JSON.stringify({ read_only: true, identity, roles, conflicts, legacyRenames, missing }, null, 2));
    if (conflicts.length) process.exitCode = 2;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`No se pudo verificar el catálogo de roles: ${error.message}`);
  process.exitCode = 1;
});
