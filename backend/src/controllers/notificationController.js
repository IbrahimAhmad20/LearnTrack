const { supabase } = require("../db/connection");

// ── GET /api/v1/notifications/me ─────────────────────────────────────────────
// Student — paginated notification list, unread first then newest
async function getMyNotifications(req, res, next) {
  try {
    const userId = req.user.user_id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 30);
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unread === "true";

    let q = supabase
      .from("notifications")
      .select(
        `
        notif_id, type, body, is_read, created_at,
        ref_course_id, ref_content_id
      `,
        { count: "exact" },
      )
      .eq("user_id", userId);

    if (unreadOnly) q = q.eq("is_read", false);

    // Unread first, then newest
    q = q
      .order("is_read", { ascending: true })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    res.json({
      notifications: data || [],
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/notifications/me/unread-count ─────────────────────────────────
// Student — unread badge count (partial index makes this O(1))
async function getUnreadCount(req, res, next) {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("notif_id", { count: "exact", head: true })
      .eq("user_id", req.user.user_id)
      .eq("is_read", false);

    if (error) throw new Error(error.message);
    res.json({ unread_count: count ?? 0 });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/v1/notifications/:notifId/read ────────────────────────────────
// Student — mark a single notification as read
async function markRead(req, res, next) {
  try {
    const notifId = Number(req.params.notifId);
    const userId = req.user.user_id;

    // Verify ownership
    const { data: notif } = await supabase
      .from("notifications")
      .select("notif_id, user_id")
      .eq("notif_id", notifId)
      .maybeSingle();

    if (!notif)
      return res.status(404).json({ error: "Notification not found" });
    if (notif.user_id !== userId)
      return res.status(403).json({ error: "Not your notification" });

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("notif_id", notifId);

    if (error) throw new Error(error.message);
    res.json({ message: "Marked as read" });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/v1/notifications/me/read-all ──────────────────────────────────
// Student — mark ALL their notifications as read
async function markAllRead(req, res, next) {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", req.user.user_id)
      .eq("is_read", false);

    if (error) throw new Error(error.message);
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/v1/notifications/:notifId ────────────────────────────────────
// Student — delete a single notification
async function deleteNotification(req, res, next) {
  try {
    const notifId = Number(req.params.notifId);
    const userId = req.user.user_id;

    const { data: notif } = await supabase
      .from("notifications")
      .select("notif_id, user_id")
      .eq("notif_id", notifId)
      .maybeSingle();

    if (!notif)
      return res.status(404).json({ error: "Notification not found" });
    if (notif.user_id !== userId)
      return res.status(403).json({ error: "Not your notification" });

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("notif_id", notifId);

    if (error) throw new Error(error.message);
    res.json({ message: "Notification deleted" });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/notifications (admin only) ───────────────────────────────────
// Admin — send a broadcast or targeted notification
async function createNotification(req, res, next) {
  try {
    const { user_id, type, body, ref_course_id, ref_content_id } = req.body;

    const VALID_TYPES = [
      "new_content",
      "quiz_graded",
      "announcement",
      "enrollment_complete",
      "certificate_issued",
      "review_received",
    ];

    if (!user_id || !type || !body) {
      return res
        .status(400)
        .json({ error: "user_id, type, and body are required" });
    }
    if (!VALID_TYPES.includes(type)) {
      return res
        .status(400)
        .json({
          error: `Invalid type. Valid values: ${VALID_TYPES.join(", ")}`,
        });
    }

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id,
        type,
        body,
        ref_course_id: ref_course_id || null,
        ref_content_id: ref_content_id || null,
      })
      .select("notif_id")
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ notif_id: data.notif_id });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
  createNotification,
};
