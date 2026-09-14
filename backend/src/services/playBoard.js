// 播放看板:从 hanimepro 管理后台各内容模块的列表接口取「播放量排行」,按内容类型分组。
//
// 已确认(2026-09):这个后台里有 mv / book / porngame 三个内容表。
//   - mv:视频库,播放量字段 count_play(真实值 real_count_play)
//   - book:漫画 + 小说 混在一张表,靠 type 区分(type_str "小說"=小说;漫画为另一值),播放量 view_count
//   - porngame:H 游,播放量 view_count
//   动漫是「动漫后台」另一个独立域名,这个 console 连不到,暂不接。
//
// 全量排名(2026-09 改):之前是拉 500 条抽样本地排序,用户反馈每类可能有数千条、要看全部。
// 现在分页拉全量(PAGE_SIZE 一页,直到拉完或碰到安全上限),排序后整批存进 play_snapshot 表。
// 这个全量拉取只在定时快照(startPlayBoardScheduler,每 6 小时)或手动点「刷新」时才会真的
// 打后台接口;日常打开看板页面走的是读本地快照,不会每次都拉全量——不然又大又慢又容易把后台
// 接口打爆。
import db from '../db.js';
import { adminConfigured, adminCall } from './adminClient.js';

const PAGE_SIZE = 200;   // 分页拉全量时,每页请求多少条
const MAX_PAGES = 80;    // 安全上限:每类最多拉 80 页(16000 条),防止某个 resource 数据异常大或分页失控时无限拉

// categoryFields:按优先级尝试的「分类/子分类」候选字段名,取第一个有值的。
export const TYPES = [
  {
    key: 'mv', label: '视频', resource: 'mv', play: 'count_play', titleFields: ['title', 'second_title'],
    categoryFields: ['mv_type_str', 'category_title', 'pay_type_str', 'type_str'],
  },
  {
    key: 'comic', label: '漫画', resource: 'book', play: 'view_count', titleFields: ['name', 'name_tw'],
    where: { 'book.type': 1 },
    rowFilter: (r) => Number(r.type) === 1 || /漫/.test(r.type_str || '') || !!r.comic_type_name,
    categoryFields: ['category_title', 'comic_type_name', 'type_str'],
  },
  {
    key: 'book', label: '小说', resource: 'book', play: 'view_count', titleFields: ['name', 'name_tw'],
    where: { 'book.type': 2 },
    rowFilter: (r) => Number(r.type) === 2 || /小[說说]/.test(r.type_str || '') || !!r.novel_type_name,
    categoryFields: ['category_title', 'novel_type_name', 'type_str'],
  },
  {
    key: 'porngame', label: 'H游', resource: 'porngame', play: 'view_count', titleFields: ['name'],
    categoryFields: ['category_title', 'type_str'],
  },
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

function pickCategory(row, categoryFields = []) {
  for (const f of categoryFields) if (row[f]) return String(row[f]);
  return null;
}

async function fetchList(resource, { limit = PAGE_SIZE, page = 1, where = {}, orderBy } = {}) {
  const params = { page, limit };
  for (const [k, v] of Object.entries(where)) params[`where[${k}]`] = v;
  // 尽力尝试服务端排序(后台若不认这参数则忽略,不影响)
  if (orderBy) params[`order[${orderBy}]`] = 'desc';
  const data = await adminCall(`/admin/${resource}/listAjax`, { params });
  return { rows: Array.isArray(data.data) ? data.data : [], count: data.count ?? null };
}

// 分页拉全量:一直翻页,直到拉到的条数够 count、或者某页返回条数小于 PAGE_SIZE(说明到底了)、
// 或者碰到 MAX_PAGES 安全上限。
async function fetchAllRows(resource, { where = {} } = {}) {
  const all = [];
  let page = 1;
  let total = Infinity;
  while (page <= MAX_PAGES && all.length < total) {
    const { rows, count } = await fetchList(resource, { limit: PAGE_SIZE, page, where });
    if (count !== null) total = count;
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break; // 不足一页,说明已经是最后一页
    page += 1;
  }
  return all;
}

// 原始首行 + 字段名清单
export async function probe(key) {
  const cfg = typeCfg(key);
  const { rows } = await fetchList(cfg.resource, { limit: 1, where: cfg.where || {} });
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

// 对已知能用的表,统计「类型/分类」字段的取值分布,用来决定怎么切「动漫」等子类
async function catDist() {
  const targets = {
    mv: ['mv_type_str', 'category_title', 'pay_type_str'],
    book: ['type_str', 'category_title'],
    porngame: ['category_title'],
  };
  const out = {};
  for (const [resource, fields] of Object.entries(targets)) {
    try {
      const { rows } = await fetchList(resource, { limit: 300 });
      out[resource] = { sample: rows.length };
      for (const f of fields) {
        const tally = {};
        for (const r of rows) {
          const v = r[f] === '' || r[f] === null || r[f] === undefined ? '(空)' : String(r[f]);
          tally[v] = (tally[v] || 0) + 1;
        }
        out[resource][f] = tally;
      }
    } catch (e) {
      out[resource] = { error: e.message };
    }
  }
  return out;
}

export async function scan() {
  const out = [];
  const categories = await catDist();
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
  return { tried: SCAN_RESOURCES.length, results: out, categories };
}

// 快照表:每次全量刷新记一份「当天」快照(同一天内重复刷新会覆盖同一天的数据,不是每次都新增一行),
// 用来算「当日新增播放」= 今天快照 - 昨天快照。
db.exec(`
  CREATE TABLE IF NOT EXISTS play_snapshot (
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    title TEXT,
    category TEXT,
    play_total INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (date, type, item_id)
  );
`);
try { db.exec(`ALTER TABLE play_snapshot ADD COLUMN category TEXT`); } // 给老库补列
catch (e) { /* 已存在则忽略 */ }
db.exec(`CREATE INDEX IF NOT EXISTS idx_play_snapshot_lookup ON play_snapshot (date, type, play_total DESC)`);

const bjDate = (offsetDays = 0) =>
  new Date(Date.now() + 8 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);

const upsertSnap = db.prepare(`
  INSERT INTO play_snapshot (date, type, item_id, title, category, play_total)
  VALUES (@date, @type, @item_id, @title, @category, @play_total)
  ON CONFLICT(date, type, item_id) DO UPDATE SET play_total = excluded.play_total, title = excluded.title, category = excluded.category
`);
const getSnap = db.prepare(`SELECT play_total FROM play_snapshot WHERE date = ? AND type = ? AND item_id = ?`);
const listSnap = db.prepare(`SELECT * FROM play_snapshot WHERE date = ? AND type = ? ORDER BY play_total DESC`);
const latestSnapDate = db.prepare(`SELECT MAX(date) AS d FROM play_snapshot WHERE type = ?`);

// 真正打后台接口、分页拉全量、排序后整批写进 play_snapshot——这是唯一会产生大量请求的地方。
// 由定时任务(每 6 小时)或手动点"刷新"触发,看板页面本身只读快照,不会触发这个。
export async function refreshSnapshot(key) {
  const cfg = typeCfg(key);
  let rows = await fetchAllRows(cfg.resource, { where: cfg.where || {} });
  if (!rows.length) {
    return { type: key, label: cfg.label, total: 0, note: `后台 /admin/${cfg.resource}/listAjax 返回空` };
  }
  if (cfg.rowFilter) rows = rows.filter(cfg.rowFilter);
  const playField = pickPlayField(rows[0] || {}, cfg.play) || cfg.play;

  const today = bjDate(0);
  const items = rows
    .map((r) => ({
      id: String(r.id ?? r._id ?? ''),
      title: pickTitle(r, cfg.titleFields),
      category: pickCategory(r, cfg.categoryFields),
      total: Number(r[playField]) || 0,
    }))
    .filter((r) => r.id)
    .sort((a, b) => b.total - a.total);

  const tx = db.transaction((list) => {
    for (const it of list) {
      upsertSnap.run({ date: today, type: key, item_id: it.id, title: it.title, category: it.category, play_total: it.total });
    }
  });
  tx(items);

  return { type: key, label: cfg.label, total: items.length, playField, date: today };
}

// 看板页面读这个——只查本地快照,不打后台接口,快且不会把后台打爆。
// limit 不传(或传 0/负数)= 返回全部。
export function getBoard(key, { limit } = {}) {
  const cfg = typeCfg(key);
  const date = latestSnapDate.get(key).d;
  if (!date) {
    return { type: key, label: cfg.label, list: [], note: '还没有快照数据,点"刷新"抓一次,或等定时任务(每 6 小时)自动跑' };
  }
  const yday = bjDate(-1);
  let rows = listSnap.all(date, key);
  const total = rows.length;
  if (limit && limit > 0) rows = rows.slice(0, limit);

  const list = rows.map((r, i) => {
    const y = getSnap.get(yday, key, r.item_id);
    return {
      rank: i + 1, id: r.item_id, title: r.title, category: r.category || null,
      playTotal: r.play_total, playToday: y ? Math.max(r.play_total - y.play_total, 0) : null,
    };
  });
  return {
    type: key, label: cfg.label, date, total,
    hasYesterday: list.some((x) => x.playToday !== null),
    list,
  };
}

export async function snapshotAll() {
  if (!adminConfigured()) return;
  for (const t of TYPES) {
    try {
      const r = await refreshSnapshot(t.key);
      console.log(`[播放看板快照] ${t.label}: ${r.total} 条`);
    } catch (e) {
      console.error(`[播放看板快照] ${t.key} 失败: ${e.message}`);
    }
  }
  console.log(`[播放看板快照] ${bjDate(0)} 全量刷新完成`);
}

export function startPlayBoardScheduler() {
  setTimeout(() => snapshotAll().catch((e) => console.error('[播放看板快照] ' + e.message)), 30_000);
  setInterval(() => snapshotAll().catch((e) => console.error('[播放看板快照] ' + e.message)), 6 * 3600e3);
  console.log('[播放看板快照] 定时任务已启动,每 6 小时记录一次(用于计算当日新增播放)');
}
