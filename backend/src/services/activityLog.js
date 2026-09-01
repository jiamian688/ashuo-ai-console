// 操作日志:登录/退出 + 账号相关的敏感操作,统一记到 activity_log 表。
// 只写不删(需要清理时另外加定时任务),查询走 /api/activity(仅管理员)。
import db from '../db.js';

// 取真实客户端 IP。后端在 nginx / Vercel 后面时,socket 里是代理 IP,
// 真实 IP 在 X-Forwarded-For 第一段。index.js 里已 app.set('trust proxy', true),
// 所以 req.ip 一般够用;这里再兜底一次。
export function clientIp(req) {
  if (!req) return null;
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.ip || req.socket?.remoteAddress || null;
}

const insertStmt = db.prepare(
  `INSERT INTO activity_log (actor, actor_id, action, target, detail, ip, user_agent)
   VALUES (@actor, @actor_id, @action, @target, @detail, @ip, @user_agent)`
);

// logActivity({ req, actor, actorId, action, target, detail })
// - action 必填(见下方 ACTIONS);其余可选
// - detail 传对象会自动 JSON 序列化
// 记日志失败绝不能影响主流程,整体 try/catch 吞掉。
export function logActivity({ req, actor, actorId, action, target, detail } = {}) {
  try {
    insertStmt.run({
      actor: actor ?? null,
      actor_id: actorId ?? null,
      action,
      target: target ?? null,
      detail:
        detail == null ? null : typeof detail === 'string' ? detail : JSON.stringify(detail),
      ip: clientIp(req),
      user_agent: req ? String(req.headers['user-agent'] || '').slice(0, 300) : null,
    });
  } catch (e) {
    console.error('[activityLog] 写入失败:', e.message);
  }
}

export const ACTIONS = [
  'login_ok',
  'login_fail',
  'logout',
  'create_user',
  'reset_password',
  'update_tools',
  'delete_user',
];

export function listActivity({ action, actor, page = 1, limit = 50 } = {}) {
  const where = [];
  const params = {};
  if (action) {
    where.push('action = @action');
    params.action = action;
  }
  if (actor) {
    where.push('actor LIKE @actor');
    params.actor = `%${actor}%`;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM activity_log ${clause}`).get(params).n;
  const rows = db
    .prepare(
      `SELECT id, ts, actor, actor_id, action, target, detail, ip, user_agent
         FROM activity_log ${clause}
        ORDER BY id DESC
        LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset: (page - 1) * limit });
  return { rows, total, page, limit };
}
