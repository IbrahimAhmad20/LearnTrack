const { supabase } = require("../db/connection");

// ── PUT /api/v1/instructors/me ───────────────────────────────────────────────
async function updateMyProfile(req, res, next) {
  try {
    const { department, qualification } = req.body;

    const updates = {};
    if (department !== undefined)
      updates.department =
        department === null ? null : String(department).trim() || null;
    if (qualification !== undefined)
      updates.qualification =
        qualification === null ? null : String(qualification).trim() || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const { data, error } = await supabase
      .from("instructors")
      .update(updates)
      .eq("user_id", req.user.user_id)
      .select("instructor_id, department, qualification")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data)
      return res.status(404).json({ error: "No instructor profile found" });

    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { updateMyProfile };
