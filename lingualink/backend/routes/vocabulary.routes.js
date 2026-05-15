const express = require('express');
const router = express.Router();
const VocabularyController = require('../controllers/VocabularyController');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9.-]/g, '');

    const uniqueName = Date.now() + '-' + safeName;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
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