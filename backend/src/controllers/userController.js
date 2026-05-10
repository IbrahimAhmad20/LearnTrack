const bcrypt = require('bcrypt');
const { supabase } = require('../db/connection');

// ── GET /api/v1/users/me ──────────────────────────────────────────────────────
async function getMe(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, full_name, email, role, bio, avatar_url, created_at')
      .eq('user_id', req.user.user_id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'User not found' });

    const { data: instProfile } = await supabase
      .from('instructors')
      .select('instructor_id, department, qualification')
      .eq('user_id', req.user.user_id)
      .maybeSingle();

    res.json({
      ...data,
      instructor_profile: instProfile || null,
    });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/v1/users/me ──────────────────────────────────────────────────────
async function updateMe(req, res, next) {
  try {
    const { full_name, bio, avatar_url, password } = req.body;
    const updates = { updated_at: new Date().toISOString() };

    if (full_name)  updates.full_name  = full_name;
    if (bio)        updates.bio        = bio;
    if (avatar_url) updates.avatar_url = avatar_url;
    if (password)   updates.password   = await bcrypt.hash(password, 12);

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('user_id', req.user.user_id);

    if (error) throw new Error(error.message);
    res.json({ message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/users  (admin only) ──────────────────────────────────────────
// Paginate with .range() so we return every row even when Supabase API
// "Max rows" limits each response (e.g. misconfigured to 1).
async function listUsers(req, res, next) {
  try {
    const PAGE = 1000;
    const select =
      'user_id, full_name, email, role, is_active, created_at';
    const all = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from('users')
        .select(select)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(...data);
      from += data.length;
    }
    res.json(all);
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/v1/users/:id  (admin only) ───────────────────────────────────
// user_id is UUID — never use Number(id) (that yields NaN and deletes nothing).
async function deleteUser(req, res, next) {
  try {
    const userId = String(req.params.id || '').trim();
    if (!userId) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (userId === req.user.user_id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('user_id', userId);

    if (error) {
      const code = error.code || '';
      const msg = (error.message || '').toLowerCase();
      if (
        code === '23503' ||
        msg.includes('foreign key') ||
        msg.includes('violates foreign key')
      ) {
        return res.status(409).json({
          error:
            'Cannot delete this user while they still own courses or have records that block removal. Remove or reassign those first, or deactivate the account instead.',
        });
      }
      throw new Error(error.message);
    }

    const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
    if (authErr) {
      console.warn('auth.admin.deleteUser after DB delete:', authErr.message);
    }

    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/v1/users/:id/status  (admin toggle active) ──────────────────────
async function setUserStatus(req, res, next) {
  try {
    const userId = String(req.params.id || '').trim();
    if (!userId) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const { error } = await supabase
      .from('users')
      .update({ is_active: req.body.is_active })
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    res.json({ message: 'User status updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, updateMe, listUsers, deleteUser, setUserStatus };
