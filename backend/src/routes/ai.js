import { Router } from 'express';

const router = Router();

// 关键词 -> 多版本推特文案
router.post('/copy', async (req, res) => {
  const { keyword, count = 3 } = req.body || {};
  if (!keyword || !keyword.trim()) return res.status(400).json({ error: '请输入关键词' });

  const key = process.env.ANTHROPIC_API_KEY;

  // 未配置 API key 时,返回本地模板文案(演示模式）
  if (!key) {
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
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `针对关键词「${keyword.trim()}」,写 ${count} 条风格不同的中文推特文案(每条不超过 200 字,适合发 X/Twitter,可用 emoji)。只输出文案,用 "---" 分隔每条,不要编号和多余说明。`,
          },
        ],
      }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.content?.[0]?.text || '';
    const variants = text.split(/\n?---\n?/).map((s) => s.trim()).filter(Boolean);
    res.json({ variants, mode: 'claude' });
  } catch (err) {
    res.status(500).json({ error: 'AI 生成失败: ' + err.message });
  }
});

export default router;
