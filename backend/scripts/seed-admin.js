const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function seedAdmin() {
  const correo = process.env.SEED_ADMIN_EMAIL;
  const plainPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!correo || !plainPassword) {
    throw new Error(
      'Debe definir SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD en el archivo .env.',
    );
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    const [roles] = await conn.query(
      "SELECT id, nombre FROM roles WHERE nombre IN ('ADMIN_GLOBAL', 'COORDINADOR', 'PROFESOR', 'ESTUDIANTE') ORDER BY id",
    );

    if (!roles.length) {
      throw new Error('No existen roles base en la tabla roles.');
    }

    const [existingUsers] = await conn.query(
      'SELECT id FROM usuarios WHERE correo = ? LIMIT 1',
      [correo],
    );

    let usuarioId;

    if (existingUsers.length) {
      usuarioId = existingUsers[0].id;
      console.log(`Usuario ya existente. id=${usuarioId}`);
    } else {
      const hash = await bcrypt.hash(plainPassword, 10);
      const [result] = await conn.query(
        `INSERT INTO usuarios
        (cedula, nombres, apellido1, apellido2, correo, password_hash, activo)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['999999999', 'Administrador', 'SGPA', null, correo, hash, 1],
      );

      usuarioId = result.insertId;
      console.log(`Usuario administrador creado. id=${usuarioId}`);
    }

    const adminRole = roles.find((rol) => rol.nombre === 'ADMIN_GLOBAL');

    if (!adminRole) {
      throw new Error('No existe el rol ADMIN_GLOBAL.');
    }

    const [existingRelation] = await conn.query(
      `SELECT 1
       FROM usuario_roles
       WHERE usuario_id = ?
       AND rol_id = ?
       LIMIT 1`,
      [usuarioId, adminRole.id],
    );

    if (!existingRelation.length) {
      await conn.query(
        `INSERT INTO usuario_roles
        (usuario_id, rol_id)
        VALUES (?, ?)`,
        [usuarioId, adminRole.id],
      );

      console.log('Rol ADMIN_GLOBAL asignado al usuario.');
    } else {
      console.log('La relación usuario-rol ya existe.');
    }

    console.log('Seed de administrador completado.');
  } finally {
    await conn.end();
  }
}

seedAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
