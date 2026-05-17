const router = require("express").Router();
const { body, param, query } = require("express-validator");
const {
  getMyTransactions,
  createTransaction,
  getInstructorEarnings,
  getAllTransactions,
  refundTransaction,
} = require("../controllers/transactionController");
const { verifyToken, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

router.use(verifyToken);

// GET  /api/v1/transactions/my                — student
router.get("/my", requireRole("student"), getMyTransactions);

// GET  /api/v1/transactions/instructor/earnings — instructor/admin
router.get(
  "/instructor/earnings",
  requireRole("instructor", "admin"),
  getInstructorEarnings,
);

// GET  /api/v1/transactions                    — admin
router.get(
  "/",
  requireRole("admin"),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("status")
    .optional()
    .isIn(["pending", "completed", "failed", "refunded"]),
  validate,
  getAllTransactions,
);

// POST /api/v1/transactions                    — student
router.post(
  "/",
  requireRole("student"),
  body("course_id").isInt({ min: 1 }),
  body("amount").isNumeric(),
  body("currency").optional().isString().isLength({ min: 2, max: 10 }),
  body("payment_method").optional().isString(),
  body("provider_ref").optional().isString(),
  validate,
  createTransaction,
);

// POST /api/v1/transactions/:transactionId/refund — admin
router.post(
  "/:transactionId/refund",
  requireRole("admin"),
  param("transactionId").isInt({ min: 1 }),
  validate,
  refundTransaction,
);

module.exports = router;
