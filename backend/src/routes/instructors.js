const router = require("express").Router();
const { body } = require("express-validator");
const { updateMyProfile } = require("../controllers/instructorController");
const { verifyToken, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

router.use(verifyToken);

router.put(
  "/me",
  requireRole("instructor", "admin"),
  body("department").optional({ nullable: true }).isString(),
  body("qualification").optional({ nullable: true }).isString(),
  validate,
  updateMyProfile,
);

module.exports = router;
