const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { supabase } = require('../db/connection');
const { hashToken } = require('../middleware/auth');

const SALT_ROUNDS = 12;
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   24 * 60 * 60 * 1000,
};

// ── POST /api/v1/auth/register ────────────────────────────────────────────────
async function register(req, res, next) {
  try {
    const {
      full_name,
      email,
      password,
      role = 'student',
      admin_code,
      department,
      qualification,
    } = req.body;
    const requestedRole = ['student', 'instructor', 'admin'].includes(role)
      ? role
      : 'student';

    // Optional policy: disable public admin signup unless a server secret is provided.
    const adminSignupRestricted =
      process.env.DISABLE_PUBLIC_ADMIN_REGISTRATION === 'true';
    if (adminSignupRestricted && requestedRole === 'admin') {
      const expectedCode = process.env.ADMIN_REGISTRATION_CODE;
      if (!expectedCode || admin_code !== expectedCode) {
        return res.status(403).json({
          error:
            'Admin registration is restricted. Contact a system administrator.',
        });
      }
    }
    const safeRole = requestedRole;

    // Check for duplicate BEFORE calling Supabase Auth so we get a clean 409
    const { data: existing, error: existingErr } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);

    if (existing) return res.status(409).json({ error: 'Email already registered' });

    // Create user in Supabase Auth — this generates the UUID
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name, role: safeRole },
      email_confirm: true,
    });

    if (authErr) {
      // Supabase Auth also throws on duplicate — catch as 409
      if (authErr.message.toLowerCase().includes('already registered') ||
          authErr.message.toLowerCase().includes('already been registered') ||
          authErr.code === '23505') {
        return res.status(409).json({ error: 'Email already registered' });
      }
      // "Database error creating new user" usually means an Auth hook/trigger failed.
      if ((authErr.message || '').toLowerCase().includes('database error creating new user')) {
        console.error(
          '[register] Supabase auth createUser failed',
          JSON.stringify({
            code: authErr.code,
            status: authErr.status,
            name: authErr.name,
            message: authErr.message,
          }),
        );
        return res.status(500).json({
          error:
            'Supabase auth could not create the user. Check Authentication Hooks (After user created) and DB trigger handle_new_auth_user().',
        });
      }

      throw new Error(authErr.message || 'Auth user creation failed');
    }

    const userId = authData.user.id;   // UUID

    // The handle_new_auth_user trigger creates the users row automatically.
    // We upsert here as a fallback in case the trigger isn't wired yet.
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const { error: upsertErr } = await supabase
      .from('users')
      .upsert({
        user_id:   userId,
        full_name,
        email,
        password:  hashedPassword,
        role:      safeRole,
      }, { onConflict: 'user_id' });

    if (upsertErr) {
      const msg = (upsertErr.message || '').toLowerCase();
      const isRls = msg.includes('row-level security') || upsertErr.code === '42501';

      if (isRls) {
        // In some Supabase setups, the Auth hook already inserted public.users
        // and direct writes can be blocked by RLS. If profile exists, proceed.
        const { data: existingProfile, error: checkErr } = await supabase
          .from('users')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();
        if (!checkErr && existingProfile) {
          // Keep registration successful; auth + profile row exists.
        } else {
          // Avoid orphaned auth.users when public profile creation fails.
          await supabase.auth.admin.deleteUser(userId);
          return res.status(500).json({
            error:
              'Registration blocked by database policy. Re-run DDL/auth hook setup, then try again.',
          });
        }
      } else {
        throw new Error(upsertErr.message);
      }
    }

    // If instructor/admin, ensure the instructors row exists.
    // The handle_new_auth_user trigger + our upsert both write to users;
    // wait 500ms to let both commits settle before touching instructors FK.
    if (['instructor', 'admin'].includes(safeRole)) {
      await new Promise(r => setTimeout(r, 500));
      let instCreated = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 500 * attempt));

        // First verify the users row actually exists with the right role
        const { data: userCheck } = await supabase
          .from('users')
          .select('user_id, role')
          .eq('user_id', userId)
          .maybeSingle();

        if (!userCheck || !['instructor', 'admin'].includes(userCheck.role)) {
          console.warn(`Attempt ${attempt + 1}: users row not ready yet for ${userId}, role=${userCheck?.role}`);
          continue;
        }

        const { error: instErr } = await supabase
          .from('instructors')
          .insert({ user_id: userId });

        if (!instErr) {
          instCreated = true;
          break;
        }
        if (instErr.code === '23505') {
          // duplicate key — row already exists, that's fine
          instCreated = true;
          break;
        }
        console.warn(`instructors insert attempt ${attempt + 1} failed — code:${instErr.code} msg:${instErr.message} details:${instErr.details} hint:${instErr.hint}`);
      }
      if (!instCreated) {
        // Registration still succeeds — createCourseWithRetry will handle the timing
        console.warn('Could not create instructors row after 5 attempts for user', userId);
      }

      // Trigger may insert an empty instructors row first; PATCH department / qualification here.
      const instPatch = {};
      if (typeof department === 'string')
        instPatch.department = department.trim() || null;
      if (typeof qualification === 'string')
        instPatch.qualification = qualification.trim() || null;
      if (Object.keys(instPatch).length > 0) {
        const { error: patchErr } = await supabase
          .from('instructors')
          .update(instPatch)
          .eq('user_id', userId);
        if (patchErr) {
          console.warn('instructors profile fields:', patchErr.message);
        }
      }
    }

    res.status(201).json({ message: 'Registration successful', user_id: userId });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/auth/login ───────────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Authenticate via a short-lived auth client so we don't mutate the
    // shared service-role client session used by other requests.
    const authClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr) return res.status(401).json({ error: 'Invalid credentials' });

    const userId = authData.user.id;   // UUID

    // Fetch our profile (has role, is_active, deleted_at)
    const { data: user } = await supabase
      .from('users')
      .select('user_id, full_name, email, role, is_active, deleted_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!user || user.deleted_at) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_active)          return res.status(403).json({ error: 'Account deactivated' });

    // Issue our own JWT (includes role for middleware checks)
    const payload = { user_id: user.user_id, email: user.email, role: user.role };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });

    // Record session
    await supabase.from('user_sessions').insert({
      user_id:    userId,
      token_hash: hashToken(token),
      ip_address: req.ip || null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    res.cookie('token', token, COOKIE_OPTS);
    res.json({
      token,
      user: { user_id: user.user_id, full_name: user.full_name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────
async function logout(req, res, next) {
  try {
    await supabase
      .from('user_sessions')
      .update({ logout_at: new Date().toISOString() })
      .eq('token_hash', hashToken(req.token))
      .eq('user_id', req.user.user_id);

    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, logout };
