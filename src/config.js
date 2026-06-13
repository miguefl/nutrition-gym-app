// Centralized configuration. The only place that reads process.env.
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
// DATA_DIR can be overridden (e.g. by tests) to avoid touching real data.
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, 'datos');

// In test mode we relax the rate limits so the suites are not throttled.
const isTest = process.env.NODE_ENV === 'test';

// Express "trust proxy" setting. Enable it when running behind a reverse proxy
// (e.g. Caddy/Nginx terminating TLS) so req.ip and rate limiting see the real
// client IP. TRUST_PROXY can be "true", "false" or a number of hops.
function parseTrustProxy(v) {
  if (v === undefined || v === '' || v === 'false') return false;
  if (v === 'true') return true;
  const n = Number(v);
  return Number.isFinite(n) ? n : false;
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  // Listens on localhost by default. In Docker the Dockerfile exports
  // HOST=0.0.0.0 (and docker-compose only publishes the port on 127.0.0.1).
  host: process.env.HOST || '127.0.0.1',
  // false by default; set TRUST_PROXY=1 when behind a reverse proxy.
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),

  publicDir: path.join(ROOT_DIR, 'public'),
  // JS-side keys are English; the files on disk keep their original names
  // (the data is intentionally left untouched).
  paths: {
    recipes: path.join(DATA_DIR, 'recetas.json'),
    equivalences: path.join(DATA_DIR, 'equivalencias.json'),
    aliases: path.join(DATA_DIR, 'alias.json'),
    plan: path.join(DATA_DIR, 'plan.json'),
    log: path.join(DATA_DIR, 'registro.json'),
    auth: path.join(DATA_DIR, 'auth.json'),
  },
  // Versioning: before each write a copy is stored in datos/.versions/<file>/,
  // keeping the last N.
  versionsDir: path.join(DATA_DIR, '.versions'),
  maxVersions: 10,

  ai: {
    enabled: !!process.env.ANTHROPIC_API_KEY,
    model: 'claude-opus-4-7',
    maxTokens: 4096,
    maxIters: 8,
  },

  limits: {
    jsonBody: '100kb',
    write: { windowMs: 15 * 60 * 1000, limit: isTest ? 100000 : 120 },
    ai: { windowMs: 60 * 60 * 1000, limit: isTest ? 100000 : 20 },
    login: { windowMs: 15 * 60 * 1000, limit: isTest ? 100000 : 10 },
  },

  auth: {
    cookieName: 'menu_sid',
    // Session lifetime (ms). Defaults to 30 days.
    sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
    // Initial credentials used if datos/auth.json does not exist yet.
    defaultUsername: 'test',
    defaultPassword: 'test',
    // Secure only makes sense behind HTTPS; disabled locally.
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  },
};
