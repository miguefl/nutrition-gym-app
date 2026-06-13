const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('../config');

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
    },
  },
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
