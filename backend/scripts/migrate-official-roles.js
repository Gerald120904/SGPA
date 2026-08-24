const mysql = require('mysql2/promise');
require('dotenv').config();

const ROLES_OFICIALES = [
  ['ADMIN_GLOBAL', 'Administrador global del sistema', 1],
  ['COORDINADOR', 'Coordinador académico', 1],
  ['PROFESOR', 'Profesor', 1],
  ['ESTUDIANTE', 'Estudiante', 1],
];

async function migrateOfficialRoles() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await connection.beginTransaction();

    await connection.query(
      "UPDATE roles SET nombre = 'ADMIN_GLOBAL' WHERE nombre = 'ADMINISTRADOR'",
    );
    await connection.query(
      "UPDATE roles SET nombre = 'COORDINADOR' WHERE nombre = 'COORDINADOR_ACADEMICO'",
    );
    await connection.query(
      `INSERT IGNORE INTO roles (nombre, descripcion, activo)
       VALUES ?`,
      [ROLES_OFICIALES],
    );

    await connection.commit();

    const [roles] = await connection.query(
      'SELECT id, nombre, descripcion, activo FROM roles ORDER BY id',
    );

    console.table(roles);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

migrateOfficialRoles().catch((error) => {
  console.error(error);
  process.exit(1);
});
