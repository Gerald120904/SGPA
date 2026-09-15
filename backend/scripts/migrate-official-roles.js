const mysql = require('mysql2/promise');
require('dotenv').config();

const ROLES_OFICIALES = [
  ['ADMIN_GLOBAL', 'Administrador global del sistema', 1],
  ['COORDINADOR', 'Coordinador académico', 1],
  ['PROFESOR', 'Profesor', 1],
  ['ASISTENTE_ESTUDIANTIL', 'Estudiante asistente', 1],
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

    const [[rolAnterior]] = await connection.query(
      "SELECT id FROM roles WHERE nombre = 'ESTUDIANTE' FOR UPDATE",
    );
    const [[rolNuevo]] = await connection.query(
      "SELECT id FROM roles WHERE nombre = 'ASISTENTE_ESTUDIANTIL' FOR UPDATE",
    );

    if (rolAnterior && !rolNuevo) {
      await connection.query(
        `UPDATE roles
         SET nombre = 'ASISTENTE_ESTUDIANTIL',
             descripcion = 'Estudiante asistente',
             activo = 1
         WHERE id = ?`,
        [rolAnterior.id],
      );
    } else if (rolAnterior && rolNuevo) {
      await connection.query(
        `INSERT IGNORE INTO usuario_roles (usuario_id, rol_id)
         SELECT usuario_id, ? FROM usuario_roles WHERE rol_id = ?`,
        [rolNuevo.id, rolAnterior.id],
      );
      await connection.query('DELETE FROM usuario_roles WHERE rol_id = ?', [
        rolAnterior.id,
      ]);
      await connection.query('DELETE FROM roles WHERE id = ?', [
        rolAnterior.id,
      ]);
    }

    await connection.query(
      "UPDATE roles SET nombre = 'ADMIN_GLOBAL' WHERE nombre = 'ADMINISTRADOR'",
    );
    await connection.query(
      "UPDATE roles SET nombre = 'COORDINADOR' WHERE nombre = 'COORDINADOR_ACADEMICO'",
    );
    await connection.query(
      `INSERT INTO roles (nombre, descripcion, activo)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         descripcion = VALUES(descripcion),
         activo = VALUES(activo)`,
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
