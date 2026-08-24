const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function seedAdmin() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'EmmaP2026*',
    database: 'sgpa',
  });

  const correo = 'admin@sgpa.local';
  const plainPassword = 'SGPA2026*';

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
      'INSERT INTO usuarios (cedula, nombres, apellido1, apellido2, correo, password_hash, activo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['999999999', 'Administrador', 'SGPA', null, correo, hash, 1],
    );
    usuarioId = result.insertId;
    console.log(`Usuario creado. id=${usuarioId}`);
  }

  const adminRole = roles.find((rol) => rol.nombre === 'ADMIN_GLOBAL');
  if (!adminRole) {
    throw new Error('No existe el rol ADMIN_GLOBAL.');
  }

  const [existingRelation] = await conn.query(
    'SELECT 1 FROM usuario_roles WHERE usuario_id = ? AND rol_id = ? LIMIT 1',
    [usuarioId, adminRole.id],
  );

  if (existingRelation.length) {
    console.log('La relación usuario-rol ya existe.');
  } else {
    await conn.query('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (?, ?)', [
      usuarioId,
      adminRole.id,
    ]);
    console.log('Rol ADMIN_GLOBAL asignado al usuario.');
  }

  await conn.end();

  console.log('Credenciales de prueba:');
  console.log(`Correo: ${correo}`);
  console.log(`Password: ${plainPassword}`);
}

seedAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
