import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'data.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uploader TEXT NOT NULL DEFAULT 'sishuo',
    filename TEXT,
    original_name TEXT,
    size INTEGER,
    status TEXT NOT NULL DEFAULT 'queued',     -- queued | processing | posted | failed
    error TEXT,
    duration_seconds INTEGER,                   -- 耗时
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    posted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    bucket TEXT NOT NULL DEFAULT 'today',       -- today | tomorrow
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 轻量迁移:给老库补上后加的列(CREATE TABLE IF NOT EXISTS 不会给已存在的表加列)
for (const [col, def] of [
  ['caption', 'TEXT'],         // 实际发到频道的文案
  ['caption_mode', 'TEXT'],    // claude=AI生成 / template=模板兜底
  ['video_path', 'TEXT'],      // 处理后视频的 /files 访问路径(供详情页保存)
  ['screenshots', 'TEXT'],     // 截图 /files 路径的 JSON 数组
]) {
  try { db.exec(`ALTER TABLE tasks ADD COLUMN ${col} ${def}`); }
  catch (e) { /* 已存在则忽略 */ }
}

// 首次启动时塞一些演示数据,让界面不空
const count = db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO tasks (id, uploader, original_name, status, duration_seconds, created_at, posted_at)
    VALUES (@id, @uploader, @original_name, @status, @duration_seconds, @created_at, @posted_at)
  `);
  const demo = [
    { id: 496, original_name: 'clip-496.mp4', duration_seconds: 326, created_at: '2026-05-31 16:03:00' },
    { id: 495, original_name: 'clip-495.mp4', duration_seconds: 267, created_at: '2026-05-31 15:54:00' },
    { id: 494, original_name: 'clip-494.mp4', duration_seconds: 234, created_at: '2026-05-31 15:50:00' },
    { id: 493, original_name: 'clip-493.mp4', duration_seconds: 288, created_at: '2026-05-31 15:49:00' },
    { id: 492, original_name: 'clip-492.mp4', duration_seconds: 218, created_at: '2026-05-31 15:47:00' },
    { id: 491, original_name: 'clip-491.mp4', duration_seconds: 575, created_at: '2026-05-31 05:14:00' },
    { id: 490, original_name: 'clip-490.mp4', duration_seconds: 132, created_at: '2026-05-31 05:10:00' },
  ];
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      insert.run({
        ...r,
        uploader: 'sishuo',
        status: 'posted',
        posted_at: r.created_at,
      });
    }
  });
  tx(demo);
}

export default db;
