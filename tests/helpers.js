// Shared test helpers. These must not require ../src/config so that callers
// can set process.env.DATA_DIR before the app is loaded.
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const SEED_DIR = path.join(__dirname, '..', 'datos');
const DATA_FILES = ['recetas.json', 'equivalencias.json', 'alias.json', 'plan.json', 'registro.json'];

// Creates a fresh temp data dir seeded from the repo's datos/ files so tests
// never touch real data. Returns the absolute path.
function seedTempData() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-test-'));
  for (const f of DATA_FILES) {
    fs.copyFileSync(path.join(SEED_DIR, f), path.join(dir, f));
  }
  return dir;
}

function cleanup(dir) {
  if (dir && dir.includes('menu-test-')) fs.rmSync(dir, { recursive: true, force: true });
}

// Loads the browser-global Blocks engine into a Node context for unit testing.
function loadBlocks() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'blocks.js'), 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`${code}\nthis.__Blocks = Blocks;`, ctx);
  return ctx.__Blocks;
}

module.exports = { seedTempData, cleanup, loadBlocks };
