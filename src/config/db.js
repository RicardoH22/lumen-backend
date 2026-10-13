const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false 
  }
});

// Forzar el search_path al esquema 'lumen' en cada conexión
pool.on('connect', (client) => {
  client.query('SET search_path TO lumen;');
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};