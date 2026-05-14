const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

let poolPromise = null;

async function getConnection() {
  if (!poolPromise) {
    poolPromise = sql.connect(config)
      .then(pool => {
        console.log('Conectado a SQL Server');
        return pool;
      })
      .catch(error => {
        poolPromise = null;
        console.error('Error conectando a SQL Server:', error);
        throw error;
      });
  }

  return poolPromise;
}

module.exports = {
  getConnection,
  sql
};