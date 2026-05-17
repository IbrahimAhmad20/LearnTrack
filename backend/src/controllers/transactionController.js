const { supabase } = require("../db/connection");

// ── GET /api/v1/transactions/my ───────────────────────────────────────────────
// Student — their own transaction history
async function getMyTransactions(req, res, next) {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        `
        transaction_id, amount, currency, status, payment_method,
        provider_ref, created_at,
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

// ── POST /api/v1/transactions ─────────────────────────────────────────────────
// Student — initiate a purchase / record a completed payment
// In a real integration the payment gateway calls a webhook; this endpoint
// simulates the final "record the result" step.
async function createTransaction(req, res, next) {
  try {
    const userId = req.user.user_id;
    const { course_id, amount, currency, payment_method, provider_ref } =
      req.body;

    if (!course_id || amount === undefined) {
      return res
        .status(400)
        .json({ error: "course_id and amount are required" });
    }

    // Verify course exists and is published
    const { data: course } = await supabase
      .from("courses")
      .select("course_id, price, is_published")
      .eq("course_id", Number(course_id))
      .is("deleted_at", null)
      .maybeSingle();

    if (!course) return res.status(404).json({ error: "Course not found" });
    if (!course.is_published)
      return res
        .status(400)
        .json({ error: "Course is not available for purchase" });

    // Prevent duplicate successful transactions
    const { data: existing } = await supabase
      .from("transactions")
      .select("transaction_id")
      .eq("user_id", userId)
      .eq("course_id", Number(course_id))
      .eq("status", "completed")
      .maybeSingle();

    if (existing) {
      return res
        .status(409)
        .json({ error: "You have already purchased this course" });
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        course_id: Number(course_id),
        amount: Number(amount),
        currency: currency || "PKR",
        status: "completed",
        payment_method: payment_method || null,
        provider_ref: provider_ref || null,
      })
      .select("transaction_id")
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ transaction_id: data.transaction_id });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/transactions/instructor/earnings ─────────────────────────────
// Instructor — revenue breakdown across their courses
async function getInstructorEarnings(req, res, next) {
  try {
    const userId = req.user.user_id;

    const { data: instructor } = await supabase
      .from("instructors")
      .select("instructor_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!instructor)
      return res.status(403).json({ error: "Not a registered instructor" });

    const { data: courses } = await supabase
      .from("courses")
      .select("course_id, title")
      .eq("instructor_id", instructor.instructor_id)
      .is("deleted_at", null);

    const courseIds = (courses || []).map((c) => c.course_id);
    if (!courseIds.length) return res.json({ total: 0, by_course: [] });

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

    // Group by course
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

    const totalRevenue = txns.reduce((sum, t) => sum + Number(t.amount), 0);

    res.json({
      total: totalRevenue,
      by_course: Object.values(byCourse).sort((a, b) => b.revenue - a.revenue),
      recent: txns.slice(0, 20), // last 20 transactions
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/transactions (admin only) ─────────────────────────────────────
// Admin — full transaction list with optional filters
async function getAllTransactions(req, res, next) {
  try {
    const { status, course_id, user_id } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    let q = supabase.from("transactions").select(
      `
        transaction_id, amount, currency, status, payment_method,
        provider_ref, created_at,
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

// ── POST /api/v1/transactions/:transactionId/refund (admin only) ──────────────
// Admin — mark a transaction as refunded (insert refund record)
async function refundTransaction(req, res, next) {
  try {
    const txId = Number(req.params.transactionId);

    const { data: original } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", txId)
      .maybeSingle();

    if (!original)
      return res.status(404).json({ error: "Transaction not found" });
    if (original.status !== "completed") {
      return res
        .status(400)
        .json({ error: "Only completed transactions can be refunded" });
    }

    // Insert a refund row — audit trail preserved
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: original.user_id,
        course_id: original.course_id,
        amount: original.amount,
        currency: original.currency,
        status: "refunded",
        payment_method: original.payment_method,
        provider_ref: original.provider_ref,
      })
      .select("transaction_id")
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ refund_transaction_id: data.transaction_id });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyTransactions,
  createTransaction,
  getInstructorEarnings,
  getAllTransactions,
  refundTransaction,
};
