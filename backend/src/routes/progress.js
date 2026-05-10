const router = require('express').Router();
const { body } = require('express-validator');
const { getMyProgress, updateProgress } = require('../controllers/progressController');
const { verifyToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(verifyToken);

router.get('/me', getMyProgress);

router.put('/:contentId',
  body('progress_percent').isFloat({ min: 0, max: 100 }),
  validate,
  updateProgress
);

module.exports = router;
