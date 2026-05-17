const router = require("express").Router();
const { body, param } = require("express-validator");
const {
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
} = require("../controllers/instructorController");
const { verifyToken, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

// Public — no auth needed
router.get(
  "/:instructorId/public",
  param("instructorId").isInt({ min: 1 }),
  validate,
  getPublicProfile,
);

// Auth-gated below
router.use(verifyToken);

router.get("/me", requireRole("instructor", "admin"), getMyProfile);

router.put(
  "/me",
  requireRole("instructor", "admin"),
  body("department").optional({ nullable: true }).isString(),
  body("qualification").optional({ nullable: true }).isString(),
  validate,
  updateMyProfile,
);

module.exports = router;
