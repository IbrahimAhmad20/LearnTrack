const router = require("express").Router();
const { param, query } = require("express-validator");
const {
  getMyCertificates,
  generateCertificate,
  verifyCertificate,
  getAllCertificates,
  revokeCertificate,
} = require("../controllers/certificateController");
const { verifyToken, requireRole } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

// ── Public ────────────────────────────────────────────────────────────────────
router.get(
  "/verify/:hash",
  param("hash").isLength({ min: 64, max: 64 }).isHexadecimal(),
  validate,
  verifyCertificate,
);

// ── Auth-gated ────────────────────────────────────────────────────────────────
router.use(verifyToken);

// GET  /api/v1/certificates/me
router.get("/me", requireRole("student"), getMyCertificates);

// POST /api/v1/certificates/:certId/generate
// Student triggers PDF generation on first download; idempotent on repeat calls
router.post(
  "/:certId/generate",
  requireRole("student"),
  param("certId").isInt({ min: 1 }),
  validate,
  generateCertificate,
);

// GET  /api/v1/certificates  (admin)
router.get(
  "/",
  requireRole("admin"),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  validate,
  getAllCertificates,
);

// DELETE /api/v1/certificates/:certId  (admin — revoke)
router.delete(
  "/:certId",
  requireRole("admin"),
  param("certId").isInt({ min: 1 }),
  validate,
  revokeCertificate,
);

module.exports = router;
