const planRepo = require('../repositories/planRepository');
const recipesRepo = require('../repositories/recipesRepository');
const { BadRequestError } = require('../errors');

function get() {
  return planRepo.get();
}

// Saves the full plan. Referenced recipes must exist.
async function save(plan) {
  const recipes = await recipesRepo.findAll();
  const names = new Set(recipes.map(r => String(r.nombre || '').toLowerCase()));
  for (const [day, meals] of Object.entries(plan)) {
    for (const [meal, recipe] of Object.entries(meals)) {
      if (recipe && !names.has(recipe.toLowerCase())) {
        throw new BadRequestError(`${day}.${meal}: no existe la receta "${recipe}".`);
      }
    }
  }
  await planRepo.replace(plan);
  return plan;
}

module.exports = { get, save };
