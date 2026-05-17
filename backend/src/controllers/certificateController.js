const PDFDocument = require("pdfkit");
const { supabase } = require("../db/connection");

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a PDF buffer for one certificate and return it. */
async function buildPDF({
  holderName,
  courseTitle,
  instructorName,
  issuedAt,
  verifyHash,
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
    const chunks = [];

    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = 841.89; // A4 landscape width  (pt)
    const H = 595.28; // A4 landscape height (pt)
    const cx = W / 2;

    // ── Background ────────────────────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill("#0b0d10");

    // Outer decorative border
    doc
      .rect(24, 24, W - 48, H - 48)
      .lineWidth(1)
      .strokeColor("#1f2937")
      .stroke();

    // Inner decorative border
    doc
      .rect(32, 32, W - 64, H - 64)
      .lineWidth(0.5)
      .strokeColor("#374151")
      .stroke();

    // Subtle corner accents (top-left, top-right, bottom-left, bottom-right)
    const accentColor = "#4f8ef7";
    const accentLen = 32;
    const accentLW = 2;
    doc.lineWidth(accentLW).strokeColor(accentColor);
    // TL
    doc
      .moveTo(32, 32 + accentLen)
      .lineTo(32, 32)
      .lineTo(32 + accentLen, 32)
      .stroke();
    // TR
    doc
      .moveTo(W - 32 - accentLen, 32)
      .lineTo(W - 32, 32)
      .lineTo(W - 32, 32 + accentLen)
      .stroke();
    // BL
    doc
      .moveTo(32, H - 32 - accentLen)
      .lineTo(32, H - 32)
      .lineTo(32 + accentLen, H - 32)
      .stroke();
    // BR
    doc
      .moveTo(W - 32 - accentLen, H - 32)
      .lineTo(W - 32, H - 32)
      .lineTo(W - 32, H - 32 - accentLen)
      .stroke();

    // ── Header label ─────────────────────────────────────────────────────────
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#4f8ef7")
      .text("CERTIFICATE OF COMPLETION", 0, 76, {
        align: "center",
        characterSpacing: 4,
      });

    // Thin divider under label
    doc
      .moveTo(cx - 100, 96)
      .lineTo(cx + 100, 96)
      .lineWidth(0.5)
      .strokeColor("#1f2937")
      .stroke();

    // ── "This certifies that" ─────────────────────────────────────────────────
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#6b7280")
      .text("This certifies that", 0, 118, { align: "center" });

    // ── Holder name ───────────────────────────────────────────────────────────
    doc
      .font("Helvetica-Bold")
      .fontSize(38)
      .fillColor("#f0f2f5")
      .text(holderName, 60, 144, { align: "center", width: W - 120 });

    // Underline accent below name
    const nameBottom = doc.y + 6;
    doc
      .moveTo(cx - 120, nameBottom)
      .lineTo(cx + 120, nameBottom)
      .lineWidth(1)
      .strokeColor("#4f8ef7")
      .stroke();

    // ── "has successfully completed" ─────────────────────────────────────────
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#6b7280")
      .text("has successfully completed", 0, nameBottom + 20, {
        align: "center",
      });

    // ── Course title ──────────────────────────────────────────────────────────
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#7eb3ff")
      .text(courseTitle, 60, nameBottom + 44, {
        align: "center",
        width: W - 120,
      });

    // ── Footer row ────────────────────────────────────────────────────────────
    const footerY = H - 110;

    // Thin full-width divider
    doc
      .moveTo(60, footerY)
      .lineTo(W - 60, footerY)
      .lineWidth(0.5)
      .strokeColor("#1f2937")
      .stroke();

    // Issued date — left column
    const issueDate = new Date(issuedAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text("DATE ISSUED", 60, footerY + 16, { characterSpacing: 2 });
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#d1d5db")
      .text(issueDate, 60, footerY + 30);

    // Instructor — centre column
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text("INSTRUCTOR", 0, footerY + 16, {
        align: "center",
        characterSpacing: 2,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#d1d5db")
      .text(instructorName, 0, footerY + 30, { align: "center" });

    // Verify hash — right column (truncated for display)
    const shortHash = verifyHash.slice(0, 16) + "…";
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text("VERIFICATION ID", W - 220, footerY + 16, {
        width: 160,
        align: "right",
        characterSpacing: 2,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#4f8ef7")
      .text(shortHash, W - 220, footerY + 30, { width: 160, align: "right" });

    // LearnTrack branding — very bottom centre
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#374151")
      .text("LearnTrack · Verify at /verify/" + verifyHash, 0, H - 36, {
        align: "center",
        characterSpacing: 1,
      });

    doc.end();
  });
}

// ── POST /api/v1/certificates/:certId/generate ────────────────────────────────
// Student — generate (or re-fetch) the PDF for one of their own certificates.
// On first call: builds PDF, uploads to Supabase Storage, stores public URL.
// On subsequent calls: returns the already-stored cert_url immediately.
async function generateCertificate(req, res, next) {
  try {
    const certId = Number(req.params.certId);
    if (!Number.isFinite(certId) || certId < 1) {
      return res.status(400).json({ error: "Invalid certificate ID" });
    }

    // ── 1. Fetch the certificate row + related data ──────────────────────────
    const { data: cert, error: certErr } = await supabase
      .from("certificates")
      .select(
        `
        cert_id, issued_at, cert_url, verify_hash,
        users   ( full_name ),
        courses (
          title,
          instructors ( users ( full_name ) )
        )
      `,
      )
      .eq("cert_id", certId)
      .eq("user_id", req.user.user_id) // ownership check — students can only generate their own
      .maybeSingle();

    if (certErr) throw new Error(certErr.message);
    if (!cert) return res.status(404).json({ error: "Certificate not found" });

    // ── 2. Already generated — return immediately ────────────────────────────
    if (cert.cert_url) {
      return res.json({ cert_url: cert.cert_url });
    }

    // ── 3. Build the PDF ─────────────────────────────────────────────────────
    const holderName = cert.users?.full_name || "Student";
    const courseTitle = cert.courses?.title || "Course";
    const instructorName =
      cert.courses?.instructors?.users?.full_name || "Instructor";

    const pdfBuffer = await buildPDF({
      holderName,
      courseTitle,
      instructorName,
      issuedAt: cert.issued_at,
      verifyHash: cert.verify_hash,
    });

    // ── 4. Upload to Supabase Storage ────────────────────────────────────────
    // Bucket: "certificates"  (create this in Supabase dashboard — public bucket)
    // Path:   certificates/{certId}-{verifyHash_first16}.pdf
    const storagePath = `${certId}-${cert.verify_hash.slice(0, 16)}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("certificates")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true, // safe to regenerate
      });

    if (uploadErr)
      throw new Error(`Storage upload failed: ${uploadErr.message}`);

    // ── 5. Get public URL ────────────────────────────────────────────────────
    const { data: urlData } = supabase.storage
      .from("certificates")
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // ── 6. Persist back to the certificates row ──────────────────────────────
    const { error: updateErr } = await supabase
      .from("certificates")
      .update({ cert_url: publicUrl })
      .eq("cert_id", certId);

    if (updateErr) throw new Error(updateErr.message);

    res.json({ cert_url: publicUrl });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/certificates/me ───────────────────────────────────────────────
async function getMyCertificates(req, res, next) {
  try {
    const { data, error } = await supabase
      .from("certificates")
      .select(
        `
        cert_id, issued_at, cert_url, verify_hash,
        courses (
          course_id, title, thumbnail_url,
          instructors ( users ( full_name ) )
        )
      `,
      )
      .eq("user_id", req.user.user_id)
      .order("issued_at", { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/certificates/verify/:hash ─────────────────────────────────────
async function verifyCertificate(req, res, next) {
  try {
    const { hash } = req.params;

    if (!hash || hash.length !== 64) {
      return res.status(400).json({ error: "Invalid verification hash" });
    }

    const { data, error } = await supabase
      .from("certificates")
      .select(
        `
        cert_id, issued_at,
        users   ( full_name ),
        courses ( title )
      `,
      )
      .eq("verify_hash", hash)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      return res.status(404).json({
        valid: false,
        message:
          "Certificate not found. It may have been revoked or the link is incorrect.",
      });
    }

    res.json({
      valid: true,
      holder_name: data.users?.full_name,
      course: data.courses?.title,
      issued_at: data.issued_at,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/certificates (admin) ─────────────────────────────────────────
async function getAllCertificates(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from("certificates")
      .select(
        `
        cert_id, issued_at, verify_hash,
        users   ( user_id, full_name, email ),
        courses ( course_id, title )
      `,
        { count: "exact" },
      )
      .order("issued_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    res.json({
      certificates: data || [],
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/v1/certificates/:certId (admin) ───────────────────────────────
async function revokeCertificate(req, res, next) {
  try {
    const certId = Number(req.params.certId);

    const { data: cert } = await supabase
      .from("certificates")
      .select("cert_id, cert_url")
      .eq("cert_id", certId)
      .maybeSingle();

    if (!cert) return res.status(404).json({ error: "Certificate not found" });

    // Best-effort: remove the PDF from storage too so it's no longer accessible
    if (cert.cert_url) {
      const storagePath = cert.cert_url.split("/certificates/").pop();
      if (storagePath) {
        await supabase.storage.from("certificates").remove([storagePath]);
      }
    }

    const { error } = await supabase
      .from("certificates")
      .delete()
      .eq("cert_id", certId);

    if (error) throw new Error(error.message);
    res.json({ message: "Certificate revoked" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyCertificates,
  generateCertificate,
  verifyCertificate,
  getAllCertificates,
  revokeCertificate,
};
