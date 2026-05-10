const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, logout } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// POST /api/v1/auth/register
router.post(
  '/register',
  body('full_name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').optional().isIn(['student', 'instructor', 'admin']),
  body('admin_code').optional().isString().trim(),
  body('department').optional().isString().trim(),
  body('qualification').optional().isString().trim(),
  validate,
  register
);

// POST /api/v1/auth/login
router.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
  login
);

// POST /api/v1/auth/logout  (requires valid token)
router.post('/logout', verifyToken, logout);

module.exports = router;
