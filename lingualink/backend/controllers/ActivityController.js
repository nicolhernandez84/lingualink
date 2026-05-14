const ActivityModel = require('../models/ActivityModel');

class ActivityController {
  async publishActivity(req, res) {
    try {
      const {
        vocabulary_id,
        activity_type,
        title,
        instructions
      } = req.body;

      if (!vocabulary_id || !activity_type || !title) {
        return res.status(400).json({
          success: false,
          message: 'Faltan datos para publicar la actividad'
        });
      }

      if (!['complete', 'matching'].includes(activity_type)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de actividad no válido'
        });
      }

      const activity = await ActivityModel.createActivity({
        vocabulary_id,
        activity_type,
        title,
        instructions
      });

      return res.status(201).json({
        success: true,
        message: 'Actividad publicada correctamente',
        data: activity
      });

    } catch (error) {
      console.error('Error publicando actividad:', error);

      return res.status(500).json({
        success: false,
        message: 'Error publicando actividad',
        detail: error.message
      });
    }
  }

  async getPublishedActivities(req, res) {
    try {
      const { level } = req.query;

      const activities = await ActivityModel.getPublishedActivities(level);

      return res.json({
        success: true,
        data: activities
      });

    } catch (error) {
      console.error('Error obteniendo actividades:', error);

      return res.status(500).json({
        success: false,
        message: 'Error obteniendo actividades',
        detail: error.message
      });
    }
  }

  async getActivityById(req, res) {
    try {
      const { id } = req.params;

      const activity = await ActivityModel.getActivityById(id);

      if (!activity) {
        return res.status(404).json({
          success: false,
          message: 'Actividad no encontrada'
        });
      }

      return res.json({
        success: true,
        data: activity
      });

    } catch (error) {
      console.error('Error obteniendo actividad:', error);

      return res.status(500).json({
        success: false,
        message: 'Error obteniendo actividad',
        detail: error.message
      });
    }
  }

  async deleteActivity(req, res) {
    try {
      const { id } = req.params;

      await ActivityModel.deleteActivity(id);

      return res.json({
        success: true,
        message: 'Actividad eliminada correctamente'
      });

    } catch (error) {
      console.error('Error eliminando actividad:', error);

      return res.status(500).json({
        success: false,
        message: 'Error eliminando actividad',
        detail: error.message
      });
    }
  }

  async saveActivityResult(req, res) {
    try {
      const { id } = req.params;

      const {
        student_id,
        score,
        total_questions,
        percentage,
        answers
      } = req.body;

      if (
        !student_id ||
        score === undefined ||
        !total_questions ||
        percentage === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: 'Faltan datos para guardar el resultado'
        });
      }

      const result = await ActivityModel.saveActivityResult(id, {
        student_id: Number(student_id),
        score: Number(score),
        total_questions: Number(total_questions),
        percentage: Number(percentage),
        answers: answers || []
      });

      return res.status(201).json({
        success: true,
        message: 'Resultado guardado correctamente',
        data: result
      });

    } catch (error) {
      console.error('Error guardando resultado:', error);

      return res.status(500).json({
        success: false,
        message: 'Error guardando resultado',
        detail: error.message
      });
    }
  }

  async getStudentProgress(req, res) {
    try {
      const { studentId } = req.params;

      const progress = await ActivityModel.getStudentProgress(studentId);

      return res.json({
        success: true,
        data: progress
      });

    } catch (error) {
      console.error('Error obteniendo progreso:', error);

      return res.status(500).json({
        success: false,
        message: 'Error obteniendo progreso',
        detail: error.message
      });
    }
  }

  async translationQuiz(req, res) {
    try {
      const { id } = req.params;

      const words = await ActivityModel.getVocabularyWords(id);

      if (!words || words.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Este vocabulario no tiene palabras registradas'
        });
      }

      const quiz = words.map(word => {
        let options = words
          .filter(w => w.spanish !== word.spanish)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map(w => w.spanish);

        options.push(word.spanish);

        return {
          english: word.english,
          correct: word.spanish,
          options: options.sort(() => 0.5 - Math.random())
        };
      });

      return res.json({
        success: true,
        data: quiz
      });

    } catch (error) {
      console.error('Error generando quiz:', error);

      return res.status(500).json({
        success: false,
        message: 'Error generando quiz',
        detail: error.message
      });
    }
  }

  async matchingGame(req, res) {
    try {
      const { id } = req.params;

      const words = await ActivityModel.getVocabularyWords(id);

      if (!words || words.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Este vocabulario no tiene palabras registradas'
        });
      }

      const english = words.map(w => ({
        id: w.id,
        text: w.english,
        answer: w.spanish
      }));

      const spanish = words
        .map(w => ({
          id: w.id,
          text: w.spanish
        }))
        .sort(() => 0.5 - Math.random());

      return res.json({
        success: true,
        data: {
          english,
          spanish
        }
      });

    } catch (error) {
      console.error('Error generando actividad:', error);

      return res.status(500).json({
        success: false,
        message: 'Error generando actividad',
        detail: error.message
      });
    }
  }
}

module.exports = new ActivityController();