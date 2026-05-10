const router = require('express').Router();
const { body } = require('express-validator');
const { logActivity } = require('../controllers/activityController');
const { verifyToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(verifyToken);

router.post('/',
  body('content_id').isInt({ min: 1 }),
  body('event_type').isIn(['play', 'pause', 'skip', 'seek', 'complete']),
  body('watch_time').optional().isInt({ min: 0 }),
  validate,
  logActivity
);

module.exports = router;
