const router = require('express').Router();
const { body } = require('express-validator');
const { getMe, updateMe, listUsers, deleteUser, setUserStatus } = require('../controllers/userController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// All routes require authentication
router.use(verifyToken);

router.get('/me', getMe);

router.put('/me',
  body('full_name').optional().trim().notEmpty(),
  body('password').optional().isLength({ min: 8 }),
  body('avatar_url').optional().isURL(),
  validate,
  updateMe
);

// Admin-only routes
router.get('/',         requireRole('admin'), listUsers);
router.delete('/:id',  requireRole('admin'), deleteUser);
router.put('/:id/status', requireRole('admin'),
  body('is_active').isBoolean(),
  validate,
  setUserStatus
);

module.exports = router;
