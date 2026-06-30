import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'comic');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 500 * 1024 * 1024 } });

const FRW_BASE = process.env.FRW_API_BASE || 'https://frw-dreamaiai-api2.aiaiartist.com';
const FRW_KEY  = process.env.FRW_API_KEY  || '';

// FRW 模板 ID
const TPL = {
  img2video: '3487718692404334592',
  txt2img:   '3487741729447088128',
  txt2video: '3487722535879970816',
};

async function frwPost(path, body) {
  const res = await fetch(`${FRW_BASE}${path}`, {
    method: 'POST',
    headers: { 'X-Api-Key': FRW_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || JSON.stringify(data));
  return data;
}

async function frwGet(path) {
  const res = await fetch(`${FRW_BASE}${path}`, {
    headers: { 'X-Api-Key': FRW_KEY },
  });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || JSON.stringify(data));
  return data;
}

/* ── 余额查询 ── */
router.get('/balance', async (req, res) => {
  try {
    const data = await frwGet('/api/frwapi/v1/balance');
    res.json(data.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── 剧本生成（调用后端 AI） ── */
router.post('/script', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: '缺少 prompt' });

  // 优先用 Claude，其次 Grok
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const xaiKey       = process.env.XAI_API_KEY;

  try {
    if (anthropicKey) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const d = await r.json();
      return res.json({ script: d.content?.[0]?.text || '' });
    }

    if (xaiKey) {
      const r = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${xaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.GROK_MODEL || 'grok-3',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const d = await r.json();
      return res.json({ script: d.choices?.[0]?.message?.content || '' });
    }

    return res.status(503).json({ error: '未配置 AI Key（ANTHROPIC_API_KEY 或 XAI_API_KEY）' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── 图生视频：提交任务 ── */
router.post('/img2video', async (req, res) => {
  const { imageUrl, prompt = '', duration = 5, width = 1080, height = 1920 } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: '缺少 imageUrl' });
  try {
    const data = await frwPost('/api/frwapi/v1/tasks', {
      templateId: TPL.img2video,
      inputs: { imageUrl, prompt, duration, width, height },
    });
    res.json({ taskId: data.data?.taskId, raw: data.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── 文生图：提交任务 ── */
router.post('/txt2img', async (req, res) => {
  const { prompt, negativePrompt = '', width = 768, height = 1024, n = 4 } = req.body || {};
  if (!prompt) return res.status(400).json({ error: '缺少 prompt' });
  try {
    const data = await frwPost('/api/frwapi/v1/tasks', {
      templateId: TPL.txt2img,
      inputs: { prompt, negativePrompt, width, height, n },
    });
    res.json({ taskId: data.data?.taskId, raw: data.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── 查询任务状态（前端轮询用） ── */
router.get('/task/:taskId', async (req, res) => {
  try {
    const data = await frwGet(`/api/frwapi/v1/tasks/${req.params.taskId}`);
    // status: pending | processing | completed | failed
    const t = data.data;
    res.json({
      taskId:  t.taskId,
      status:  t.status,
      outputs: t.outputs || [],   // [{url, type}]
      error:   t.error || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── 批量查询任务 ── */
router.get('/tasks', async (req, res) => {
  const { ids } = req.query; // ids=a,b,c
  if (!ids) return res.status(400).json({ error: '缺少 ids' });
  try {
    const data = await frwGet(`/api/frwapi/v1/tasks?taskIds=${ids}`);
    res.json(data.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── 视频片段合并（FFmpeg） ── */
router.post('/merge', upload.array('clips'), async (req, res) => {
  const files = req.files;
  if (!files || files.length < 2) return res.status(400).json({ error: '至少需要2个片段' });

  const outName = `merged_${Date.now()}.mp4`;
  const outPath = path.join(uploadDir, outName);
  const listFile = path.join(os.tmpdir(), `list_${Date.now()}.txt`);

  try {
    // 写 ffmpeg concat 列表
    const listContent = files.map(f => `file '${f.path}'`).join('\n');
    fs.writeFileSync(listFile, listContent);

    const { spawn } = await import('child_process');
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-f', 'concat', '-safe', '0',
        '-i', listFile,
        '-c', 'copy',
        '-y', outPath,
      ]);
      ff.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
      ff.on('error', reject);
    });

    // 清理临时文件
    files.forEach(f => fs.unlink(f.path, () => {}));
    fs.unlink(listFile, () => {});

    res.json({ url: `/files/comic/${outName}` });
  } catch (err) {
    files.forEach(f => fs.unlink(f.path, () => {}));
    fs.unlink(listFile, () => {});
    res.status(500).json({ error: err.message });
  }
});

export default router;
