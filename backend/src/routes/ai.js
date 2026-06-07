import { Router } from 'express';
import { chat, activeProvider } from '../services/llm.js';

const router = Router();

// 会议纪要整理:把粘贴的原文(常为英文/含错别字)翻译成中文、纠错、并整理成
// 前端能直接解析的「参会人员 + 中文序号小标题」纯文本格式。
router.post('/meeting-notes', async (req, res) => {
  const raw = (req.body?.raw || '').trim();
  if (!raw) return res.status(400).json({ error: '请先粘贴会议纪要' });

  const provider = activeProvider();
  if (!provider) {
    return res.status(400).json({ error: '未配置 AI,无法翻译整理(需在后端设置 XAI_API_KEY 或 ANTHROPIC_API_KEY)' });
  }

  try {
    const prompt =
      `你是专业的会议纪要整理助手。下面是一段会议纪要原文(可能是英文或中英混杂,也可能有错别字、语法或语音转写错误)。请你:\n` +
      `1. 如果是英文或中英混杂,完整翻译成简体中文;已经是中文的就保留并适当润色。\n` +
      `2. 修正错别字、语法和明显的转写错误,但不要编造原文没有的信息。\n` +
      `3. 整理成结构化纪要,严格按下面的纯文本格式输出:\n` +
      `   - 若能从原文看出参会者,第一行写:参会人员:姓名1、姓名2、姓名3\n` +
      `   - 之后按主题把内容分成若干部分,每个部分先用「一、标题」「二、标题」这样的中文序号小标题单独占一行,标题下一行起写该部分的中文内容。\n` +
      `4. 只输出整理后的纪要本身,不要任何前言、说明或评论,不要用 Markdown 代码块或反引号包裹。\n\n` +
      `会议纪要原文:\n"""\n${raw}\n"""`;
    let text = await chat({ prompt, maxTokens: 2000 });
    // 兜底去掉可能被包裹的代码块围栏
    text = text.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```$/, '').trim();
    if (!text) throw new Error('AI 返回空内容');
    res.json({ text, mode: provider });
  } catch (err) {
    res.status(500).json({ error: 'AI 整理失败: ' + err.message });
  }
});

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
