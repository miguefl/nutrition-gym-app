const { Router } = require('express');
const asyncHandler = require('./asyncHandler');
const equivalencesRepository = require('../repositories/equivalencesRepository');

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await equivalencesRepository.findAll());
}));

module.exports = router;
