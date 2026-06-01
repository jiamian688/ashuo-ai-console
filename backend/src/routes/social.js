import { Router } from 'express';
import { twitterConfigured, testTwitter, postTweet } from '../services/twitter.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json({ configured: twitterConfigured() });
});

router.post('/test', async (req, res) => {
  try {
    const me = await testTwitter();
    res.json({ ok: true, ...me });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post('/post', async (req, res) => {
  try {
    const result = await postTweet(req.body?.text);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;
