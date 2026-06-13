// Boots the app for e2e tests against a throwaway temp data dir, so browser
// tests never touch real data. Used by playwright.config.js as the webServer.
const { seedTempData } = require('../helpers');

const dataDir = seedTempData();
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.E2E_PORT || '3100';
process.env.HOST = '127.0.0.1';
delete process.env.ANTHROPIC_API_KEY;

const config = require('../../src/config');
const createApp = require('../../src/app');

createApp().listen(config.port, config.host, () => {
  console.log(`[e2e] server on http://${config.host}:${config.port} (data: ${dataDir})`);
});
