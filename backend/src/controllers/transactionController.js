const { Safepay } = require("@sfpy/node-sdk");
const { supabase } = require("../db/connection");

// ── Safepay client (singleton) ────────────────────────────────────────────────
const safepay = new Safepay({
  environment: process.env.SAFEPAY_ENV || "sandbox",
  apiKey: process.env.SAFEPAY_API_KEY,
  v1Secret: process.env.SAFEPAY_V1_SECRET,
  // SDK requires webhookSecret even in sandbox — falls back to a placeholder until you set it in .env
  webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET || "placeholder-set-in-env",
});

// ── Helper: enroll a student directly (internal, not via HTTP) ────────────────
async function enrollStudent(userId, courseId) {
  // Idempotent — silently succeeds if already enrolled
  const { data: existing } = await supabase
    .from("enrollments")
    .select("enrollment_id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) return existing.enrollment_id;

  const { data: statusRow } = await supabase
    .from("enrollment_statuses")
    .select("status_id")
    .eq("status_name", "active")
    .single();

  const { data, error } = await supabase
    .from("enrollments")
    .insert({
      user_id: userId,
      course_id: courseId,
      status_id: statusRow.status_id,
    })
    .select("enrollment_id")
    .single();

  if (error) throw new Error(error.message);
  return data.enrollment_id;
}

// ── POST /api/v1/transactions/initiate ───────────────────────────────────────
// Student clicks "Buy" — creates a pending transaction + Safepay checkout URL.
// Frontend redirects student to the returned checkout_url.
async function initiateTransaction(req, res, next) {
  try {
    const userId = req.user.user_id;
    const courseId = Number(req.body.course_id);

    if (!courseId) {
      return res.status(400).json({ error: "course_id is required" });
    }

    // ── 1. Validate course ───────────────────────────────────────────────────
    const { data: course } = await supabase
      .from("courses")
      .select("course_id, title, price, discounted_price, is_published")
      .eq("course_id", courseId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!course) return res.status(404).json({ error: "Course not found" });
    if (!course.is_published)
      return res
        .status(400)
        .json({ error: "Course not available for purchase" });

    // ── 2. Resolve price ─────────────────────────────────────────────────────
    const price = Number(course.discounted_price ?? course.price);

    // Free course — skip payment, enroll directly
    if (price === 0) {
      await enrollStudent(userId, courseId);
      return res.json({ free: true, enrolled: true });
    }

    // ── 3. Guard: already purchased ──────────────────────────────────────────
    const { data: existing } = await supabase
      .from("transactions")
      .select("tx_id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("status", "completed")
      .maybeSingle();

    if (existing) {
      return res
        .status(409)
        .json({ error: "You have already purchased this course" });
    }

    // ── 4. Create payment token ──────────────────────────────────────────────
    // If real Safepay keys are set, use the SDK. Otherwise use mock mode so
    // the flow can be tested end-to-end without credentials.
    const hasSafepayKeys =
      process.env.SAFEPAY_API_KEY && process.env.SAFEPAY_API_KEY !== "your_key";

    const baseUrl = process.env.CLIENT_ORIGIN || "http://localhost:5173";
    let token, checkoutUrl;

    if (hasSafepayKeys) {
      // ── Real Safepay ───────────────────────────────────────────────────────
      const amountPaisa = Math.round(price * 100);
      const created = await safepay.payments.create({
        amount: amountPaisa,
        currency: "PKR",
      });
      token = created.token;

      // ── 5. Persist pending transaction ────────────────────────────────────
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          course_id: courseId,
          amount: price,
          currency: "PKR",
          status: "pending",
          gateway_reference: token,
        })
        .select("tx_id")
        .single();

      if (txErr) throw new Error(txErr.message);

      checkoutUrl = safepay.checkout.create({
        token,
        orderId: String(tx.tx_id),
        cancelUrl: `${baseUrl}/payment/cancel`,
        redirectUrl: `${baseUrl}/payment/success`,
        source: "custom",
        webhooks: false,
      });

      res.json({ checkout_url: checkoutUrl, tx_id: tx.tx_id });
    } else {
      // ── Mock mode (no Safepay credentials yet) ────────────────────────────
      // Persist as pending, then redirect to a local mock page that simulates
      // the Safepay success redirect with a fake signature.
      const mockToken = `mock_${Date.now()}`;

      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          course_id: courseId,
          amount: price,
          currency: "PKR",
          status: "pending",
          gateway_reference: mockToken,
        })
        .select("tx_id")
        .single();

      if (txErr) throw new Error(txErr.message);

      // Mock checkout URL — goes straight to /payment/mock on the frontend
      const mockCheckoutUrl =
        `${baseUrl}/payment/mock?orderId=${tx.tx_id}&token=${mockToken}&` +
        `amount=${price}&title=${encodeURIComponent(course.title)}`;

      res.json({ checkout_url: mockCheckoutUrl, tx_id: tx.tx_id, mock: true });
    }
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/transactions/verify ─────────────────────────────────────────
// Called by the frontend after Safepay redirects back with ?orderId=&signature=
// Verifies the HMAC signature, marks the transaction completed, enrolls student.
async function verifyTransaction(req, res, next) {
  try {
    const userId = req.user.user_id;

    // Safepay POSTs back with: { orderId, sig, tracker }
    // 'sig' is the HMAC-SHA256 of tracker signed with v1Secret
    const { orderId, sig, tracker } = req.body;

    if (!orderId || !sig) {
      return res.status(400).json({ error: "orderId and sig are required" });
    }

    // ── 1. Verify signature ───────────────────────────────────────────────────
    const isMock = sig === "mock_signature";
    const hasSafepayKeys =
      process.env.SAFEPAY_API_KEY && process.env.SAFEPAY_API_KEY !== "your_key";

    if (!isMock && hasSafepayKeys) {
      // SDK verify.signature reads request.body.sig and request.body.tracker
      const valid = safepay.verify.signature({ body: { sig, tracker } });
      if (!valid) {
        return res.status(400).json({ error: "Invalid payment signature" });
      }
    }
    // In mock mode we trust the orderId — ownership check below keeps it safe.

    // ── 2. Look up the pending transaction by orderId (= tx_id) ──────────────
    const txId = Number(orderId);
    const { data: tx } = await supabase
      .from("transactions")
      .select("tx_id, user_id, course_id, status")
      .eq("tx_id", txId)
      .eq("user_id", userId) // ownership check
      .maybeSingle();

    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.status === "completed") return res.json({ already_completed: true });
    if (tx.status !== "pending")
      return res.status(400).json({ error: `Transaction is ${tx.status}` });

    // ── 3. Mark completed ────────────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("transactions")
      .update({ status: "completed" })
      .eq("tx_id", txId);

    if (updateErr) throw new Error(updateErr.message);

    // ── 4. Enroll the student ────────────────────────────────────────────────
    await enrollStudent(userId, tx.course_id);

    res.json({ success: true, course_id: tx.course_id });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/transactions/my ───────────────────────────────────────────────
async function getMyTransactions(req, res, next) {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        `
        tx_id, amount, currency, status, gateway_reference, created_at,
        courses ( course_id, title, thumbnail_url )
      `,
      )
      .eq("user_id", req.user.user_id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/transactions/instructor/earnings ─────────────────────────────
async function getInstructorEarnings(req, res, next) {
  try {
    const { data: instructor } = await supabase
      .from("instructors")
      .select("instructor_id")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (!instructor)
      return res.status(403).json({ error: "Not a registered instructor" });

    const { data: courses } = await supabase
      .from("courses")
      .select("course_id, title")
      .eq("instructor_id", instructor.instructor_id)
      .is("deleted_at", null);

    const courseIds = (courses || []).map((c) => c.course_id);
    if (!courseIds.length)
      return res.json({ total: 0, by_course: [], recent: [] });

    const courseMap = Object.fromEntries(
      (courses || []).map((c) => [c.course_id, c.title]),
    );

    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("course_id, amount, currency, created_at")
      .in("course_id", courseIds)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const txns = transactions || [];
    const byCourse = {};
    txns.forEach((t) => {
      if (!byCourse[t.course_id]) {
        byCourse[t.course_id] = {
          course_id: t.course_id,
          course_title: courseMap[t.course_id] || null,
          revenue: 0,
          sales: 0,
          currency: t.currency,
        };
      }
      byCourse[t.course_id].revenue += Number(t.amount);
      byCourse[t.course_id].sales += 1;
    });

    res.json({
      total: txns.reduce((s, t) => s + Number(t.amount), 0),
      by_course: Object.values(byCourse).sort((a, b) => b.revenue - a.revenue),
      recent: txns.slice(0, 20),
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/transactions (admin) ─────────────────────────────────────────
async function getAllTransactions(req, res, next) {
  try {
    const { status, course_id, user_id } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    let q = supabase.from("transactions").select(
      `
      tx_id, amount, currency, status, gateway_reference, created_at,
      users   ( user_id, full_name, email ),
      courses ( course_id, title )
    `,
      { count: "exact" },
    );

    if (status) q = q.eq("status", status);
    if (course_id) q = q.eq("course_id", Number(course_id));
    if (user_id) q = q.eq("user_id", user_id);

    q = q
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    res.json({
      transactions: data || [],
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/transactions/:txId/refund (admin) ────────────────────────────
async function refundTransaction(req, res, next) {
  try {
    const txId = Number(req.params.txId);

    const { data: original } = await supabase
      .from("transactions")
      .select("*")
      .eq("tx_id", txId)
      .maybeSingle();

    if (!original)
      return res.status(404).json({ error: "Transaction not found" });
    if (original.status !== "completed") {
      return res
        .status(400)
        .json({ error: "Only completed transactions can be refunded" });
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: original.user_id,
        course_id: original.course_id,
        amount: original.amount,
        currency: original.currency,
        status: "refunded",
        gateway_reference: original.gateway_reference,
      })
      .select("tx_id")
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ refund_tx_id: data.tx_id });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/transactions/:txId/status ─────────────────────────────────────
// Frontend polls this after redirecting student to Safepay.
// Checks Safepay's API directly for payment status — no tunnel/webhook needed.
// If Safepay says paid, marks tx completed and enrolls the student immediately.
async function checkTransactionStatus(req, res, next) {
  try {
    const userId = req.user.user_id;
    const txId = Number(req.params.txId);

    // ── 1. Load the transaction ───────────────────────────────────────────────
    const { data: tx } = await supabase
      .from("transactions")
      .select("tx_id, user_id, course_id, status, gateway_reference")
      .eq("tx_id", txId)
      .eq("user_id", userId) // ownership check
      .maybeSingle();

    if (!tx) return res.status(404).json({ error: "Transaction not found" });

    // Already done — return immediately
    if (tx.status === "completed") {
      return res.json({ status: "completed", course_id: tx.course_id });
    }
    if (tx.status === "failed" || tx.status === "refunded") {
      return res.json({ status: tx.status });
    }

    // ── 2. Ask Safepay for the current payment status ─────────────────────────
    const isMock = tx.gateway_reference?.startsWith("mock_");
    const hasSafepayKeys =
      process.env.SAFEPAY_API_KEY && process.env.SAFEPAY_API_KEY !== "your_key";

    if (isMock || !hasSafepayKeys) {
      // Mock mode — just return pending; mock flow uses /verify directly
      return res.json({ status: "pending" });
    }

    // Call Safepay's payment retrieval API using the tracker token
    const token = tx.gateway_reference;
    const sfpayHost =
      process.env.SAFEPAY_ENV === "production"
        ? "https://api.getsafepay.com"
        : "https://sandbox.api.getsafepay.com";

    const sfpayRes = await fetch(`${sfpayHost}/order/v1/payments/${token}`, {
      headers: {
        "Content-Type": "application/json",
        "X-SFPY-SECRET-KEY": process.env.SAFEPAY_API_KEY,
      },
    });

    if (!sfpayRes.ok) {
      // Safepay API error — don't crash, just report pending
      console.error("[status check] Safepay API error:", sfpayRes.status);
      return res.json({ status: "pending" });
    }

    const sfpayData = await sfpayRes.json();
    console.log("[status check] Safepay response:", JSON.stringify(sfpayData));

    // Safepay payment states: PAID, CANCELLED, UNPAID, etc.
    const sfpayState = sfpayData?.data?.state || sfpayData?.state || "";

    if (sfpayState === "PAID" || sfpayState === "paid") {
      // ── 3. Mark completed in our DB ─────────────────────────────────────────
      await supabase
        .from("transactions")
        .update({ status: "completed" })
        .eq("tx_id", txId);

      // ── 4. Enroll student ───────────────────────────────────────────────────
      await enrollStudent(userId, tx.course_id);

      return res.json({ status: "completed", course_id: tx.course_id });
    }

    if (sfpayState === "CANCELLED" || sfpayState === "cancelled") {
      await supabase
        .from("transactions")
        .update({ status: "failed" })
        .eq("tx_id", txId);
      return res.json({ status: "failed" });
    }

    // Still pending
    return res.json({ status: "pending" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  initiateTransaction,
  checkTransactionStatus,
  verifyTransaction,
  getMyTransactions,
  getInstructorEarnings,
  getAllTransactions,
  refundTransaction,
};
