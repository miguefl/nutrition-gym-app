const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Whether the app is actually served over TLS. Set COOKIE_SECURE=true when
// behind HTTPS (e.g. the Caddy reverse proxy in docker-compose.https.yml).
// Over plain HTTP on a LAN/VPN it stays false.
const httpsEnabled = config.auth.cookieSecure;

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      // Helmet adds `upgrade-insecure-requests` by default, which makes the
      // browser rewrite asset requests to https://. Over plain HTTP (LAN/VPN)
      // there is no TLS listener, so CSS/JS fail to load and the page renders
      // unstyled. Keep it only when actually serving over HTTPS.
      upgradeInsecureRequests: httpsEnabled ? [] : null,
    },
  },
  // HSTS only makes sense over HTTPS; sending it over plain HTTP is wrong (and
  // can lock a domain into https:// in the browser). Enable it only under TLS.
  strictTransportSecurity: httpsEnabled
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
});

// Basic anti-CSRF: mutating requests that arrive from a browser (with an
// Origin header) must come from the same host. curl/scripts without Origin
// still work.
function sameOriginOnly(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  try {
    if (new URL(origin).host === req.headers.host) return next();
  } catch { /* malformed origin → reject */ }
  return res.status(403).json({ error: 'Origen no permitido.' });
}

// Generous limit for normal writes…
const writeLimiter = rateLimit({
  windowMs: config.limits.write.windowMs,
  limit: config.limits.write.limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones de escritura. Espera unos minutos.' },
});

// …and a strict one for AI, which spends Anthropic budget.
const aiLimiter = rateLimit({
  windowMs: config.limits.ai.windowMs,
  limit: config.limits.ai.limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: `Límite de consultas a la IA alcanzado (${config.limits.ai.limit}/hora). Espera un poco.` },
});

// Throttles brute-force login attempts.
const loginLimiter = rateLimit({
  windowMs: config.limits.login.windowMs,
  limit: config.limits.login.limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso. Espera unos minutos.' },
});

module.exports = { securityHeaders, sameOriginOnly, writeLimiter, aiLimiter, loginLimiter };
