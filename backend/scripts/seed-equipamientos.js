const mysql = require('mysql2/promise');
require('dotenv').config();

const EQUIPAMIENTOS = [
  [
    'Proyector',
    'Proyector multimedia / Video beam disponible en el aula.',
    1,
  ],
  [
    'Pantalla de proyección',
    'Pantalla utilizada para proyección de contenido.',
    1,
  ],
  [
    'Computadora',
    'Equipo de cómputo disponible en el aula.',
    1,
  ],
  [
    'Televisor',
    'Pantalla o televisor disponible en el aula.',
    1,
  ],
  [
    'Pizarra',
    'Pizarra convencional disponible en el aula.',
    1,
  ],
  [
    'Pizarra digital',
    'Pizarra interactiva o digital.',
    1,
  ],
  [
    'Sistema de sonido',
    'Sistema de audio disponible en el aula.',
    1,
  ],
  [
    'Aire acondicionado',
    'Sistema de climatización disponible en el aula.',
    1,
  ],
];

async function seedEquipamientos() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    for (const [nombre, descripcion, activo] of EQUIPAMIENTOS) {
      await connection.query(
        `
        INSERT INTO equipamientos
          (nombre, descripcion, activo)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          descripcion = VALUES(descripcion)
        `,
        [nombre, descripcion, activo],
      );
    }

    const [equipamientos] = await connection.query(`
      SELECT id, nombre, descripcion, activo
      FROM equipamientos
      ORDER BY nombre
    `);

    console.table(equipamientos);

    console.log('Catálogo de equipamientos preparado correctamente.');
  } finally {
    await connection.end();
  }
}

seedEquipamientos().catch((error) => {
  console.error(error);
  process.exit(1);
});
