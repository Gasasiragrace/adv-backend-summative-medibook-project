// Convenience: `npm run db:setup` runs database/schema.sql and database/seed.sql using your .env credentials.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });
  for (const file of ['schema.sql', 'seed.sql']) {
    const sql = await fs.promises.readFile(path.join(__dirname, '..', 'database', file), 'utf8');
    await connection.query(sql);
    console.log(`ran database/${file}`);
  }
  await connection.end();
}

main().catch((error) => {
  console.error('db:setup failed:', error.message);
  process.exit(1);
});
