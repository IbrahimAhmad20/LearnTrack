const { supabase } = require('../db/connection');

// ── GET /api/v1/progress/me ───────────────────────────────────────────────────
async function getMyProgress(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('content_progress')
      .select(`
        content_id, progress_percent, last_watched_at,
        content ( title, course_id, courses ( title ) )
      `)
      .eq('user_id', req.user.user_id)
      .order('last_watched_at', { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/v1/progress/:contentId ──────────────────────────────────────────
async function updateProgress(req, res, next) {
  try {
    const { progress_percent } = req.body;
    const contentId = Number(req.params.contentId);
    const userId    = req.user.user_id;

    // upsert – inserts if not exists, updates if exists
    const { error } = await supabase
      .from('content_progress')
      .upsert(
        { user_id: userId, content_id: contentId, progress_percent: Number(progress_percent), last_watched_at: new Date().toISOString() },
        { onConflict: 'user_id,content_id' }
      );

    if (error) throw new Error(error.message);
    res.json({ message: 'Progress updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyProgress, updateProgress };
