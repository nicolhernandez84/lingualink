const db = require('../config/db');

class ActivityModel {
  async getVocabularyWords(vocabularyId) {
    const result = await db.query(
      `
      SELECT 
        w.id,
        w.english,
        w.spanish
      FROM vocabulary_words w
      INNER JOIN vocabularies v ON v.id = w.vocabulary_id
      WHERE w.vocabulary_id = $1
        AND COALESCE(v.active, true) = true
      ORDER BY w.id ASC
      `,
      [vocabularyId]
    );

    return result.rows;
  }

  async createActivity(data) {
    const result = await db.query(
      `
      INSERT INTO activities 
        (vocabulary_id, activity_type, title, instructions, active)
      VALUES 
        ($1, $2, $3, $4, true)
      RETURNING 
        id,
        vocabulary_id,
        activity_type,
        title,
        instructions,
        active,
        created_at
      `,
      [
        data.vocabulary_id,
        data.activity_type,
        data.title,
        data.instructions || null
      ]
    );

    return result.rows[0];
  }

  async getPublishedActivities(level = null) {
    let query = `
      SELECT 
        a.id,
        a.vocabulary_id,
        a.activity_type,
        a.title,
        a.instructions,
        a.active,
        a.created_at,
        v.name AS vocabulary_name,
        v.level,
        v.theme,
        v.emoji,
        v.color
      FROM activities a
      INNER JOIN vocabularies v ON v.id = a.vocabulary_id
      WHERE COALESCE(a.active, true) = true
        AND COALESCE(v.active, true) = true
    `;

    const params = [];

    if (level) {
      params.push(level);
      query += ` AND v.level = $1 `;
    }

    query += ` ORDER BY a.created_at DESC `;

    const result = await db.query(query, params);
    return result.rows;
  }

  async getActivityById(activityId) {
    const activityResult = await db.query(
      `
      SELECT 
        a.id,
        a.vocabulary_id,
        a.activity_type,
        a.title,
        a.instructions,
        a.active,
        a.created_at,
        v.name AS vocabulary_name,
        v.level,
        v.theme,
        v.emoji,
        v.color
      FROM activities a
      INNER JOIN vocabularies v ON v.id = a.vocabulary_id
      WHERE a.id = $1
        AND COALESCE(a.active, true) = true
        AND COALESCE(v.active, true) = true
      `,
      [activityId]
    );

    if (activityResult.rows.length === 0) {
      return null;
    }

    const activity = activityResult.rows[0];

    const wordsResult = await db.query(
      `
      SELECT 
        id,
        english,
        spanish
      FROM vocabulary_words
      WHERE vocabulary_id = $1
      ORDER BY id ASC
      `,
      [activity.vocabulary_id]
    );

    activity.words = wordsResult.rows;

    return activity;
  }

  async deleteActivity(activityId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `
        DELETE FROM student_progress sp
        USING activity_results ar, activities a, vocabularies v
        WHERE ar.student_id = sp.student_id
          AND a.id = ar.activity_id
          AND v.id = a.vocabulary_id
          AND v.level = sp.level
          AND ar.activity_id = $1
        `,
        [activityId]
      );

      await client.query(
        `
        DELETE FROM activity_results
        WHERE activity_id = $1
        `,
        [activityId]
      );

      const result = await client.query(
        `
        DELETE FROM activities
        WHERE id = $1
        `,
        [activityId]
      );

      await client.query('COMMIT');

      return result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async saveActivityResult(activityId, data) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const activityResult = await client.query(
        `
        SELECT 
          a.id,
          v.level
        FROM activities a
        INNER JOIN vocabularies v ON v.id = a.vocabulary_id
        WHERE a.id = $1
          AND COALESCE(a.active, true) = true
          AND COALESCE(v.active, true) = true
        `,
        [activityId]
      );

      if (activityResult.rows.length === 0) {
        throw new Error('Actividad no encontrada o inactiva');
      }

      const activity = activityResult.rows[0];
      const answersJson = JSON.stringify(data.answers || []);

      const resultInsert = await client.query(
        `
        INSERT INTO activity_results 
          (activity_id, student_id, score, total_questions, percentage, answers_json)
        VALUES 
          ($1, $2, $3, $4, $5, $6)
        RETURNING id
        `,
        [
          activityId,
          data.student_id,
          data.score,
          data.total_questions,
          data.percentage,
          answersJson
        ]
      );

      const summaryResult = await client.query(
        `
        WITH ranked_results AS (
          SELECT 
            ar.activity_id,
            ar.score,
            ar.total_questions,
            ar.percentage,
            ROW_NUMBER() OVER (
              PARTITION BY ar.activity_id
              ORDER BY ar.completed_at DESC
            ) AS rn
          FROM activity_results ar
          INNER JOIN activities a ON a.id = ar.activity_id
          INNER JOIN vocabularies v ON v.id = a.vocabulary_id
          WHERE ar.student_id = $1
            AND v.level = $2
            AND COALESCE(a.active, true) = true
            AND COALESCE(v.active, true) = true
        )
        SELECT 
          COUNT(*)::int AS completed_activities,
          COALESCE(SUM(score), 0)::int AS total_score,
          COALESCE(SUM(total_questions), 0)::int AS total_questions,
          ROUND(
            CASE 
              WHEN COALESCE(SUM(total_questions), 0) = 0 THEN 0
              ELSE 
                (
                  COALESCE(SUM(score), 0)::numeric / 
                  COALESCE(SUM(total_questions), 0)::numeric
                ) * 100
            END,
            2
          ) AS progress_percentage
        FROM ranked_results
        WHERE rn = 1
        `,
        [data.student_id, activity.level]
      );

      const summary = summaryResult.rows[0];

      await client.query(
        `
        INSERT INTO student_progress 
          (
            student_id,
            level,
            completed_activities,
            total_score,
            total_questions,
            progress_percentage,
            updated_at
          )
        VALUES 
          ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (student_id, level)
        DO UPDATE SET
          completed_activities = EXCLUDED.completed_activities,
          total_score = EXCLUDED.total_score,
          total_questions = EXCLUDED.total_questions,
          progress_percentage = EXCLUDED.progress_percentage,
          updated_at = NOW()
        `,
        [
          data.student_id,
          activity.level,
          summary.completed_activities,
          summary.total_score,
          summary.total_questions,
          Number(summary.progress_percentage || 0)
        ]
      );

      await client.query('COMMIT');

      return {
        result_id: resultInsert.rows[0].id,
        progress: {
          level: activity.level,
          completed_activities: summary.completed_activities,
          total_score: summary.total_score,
          total_questions: summary.total_questions,
          progress_percentage: Number(summary.progress_percentage || 0)
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getStudentProgress(studentId) {
    const result = await db.query(
      `
      WITH best_results AS (
        SELECT 
          ar.activity_id,
          ar.student_id,
          ar.score,
          ar.total_questions,
          ar.percentage,
          ar.completed_at,
          a.title,
          a.activity_type,
          v.name AS vocabulary_name,
          v.level,
          v.color,
          ROW_NUMBER() OVER (
            PARTITION BY ar.activity_id
            ORDER BY ar.completed_at DESC
          ) AS rn
        FROM activity_results ar
        INNER JOIN activities a ON a.id = ar.activity_id
        INNER JOIN vocabularies v ON v.id = a.vocabulary_id
        WHERE ar.student_id = $1
          AND COALESCE(a.active, true) = true
          AND COALESCE(v.active, true) = true
      )
      SELECT 
        activity_id,
        title,
        activity_type,
        vocabulary_name,
        level,
        color,
        score,
        total_questions,
        percentage,
        completed_at
      FROM best_results
      WHERE rn = 1
      ORDER BY level ASC, completed_at DESC
      `,
      [studentId]
    );

    return result.rows;
  }
}

module.exports = new ActivityModel();