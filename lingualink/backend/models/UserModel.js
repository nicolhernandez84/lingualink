const pool = require('../config/db');

class UserModel {
  async findByCredentials(type_document, number_document, password) {

    const result = await pool.query(
      `
      SELECT id, type_document, number_document, role
      FROM users
      WHERE type_document = $1
      AND number_document = $2
      AND password = $3
      `,
      [
        type_document,
        String(number_document),
        String(password)
      ]
    );

    return result.rows[0] || null;
  }
}

module.exports = new UserModel();
