const store = require('./jsonStore');
const { paths } = require('../config');

function findAll() {
  return store.read(paths.recipes);
}

// Inserts only if no other recipe has the same name (case-insensitive).
// Returns { inserted: boolean }.
function insertIfAbsent(recipe) {
  const nameNorm = recipe.nombre.toLowerCase();
  return store.update(paths.recipes, (recipes) => {
    const exists = recipes.some(r => String(r.nombre || '').toLowerCase() === nameNorm);
    if (exists) return { inserted: false };
    return { data: [...recipes, recipe], inserted: true };
  });
}

// Replaces the recipe `originalName` with `recipe` (allows renaming).
// Returns { updated: boolean, conflict: boolean }.
function replaceByName(originalName, recipe) {
  const origNorm = originalName.toLowerCase();
  const newNorm = recipe.nombre.toLowerCase();
  return store.update(paths.recipes, (recipes) => {
    const idx = recipes.findIndex(r => String(r.nombre || '').toLowerCase() === origNorm);
    if (idx < 0) return { updated: false, conflict: false };
    const clashes = recipes.some((r, i) =>
      i !== idx && String(r.nombre || '').toLowerCase() === newNorm
    );
    if (clashes) return { updated: false, conflict: true };
    const data = [...recipes];
    data[idx] = recipe;
    return { data, updated: true, conflict: false };
  });
}

// Returns { removed: boolean }.
function removeByName(name) {
  const norm = name.toLowerCase();
  return store.update(paths.recipes, (recipes) => {
    const data = recipes.filter(r => String(r.nombre || '').toLowerCase() !== norm);
    if (data.length === recipes.length) return { removed: false };
    return { data, removed: true };
  });
}

module.exports = { findAll, insertIfAbsent, replaceByName, removeByName };
