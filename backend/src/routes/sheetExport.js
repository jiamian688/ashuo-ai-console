// 给 Google Apps Script 定时读取用的导出接口。不走站内登录(Apps Script 没法登录拿 token),
// 用一个共享密钥(SHEET_EXPORT_TOKEN)保护,谁都可以调但必须带对密钥。
import { Router } from 'express';
import { listDailyReports } from '../services/businessData.js';

const router = Router();

function checkToken(req, res, next) {
  const token = process.env.SHEET_EXPORT_TOKEN;
  if (!token) return res.status(400).json({ error: '后端未配置 SHEET_EXPORT_TOKEN' });
  if (req.query.token !== token) return res.status(401).json({ error: 'token 不对' });
  next();
}

// 最新一天(已生成的)经营数据,给 Google Sheet 每天定时抓取用。
router.get('/daily-latest', checkToken, async (req, res) => {
  try {
    const { list } = await listDailyReports({ limit: 1 });
    res.json(list[0] || null);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
