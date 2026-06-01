import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { trimVideo, extractThumbnail } from '../services/ffmpeg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const outDir = path.join(uploadDir, 'clips');
fs.mkdirSync(outDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 },
});

const router = Router();

// 上传视频 + 裁剪 + 生成封面
router.post('/process', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有收到文件' });
  const input = req.file.path;
  const { start, end, thumbAt } = req.body || {};
  const stamp = Date.now();
  const trimmedName = `clip-${stamp}.mp4`;
  const thumbName = `cover-${stamp}.jpg`;
  const trimmedPath = path.join(outDir, trimmedName);
  const thumbPath = path.join(outDir, thumbName);

  try {
    const result = {};

    // 有起止时间才裁剪,否则只生成封面
    if (start || end) {
      await trimVideo({ input, output: trimmedPath, start, end });
      result.video = `/files/clips/${trimmedName}`;
    }

    await extractThumbnail({
      input: (start || end) ? trimmedPath : input,
      output: thumbPath,
      at: thumbAt || 0,
    });
    result.cover = `/files/clips/${thumbName}`;

    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(input, () => {}); // 删掉上传的原始临时文件
  }
});

export default router;
