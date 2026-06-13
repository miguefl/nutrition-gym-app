const { Router } = require('express');
const asyncHandler = require('./asyncHandler');
const { validateLogEntry } = require('../validation');
const { BadRequestError } = require('../errors');
const logService = require('../services/logService');
const { writeLimiter } = require('../middleware/security');

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await logService.get());
}));

router.put('/:date', writeLimiter, asyncHandler(async (req, res) => {
  const v = validateLogEntry(req.params.date, req.body);
  if (!v.ok) throw new BadRequestError(v.error);
  res.json(await logService.mark(v.value.fecha, v.value.comida, v.value.estado));
}));

module.exports = router;
