const VocabularyModel = require('../models/VocabularyModel');
const cloudinary = require('../config/cloudinary');

function parseWords(wordsText) {
  try {
    const words = JSON.parse(wordsText || '[]');
    return Array.isArray(words) ? words : [];
  } catch (error) {
    return [];
  }
}

async function uploadAudioToCloudinary(file) {
  if (!file) return '';

  const base64Audio = file.buffer.toString('base64');
  const dataUri = `data:${file.mimetype};base64,${base64Audio}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    resource_type: 'video',
    folder: 'lingualink/audios',
    use_filename: true,
    unique_filename: true
  });

  return result.secure_url;
}

class VocabularyController {
  async getByLevel(req, res) {
    try {
      const { level } = req.query;

      if (!level) {
        return res.status(400).json({
          success: false,
          message: 'El nivel es obligatorio'
        });
      }

      const data = await VocabularyModel.getByLevel(level);

      return res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error getByLevel:', error);

      return res.status(500).json({
        success: false,
        message: 'Error cargando vocabularios',
        detail: error.message
      });
    }
  }

  async getAll(req, res) {
    try {
      const data = await VocabularyModel.getAll();

      return res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error getAll:', error);

      return res.status(500).json({
        success: false,
        message: 'Error cargando vocabularios del profesor',
        detail: error.message
      });
    }
  }

  async getById(req, res) {
    try {
      const vocabulary = await VocabularyModel.getById(req.params.id);

      if (!vocabulary) {
        return res.status(404).json({
          success: false,
          message: 'Vocabulario no encontrado'
        });
      }

      return res.json({
        success: true,
        data: vocabulary
      });
    } catch (error) {
      console.error('Error getById:', error);

      return res.status(500).json({
        success: false,
        message: 'Error cargando el vocabulario',
        detail: error.message
      });
    }
  }

  async create(req, res) {
    try {
      const { name, level, theme, emoji, color } = req.body;
      const files = req.files || [];
      let words = parseWords(req.body.words);

      words = await Promise.all(
        words.map(async (word, index) => {
          const file = files[index];
          const audioUrl = file ? await uploadAudioToCloudinary(file) : '';

          return {
            english: word.english,
            spanish: word.spanish,
            audio: audioUrl
          };
        })
      );

      const result = await VocabularyModel.create({
        name,
        level,
        theme,
        emoji,
        color,
        words
      });

      return res.status(201).json({
        success: true,
        message: 'Vocabulario creado correctamente',
        data: result
      });
    } catch (error) {
      console.error('Error create vocabulary:', error);

      return res.status(500).json({
        success: false,
        message: 'Error creando vocabulario',
        detail: error.message
      });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const files = req.files || [];
      let words = parseWords(req.body.words);

      let audioIndexes = req.body.audioIndex || [];

      if (!Array.isArray(audioIndexes)) {
        audioIndexes = [audioIndexes];
      }

      words = words.map((word) => {
        return {
          english: word.english,
          spanish: word.spanish,
          audio: word.audio || ''
        };
      });

      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        const wordIndex = Number(audioIndexes[fileIndex]);

        if (!isNaN(wordIndex) && words[wordIndex]) {
          const audioUrl = await uploadAudioToCloudinary(file);
          words[wordIndex].audio = audioUrl;
        }
      }

      await VocabularyModel.updateVocabulary(id, {
        ...req.body,
        words
      });

      return res.json({
        success: true,
        message: 'Vocabulario actualizado correctamente'
      });
    } catch (error) {
      console.error('Error update vocabulary:', error);

      return res.status(500).json({
        success: false,
        message: 'Error modificando vocabulario',
        detail: error.message
      });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;

      await VocabularyModel.deleteVocabulary(id);

      return res.json({
        success: true,
        message: 'Vocabulario eliminado correctamente'
      });
    } catch (error) {
      console.error('Error delete vocabulary:', error);

      return res.status(500).json({
        success: false,
        message: 'Error eliminando vocabulario',
        detail: error.message
      });
    }
  }
}

module.exports = new VocabularyController();