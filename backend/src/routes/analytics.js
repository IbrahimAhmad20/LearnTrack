const router = require('express').Router();
const {
  activeStudents, underperforming, skippedContent,
  completionRates, performanceTrend, adminDashboard,
  instructorDashboard, refreshSummary,
} = require('../controllers/analyticsController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);

// Instructor & Admin
router.get('/active-students',   requireRole('instructor', 'admin'), activeStudents);
router.get('/underperforming',   requireRole('instructor', 'admin'), underperforming);
router.get('/skipped-content',   requireRole('instructor', 'admin'), skippedContent);
router.get('/completion-rates',  requireRole('instructor', 'admin'), completionRates);
router.get('/performance-trend/:userId', requireRole('student', 'instructor', 'admin'), performanceTrend);

// Instructor dashboard per course
router.get('/instructor/:courseId', requireRole('instructor', 'admin'), instructorDashboard);

// Admin only
router.get('/dashboard/admin',   requireRole('admin'), adminDashboard);
router.post('/refresh-summary',  requireRole('admin'), refreshSummary);

module.exports = router;
