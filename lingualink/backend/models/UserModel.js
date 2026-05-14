const { getConnection, sql } = require('../config/db');

class UserModel {
  async findByCredentials(type_document, number_document, password) {
    const pool = await getConnection();
    const result = await pool.request()
      .input('type_document', sql.VarChar, type_document)
      .input('number_document', sql.VarChar, String(number_document))
      .input('password', sql.VarChar, String(password))
      .query(`
        SELECT id, type_document, number_document, role
        FROM users
        WHERE type_document = @type_document
          AND CONVERT(VARCHAR(50), number_document) = @number_document
          AND CONVERT(VARCHAR(255), password) = @password
      `);

    return result.recordset[0] || null;
  }
}

module.exports = new UserModel();
