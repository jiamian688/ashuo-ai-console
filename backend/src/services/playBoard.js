// 播放看板:从 hanimepro 管理后台各内容模块的列表接口取「播放量 Top」,按内容类型分组。
//
// 已确认(2026-09):这个后台里有 mv / book / porngame 三个内容表。
//   - mv:视频库,播放量字段 count_play(真实值 real_count_play)
//   - book:漫画 + 小说 混在一张表,靠 type 区分(type_str "小說"=小说;漫画为另一值),播放量 view_count
//   - porngame:H 游,播放量 view_count
//   动漫是「动漫后台」另一个独立域名,这个 console 连不到,暂不接。
// ⚠️ listAjax 是否支持按播放量服务端排序还没确认;当前是拉一批(limit=SAMPLE)在本地排序,
//    属「抽样排名」。拿到真实排序参数后把 orderParam 填上即可变全量排名。
import db from '../db.js';
import { adminConfigured, adminCall } from './adminClient.js';

const SAMPLE = 500; // 每类拉多少条参与排序

export const TYPES = [
  { key: 'mv', label: '视频', resource: 'mv', play: 'count_play', titleFields: ['title', 'second_title'] },
  {
    key: 'comic', label: '漫画', resource: 'book', play: 'view_count', titleFields: ['name', 'name_tw'],
    where: { 'book.type': 1 },
    rowFilter: (r) => Number(r.type) === 1 || /漫/.test(r.type_str || '') || !!r.comic_type_name,
  },
  {
    key: 'book', label: '小说', resource: 'book', play: 'view_count', titleFields: ['name', 'name_tw'],
    where: { 'book.type': 2 },
    rowFilter: (r) => Number(r.type) === 2 || /小[說说]/.test(r.type_str || '') || !!r.novel_type_name,
  },
  { key: 'porngame', label: 'H游', resource: 'porngame', play: 'view_count', titleFields: ['name'] },
];

// 自动识别播放量字段用的候选(type 未显式给 play 时兜底)
const PLAY_FIELD_CANDIDATES = [
  'count_play', 'real_count_play', 'view_count', 'real_view_count',
  'play_num', 'play_count', 'playnum', 'plays', 'watch_num', 'watch_count',
  'hits', 'read_num', 'click_num', 'hot',
];

export const playBoardConfigured = adminConfigured;

function typeCfg(key) {
  const t = TYPES.find((x) => x.key === key);
  if (!t) throw new Error('未知内容类型: ' + key);
  return t;
}

function pickPlayField(row, prefer) {
  if (prefer && row[prefer] !== undefined && !Number.isNaN(Number(row[prefer]))) return prefer;
  for (const f of PLAY_FIELD_CANDIDATES) {
    const v = row[f];
    if (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v))) return f;
  }
  return null;
}

function pickTitle(row, titleFields = []) {
  for (const f of titleFields) if (row[f]) return String(row[f]);
  return String(row.name || row.title || `#${row.id ?? ''}`);
}

async function fetchList(resource, { limit = SAMPLE, where = {}, orderBy } = {}) {
  const params = { page: 1, limit };
  for (const [k, v] of Object.entries(where)) params[`where[${k}]`] = v;
  // 尽力尝试服务端排序(后台若不认这参数则忽略,不影响)
  if (orderBy) params[`order[${orderBy}]`] = 'desc';
  const data = await adminCall(`/admin/${resource}/listAjax`, { params });
  return Array.isArray(data.data) ? data.data : [];
}

// 原始首行 + 字段名清单
export async function probe(key) {
  const cfg = typeCfg(key);
  const rows = await fetchList(cfg.resource, { limit: 1, where: cfg.where || {} });
  return {
    resource: cfg.resource,
    detectedPlayField: rows[0] ? pickPlayField(rows[0], cfg.play) : null,
    sampleKeys: rows[0] ? Object.keys(rows[0]) : [],
    sample: rows[0] || null,
  };
}

// 一次性扫一批可能的内容 resource 名
const SCAN_RESOURCES = [
  'mv', 'book', 'comic', 'cartoon', 'anime', 'animation', 'manga', 'manhua', 'comicbook',
  'dm', 'dongman', 'donghua', 'hmv', 'video', 'novel', 'fiction', 'story',
  'porn', 'game', 'hgame', 'porngame', 'h5game', 'picture', 'photo', 'album', 'cosplay',
];

export async function scan() {
  const out = [];
  for (const r of SCAN_RESOURCES) {
    try {
      const data = await adminCall(`/admin/${r}/listAjax`, { params: { page: 1, limit: 1 } });
      const row = Array.isArray(data.data) ? data.data[0] : null;
      out.push({
        resource: r,
        ok: true,
        count: data.count ?? null,
        detectedPlayField: row ? pickPlayField(row) : null,
        numberKeys: row ? Object.keys(row).filter((k) => /count|num|play|view|hit|click|read|watch|hot|heat|pv|uv/i.test(k)) : [],
        titleKeys: row ? Object.keys(row).filter((k) => /title|name/i.test(k)) : [],
        allKeys: row ? Object.keys(row) : [],
        typeSample: row
          ? Object.fromEntries(Object.entries(row).filter(([k]) => /type|kind|classify|module|is_comic|is_novel|is_book|section|channel/i.test(k)))
          : {},
      });
    } catch (e) {
      out.push({ resource: r, ok: false, error: e.message });
    }
  }
  return { tried: SCAN_RESOURCES.length, results: out };
}

// 快照表:每天记录一次各内容 Top-N 的累计播放,用来算「当日新增播放」
db.exec(`
  CREATE TABLE IF NOT EXISTS play_snapshot (
    date TEXT NOT NULL,
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
  let rows = await fetchList(cfg.resource, {
    limit: SAMPLE,
    where: cfg.where || {},
    orderBy: `${cfg.resource}.${cfg.play}`,
  });
  if (!rows.length) {
    return { type: key, label: cfg.label, playField: null, list: [], note: `后台 /admin/${cfg.resource}/listAjax 返回空` };
  }
  if (cfg.rowFilter) rows = rows.filter(cfg.rowFilter);
  const playField = pickPlayField(rows[0] || {}, cfg.play) || cfg.play;

  const today = bjDate(0);
  const yday = bjDate(-1);
  const ranked = rows
    .map((r) => ({ id: String(r.id ?? r._id ?? ''), title: pickTitle(r, cfg.titleFields), total: Number(r[playField]) || 0 }))
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
  return {
    type: key, label: cfg.label, playField, date: today,
    hasYesterday: list.some((x) => x.playToday !== null),
    sampledFrom: SAMPLE,
    list,
  };
}

export async function snapshotAll() {
  if (!adminConfigured()) return;
  for (const t of TYPES) {
    try { await getBoard(t.key, { limit: 30 }); }
    catch (e) { console.error(`[播放看板快照] ${t.key} 失败: ${e.message}`); }
  }
  console.log(`[播放看板快照] ${bjDate(0)} 已记录各内容 Top30`);
}

export function startPlayBoardScheduler() {
  setTimeout(() => snapshotAll().catch((e) => console.error('[播放看板快照] ' + e.message)), 30_000);
  setInterval(() => snapshotAll().catch((e) => console.error('[播放看板快照] ' + e.message)), 6 * 3600e3);
  console.log('[播放看板快照] 定时任务已启动,每 6 小时记录一次(用于计算当日新增播放)');
}
