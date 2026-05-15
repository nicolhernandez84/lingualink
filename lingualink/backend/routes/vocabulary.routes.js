const express = require('express');
const router = express.Router();
const VocabularyController = require('../controllers/VocabularyController');

const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();

    if (extension !== '.mp3') {
      return cb(new Error('Solo se permiten archivos MP3'));
    }

    cb(null, true);
  }
});

router.get('/vocabularies', VocabularyController.getByLevel.bind(VocabularyController));
router.get('/teacher/vocabularies', VocabularyController.getAll.bind(VocabularyController));
router.get('/vocabulary/:id', VocabularyController.getById.bind(VocabularyController));

router.post(
  '/vocabulary',
  upload.array('audios'),
  VocabularyController.create.bind(VocabularyController)
);

router.put(
  '/vocabulary/:id',
  upload.array('audios'),
  VocabularyController.update.bind(VocabularyController)
);

router.delete('/vocabulary/:id', VocabularyController.delete.bind(VocabularyController));

module.exports = router;