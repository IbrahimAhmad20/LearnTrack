const router = require('express').Router();
const { body } = require('express-validator');
const {
  getQuiz,
  createQuiz,
  addQuestion,
  getQuestionTypes,
  listMyAttempts,
  submitAttempt,
  getAttemptReview,
  updateQuiz,
} = require('../controllers/quizController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(verifyToken);

// Utility — must come before /:id to avoid route collision
router.get('/question-types', getQuestionTypes);

// v2: attempt review — must also come before /:id
router.get('/attempts/me', requireRole('student'), listMyAttempts);
router.get('/attempts/:attemptId', getAttemptReview);

router.patch(
  '/:id',
  requireRole('instructor', 'admin'),
  body('title').optional().trim().notEmpty(),
  body('pass_score').optional().isFloat({ min: 0, max: 100 }),
  body('allow_multiple').optional().isBoolean(),
  body('time_limit_min').optional({ nullable: true }).isInt({ min: 1 }),
  body('is_published').optional().isBoolean(),
  validate,
  updateQuiz
);

router.get('/:id', getQuiz);

router.post(
  '/',
  requireRole('instructor', 'admin'),
  body('course_id').isInt({ min: 1 }),
  body('title').notEmpty().trim(),
  body('pass_score').optional().isFloat({ min: 0, max: 100 }),
  body('allow_multiple').optional().isBoolean(),
  body('time_limit_min').optional({ nullable: true }).isInt({ min: 1 }),
  body('is_published').optional().isBoolean(),
  validate,
  createQuiz
);

// v2: body shape changed — options array replaces option_a/b/c/d + correct_answer
router.post(
  '/:id/questions',
  requireRole('instructor', 'admin'),
  body('question_type').isIn(['mcq', 'true_false']),
  body('question_text').notEmpty(),
  body('options').isArray({ min: 2 }),
  body('options.*.option_text').notEmpty(),
  body('options.*.is_correct').isBoolean(),
  validate,
  addQuestion
);

// v2: answers is array of { question_id, option_id } — not { selected_answer: 'A' }
router.post(
  '/:id/attempt',
  requireRole('student'),
  body('answers').isArray({ min: 1 }),
  body('answers.*.question_id').isInt({ min: 1 }),
  body('answers.*.option_id').isInt({ min: 1 }),
  validate,
  submitAttempt
);

module.exports = router;
