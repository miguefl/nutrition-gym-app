const { Router } = require('express');
const asyncHandler = require('./asyncHandler');
const backupService = require('../services/backupService');

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const data = await backupService.exportAll();
  const date = data.exported_at.slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="menu-backup-${date}.json"`);
  res.json(data);
}));

module.exports = router;
