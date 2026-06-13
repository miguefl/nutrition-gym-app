const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { seedTempData, cleanup } = require('../helpers');

// Point DATA_DIR at a temp dir BEFORE the app/config is loaded.
const dataDir = seedTempData();
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = 'test';
delete process.env.ANTHROPIC_API_KEY; // exercise the "AI not configured" path

const createApp = require('../../src/app');
const app = createApp();

// Logs in and returns a supertest agent that carries the session cookie.
async function authedAgent() {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'test', password: 'test' }).expect(200);
  return agent;
}

after(() => cleanup(dataDir));

describe('auth', () => {
  test('GET /api/auth/me is public and reports anonymous', async () => {
    const res = await request(app).get('/api/auth/me').expect(200);
    assert.equal(res.body.authenticated, false);
  });

  test('protected routes return 401 without a session', async () => {
    await request(app).get('/api/recipes').expect(401);
    await request(app).get('/api/plan').expect(401);
  });

  test('login rejects bad credentials, accepts good ones', async () => {
    await request(app).post('/api/auth/login').send({ username: 'test', password: 'bad' }).expect(401);
    const agent = await authedAgent();
    const me = await agent.get('/api/auth/me').expect(200);
    assert.equal(me.body.authenticated, true);
    assert.equal(me.body.username, 'test');
  });

  test('protected route works with a session', async () => {
    const agent = await authedAgent();
    await agent.get('/api/recipes').expect(200);
  });

  test('logout clears the session', async () => {
    const agent = await authedAgent();
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/recipes').expect(401);
  });
});

describe('recipes CRUD', () => {
  test('create, reject duplicate, update (rename), delete', async () => {
    const agent = await authedAgent();
    const recipe = {
      nombre: 'Test Integración',
      tipo_comida: 'cena',
      ingredientes: [{ nombre: 'pollo', cantidad: '200 g', tipo: 'carne blanca' }],
    };
    await agent.post('/api/recipes').send(recipe).expect(201);

    // duplicate name → 409
    await agent.post('/api/recipes').send(recipe).expect(409);

    // appears in the list
    const list = await agent.get('/api/recipes').expect(200);
    assert.ok(list.body.some(r => r.nombre === 'Test Integración'));

    // update + rename
    await agent.put('/api/recipes/Test%20Integraci%C3%B3n')
      .send({ ...recipe, nombre: 'Test Integración 2' }).expect(200);

    // delete (old name now 404, new one 204)
    await agent.delete('/api/recipes/Test%20Integraci%C3%B3n').expect(404);
    await agent.delete('/api/recipes/Test%20Integraci%C3%B3n%202').expect(204);
  });

  test('rejects invalid payloads with 400', async () => {
    const agent = await authedAgent();
    await agent.post('/api/recipes').send({ nombre: 'x', tipo_comida: 'brunch', ingredientes: [{ nombre: 'a' }] }).expect(400);
    await agent.post('/api/recipes').send({ tipo_comida: 'cena', ingredientes: [] }).expect(400);
  });

  test('XSS in tipo_comida is rejected by the enum check', async () => {
    const agent = await authedAgent();
    await agent.post('/api/recipes')
      .send({ nombre: 'xss', tipo_comida: '<img src=x onerror=alert(1)>', ingredientes: [{ nombre: 'a' }] })
      .expect(400);
  });
});

describe('aliases', () => {
  test('upsert and delete', async () => {
    const agent = await authedAgent();
    await agent.post('/api/aliases').send({ nombre: 'Kefir', cat: 'proteinas_magras', gPorBloque: 200 }).expect(201);
    const list = await agent.get('/api/aliases').expect(200);
    assert.ok(list.body.some(a => a.nombre === 'kefir'));
    await agent.delete('/api/aliases/kefir').expect(204);
    await agent.delete('/api/aliases/kefir').expect(404);
  });

  test('rejects invalid category', async () => {
    const agent = await authedAgent();
    await agent.post('/api/aliases').send({ nombre: 'x', cat: 'nope', gPorBloque: 1 }).expect(400);
  });
});

describe('plan', () => {
  test('rejects references to missing recipes, accepts valid plan', async () => {
    const agent = await authedAgent();
    await agent.put('/api/plan').send({ lunes: { comida: 'No existe' } }).expect(400);

    // use an existing seeded recipe
    const recipes = (await agent.get('/api/recipes')).body;
    const someName = recipes[0].nombre;
    const res = await agent.put('/api/plan').send({ lunes: { [recipes[0].tipo_comida]: someName } }).expect(200);
    assert.equal(res.body.lunes[recipes[0].tipo_comida], someName);
  });
});

describe('adherence log', () => {
  test('mark a meal and read it back; invalid date rejected', async () => {
    const agent = await authedAgent();
    await agent.put('/api/log/2026-06-13').send({ comida: 'desayuno', estado: 'ok' }).expect(200);
    const log = await agent.get('/api/log').expect(200);
    assert.equal(log.body['2026-06-13'].desayuno, 'ok');
    await agent.put('/api/log/13-06-2026').send({ comida: 'desayuno', estado: 'ok' }).expect(400);
  });
});

describe('backup', () => {
  test('exports all data with a download header', async () => {
    const agent = await authedAgent();
    const res = await agent.get('/api/backup').expect(200);
    assert.match(res.headers['content-disposition'] || '', /attachment; filename="menu-backup-/);
    for (const k of ['recetas', 'equivalencias', 'alias', 'plan', 'registro']) {
      assert.ok(k in res.body);
    }
  });
});

describe('ai (not configured)', () => {
  test('returns 503 when no API key, 400 for invalid body', async () => {
    const agent = await authedAgent();
    await agent.post('/api/ai/equivalence').send({ nombre: 'hummus' }).expect(503);
    await agent.post('/api/ai/recipe').send({ tipo_comida: 'cena', ingredientes: ['pollo'] }).expect(503);
    await agent.post('/api/ai/equivalence').send({}).expect(400);
  });
});

describe('security headers & origin', () => {
  test('sets a Content-Security-Policy header', async () => {
    const res = await request(app).get('/api/auth/me').expect(200);
    assert.ok(res.headers['content-security-policy']);
  });

  test('rejects cross-origin mutations with 403', async () => {
    const agent = await authedAgent();
    await agent.post('/api/recipes').set('Origin', 'http://evil.com').send({}).expect(403);
  });
});
