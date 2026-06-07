import { useMemo, useState } from 'react';
import { api } from '../api/client.js';

const FATHOM_URL = 'https://fathom.video/';
const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];

const safe = (s) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 参会人员:逗号 / 顿号 / 分号 / 换行 / 多空格分隔,统一成「张三、李四、王五」
function normalizePeople(raw) {
  return String(raw || '')
    .split(/[,，、;；\n\r]+|\s{2,}/)
    .map((s) => s.trim().replace(/^[-*•·]\s*/, ''))
    .filter(Boolean)
    .join('、');
}

const cleanHeading = (s) =>
  String(s || '').replace(/\*\*/g, '').replace(/^#+\s*/, '').replace(/^[-*•·]\s*/, '').replace(/[:：]\s*$/, '').trim();

// 判断一行是不是「小标题」,是就返回标题文字,否则返回 null
function asHeading(line) {
  const t = line.trim();
  if (!t) return null;
  let m;
  // Markdown #
  if ((m = t.match(/^#{1,6}\s+(.+)$/))) return cleanHeading(m[1]);
  // 整行加粗 **标题**
  if ((m = t.match(/^\*\*(.+?)\*\*[:：]?$/))) return cleanHeading(m[1]);
  // 中文序号:一、 / (一) / 第一部分
  if ((m = t.match(/^[（(]?第?[一二三四五六七八九十]+[）)]?\s*[、.．，,]\s*(.+)$/))) return cleanHeading(m[1]);
  // 阿拉伯序号且短、不含句中标点:1. 进度回顾
  if ((m = t.match(/^\d+\s*[、.．)）]\s*(.+)$/)) && m[1].length <= 22 && !/[。!?！？,，;；]/.test(m[1])) return cleanHeading(m[1]);
  // 短行以冒号结尾:进度回顾:
  if ((m = t.match(/^(.{1,22})[:：]$/))) return cleanHeading(m[1]);
  return null;
}

// 参会人员行:返回冒号后的内容(可能为空字符串);非该行返回 undefined
function asParticipantLine(line) {
  const t = line.trim().replace(/^[#*\-•·\s]+/, '').replace(/\*\*/g, '');
  const m = t.match(/^(参会人员|参会人|与会人员|参与人员|参加人员|出席人员|参会者|参与人|出席人|与会者)\s*[:：]?\s*(.*)$/);
  return m ? m[2].trim() : undefined;
}

// 把整段粘贴的纪要自动拆成 { participants, sections:[{heading,content}] }
function parseNotes(raw) {
  const lines = String(raw || '').replace(/\r/g, '').split('\n');
  let participants = '';
  const sections = [];
  let cur = { heading: '', lines: [] };
  const flush = () => {
    if (cur.heading || cur.lines.some((l) => l.trim())) {
      sections.push({ heading: cur.heading, content: cur.lines.join('\n').trim() });
    }
    cur = { heading: '', lines: [] };
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const p = asParticipantLine(line);
    if (p !== undefined) {
      if (p) participants = p;
      else {
        const next = (lines[i + 1] || '').trim();
        if (next && asHeading(next) === null) { participants = next; i++; }
      }
      continue;
    }
    const h = asHeading(line);
    if (h !== null) { flush(); cur.heading = h; continue; }
    cur.lines.push(line);
  }
  flush();
  return { participants: normalizePeople(participants), sections };
}

// 统一的编号块:参会人员(若有)排第一,其余分类依次往下
function orderedBlocks(participants, sections) {
  const out = [];
  let idx = 0;
  if (participants) { out.push({ num: CN_NUM[idx] || '', heading: '参会人员', content: participants }); idx++; }
  for (const s of sections) {
    const heading = (s.heading || '').trim() || '会议要点';
    const content = (s.content || '').trim();
    if (!heading && !content) continue;
    out.push({ num: CN_NUM[idx] || '', heading, content });
    idx++;
  }
  return out;
}

function buildHtml(title, blocks) {
  const date = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const para = (txt) =>
    String(txt || '')
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean)
      .map((b) => `<p>${safe(b).replace(/\n/g, '<br>')}</p>`)
      .join('\n');
  const body = blocks
    .map((b) => `<h2>${b.num ? b.num + '、' : ''}${safe(b.heading)}</h2>\n${para(b.content) || '<p></p>'}`)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${safe(title) || '会议纪要'}</title>
<style>
  body { font-family: 'PingFang SC','Microsoft YaHei','Segoe UI',sans-serif; color: #1a1a2e; line-height: 1.8; max-width: 760px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 24px; margin: 0 0 4px; text-align: center; }
  .meta { color: #888; font-size: 13px; margin-bottom: 24px; border-bottom: 2px solid #6c5ce7; padding-bottom: 12px; text-align: center; }
  h2 { font-size: 17px; margin: 26px 0 10px; color: #4a3fbf; }
  p { font-size: 15px; margin: 0 0 12px; white-space: pre-wrap; }
</style></head>
<body>
  <h1>${safe(title) || '会议纪要'}</h1>
  <div class="meta">生成日期:${date}</div>
  ${body || '<p></p>'}
</body></html>`;
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MeetingRoom() {
  const [title, setTitle] = useState('');
  const [raw, setRaw] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');

  // 含较多英文字母时,提示可以一键翻译整理(纯前端启发式,不调接口)
  const looksEnglish = useMemo(() => {
    const letters = (raw.match(/[a-zA-Z]/g) || []).length;
    const cjk = (raw.match(/[一-鿿]/g) || []).length;
    return letters >= 20 && letters > cjk * 2;
  }, [raw]);

  const aiOrganize = async () => {
    if (!raw.trim() || aiBusy) return;
    setAiBusy(true);
    setAiErr('');
    try {
      const { text } = await api.organizeMeeting(raw);
      if (text) setRaw(text);
    } catch (e) {
      setAiErr(e.message || 'AI 整理失败');
    } finally {
      setAiBusy(false);
    }
  };

  const blocks = useMemo(() => {
    const { participants, sections } = parseNotes(raw);
    return orderedBlocks(participants, sections);
  }, [raw]);

  const baseName = (title.trim() || '会议纪要').replace(/[\\/:*?"<>|]/g, '_');
  const hasContent = title.trim() || blocks.length > 0;
  const html = () => buildHtml(title, blocks);

  const exportHtml = () => download(`${baseName}.html`, html(), 'text/html;charset=utf-8');

  // Word 能直接打开「带 Word 命名空间的 HTML」并另存为 .doc/.docx,中文无乱码
  const exportWord = () => {
    const doc = html().replace(
      '<html lang="zh-CN">',
      '<html lang="zh-CN" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
    );
    download(`${baseName}.doc`, doc, 'application/msword');
  };

  // PDF:打开排版后的窗口直接调起浏览器打印,用户选「另存为 PDF」。中文渲染完美、零依赖
  const exportPdf = () => {
    const w = window.open('', '_blank');
    if (!w) { alert('浏览器拦截了弹窗,请允许后重试'); return; }
    w.document.write(html());
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="page">
      <section className="hero">
        <h1>Agent 会议室</h1>
        <div className="sub">在 Fathom 里开会与 AI 跟会记录 · 会后整段粘贴纪要,自动拆成「参会人员 + 重点分类」,一键导出 Word / PDF / HTML</div>
        <a href={FATHOM_URL} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12, textDecoration: 'none' }}>
          🎥 进入 Fathom 会议室 ↗
        </a>
      </section>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-head">会议纪要 <span className="muted">整段粘贴,自动生成结构</span></div>
        <div className="card-body">
          <div className="field-label">会议标题</div>
          <input
            className="text-input"
            style={{ width: '100%', marginBottom: 18 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如:6月8日产品同步会"
          />

          <div className="field-label">粘贴会议纪要(整段贴进来即可,自动识别参会人员与各重点分类)</div>
          <textarea
            className="text-input"
            style={{ width: '100%', minHeight: 240, resize: 'vertical', lineHeight: 1.7, fontSize: 14 }}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={'把 Fathom 生成的会议纪要 / AI 摘要整段粘贴到这里(中英文都行),例如:\n\nAttendees: Alice, Bob, Carol\n\nProgress\nBackend deployed…\n\nAction Items\nFinish layout this week…'}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="up-btn primary" onClick={aiOrganize} disabled={!raw.trim() || aiBusy}>
              {aiBusy ? '整理中…' : '🤖 AI 整理成中文（翻译 · 分类 · 纠错）'}
            </button>
            {looksEnglish && !aiBusy && (
              <span style={{ fontSize: 13, color: 'var(--primary)' }}>检测到英文,点左侧按钮自动翻译并分类 →</span>
            )}
            {aiErr && <span style={{ fontSize: 13, color: '#e11d48' }}>{aiErr}</span>}
          </div>

          <div className="field-label" style={{ marginTop: 22, marginBottom: 10 }}>自动生成预览</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', background: 'var(--surface-2)', minHeight: 80 }}>
            {blocks.length === 0 ? (
              <div className="empty" style={{ color: 'var(--text-faint)', fontSize: 13 }}>在上方粘贴会议纪要后,这里会自动拆成「一、参会人员」「二、…」结构。</div>
            ) : (
              blocks.map((b, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 4, fontSize: 15 }}>{b.num}、{b.heading}</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--text-soft)', lineHeight: 1.7 }}>{b.content || '（无内容）'}</div>
                </div>
              ))
            )}
          </div>

          <div className="up-actions" style={{ marginTop: 20 }}>
            <button type="button" className="up-btn primary" onClick={exportWord} disabled={!hasContent}>下载 Word（.doc）</button>
            <button type="button" className="up-btn" onClick={exportPdf} disabled={!hasContent}>下载 PDF</button>
            <button type="button" className="up-btn" onClick={exportHtml} disabled={!hasContent}>下载 HTML</button>
          </div>
          <div className="gear-hint" style={{ marginTop: 10 }}>
            自动识别:含「参会人员/与会人员」的行 → 第一项;Markdown 标题、加粗行、「一、」「1.」等序号、或以冒号结尾的短行 → 各重点分类。Word 用 Office / WPS 打开可继续编辑;PDF 在打印窗口选「另存为 PDF」。
          </div>
        </div>
      </div>
    </div>
  );
}
