// Single-user authentication.
// - The password is stored hashed with scrypt (per-user salt) in datos/auth.json.
// - The session is a token signed with HMAC-SHA256 (secret in the same file),
//   carried in an HttpOnly cookie. Nothing is stored on the client.
// - Changing credentials rotates the session secret, invalidating prior sessions.
const crypto = require('crypto');
const store = require('../repositories/jsonStore');
const config = require('../config');
const { BadRequestError } = require('../errors');

const SCRYPT_KEYLEN = 64;
const MIN_LEN = 1;
const MAX_LEN = 100;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return { salt, hash };
}

function timingSafeEqualHex(a, b) {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Loads the credentials; if the file does not exist, seeds it with the default
// credentials (test/test) and a random session secret.
async function load() {
  try {
    return await store.read(config.paths.auth);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    const { salt, hash } = hashPassword(config.auth.defaultPassword);
    const seed = {
      username: config.auth.defaultUsername,
      salt,
      hash,
      sessionSecret: crypto.randomBytes(32).toString('hex'),
      updated_at: new Date().toISOString(),
    };
    await store.write(config.paths.auth, seed);
    return seed;
  }
}

function save(creds) {
  return store.write(config.paths.auth, creds);
}

// ---------- Session token (stateless, signed) ----------
function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
}

function makeToken(username, secret) {
  const payload = { u: username, exp: Date.now() + config.auth.sessionTtlMs };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

function verifyToken(token, creds) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, mac] = token.split('.');
  const expected = sign(payloadB64, creds.sessionSecret);
  // Constant-time comparison of the signature.
  const macBuf = Buffer.from(mac || '', 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (macBuf.length !== expBuf.length || !crypto.timingSafeEqual(macBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.u !== creds.username) return null;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    return { username: payload.u };
  } catch {
    return null;
  }
}

// ---------- Operations ----------
async function login(username, password) {
  const creds = await load();
  const candidate = hashPassword(password, creds.salt);
  const userOk = typeof username === 'string' && username === creds.username;
  const passOk = timingSafeEqualHex(candidate.hash, creds.hash);
  // Both checks always run so we don't leak which one failed.
  if (!userOk || !passOk) return null;
  return { token: makeToken(creds.username, creds.sessionSecret), username: creds.username };
}

async function getSession(token) {
  const creds = await load();
  return verifyToken(token, creds);
}

function validateText(value, field) {
  if (typeof value !== 'string' || value.length < MIN_LEN || value.length > MAX_LEN) {
    throw new BadRequestError(`"${field}" debe tener entre ${MIN_LEN} y ${MAX_LEN} caracteres.`);
  }
}

// Changes username and/or password after verifying the current password.
// Rotates the session secret → invalidates any existing session.
async function changeCredentials({ currentPassword, newUsername, newPassword }) {
  const creds = await load();
  const current = hashPassword(String(currentPassword ?? ''), creds.salt);
  if (!timingSafeEqualHex(current.hash, creds.hash)) {
    throw new BadRequestError('La contraseña actual no es correcta.');
  }

  const username = newUsername !== undefined && newUsername !== '' ? newUsername : creds.username;
  validateText(username, 'username');

  let { salt, hash } = creds;
  if (newPassword !== undefined && newPassword !== '') {
    validateText(newPassword, 'newPassword');
    ({ salt, hash } = hashPassword(newPassword));
  }

  const updated = {
    username,
    salt,
    hash,
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    updated_at: new Date().toISOString(),
  };
  await save(updated);
  // Return a fresh token so the caller who changes credentials stays logged in.
  return { token: makeToken(updated.username, updated.sessionSecret), username: updated.username };
}

module.exports = { login, getSession, changeCredentials };
