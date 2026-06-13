const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { seedTempData, cleanup } = require('../helpers');

// Point DATA_DIR at a temp dir BEFORE requiring the service (config reads it).
let dataDir;
before(() => {
  dataDir = seedTempData();
  process.env.DATA_DIR = dataDir;
  process.env.NODE_ENV = 'test';
});
after(() => cleanup(dataDir));

test('login: seeds test/test on first run and accepts it', async () => {
  const authService = require('../../src/services/authService');
  const ok = await authService.login('test', 'test');
  assert.ok(ok && ok.token);
  assert.equal(ok.username, 'test');
});

test('login: rejects wrong user or password', async () => {
  const authService = require('../../src/services/authService');
  assert.equal(await authService.login('test', 'bad'), null);
  assert.equal(await authService.login('nope', 'test'), null);
});

test('getSession: validates the issued token', async () => {
  const authService = require('../../src/services/authService');
  const { token } = await authService.login('test', 'test');
  const session = await authService.getSession(token);
  assert.equal(session.username, 'test');
  assert.equal(await authService.getSession('garbage.token'), null);
});

test('changeCredentials: rotates secret and invalidates old sessions', async () => {
  const authService = require('../../src/services/authService');
  const { token: oldToken } = await authService.login('test', 'test');

  await assert.rejects(
    () => authService.changeCredentials({ currentPassword: 'wrong', newPassword: 'nuevo123' }),
    /contraseña actual/i,
  );

  const res = await authService.changeCredentials({
    currentPassword: 'test', newUsername: 'miguel', newPassword: 'secreto123',
  });
  assert.equal(res.username, 'miguel');

  // Old token no longer valid after secret rotation; new one is.
  assert.equal(await authService.getSession(oldToken), null);
  assert.ok(await authService.getSession(res.token));
  // Old credentials rejected, new ones accepted.
  assert.equal(await authService.login('test', 'test'), null);
  assert.ok(await authService.login('miguel', 'secreto123'));
});

test('stored password is hashed (no plaintext)', () => {
  const fs = require('fs');
  const path = require('path');
  const raw = fs.readFileSync(path.join(dataDir, 'auth.json'), 'utf8');
  assert.ok(!raw.includes('secreto123'));
  assert.ok(!raw.includes('"password"'));
  const creds = JSON.parse(raw);
  assert.equal(creds.hash.length, 128); // 64 bytes hex
  assert.ok(creds.salt && creds.sessionSecret);
});
