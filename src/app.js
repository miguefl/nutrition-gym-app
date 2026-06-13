const express = require('express');
const config = require('./config');
const { securityHeaders, sameOriginOnly } = require('./middleware/security');
const { requireAuth } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // Behind a reverse proxy (TLS termination): trust X-Forwarded-* so req.ip and
  // rate limiting use the real client IP. Off unless TRUST_PROXY is set.
  if (config.trustProxy !== false) app.set('trust proxy', config.trustProxy);

  app.use(securityHeaders);
  app.use(express.json({ limit: config.limits.jsonBody }));
  app.use(express.static(config.publicDir));
  app.use(sameOriginOnly);

  // Public health check (no auth) for Docker healthcheck / monitoring.
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Auth: /api/auth routes are public (login, status…).
  app.use('/api/auth', require('./routes/authRoutes'));

  // Everything else under /api requires a valid session.
  app.use('/api/recipes', requireAuth, require('./routes/recipesRoutes'));
  app.use('/api/equivalences', requireAuth, require('./routes/equivalencesRoutes'));
  app.use('/api/aliases', requireAuth, require('./routes/aliasesRoutes'));
  app.use('/api/plan', requireAuth, require('./routes/planRoutes'));
  app.use('/api/log', requireAuth, require('./routes/logRoutes'));
  app.use('/api/backup', requireAuth, require('./routes/backupRoutes'));
  app.use('/api/ai', requireAuth, require('./routes/aiRoutes'));

  app.use(errorHandler);
  return app;
}

module.exports = createApp;
