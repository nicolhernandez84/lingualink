const db = require('../config/db');

class VocabularyModel {
  async getByLevel(level) {
    const result = await db.query(
      `
      SELECT 
        v.id,
        v.name,
        v.level,
        v.theme,
        v.emoji,
        v.color,
        v.created_at,
        v.active,
        COUNT(w.id)::int AS word_count
      FROM vocabularies v
      LEFT JOIN vocabulary_words w ON w.vocabulary_id = v.id
      WHERE v.level = $1
        AND COALESCE(v.active, true) = true
      GROUP BY 
        v.id,
        v.name,
        v.level,
        v.theme,
        v.emoji,
        v.color,
        v.created_at,
        v.active
      ORDER BY v.created_at DESC
      `,
      [level]
    );

    return result.rows;
  }

  async getAll() {
    const result = await db.query(
      `
      SELECT 
        v.id,
        v.name,
        v.level,
        v.theme,
        v.emoji,
        v.color,
        v.created_at,
        v.active,
        COUNT(w.id)::int AS word_count
      FROM vocabularies v
      LEFT JOIN vocabulary_words w ON w.vocabulary_id = v.id
      WHERE COALESCE(v.active, true) = true
      GROUP BY 
        v.id,
        v.name,
        v.level,
        v.theme,
        v.emoji,
        v.color,
        v.created_at,
        v.active
      ORDER BY v.level ASC, v.created_at DESC
      `
    );

    return result.rows;
  }

  async getById(id) {
    const vocabularyResult = await db.query(
      `
      SELECT 
        id,
        name,
        level,
        theme,
        emoji,
        color,
        created_at,
        active
      FROM vocabularies
      WHERE id = $1
        AND COALESCE(active, true) = true
      `,
      [id]
    );

    if (vocabularyResult.rows.length === 0) {
      return null;
    }

    const vocabulary = vocabularyResult.rows[0];

    const wordsResult = await db.query(
      `
      SELECT 
        id,
        vocabulary_id,
        english,
        spanish,
        audio,
        created_at
      FROM vocabulary_words
      WHERE vocabulary_id = $1
      ORDER BY id ASC
      `,
      [id]
    );

    vocabulary.words = wordsResult.rows;

    return vocabulary;
  }

  async create(data) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const vocabularyResult = await client.query(
        `
        INSERT INTO vocabularies 
          (name, level, theme, emoji, color, active)
        VALUES 
          ($1, $2, $3, $4, $5, true)
        RETURNING id
        `,
        [
          data.name,
          data.level,
          data.theme,
          data.emoji || '',
          data.color || 'from-blue-600 to-blue-800'
        ]
      );

      const vocabularyId = vocabularyResult.rows[0].id;
      const words = Array.isArray(data.words) ? data.words : [];

      for (const word of words) {
        if (!word.english || !word.spanish) continue;

        await client.query(
          `
          INSERT INTO vocabulary_words 
            (vocabulary_id, english, spanish, audio)
          VALUES 
            ($1, $2, $3, $4)
          `,
          [
            vocabularyId,
            word.english,
            word.spanish,
            word.audio || null
          ]
        );
      }

      await client.query('COMMIT');

      return {
        success: true,
        id: vocabularyId
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateVocabulary(id, data) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `
        UPDATE vocabularies
        SET 
          name = $1,
          level = $2,
          theme = $3,
          emoji = $4,
          color = $5
        WHERE id = $6
        `,
        [
          data.name,
          data.level,
          data.theme,
          data.emoji || '',
          data.color || 'from-blue-600 to-blue-800',
          id
        ]
      );

      await client.query(
        `
        DELETE FROM vocabulary_words
        WHERE vocabulary_id = $1
        `,
        [id]
      );

      const words = Array.isArray(data.words) ? data.words : [];

      for (const word of words) {
        if (!word.english || !word.spanish) continue;

        await client.query(
          `
          INSERT INTO vocabulary_words 
            (vocabulary_id, english, spanish, audio)
          VALUES 
            ($1, $2, $3, $4)
          `,
          [
            id,
            word.english,
            word.spanish,
            word.audio || null
          ]
        );
      }

      await client.query('COMMIT');

      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteVocabulary(id) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `
        DELETE FROM activity_results
        WHERE activity_id IN (
          SELECT id 
          FROM activities 
          WHERE vocabulary_id = $1
        )
        `,
        [id]
      );

      await client.query(
        `
        DELETE FROM activities
        WHERE vocabulary_id = $1
        `,
        [id]
      );

      await client.query(
        `
        DELETE FROM vocabulary_words
        WHERE vocabulary_id = $1
        `,
        [id]
      );

      await client.query(
        `
        DELETE FROM vocabularies
        WHERE id = $1
        `,
        [id]
      );

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Vocabulario eliminado correctamente'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new VocabularyModel();