const { Router } = require('express');
const asyncHandler = require('./asyncHandler');
const { validateAIQuery, validateRecipeSuggestion } = require('../validation');
const { BadRequestError } = require('../errors');
const aiService = require('../services/aiService');
const { aiLimiter } = require('../middleware/security');

const router = Router();

router.post('/equivalence', aiLimiter, asyncHandler(async (req, res) => {
  const v = validateAIQuery(req.body);
  if (!v.ok) throw new BadRequestError(v.error);
  const alias = await aiService.proposeEquivalence(v.value.nombre, v.value.contexto);
  res.json({ alias });
}));

router.post('/recipe', aiLimiter, asyncHandler(async (req, res) => {
  const v = validateRecipeSuggestion(req.body);
  if (!v.ok) throw new BadRequestError(v.error);
  const { tipo_comida, ingredientes, contexto } = v.value;
  res.json(await aiService.suggestRecipe(tipo_comida, ingredientes, contexto));
}));

module.exports = router;
