const router = require("express").Router();
const { param } = require("express-validator");
const { verifyToken, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const {
  uploadAvatar,
  uploadThumbnail,
  uploadCourseFile,
  deleteCourseFile,
  listCourseFiles,
} = require("../controllers/uploadController");
const {
  avatarUpload,
  thumbnailUpload,
  contentUpload,
} = require("../middleware/upload");

router.use(verifyToken);

// ── POST /api/v1/uploads/avatar
// Any authenticated user uploads their own avatar
router.post("/avatar", avatarUpload.single("file"), uploadAvatar);

// ── POST /api/v1/uploads/courses/:courseId/thumbnail
// Instructor uploads a course thumbnail (must own course)
router.post(
  "/courses/:courseId/thumbnail",
  requireRole("instructor", "admin"),
  param("courseId").isInt({ min: 1 }),
  validate,
  thumbnailUpload.single("file"),
  uploadThumbnail,
);

// ── GET /api/v1/uploads/courses/:courseId/files
// List files attached to a course (instructor or enrolled student)
router.get(
  "/courses/:courseId/files",
  param("courseId").isInt({ min: 1 }),
  validate,
  listCourseFiles,
);
router.post(
  "/courses/:courseId/files",
  requireRole("instructor", "admin"),
  param("courseId").isInt({ min: 1 }),
  validate,
  contentUpload.single("file"),
  uploadCourseFile,
);

// ── DELETE /api/v1/uploads/courses/:courseId/files/:fileId
// Instructor deletes a course file
router.delete(
  "/courses/:courseId/files/:fileId",
  requireRole("instructor", "admin"),
  param("courseId").isInt({ min: 1 }),
  param("fileId").isInt({ min: 1 }),
  validate,
  deleteCourseFile,
);

module.exports = router;
