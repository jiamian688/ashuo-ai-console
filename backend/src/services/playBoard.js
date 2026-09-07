// 播放看板:从 hanimepro 管理后台各内容模块的列表接口取「播放量 Top」,按内容类型分组。
//
// ⚠️ 后台真实的 resource 路径和「播放量」字段名还没最终确认。下面按最可能的命名先配上;
//    部署后用  GET /api/play-board/probe?type=<key>  看某个模块返回的原始字段,
//    再据此改 TYPES 里的 resource / titleFields,以及 PLAY_FIELD_CANDIDATES。
import db from '../db.js';
import { adminConfigured, adminCall } from './adminClient.js';

export const TYPES = [
  // 动漫/成人 都是视频内容,标签带「视频」以示区分;不再单列「视频」tab
  { key: 'cartoon', label: '动漫视频', resource: 'cartoon', titleFields: ['title', 'second_title', 'name'] },
  { key: 'mv', label: '成人视频', resource: 'mv', titleFields: ['title', 'second_title', 'name'] }, // 已确认可用,字段 count_play
  { key: 'comic', label: '漫画', resource: 'comic', titleFields: ['title', 'comic_name', 'name'] }, // ⚠️ /admin/comic 404,真实 resource 名待确认
  { key: 'book', label: '小说', resource: 'book', titleFields: ['title', 'book_name', 'name'] },
];

// 首行里按这个顺序找「播放量」字段(找到第一个数字型的就用)。
// mv 实测字段:count_play(展示播放)/ real_count_play(真实播放);注意别命中 count_pay。
const PLAY_FIELD_CANDIDATES = [
  'count_play', 'real_count_play',
  'play_num', 'play_count', 'playnum', 'plays', 'play', 'play_total',
  'view_count', 'view_num', 'views', 'watch_num', 'watch_count',
  'hits', 'hit', 'look_num', 'read_num', 'click_num',
  'hot', 'heat', 'popularity',
];

export const playBoardConfigured = adminConfigured;

function typeCfg(key) {
  const t = TYPES.find((x) => x.key === key);
  if (!t) throw new Error('未知内容类型: ' + key);
  return t;
}

function pickPlayField(row) {
  for (const f of PLAY_FIELD_CANDIDATES) {
    const v = row[f];
    if (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v))) return f;
  }
  return null;
}

function pickTitle(row, titleFields) {
  for (const f of titleFields) if (row[f]) return String(row[f]);
  return String(row.name || row.title || `#${row.id ?? ''}`);
}

async function fetchList(resource, limit = 80) {
  const data = await adminCall(`/admin/${resource}/listAjax`, { params: { page: 1, limit } });
  return Array.isArray(data.data) ? data.data : [];
}

// 原始首行 + 字段名清单,供人工确认「播放量」到底叫什么
export async function probe(key) {
  const cfg = typeCfg(key);
  const rows = await fetchList(cfg.resource, 1);
  return {
    resource: cfg.resource,
    detectedPlayField: rows[0] ? pickPlayField(rows[0]) : null,
    sampleKeys: rows[0] ? Object.keys(rows[0]) : [],
    sample: rows[0] || null,
  };
}

// 快照表:每天记录一次各内容 Top-N 的累计播放,用来算「当日新增播放」
db.exec(`
  CREATE TABLE IF NOT EXISTS play_snapshot (
    date TEXT NOT NULL,            -- 北京时间 YYYY-MM-DD
    type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    title TEXT,
    play_total INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (date, type, item_id)
  );
`);

const bjDate = (offsetDays = 0) =>
  new Date(Date.now() + 8 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);

const upsertSnap = db.prepare(`
  INSERT INTO play_snapshot (date, type, item_id, title, play_total)
  VALUES (@date, @type, @item_id, @title, @play_total)
  ON CONFLICT(date, type, item_id) DO UPDATE SET play_total = excluded.play_total, title = excluded.title
`);
const getSnap = db.prepare(`SELECT play_total FROM play_snapshot WHERE date = ? AND type = ? AND item_id = ?`);

export async function getBoard(key, { limit = 10 } = {}) {
  const cfg = typeCfg(key);
  const rows = await fetchList(cfg.resource, 80);
  if (!rows.length) {
    return { type: key, label: cfg.label, playField: null, list: [], note: `后台 /admin/${cfg.resource}/listAjax 返回空,确认 resource 名是否正确` };
  }
  const playField = pickPlayField(rows[0]);
  if (!playField) {
    return {
      type: key, label: cfg.label, playField: null, list: [],
      sampleKeys: Object.keys(rows[0]),
      note: '返回里没识别到播放量字段,用 /api/play-board/probe?type=' + key + ' 查字段名后补进 PLAY_FIELD_CANDIDATES',
    };
  }
  const today = bjDate(0);
  const yday = bjDate(-1);
  const ranked = rows
    .map((r) => ({ id: String(r.id ?? r._pk ?? r.pk ?? ''), title: pickTitle(r, cfg.titleFields), total: Number(r[playField]) || 0 }))
    .filter((r) => r.id)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  const tx = db.transaction((items) => {
    for (const it of items) upsertSnap.run({ date: today, type: key, item_id: it.id, title: it.title, play_total: it.total });
  });
  try { tx(ranked); } catch { /* 快照失败不影响展示 */ }

  const list = ranked.map((it, i) => {
    const y = getSnap.get(yday, key, it.id);
    return { rank: i + 1, id: it.id, title: it.title, playTotal: it.total, playToday: y ? Math.max(it.total - y.play_total, 0) : null };
  });
  return { type: key, label: cfg.label, playField, date: today, hasYesterday: list.some((x) => x.playToday !== null), list };
}

export async function snapshotAll() {
  if (!adminConfigured()) return;
  for (const t of TYPES) {
    try { await getBoard(t.key, { limit: 30 }); }
    catch (e) { console.error(`[播放看板快照] ${t.key} 失败: ${e.message}`); }
  }
  console.log(`[播放看板快照] ${bjDate(0)} 已记录各内容 Top30 累计播放`);
}

export function startPlayBoardScheduler() {
  setTimeout(() => snapshotAll().catch((e) => console.error('[播放看板快照] ' + e.message)), 30_000);
  setInterval(() => snapshotAll().catch((e) => console.error('[播放看板快照] ' + e.message)), 6 * 3600e3);
  console.log('[播放看板快照] 定时任务已启动,每 6 小时记录一次(用于计算当日新增播放)');
}
