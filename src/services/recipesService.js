const repo = require('../repositories/recipesRepository');
const { ConflictError, NotFoundError } = require('../errors');

function list() {
  return repo.findAll();
}

async function create(recipe) {
  const { inserted } = await repo.insertIfAbsent(recipe);
  if (!inserted) {
    throw new ConflictError(`Ya existe una receta con el nombre "${recipe.nombre}"`);
  }
  return recipe;
}

async function update(originalName, recipe) {
  const { updated, conflict } = await repo.replaceByName(originalName, recipe);
  if (conflict) {
    throw new ConflictError(`Ya existe otra receta con el nombre "${recipe.nombre}"`);
  }
  if (!updated) {
    throw new NotFoundError(`No existe la receta "${originalName}"`);
  }
  return recipe;
}

async function remove(name) {
  const { removed } = await repo.removeByName(name);
  if (!removed) throw new NotFoundError(`No existe la receta "${name}"`);
}

module.exports = { list, create, update, remove };
