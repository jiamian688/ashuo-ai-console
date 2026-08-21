import { Router } from 'express';
import { adminConfigured } from '../services/adminClient.js';
import { listDailyReports, getTodayStats } from '../services/businessData.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json({ configured: adminConfigured() });
});

router.get('/daily', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 30;
    const { list, total } = await listDailyReports({ limit });
    res.json({ list, total });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/today', async (req, res) => {
  try {
    const stats = await getTodayStats();
    res.json({ stats });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
