import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { processVideo, extractThumbnail, probeResolution, extractHighlights, enhanceImage, makeTriptych } from '../services/ffmpeg.js';
import { detectTextBoxes, autoCropFraction } from '../services/ocr.js';

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
  // 动态水印:.mov/webm/gif 等。multer 落盘文件无扩展名,故用 mimetype + 原始文件名一起判断。
  const wmIsVideo = !!wmFile && (/^video\//.test(wmFile.mimetype || '') || /\.(mov|mp4|m4v|webm|mkv|gif)$/i.test(wmFile.originalname || ''));
  const { start, end, thumbAt, wmPosition } = req.body || {};
  // 去字参数:cropX='1' 表示「自动裁这条边」(裁多少由 OCR 识别的边缘文字决定),
  // autoBlurText='1' 用 OCR 识别画面里的文字并按真实大小模糊
  const flag = (v) => v === '1' || v === 'true';
  const wantCropTop = flag(req.body?.cropTop);
  const wantCropBottom = flag(req.body?.cropBottom);
  const wantCropLeft = flag(req.body?.cropLeft);
  const wantCropRight = flag(req.body?.cropRight);
  const autoBlurText = flag(req.body?.autoBlurText);
  const wantAutoCrop = wantCropTop || wantCropBottom || wantCropLeft || wantCropRight;
  // 单视频:封面取「干净原片」最佳帧,不带水印;帖子视频:额外产出 4 张带水印精彩帧 + 794×422 三联封面
  const mode = req.body?.mode === 'post' ? 'post' : 'single';
  const stamp = Date.now();
  const trimmedName = `clip-${stamp}.mp4`;
  const thumbName = `cover-${stamp}.jpg`;
  const trimmedPath = path.join(outDir, trimmedName);
  const thumbPath = path.join(outDir, thumbName);

  try {
    const result = {};

    // 「智能去字」或任一「自动裁边」都要先用 OCR 找出稳定文字区域(水印/字幕)
    let boxes = [];
    if (autoBlurText || wantAutoCrop) boxes = await detectTextBoxes(input);

    // 自动裁边:每条启用的边裁掉「刚好盖住该边文字」的厚度,夹在 0~25%,没文字就不裁
    let cropTop = 0, cropBottom = 0, cropLeft = 0, cropRight = 0;
    if (wantAutoCrop && boxes.length) {
      const { w: W, h: H } = await probeResolution(input);
      if (W && H) {
        if (wantCropTop) cropTop = autoCropFraction(boxes, 'top', W, H);
        if (wantCropBottom) cropBottom = autoCropFraction(boxes, 'bottom', W, H);
        if (wantCropLeft) cropLeft = autoCropFraction(boxes, 'left', W, H);
        if (wantCropRight) cropRight = autoCropFraction(boxes, 'right', W, H);
        result.crop = {
          top: Math.round(cropTop * 100), bottom: Math.round(cropBottom * 100),
          left: Math.round(cropLeft * 100), right: Math.round(cropRight * 100),
        };
      }
    }
    const needCrop = cropTop || cropBottom || cropLeft || cropRight;

    // 智能去字:模糊所有识别到的文字(被裁掉的边会随裁切一起消失,不重复处理)
    const blurBoxes = autoBlurText ? boxes : [];
    if (autoBlurText) result.textBoxes = blurBoxes.length;

    // 有裁剪时间 / 水印 / 裁边 / 识别到要模糊的文字 → 都需要产出新视频
    const needVideo = start || end || watermark || needCrop || blurBoxes.length;
    if (needVideo) {
      await processVideo({ input, output: trimmedPath, start, end, watermark, wmIsVideo, wmPosition, cropTop, cropBottom, cropLeft, cropRight, blurBoxes, preset: 'ultrafast', crf: 23 });
      result.video = `/files/clips/${trimmedName}`;
    }

    if (mode === 'post') {
      // 帖子视频:精彩帧取自「产出视频」(带水印/裁剪),帖子内容图也就自带水印
      const src = needVideo ? trimmedPath : input;
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'post-'));
      try {
        const raw = await extractHighlights({ input: src, outDir: tmpDir, baseName: 'h', count: 4 });
        const postImages = [];
        for (let i = 0; i < raw.length; i++) {
          const name = `post-${stamp}-${i + 1}.jpg`;
          await enhanceImage({ input: raw[i], output: path.join(outDir, name) });
          postImages.push(`/files/clips/${name}`);
        }
        result.postImages = postImages;
        // 帖子封面:不带水印 —— 从「干净原片」另抽 3 帧横向拼成 794×422
        const coverFrames = await extractHighlights({ input, outDir: tmpDir, baseName: 'c', count: 3 });
        if (coverFrames.length >= 3) {
          const pcoverName = `pcover-${stamp}.jpg`;
          await makeTriptych({ images: coverFrames, output: path.join(outDir, pcoverName), W: 794, H: 422 });
          result.cover = `/files/clips/${pcoverName}`;
        }
      } finally {
        fs.rm(tmpDir, { recursive: true, force: true }, () => {});
      }
    } else {
      // 单视频:封面取「干净原片」最佳帧(不带水印),高清化 750×422
      await extractThumbnail({ input, output: thumbPath, at: thumbAt });
      result.cover = `/files/clips/${thumbName}`;
    }

    res.json({ ok: true, mode, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(input, () => {});               // 删原始临时视频
    if (watermark) fs.unlink(watermark, () => {}); // 删临时水印图
  }
});

// 手动封面:上传 3 张图(人物生活照 + 性爱图等),拼成 794×210 帖子封面(不带水印,人脸居中偏上)
router.post('/cover', upload.array('images', 3), async (req, res) => {
  const files = req.files || [];
  if (files.length < 3) {
    files.forEach((f) => fs.unlink(f.path, () => {}));
    return res.status(400).json({ error: '请上传 3 张图片' });
  }
  const stamp = Date.now();
  const coverName = `cover-manual-${stamp}.jpg`;
  const coverPath = path.join(outDir, coverName);
  try {
    await makeTriptych({ images: files.map((f) => f.path), output: coverPath, W: 794, H: 210 });
    res.json({ ok: true, cover: `/files/clips/${coverName}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    files.forEach((f) => fs.unlink(f.path, () => {}));
  }
});

export default router;
