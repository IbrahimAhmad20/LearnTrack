const router = require("express").Router();
const { body, param, query } = require("express-validator");
const {
  getMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
  createNotification,
} = require("../controllers/notificationController");
const { verifyToken, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

router.use(verifyToken);

// GET  /api/v1/notifications/me/unread-count
router.get("/me/unread-count", getUnreadCount);

// GET  /api/v1/notifications/me
router.get(
  "/me",
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("unread").optional().isBoolean(),
  validate,
  getMyNotifications,
);

// PATCH /api/v1/notifications/me/read-all
router.patch("/me/read-all", markAllRead);

// PATCH /api/v1/notifications/:notifId/read
router.patch(
  "/:notifId/read",
  param("notifId").isInt({ min: 1 }),
  validate,
  markRead,
);

// DELETE /api/v1/notifications/:notifId
router.delete(
  "/:notifId",
  param("notifId").isInt({ min: 1 }),
  validate,
  deleteNotification,
);

// POST /api/v1/notifications — admin broadcast/targeted
router.post(
  "/",
  requireRole("admin"),
  body("user_id").notEmpty(),
  body("type").isIn([
    "new_content",
    "quiz_graded",
    "announcement",
    "enrollment_complete",
    "certificate_issued",
    "review_received",
  ]),
  body("body").notEmpty().trim(),
  body("ref_course_id").optional({ nullable: true }).isInt({ min: 1 }),
  body("ref_content_id").optional({ nullable: true }).isInt({ min: 1 }),
  validate,
  createNotification,
);

module.exports = router;
