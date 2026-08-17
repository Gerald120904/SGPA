const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host: 'localhost', port: 3306, user: 'root', password: 'EmmaP2026*', database: 'sgpa' });
  const targetTables = ['usuarios', 'roles', 'usuario_roles'];
  const [tables] = await conn.query('SHOW TABLES');
  console.log('ALL_TABLES=' + JSON.stringify(tables));
  for (const table of targetTables) {
    const [cols] = await conn.query('DESCRIBE `' + table + '`');
    console.log('TABLE=' + table);
    console.log(JSON.stringify(cols, null, 2));
  }
  await conn.end();
})();
