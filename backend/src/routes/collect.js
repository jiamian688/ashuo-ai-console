import { Router } from 'express';
import { collectVideo, extractVideoUrls } from '../services/collect.js';

const router = Router();

// 采集:m3u8/mp4 直链 或 网页地址 -> 下载合并成 MP4
router.post('/', async (req, res) => {
  const { url, referer } = req.body || {};
  if (!url) return res.status(400).json({ error: '请填视频或页面地址' });
  try {
    res.json(await collectVideo(url, { referer }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 只从网页里提取候选视频地址,不下载
router.post('/extract', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: '请填页面地址' });
  try {
    res.json({ urls: await extractVideoUrls(url) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
