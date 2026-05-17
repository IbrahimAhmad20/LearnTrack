const router = require("express").Router();
const { body, param } = require("express-validator");
const {
  getSectionsByCourse,
  createSection,
  updateSection,
  deleteSection,
  assignContentToSection,
} = require("../controllers/sectionController");
const { verifyToken, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

// GET  /api/v1/sections/course/:courseId  — public
router.get(
  "/course/:courseId",
  param("courseId").isInt({ min: 1 }),
  validate,
  getSectionsByCourse,
);

// All write routes require auth
router.use(verifyToken);

// POST /api/v1/sections/course/:courseId  — instructor/admin
router.post(
  "/course/:courseId",
  requireRole("instructor", "admin"),
  param("courseId").isInt({ min: 1 }),
  body("title").notEmpty().trim(),
  body("sort_order").optional().isInt({ min: 0 }),
  validate,
  createSection,
);

// PATCH /api/v1/sections/content/:contentId/assign  — instructor/admin
router.patch(
  "/content/:contentId/assign",
  requireRole("instructor", "admin"),
  param("contentId").isInt({ min: 1 }),
  body("section_id").optional({ nullable: true }).isInt({ min: 1 }),
  validate,
  assignContentToSection,
);

// PATCH /api/v1/sections/:sectionId  — instructor/admin
router.patch(
  "/:sectionId",
  requireRole("instructor", "admin"),
  param("sectionId").isInt({ min: 1 }),
  body("title").optional().notEmpty().trim(),
  body("sort_order").optional().isInt({ min: 0 }),
  validate,
  updateSection,
);

// DELETE /api/v1/sections/:sectionId  — instructor/admin
router.delete(
  "/:sectionId",
  requireRole("instructor", "admin"),
  param("sectionId").isInt({ min: 1 }),
  validate,
  deleteSection,
);

module.exports = router;
