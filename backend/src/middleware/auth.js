const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { supabase } = require('../db/connection');

// SHA-256 hash of the raw JWT — never store tokens plain in DB
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── verifyToken ───────────────────────────────────────────────────────────────
async function verifyToken(req, res, next) {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const tokenHash = hashToken(token);

    // Check revocation list — maybeSingle avoids error when no row found
    const { data: revoked } = await supabase
      .from('user_sessions')
      .select('session_id')
      .eq('token_hash', tokenHash)
      .not('logout_at', 'is', null)
      .maybeSingle();

    if (revoked) return res.status(401).json({ error: 'Token has been revoked' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user is still active and not soft-deleted
    const { data: user } = await supabase
      .from('users')
      .select('is_active, deleted_at')
      .eq('user_id', decoded.user_id)
      .maybeSingle();

    if (!user || !user.is_active || user.deleted_at !== null) {
      return res.status(401).json({ error: 'Account is inactive or deleted' });
    }

    req.user  = decoded;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ── requireRole ───────────────────────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

module.exports = { verifyToken, requireRole, hashToken };
