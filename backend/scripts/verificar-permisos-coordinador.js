require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'sgpa',
  });

  const [users] = await connection.query(`
    SELECT u.id, u.correo, u.nombres, u.apellido1, r.nombre as rol
    FROM usuarios u
    JOIN usuario_roles ur ON u.id = ur.usuario_id
    JOIN roles r ON ur.rol_id = r.id
    WHERE r.nombre = 'COORDINADOR' AND u.activo = 1
  `);

  console.log('Coordinadores encontrados:', users);

  const required = [
    'FORMULARIOS_ESTUDIANTES_VER',
    'FORMULARIOS_ESTUDIANTES_CREAR',
    'FORMULARIOS_ESTUDIANTES_GESTIONAR',
    'FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS',
  ];

  for (const user of users) {
    const [perms] = await connection.query(
      `SELECT permiso FROM usuario_permisos WHERE usuario_id = ? AND activo = 1`,
      [user.id],
    );
    const permList = perms.map((p) => p.permiso);
    console.log(`Permisos actuales de ${user.correo}:`, permList.filter((p) => p.startsWith('FORMULARIOS_ESTUDIANTES')));

    for (const req of required) {
      if (!permList.includes(req)) {
        await connection.query(
          `INSERT INTO usuario_permisos (usuario_id, permiso, activo, created_at, updated_at)
           VALUES (?, ?, 1, NOW(), NOW())
           ON DUPLICATE KEY UPDATE activo = 1, updated_at = NOW()`,
          [user.id, req],
        );
        console.log(`  + Asignado permiso ${req} a ${user.correo}`);
      }
    }

    const [finalPerms] = await connection.query(
      `SELECT permiso FROM usuario_permisos WHERE usuario_id = ? AND activo = 1`,
      [user.id],
    );
    const finalPermList = finalPerms.map((p) => p.permiso);
    console.log(`Permisos finales de ${user.correo}:`, finalPermList.filter((p) => p.startsWith('FORMULARIOS_ESTUDIANTES')));
  }

  await connection.end();
}

main().catch(console.error);
