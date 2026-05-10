const router = require('express').Router();
const { body } = require('express-validator');
const {
  listCourses,
  listMyCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseContent,
  addContent,
  updateContent,
  deleteContent,
  getCourseStudents,
} = require('../controllers/courseController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(verifyToken);

// Course CRUD
router.get('/', listCourses);
router.get('/mine', requireRole('instructor', 'admin'), listMyCourses);
router.get('/:id', getCourse);

router.post('/',
  requireRole('instructor', 'admin'),
  body('title').notEmpty().trim(),
  body('category').optional().trim(),
  validate,
  createCourse
);

router.put('/:id',
  requireRole('instructor', 'admin'),
  body('title').optional().trim().notEmpty(),
  validate,
  updateCourse
);

router.delete('/:id', requireRole('admin'), deleteCourse);

// Content endpoints
router.get('/:id/content', getCourseContent);

router.post('/:id/content',
  requireRole('instructor', 'admin'),
  body('title').notEmpty().trim(),
  body('content_type').isIn(['video', 'document', 'quiz']),
  body('content_url').optional({ nullable: true }).isURL(),
  body('content_body').optional({ nullable: true }).isString(),
  validate,
  addContent
);

router.put('/:id/content/:contentId',
  requireRole('instructor', 'admin'),
  body('title').optional().trim().notEmpty(),
  body('content_type').optional().isIn(['video', 'document', 'quiz']),
  body('content_url').optional({ nullable: true }).isURL(),
  body('content_body').optional({ nullable: true }).isString(),
  validate,
  updateContent
);

router.delete('/:id/content/:contentId',
  requireRole('instructor', 'admin'),
  deleteContent
);

// Students list (instructor + admin)
router.get('/:id/students', requireRole('instructor', 'admin'), getCourseStudents);

module.exports = router;
