// 操作日志查询接口。挂载处已套 requireAuth + requireAdmin(见 index.js),这里不再判权限。
import { Router } from 'express';
import { listActivity, ACTIONS } from '../services/activityLog.js';

const router = Router();

router.get('/', (req, res) => {
  const { action, actor } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  res.json(listActivity({
    action: ACTIONS.includes(action) ? action : undefined,
    actor: actor ? String(actor).trim() : undefined,
    page,
    limit,
  }));
});

export default router;
