const { supabase } = require('../db/connection');

// ── POST /api/v1/activity ─────────────────────────────────────────────────────
async function logActivity(req, res, next) {
  try {
    const { content_id, event_type, watch_time = 0 } = req.body;

    const { data: typeRow, error: typeErr } = await supabase
      .from('activity_types')
      .select('type_id')
      .eq('type_name', event_type)
      .single();

    if (typeErr || !typeRow) {
      return res.status(400).json({ error: `Unknown event type: ${event_type}` });
    }

    const { error } = await supabase.from('activity_log').insert({
      user_id:    req.user.user_id,
      content_id: Number(content_id),
      type_id:    typeRow.type_id,
      watch_time: Number(watch_time),
    });

    if (error) throw new Error(error.message);
    res.status(201).json({ message: 'Activity logged' });
  } catch (err) {
    next(err);
  }
}

module.exports = { logActivity };
