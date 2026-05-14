const express = require('express');
const router = express.Router();

const ActivityController = require('../controllers/ActivityController');

router.post('/', ActivityController.publishActivity.bind(ActivityController));

router.get('/', ActivityController.getPublishedActivities.bind(ActivityController));

router.get('/progress/:studentId', ActivityController.getStudentProgress.bind(ActivityController));

router.get('/:id', ActivityController.getActivityById.bind(ActivityController));

router.delete('/:id', ActivityController.deleteActivity.bind(ActivityController));

router.post('/:id/result', ActivityController.saveActivityResult.bind(ActivityController));

router.get('/quiz/:id', ActivityController.translationQuiz.bind(ActivityController));

router.get('/matching/:id', ActivityController.matchingGame.bind(ActivityController));

module.exports = router;