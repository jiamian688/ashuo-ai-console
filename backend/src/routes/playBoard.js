import { Router } from 'express';
import { playBoardConfigured, TYPES, getBoard, refreshSnapshot, probe, scan } from '../services/playBoard.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json({ configured: playBoardConfigured(), types: TYPES.map((t) => ({ key: t.key, label: t.label })) });
});

// 读本地快照,不打后台接口。limit 不传 = 返回全部(可能几千条)。
router.get('/board', (req, res) => {
  try {
    const type = req.query.type || TYPES[0].key;
    const limit = Number(req.query.limit) || 0;
    res.json(getBoard(type, { limit }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 手动刷新:真的去后台分页拉全量再排序,数据量大时会比较慢(几秒到几十秒)。
router.post('/refresh', async (req, res) => {
  try {
    const type = req.query.type || TYPES[0].key;
    await refreshSnapshot(type);
    res.json(getBoard(type, { limit: Number(req.query.limit) || 0 }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 调试:看某个内容模块列表返回的原始字段,用来确认「播放量」字段名
router.get('/probe', async (req, res) => {
  try {
    res.json(await probe(req.query.type || TYPES[0].key));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 调试:一次性扫一批可能的 resource 名,返回哪些通 + 疑似播放量/标题字段
router.get('/scan', async (req, res) => {
  try {
    res.json(await scan());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
