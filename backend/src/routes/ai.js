import { Router } from 'express';
import { chat, activeProvider } from '../services/llm.js';

const router = Router();

// 关键词 -> 多版本推特文案
router.post('/copy', async (req, res) => {
  const { keyword, count = 3 } = req.body || {};
  if (!keyword || !keyword.trim()) return res.status(400).json({ error: '请输入关键词' });

  const provider = activeProvider();

  // 未配置任何 AI key 时,返回本地模板文案(演示模式)
  if (!provider) {
    const templates = [
      (k) => `关于「${k}」,有件事很多人没意识到 👇\n\n它正在悄悄改变规则。你准备好了吗?`,
      (k) => `${k} 的 3 个真相:\n1. 大多数人理解错了\n2. 早入场的人已经赚到\n3. 现在还不晚\n\n收藏起来慢慢看 🔖`,
      (k) => `如果你还在观望「${k}」,这条推送给你。\n\n机会从来只留给行动的人。`,
      (k) => `我花了一周研究「${k}」,总结成这一条。\n\n转发给需要的朋友 🚀`,
    ];
    const variants = templates.slice(0, Math.min(count, templates.length)).map((t) => t(keyword.trim()));
    return res.json({ variants, mode: 'template' });
  }

  try {
    const prompt =
      `针对关键词「${keyword.trim()}」,写 ${count} 条风格不同的中文推特文案` +
      `(每条不超过 200 字,适合发 X/Twitter,可用 emoji)。` +
      `只输出文案,用 "---" 分隔每条,不要编号和多余说明。`;
    const text = await chat({ prompt, maxTokens: 1024 });
    const variants = text.split(/\n?---\n?/).map((s) => s.trim()).filter(Boolean);
    res.json({ variants, mode: provider });
  } catch (err) {
    res.status(500).json({ error: 'AI 生成失败: ' + err.message });
  }
});

export default router;
