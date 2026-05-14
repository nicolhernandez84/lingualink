const sql = require('mssql');

const config = {
  user: 'sa',
  password: '1234',
  server: 'localhost',
  port: 1433,
  database: 'lingualink',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

let poolPromise = null;

async function getConnection() {
  if (!poolPromise) {
    poolPromise = sql.connect(config)
      .then(pool => {
        console.log('Conectado a SQL Server con usuario sa');
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