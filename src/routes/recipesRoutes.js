const { Router } = require('express');
const asyncHandler = require('./asyncHandler');
const { validateRecipe, validateNameParam } = require('../validation');
const { BadRequestError } = require('../errors');
const recipesService = require('../services/recipesService');
const { writeLimiter } = require('../middleware/security');

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await recipesService.list());
}));

router.post('/', writeLimiter, asyncHandler(async (req, res) => {
  const v = validateRecipe(req.body);
  if (!v.ok) throw new BadRequestError(v.error);
  const recipe = await recipesService.create(v.value);
  res.status(201).json(recipe);
}));

router.put('/:name', writeLimiter, asyncHandler(async (req, res) => {
  const n = validateNameParam(req.params.name);
  if (!n.ok) throw new BadRequestError(n.error);
  const v = validateRecipe(req.body);
  if (!v.ok) throw new BadRequestError(v.error);
  const recipe = await recipesService.update(n.value, v.value);
  res.json(recipe);
}));

router.delete('/:name', writeLimiter, asyncHandler(async (req, res) => {
  const n = validateNameParam(req.params.name);
  if (!n.ok) throw new BadRequestError(n.error);
  await recipesService.remove(n.value);
  res.status(204).end();
}));

module.exports = router;
