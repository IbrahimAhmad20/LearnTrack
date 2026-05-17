const router = require("express").Router();
const express = require("express");
const { body, param, query } = require("express-validator");
const {
  initiateTransaction,
  handleCallback,
  handleWebhook,
  checkTransactionStatus,
  verifyTransaction,
  getMyTransactions,
  getInstructorEarnings,
  getAllTransactions,
  refundTransaction,
} = require("../controllers/transactionController");
const { verifyToken, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

// POST /api/v1/transactions/webhook  — PUBLIC, server-to-server from Safepay
router.post("/webhook", handleWebhook);

// GET  /api/v1/transactions/callback  — PUBLIC, browser redirect from Safepay
// Safepay redirects the browser here with ?order_id=&tracker=&sig= in query params
router.get("/callback", handleCallback);

// POST /api/v1/transactions/callback  — PUBLIC, kept for fallback
router.post("/callback", handleCallback);

router.use(verifyToken);

// GET  /api/v1/transactions/my                — student: purchase history
router.get("/my", requireRole("student"), getMyTransactions);

// GET  /api/v1/transactions/instructor/earnings — instructor/admin
router.get(
  "/instructor/earnings",
  requireRole("instructor", "admin"),
  getInstructorEarnings,
);

// GET  /api/v1/transactions                    — admin: all transactions
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

// POST /api/v1/transactions/initiate           — student: start Safepay checkout
router.post(
  "/initiate",
  requireRole("student"),
  body("course_id").isInt({ min: 1 }),
  validate,
  initiateTransaction,
);

// POST /api/v1/transactions/verify             — student: confirm payment after redirect
router.post(
  "/verify",
  requireRole("student"),
  body("orderId").notEmpty(),
  body("signature").notEmpty(),
  validate,
  verifyTransaction,
);

// GET  /api/v1/transactions/:txId/status       — student: poll payment status
router.get(
  "/:txId/status",
  requireRole("student"),
  param("txId").isInt({ min: 1 }),
  validate,
  checkTransactionStatus,
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
