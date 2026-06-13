const { Router } = require('express');
const asyncHandler = require('./asyncHandler');
const { validatePlan } = require('../validation');
const { BadRequestError } = require('../errors');
const planService = require('../services/planService');
const { writeLimiter } = require('../middleware/security');

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await planService.get());
}));

router.put('/', writeLimiter, asyncHandler(async (req, res) => {
  const v = validatePlan(req.body);
  if (!v.ok) throw new BadRequestError(v.error);
  res.json(await planService.save(v.value));
}));

module.exports = router;
