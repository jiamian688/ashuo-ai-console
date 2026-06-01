import { Router } from 'express';
import { telegramConfigured, testTelegram } from '../services/telegram.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json({ configured: telegramConfigured() });
});

router.post('/test', async (req, res) => {
  try {
    const result = await testTelegram({ sendPing: req.body?.sendPing !== false });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;
