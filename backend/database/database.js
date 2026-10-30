const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'diduseeme_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then((conn) => {
    console.log('✅ Conexão ao MySQL (Did U See Me?) estabelecida com sucesso!');
    conn.release();
  })
  .catch((err) => {
    console.error('❌ Erro ao conectar ao MySQL:', err.message);
  });

module.exports = pool;