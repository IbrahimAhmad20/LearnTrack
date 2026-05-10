const router = require('express').Router();
const { body } = require('express-validator');
const {
  getMyEnrollments,
  enroll,
  updateEnrollmentStatus,
  unenroll,
} = require('../controllers/enrollmentController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(verifyToken);

// GET  /api/v1/enrollments/my      → student sees their own enrolled courses
router.get('/my', requireRole('student'), getMyEnrollments);

// POST /api/v1/enrollments/:courseId  → student enrolls in a course
router.post(
  '/:courseId',
  requireRole('student'),
  validate,
  enroll
);

// PATCH /api/v1/enrollments/:enrollmentId/status → update status (student or admin)
router.patch(
  '/:enrollmentId/status',
  requireRole('student', 'admin'),
  body('status_name').isIn(['active', 'completed', 'dropped']),
  validate,
  updateEnrollmentStatus
);

// DELETE /api/v1/enrollments/:enrollmentId → hard delete (admin only)
router.delete('/:enrollmentId', requireRole('admin'), unenroll);

module.exports = router;
