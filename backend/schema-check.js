const mysql = require('mysql2/promise');
require('dotenv').config();

async function schemaCheck() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    const targetTables = ['usuarios', 'roles', 'usuario_roles'];
    const [tables] = await conn.query('SHOW TABLES');

    console.log('ALL_TABLES=' + JSON.stringify(tables));

    for (const table of targetTables) {
      const [cols] = await conn.query(`DESCRIBE \`${table}\``);

      console.log(`TABLE=${table}`);
      console.log(JSON.stringify(cols, null, 2));
    }
  } finally {
    await conn.end();
  }
}

schemaCheck().catch((error) => {
  console.error(error);
  process.exit(1);
});
