const router = require("express").Router();
const { body, param, query } = require("express-validator");
const {
  getReviewsByCourse,
  getCourseSummary,
  createReview,
  updateReview,
  deleteReview,
  getInstructorReviews,
} = require("../controllers/reviewController");
const { verifyToken, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

// Public routes
router.get(
  "/course/:courseId",
  param("courseId").isInt({ min: 1 }),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
  validate,
  getReviewsByCourse,
);

router.get(
  "/course/:courseId/summary",
  param("courseId").isInt({ min: 1 }),
  validate,
  getCourseSummary,
);

// Auth-gated routes
router.use(verifyToken);

// GET /api/v1/reviews/instructor/mine — instructor only
router.get(
  "/instructor/mine",
  requireRole("instructor", "admin"),
  getInstructorReviews,
);

// POST /api/v1/reviews/course/:courseId — student only
router.post(
  "/course/:courseId",
  requireRole("student"),
  param("courseId").isInt({ min: 1 }),
  body("rating").isInt({ min: 1, max: 5 }),
  body("body").optional().isString().trim(),
  validate,
  createReview,
);

// PATCH /api/v1/reviews/:reviewId
router.patch(
  "/:reviewId",
  requireRole("student", "admin"),
  param("reviewId").isInt({ min: 1 }),
  body("rating").optional().isInt({ min: 1, max: 5 }),
  body("body").optional().isString().trim(),
  validate,
  updateReview,
);

// DELETE /api/v1/reviews/:reviewId
router.delete(
  "/:reviewId",
  requireRole("student", "admin"),
  param("reviewId").isInt({ min: 1 }),
  validate,
  deleteReview,
);

module.exports = router;
