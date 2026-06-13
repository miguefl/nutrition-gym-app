const { Router } = require('express');
const asyncHandler = require('./asyncHandler');
const { validateAlias, validateNameParam } = require('../validation');
const { BadRequestError } = require('../errors');
const aliasesService = require('../services/aliasesService');
const { writeLimiter } = require('../middleware/security');

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await aliasesService.list());
}));

router.post('/', writeLimiter, asyncHandler(async (req, res) => {
  const v = validateAlias(req.body);
  if (!v.ok) throw new BadRequestError(v.error);
  const entry = await aliasesService.save(v.value);
  res.status(201).json(entry);
}));

router.delete('/:name', writeLimiter, asyncHandler(async (req, res) => {
  const n = validateNameParam(req.params.name);
  if (!n.ok) throw new BadRequestError(n.error);
  await aliasesService.remove(n.value);
  res.status(204).end();
}));

module.exports = router;
