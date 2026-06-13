const { Router } = require('express');
const asyncHandler = require('./asyncHandler');
const config = require('../config');
const authService = require('../services/authService');
const { parseCookies, setSessionCookie, clearSessionCookie, requireAuth } = require('../middleware/auth');
const { loginLimiter, writeLimiter } = require('../middleware/security');

const router = Router();

// Current session status. Never returns 401 so the frontend can query it
// freely on load.
router.get('/me', asyncHandler(async (req, res) => {
  const token = parseCookies(req)[config.auth.cookieName];
  const session = token ? await authService.getSession(token) : null;
  res.json({ authenticated: !!session, username: session?.username || null });
}));

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  const result = await authService.login(username, password);
  if (!result) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  setSessionCookie(res, result.token);
  res.json({ authenticated: true, username: result.username });
}));

router.post('/logout', asyncHandler(async (_req, res) => {
  clearSessionCookie(res);
  res.json({ authenticated: false });
}));

// Change username and/or password (requires session and current password).
router.post('/change', requireAuth, writeLimiter, asyncHandler(async (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body || {};
  const result = await authService.changeCredentials({ currentPassword, newUsername, newPassword });
  setSessionCookie(res, result.token); // renew the session for whoever changes it
  res.json({ authenticated: true, username: result.username });
}));

module.exports = router;
