const repo = require('../repositories/aliasesRepository');
const { NotFoundError } = require('../errors');

function list() {
  return repo.findAll();
}

async function save(alias) {
  const entry = { ...alias, approved_at: new Date().toISOString() };
  await repo.upsert(entry);
  return entry;
}

async function remove(name) {
  const { removed } = await repo.removeByName(name);
  if (!removed) throw new NotFoundError(`No existe la equivalencia "${name}"`);
}

module.exports = { list, save, remove };
