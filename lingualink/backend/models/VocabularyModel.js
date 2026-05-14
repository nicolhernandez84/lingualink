const { getConnection, sql } = require('../config/db');

class VocabularyModel {
  async getByLevel(level) {
    const pool = await getConnection();

    const result = await pool.request()
      .input('level', sql.VarChar, level)
      .query(`
        SELECT
          v.id,
          v.name,
          v.level,
          v.theme,
          v.emoji,
          v.color,
          v.created_at,
          v.active,
          COUNT(w.id) AS word_count
        FROM Vocabularies v
        LEFT JOIN VocabularyWords w ON w.vocabulary_id = v.id
        WHERE v.level = @level AND ISNULL(v.active, 1) = 1
        GROUP BY 
          v.id, v.name, v.level, v.theme, 
          v.emoji, v.color, v.created_at, v.active
        ORDER BY v.created_at DESC
      `);

    return result.recordset;
  }

  async getAll() {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT
        v.id,
        v.name,
        v.level,
        v.theme,
        v.emoji,
        v.color,
        v.created_at,
        v.active,
        COUNT(w.id) AS word_count
      FROM Vocabularies v
      LEFT JOIN VocabularyWords w ON w.vocabulary_id = v.id
      WHERE ISNULL(v.active, 1) = 1
      GROUP BY 
        v.id, v.name, v.level, v.theme, 
        v.emoji, v.color, v.created_at, v.active
      ORDER BY v.level ASC, v.created_at DESC
    `);

    return result.recordset;
  }

  async getById(id) {
    const pool = await getConnection();

    const vocabResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          id, 
          name, 
          level, 
          theme, 
          emoji, 
          color,
          created_at, 
          active
        FROM Vocabularies
        WHERE id = @id AND ISNULL(active, 1) = 1
      `);

    if (vocabResult.recordset.length === 0) {
      return null;
    }

    const vocabulary = vocabResult.recordset[0];

    const wordsResult = await pool.request()
      .input('vocabulary_id', sql.Int, id)
      .query(`
        SELECT 
          id, 
          vocabulary_id, 
          english, 
          spanish, 
          audio, 
          created_at
        FROM VocabularyWords
        WHERE vocabulary_id = @vocabulary_id
        ORDER BY id ASC
      `);

    vocabulary.words = wordsResult.recordset;

    return vocabulary;
  }

  async create(data) {
    const pool = await getConnection();
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      const vocabularyResult = await transaction.request()
        .input('name', sql.NVarChar, data.name)
        .input('level', sql.VarChar, data.level)
        .input('theme', sql.NVarChar, data.theme)
        .input('emoji', sql.NVarChar, data.emoji || '📚')
        .input('color', sql.NVarChar, data.color || 'from-blue-600 to-blue-800')
        .query(`
          INSERT INTO Vocabularies 
          (name, level, theme, emoji, color, active)
          OUTPUT INSERTED.id
          VALUES 
          (@name, @level, @theme, @emoji, @color, 1)
        `);

      const vocabularyId = vocabularyResult.recordset[0].id;
      const words = Array.isArray(data.words) ? data.words : [];

      for (const word of words) {
        if (!word.english || !word.spanish) continue;

        await transaction.request()
          .input('vocabulary_id', sql.Int, vocabularyId)
          .input('english', sql.NVarChar, word.english)
          .input('spanish', sql.NVarChar, word.spanish)
          .input('audio', sql.NVarChar, word.audio || null)
          .query(`
            INSERT INTO VocabularyWords 
            (vocabulary_id, english, spanish, audio)
            VALUES 
            (@vocabulary_id, @english, @spanish, @audio)
          `);
      }

      await transaction.commit();

      return {
        success: true,
        id: vocabularyId
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateVocabulary(id, data) {
    const pool = await getConnection();
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      await transaction.request()
        .input('id', sql.Int, id)
        .input('name', sql.NVarChar, data.name)
        .input('level', sql.VarChar, data.level)
        .input('theme', sql.NVarChar, data.theme)
        .input('emoji', sql.NVarChar, data.emoji || '📚')
        .input('color', sql.NVarChar, data.color || 'from-blue-600 to-blue-800')
        .query(`
          UPDATE Vocabularies
          SET
            name = @name,
            level = @level,
            theme = @theme,
            emoji = @emoji,
            color = @color
          WHERE id = @id
        `);

      await transaction.request()
        .input('id', sql.Int, id)
        .query(`
          DELETE FROM VocabularyWords
          WHERE vocabulary_id = @id
        `);

      const words = Array.isArray(data.words) ? data.words : [];

      for (const word of words) {
        if (!word.english || !word.spanish) continue;

        await transaction.request()
          .input('vocabulary_id', sql.Int, id)
          .input('english', sql.NVarChar, word.english)
          .input('spanish', sql.NVarChar, word.spanish)
          .input('audio', sql.NVarChar, word.audio || null)
          .query(`
            INSERT INTO VocabularyWords
            (vocabulary_id, english, spanish, audio)
            VALUES
            (@vocabulary_id, @english, @spanish, @audio)
          `);
      }

      await transaction.commit();

      return true;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteVocabulary(id) {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const request = new sql.Request(transaction);
      request.input('id', sql.Int, id);

      await request.query(`
        DELETE ar
        FROM ActivityResults ar
        INNER JOIN Activities a ON ar.activity_id = a.id
        WHERE a.vocabulary_id = @id
      `);

      await request.query(`
        DELETE FROM Activities
        WHERE vocabulary_id = @id
      `);

      await request.query(`
        DELETE FROM VocabularyWords
        WHERE vocabulary_id = @id
      `);

      await request.query(`
        DELETE FROM Vocabularies
        WHERE id = @id
      `);

      await transaction.commit();

      return {
        success: true,
        message: 'Vocabulario eliminado definitivamente'
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new VocabularyModel();