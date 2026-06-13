const store = require('../repositories/jsonStore');
const { paths } = require('../config');

// Exports all data in a single downloadable JSON.
async function exportAll() {
  const [recipes, equivalences, aliases, plan, log] = await Promise.all([
    store.read(paths.recipes),
    store.read(paths.equivalences),
    store.read(paths.aliases),
    store.read(paths.plan),
    store.read(paths.log),
  ]);
  return {
    exported_at: new Date().toISOString(),
    version: 1,
    recetas: recipes,
    equivalencias: equivalences,
    alias: aliases,
    plan,
    registro: log,
  };
}

module.exports = { exportAll };
