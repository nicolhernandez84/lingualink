require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

async function getConnection() {
  await pool.query('SELECT NOW()');
  return pool;
}

module.exports = {
  pool,
  getConnection,
  query: (text, params) => pool.query(text, params)
};