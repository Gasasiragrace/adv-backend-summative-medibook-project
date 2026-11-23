const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // DECIMAL columns come back as numbers, not strings
  dateStrings: true, // DATETIME columns come back as 'YYYY-MM-DD HH:mm:ss' (no timezone shifting)
});

module.exports = pool;
