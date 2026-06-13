const config = require('../config');
const authService = require('../services/authService');

// Minimal cookie parser (avoids an extra dependency).
function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function buildCookie(value, maxAgeMs) {
  const parts = [
    `${config.auth.cookieName}=${value}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (config.auth.cookieSecure) parts.push('Secure');
  return parts.join('; ');
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', buildCookie(token, config.auth.sessionTtlMs));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', buildCookie('', 0));
}

// Guards routes: requires a valid session cookie.
async function requireAuth(req, res, next) {
  try {
    const token = parseCookies(req)[config.auth.cookieName];
    const session = token ? await authService.getSession(token) : null;
    if (!session) return res.status(401).json({ error: 'No autenticado.' });
    req.user = session;
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { parseCookies, setSessionCookie, clearSessionCookie, requireAuth };
