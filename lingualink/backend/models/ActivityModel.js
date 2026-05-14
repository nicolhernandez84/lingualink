const { getConnection, sql } = require('../config/db');

class ActivityModel {
  async getVocabularyWords(vocabularyId) {
    const pool = await getConnection();

    const result = await pool.request()
      .input('id', sql.Int, vocabularyId)
      .query(`
        SELECT 
          w.id, 
          w.english, 
          w.spanish
        FROM VocabularyWords w
        INNER JOIN Vocabularies v ON v.id = w.vocabulary_id
        WHERE 
          w.vocabulary_id = @id
          AND ISNULL(v.active, 1) = 1
        ORDER BY w.id ASC
      `);

    return result.recordset;
  }

  async createActivity(data) {
    const pool = await getConnection();

    const result = await pool.request()
      .input('vocabulary_id', sql.Int, data.vocabulary_id)
      .input('activity_type', sql.VarChar, data.activity_type)
      .input('title', sql.NVarChar, data.title)
      .input('instructions', sql.NVarChar, data.instructions || null)
      .query(`
        INSERT INTO Activities
        (vocabulary_id, activity_type, title, instructions, active)
        OUTPUT INSERTED.id
        VALUES
        (@vocabulary_id, @activity_type, @title, @instructions, 1)
      `);

    return result.recordset[0];
  }

  async getPublishedActivities(level = null) {
    const pool = await getConnection();

    const result = await pool.request()
      .input('level', sql.VarChar, level || null)
      .query(`
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
        FROM Activities a
        INNER JOIN Vocabularies v ON v.id = a.vocabulary_id
        WHERE 
          ISNULL(a.active, 1) = 1
          AND ISNULL(v.active, 1) = 1
          AND (@level IS NULL OR v.level = @level)
        ORDER BY a.created_at DESC
      `);

    return result.recordset;
  }

  async getActivityById(activityId) {
    const pool = await getConnection();

    const activityResult = await pool.request()
      .input('id', sql.Int, activityId)
      .query(`
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
        FROM Activities a
        INNER JOIN Vocabularies v ON v.id = a.vocabulary_id
        WHERE 
          a.id = @id
          AND ISNULL(a.active, 1) = 1
          AND ISNULL(v.active, 1) = 1
      `);

    if (activityResult.recordset.length === 0) {
      return null;
    }

    const activity = activityResult.recordset[0];

    const wordsResult = await pool.request()
      .input('vocabulary_id', sql.Int, activity.vocabulary_id)
      .query(`
        SELECT 
          id,
          english,
          spanish
        FROM VocabularyWords
        WHERE vocabulary_id = @vocabulary_id
        ORDER BY id ASC
      `);

    activity.words = wordsResult.recordset;

    return activity;
  }

 async deleteActivity(activityId) {
  const pool = await getConnection();
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // 1. BORRAR PROGRESO DEL ESTUDIANTE ANTES DE BORRAR RESULTADOS
    await transaction.request()
      .input('id', sql.Int, activityId)
      .query(`
        DELETE SP
        FROM StudentProgress SP
        INNER JOIN ActivityResults AR
          ON AR.student_id = SP.student_id
        INNER JOIN Activities A
          ON A.id = AR.activity_id
        INNER JOIN Vocabularies V
          ON V.id = A.vocabulary_id
          AND V.level = SP.level
        WHERE AR.activity_id = @id
      `);

    // 2. BORRAR RESULTADOS DE LA ACTIVIDAD
    await transaction.request()
      .input('id', sql.Int, activityId)
      .query(`
        DELETE FROM ActivityResults
        WHERE activity_id = @id
      `);

    // 3. BORRAR ACTIVIDAD
    const result = await transaction.request()
      .input('id', sql.Int, activityId)
      .query(`
        DELETE FROM Activities
        WHERE id = @id
      `);

    await transaction.commit();

    return result.rowsAffected[0] > 0;

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

  async saveActivityResult(activityId, data) {
    const pool = await getConnection();
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      const activityResult = await transaction.request()
        .input('activity_id', sql.Int, activityId)
        .query(`
          SELECT 
            a.id,
            v.level
          FROM Activities a
          INNER JOIN Vocabularies v ON v.id = a.vocabulary_id
          WHERE 
            a.id = @activity_id
            AND ISNULL(a.active, 1) = 1
            AND ISNULL(v.active, 1) = 1
        `);

      if (activityResult.recordset.length === 0) {
        throw new Error('Actividad no encontrada o inactiva');
      }

      const activity = activityResult.recordset[0];

      const answersJson = JSON.stringify(data.answers || []);

      const resultInsert = await transaction.request()
        .input('activity_id', sql.Int, activityId)
        .input('student_id', sql.Int, data.student_id)
        .input('score', sql.Int, data.score)
        .input('total_questions', sql.Int, data.total_questions)
        .input('percentage', sql.Decimal(5, 2), data.percentage)
        .input('answers_json', sql.NVarChar, answersJson)
        .query(`
          INSERT INTO ActivityResults
          (activity_id, student_id, score, total_questions, percentage, answers_json)
          OUTPUT INSERTED.id
          VALUES
          (@activity_id, @student_id, @score, @total_questions, @percentage, @answers_json)
        `);

      const summaryResult = await transaction.request()
        .input('student_id', sql.Int, data.student_id)
        .input('level', sql.VarChar, activity.level)
        .query(`
          WITH RankedResults AS (
            SELECT 
              ar.activity_id,
              ar.score,
              ar.total_questions,
              ar.percentage,
              ROW_NUMBER() OVER (
                PARTITION BY ar.activity_id 
                ORDER BY ar.completed_at DESC
              ) AS rn
            FROM ActivityResults ar
            INNER JOIN Activities a ON a.id = ar.activity_id
            INNER JOIN Vocabularies v ON v.id = a.vocabulary_id
            WHERE 
              ar.student_id = @student_id
              AND v.level = @level
              AND ISNULL(a.active, 1) = 1
              AND ISNULL(v.active, 1) = 1
          )
          SELECT
            COUNT(*) AS completed_activities,
            ISNULL(SUM(score), 0) AS total_score,
            ISNULL(SUM(total_questions), 0) AS total_questions,
            CAST(
              CASE 
                WHEN ISNULL(SUM(total_questions), 0) = 0 THEN 0
                ELSE (CAST(ISNULL(SUM(score), 0) AS DECIMAL(10,2)) / ISNULL(SUM(total_questions), 0)) * 100
              END 
            AS DECIMAL(5,2)) AS progress_percentage
          FROM RankedResults
          WHERE rn = 1
        `);

      const summary = summaryResult.recordset[0];

      const existingProgress = await transaction.request()
        .input('student_id', sql.Int, data.student_id)
        .input('level', sql.VarChar, activity.level)
        .query(`
          SELECT id
          FROM StudentProgress
          WHERE student_id = @student_id AND level = @level
        `);

      if (existingProgress.recordset.length > 0) {
        await transaction.request()
          .input('student_id', sql.Int, data.student_id)
          .input('level', sql.VarChar, activity.level)
          .input('completed_activities', sql.Int, summary.completed_activities)
          .input('total_score', sql.Int, summary.total_score)
          .input('total_questions', sql.Int, summary.total_questions)
          .input('progress_percentage', sql.Decimal(5, 2), Number(summary.progress_percentage || 0))
          .query(`
            UPDATE StudentProgress
            SET
              completed_activities = @completed_activities,
              total_score = @total_score,
              total_questions = @total_questions,
              progress_percentage = @progress_percentage,
              updated_at = GETDATE()
            WHERE student_id = @student_id AND level = @level
          `);
      } else {
        await transaction.request()
          .input('student_id', sql.Int, data.student_id)
          .input('level', sql.VarChar, activity.level)
          .input('completed_activities', sql.Int, summary.completed_activities)
          .input('total_score', sql.Int, summary.total_score)
          .input('total_questions', sql.Int, summary.total_questions)
          .input('progress_percentage', sql.Decimal(5, 2), Number(summary.progress_percentage || 0))
          .query(`
            INSERT INTO StudentProgress
            (student_id, level, completed_activities, total_score, total_questions, progress_percentage)
            VALUES
            (@student_id, @level, @completed_activities, @total_score, @total_questions, @progress_percentage)
          `);
      }

      await transaction.commit();

      return {
        result_id: resultInsert.recordset[0].id,
        progress: {
          level: activity.level,
          completed_activities: summary.completed_activities,
          total_score: summary.total_score,
          total_questions: summary.total_questions,
          progress_percentage: Number(summary.progress_percentage || 0)
        }
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getStudentProgress(studentId) {
  const pool = await getConnection();

  const result = await pool.request()
    .input('student_id', sql.Int, studentId)
    .query(`
      WITH BestResults AS (
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
        FROM ActivityResults ar
        INNER JOIN Activities a ON a.id = ar.activity_id
        INNER JOIN Vocabularies v ON v.id = a.vocabulary_id
        WHERE ar.student_id = @student_id
          AND ISNULL(a.active, 1) = 1
          AND ISNULL(v.active, 1) = 1
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
      FROM BestResults
      WHERE rn = 1
      ORDER BY level ASC, completed_at DESC
    `);

  return result.recordset;
}
}
module.exports = new ActivityModel();