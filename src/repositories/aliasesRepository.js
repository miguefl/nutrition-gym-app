const store = require('./jsonStore');
const { paths } = require('../config');

function findAll() {
  return store.read(paths.aliases);
}

// Inserts or replaces the alias by normalized name.
function upsert(entry) {
  return store.update(paths.aliases, (aliases) => {
    const idx = aliases.findIndex(
      x => String(x.nombre || '').toLowerCase().trim() === entry.nombre
    );
    const data = [...aliases];
    if (idx >= 0) data[idx] = entry; else data.push(entry);
    return { data };
  });
}

// Returns { removed: boolean }.
function removeByName(name) {
  const norm = name.toLowerCase().trim();
  return store.update(paths.aliases, (aliases) => {
    const data = aliases.filter(
      x => String(x.nombre || '').toLowerCase().trim() !== norm
    );
    if (data.length === aliases.length) return { removed: false };
    return { data, removed: true };
  });
}

module.exports = { findAll, upsert, removeByName };
