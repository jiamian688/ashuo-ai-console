import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { processVideo, extractThumbnail } from '../services/ffmpeg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const outDir = path.join(uploadDir, 'clips');
fs.mkdirSync(outDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 },
});

const router = Router();

// 上传视频(+ 可选水印图)→ 裁剪 + 叠加水印 + 生成 750×422 高清封面
router.post('/process', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'watermark', maxCount: 1 },
]), async (req, res) => {
  const videoFile = req.files?.file?.[0];
  const wmFile = req.files?.watermark?.[0];
  if (!videoFile) return res.status(400).json({ error: '没有收到视频文件' });

  const input = videoFile.path;
  const watermark = wmFile?.path;
  const { start, end, thumbAt, wmPosition } = req.body || {};
  const stamp = Date.now();
  const trimmedName = `clip-${stamp}.mp4`;
  const thumbName = `cover-${stamp}.jpg`;
  const trimmedPath = path.join(outDir, trimmedName);
  const thumbPath = path.join(outDir, thumbName);

  try {
    const result = {};

    // 有裁剪时间 或 有水印 → 都需要产出新视频
    const needVideo = start || end || watermark;
    if (needVideo) {
      await processVideo({ input, output: trimmedPath, start, end, watermark, wmPosition });
      result.video = `/files/clips/${trimmedName}`;
    }

    // 封面从产出视频取(含水印/裁剪效果),否则从原视频取
    await extractThumbnail({
      input: needVideo ? trimmedPath : input,
      output: thumbPath,
      at: thumbAt,
    });
    result.cover = `/files/clips/${thumbName}`;

    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(input, () => {});               // 删原始临时视频
    if (watermark) fs.unlink(watermark, () => {}); // 删临时水印图
  }
});

export default router;
