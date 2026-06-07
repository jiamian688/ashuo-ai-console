import { useMemo, useState } from 'react';
import { TAG_GROUPS, ALL_TAGS } from '../tags.js';

const overlay = { position: 'fixed', inset: 0, background: 'rgba(20,22,34,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { width: 'min(920px, 94vw)', maxHeight: '86vh', background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' };
const head = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #eee' };
const body = { padding: '12px 20px', overflowY: 'auto' };
const foot = { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderTop: '1px solid #eee' };
const ghostBtn = { padding: '8px 16px', border: '1px solid #d8dbe8', background: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14 };
const primaryBtn = { padding: '8px 18px', border: 'none', background: '#6c5ce7', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 };
const chip = (on) => ({
  padding: '5px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
  border: on ? '1px solid #6c5ce7' : '1px solid #d8dbe8',
  background: on ? '#6c5ce7' : '#fff',
  color: on ? '#fff' : '#444',
});

// 分类多选弹窗。initial:当前关键词字符串;onConfirm(新关键词字符串);onCancel()
export default function TagPicker({ title = '选关键词', initial = '', onConfirm, onCancel }) {
  const initialWords = useMemo(() => (initial || '').split(/\s+/).filter(Boolean), [initial]);
  // 保留用户手输的、不在标签库里的词,确定时拼回前面
  const extras = useMemo(() => initialWords.filter((w) => !ALL_TAGS.has(w)), [initialWords]);
  const [selected, setSelected] = useState(() => new Set(initialWords.filter((w) => ALL_TAGS.has(w))));

  const toggle = (tag) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(tag)) n.delete(tag); else n.add(tag);
      return n;
    });
  };
  const clearAll = () => setSelected(new Set());

  const confirm = () => {
    const ordered = TAG_GROUPS.flatMap((g) => g.tags).filter((t) => selected.has(t));
    onConfirm([...extras, ...ordered].join(' '));
  };

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{title}</span>
          <span style={{ color: '#888', fontSize: 13 }}>
            已选 {selected.size}{extras.length ? ` · 另保留 ${extras.length} 个自定义词` : ''}
          </span>
        </div>
        <div style={body}>
          {TAG_GROUPS.map((g) => (
            <div key={g.label} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, color: '#6c5ce7', margin: '6px 0', fontSize: 13 }}>{g.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {g.tags.map((t) => (
                  <button key={t} type="button" onClick={() => toggle(t)} style={chip(selected.has(t))}>{t}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={foot}>
          <button type="button" onClick={clearAll} style={ghostBtn}>清空</button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onCancel} style={ghostBtn}>取消</button>
          <button type="button" onClick={confirm} style={primaryBtn}>确定</button>
        </div>
      </div>
    </div>
  );
}
