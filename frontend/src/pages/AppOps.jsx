import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const TABS = [
  { key: 'members', label: '👥 用户列表' },
  { key: 'codes', label: '🎟 兑换码' },
  { key: 'orders', label: '🧾 订单列表' },
  { key: 'charges', label: '💰 上下分' },
];

const OAUTH_TYPES = { android: 'Android', ios: 'iOS', web: 'Web', 'a-web': 'Android Web' };
const ORDER_STATUS = { 0: '待支付', 2: '支付中', 3: '支付成功', 99: '支付失败' };
const CHARGE_TYPE = { 2: '上分', 1: '下分' };
const SCORE_TYPE = { 1: '金币', 2: '积分', 3: '裸聊金币' };
const CODE_STATUS = { 1: '可用', 0: '已使用' };
const PRODUCT_STATUS = { 0: '未上架', 1: '已上架', 2: '已下架', 3: '邀请奖励' };
const PAGE_SIZE = 20;

// 通用:筛选条件 + 分页拉列表
function useList(fetcher, initialFilters) {
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const q = { page, limit: PAGE_SIZE };
      for (const [k, v] of Object.entries(applied)) if (v !== '') q[k] = String(v).trim();
      setData(await fetcher(q));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, applied]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const search = () => { setPage(1); setApplied({ ...filters }); };
  const reset = () => { setFilters(initialFilters); setPage(1); setApplied(initialFilters); };
  return { filters, set, search, reset, page, setPage, data, loading, error, reload: load };
}

function Pager({ page, total, setPage, loading }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="ops-pager">
      <span>共 {total.toLocaleString()} 条 · 第 {page} / {pages} 页</span>
      <button className="ghost-btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>上一页</button>
      <button className="ghost-btn" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>下一页</button>
    </div>
  );
}

function Filters({ children, onSearch, onReset }) {
  return (
    <div className="ops-filters" onKeyDown={(e) => e.key === 'Enter' && onSearch()}>
      {children}
      <button className="btn-primary" onClick={onSearch}>查询</button>
      <button className="ghost-btn" style={{ marginLeft: 0 }} onClick={onReset}>重置</button>
    </div>
  );
}

function Select({ value, onChange, placeholder, options }) {
  return (
    <select className="text-input" value={value} onChange={onChange}>
      <option value="">{placeholder}</option>
      {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}

function ListCard({ l, children }) {
  return (
    <div className="card card--tight">
      <div className="card-body">
        {l.error && <div className="tg-banner warn" style={{ marginTop: 0, marginBottom: 12 }}>⚠ {l.error}</div>}
        <div className="ops-table-wrap">{children}</div>
        {!l.loading && l.data.list.length === 0 && <div className="empty">没有数据</div>}
        {l.loading && <div className="empty">加载中…</div>}
        <Pager page={l.page} total={l.data.total} setPage={l.setPage} loading={l.loading} />
      </div>
    </div>
  );
}

function Members() {
  const l = useList(api.appOpsMembers, { aff: '', affCode: '', uuid: '', nickname: '', oauthType: '' });
  return (
    <>
      <div className="card card--tight">
        <div className="card-body">
          <Filters onSearch={l.search} onReset={l.reset}>
            <input className="text-input" placeholder="aff" value={l.filters.aff} onChange={l.set('aff')} />
            <input className="text-input" placeholder="邀请码" value={l.filters.affCode} onChange={l.set('affCode')} />
            <input className="text-input" placeholder="uuid" value={l.filters.uuid} onChange={l.set('uuid')} />
            <input className="text-input" placeholder="昵称" value={l.filters.nickname} onChange={l.set('nickname')} />
            <Select value={l.filters.oauthType} onChange={l.set('oauthType')} placeholder="全部设备" options={OAUTH_TYPES} />
          </Filters>
        </div>
      </div>
      <ListCard l={l}>
        <table className="compact ops-table">
          <thead>
            <tr><th>用户</th><th>邀请码 / 版本</th><th>渠道 / 注册ip</th><th>邀请</th><th>金币</th><th>chat金币</th><th>代理money</th><th>角色</th><th>VIP</th><th>注册 / 上次登录</th></tr>
          </thead>
          <tbody>
            {l.data.list.map((m) => (
              <tr key={m.uid}>
                <td>
                  <div className="ops-user">
                    {m.thumbUrl && <img src={m.thumbUrl} alt="" />}
                    <div>
                      <div>uid <span className="ops-red">{m.uid}</span> · aff <span className="ops-red">{m.aff}</span></div>
                      <div className="ops-sub">{m.nickname || '-'} · {m.oauthType}</div>
                    </div>
                  </div>
                </td>
                <td>{m.affCode || '-'}<div className="ops-sub">{m.appVersion}</div></td>
                <td>{m.channel || '-'}<div className="ops-sub">{m.regip}</div></td>
                <td>{m.invitedNum}<div className="ops-sub">邀请人 {m.invitedByStr || '-'}</div></td>
                <td className="ops-red">{m.money}</td>
                <td>{m.chatMoney}</td>
                <td>{m.proxyMoney}</td>
                <td>{m.roleStr}</td>
                <td>{m.vipLevelStr}{m.expiredAt && <div className="ops-sub">至 {m.expiredAt}</div>}</td>
                <td>{m.regdate}<div className="ops-sub">{m.lastactivity}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListCard>
    </>
  );
}

function Orders() {
  const l = useList(api.appOpsOrders, { affCode: '', uuid: '', orderId: '', status: '', oauthType: '', dateFrom: '', dateTo: '' });
  return (
    <>
      <div className="card card--tight">
        <div className="card-body">
          <Filters onSearch={l.search} onReset={l.reset}>
            <input className="text-input" placeholder="订单号" value={l.filters.orderId} onChange={l.set('orderId')} />
            <input className="text-input" placeholder="邀请码" value={l.filters.affCode} onChange={l.set('affCode')} />
            <input className="text-input" placeholder="uuid" value={l.filters.uuid} onChange={l.set('uuid')} />
            <Select value={l.filters.status} onChange={l.set('status')} placeholder="全部状态" options={ORDER_STATUS} />
            <Select value={l.filters.oauthType} onChange={l.set('oauthType')} placeholder="全部设备" options={OAUTH_TYPES} />
            <input className="text-input" type="date" title="下单开始日期" value={l.filters.dateFrom} onChange={l.set('dateFrom')} />
            <input className="text-input" type="date" title="下单结束日期" value={l.filters.dateTo} onChange={l.set('dateTo')} />
          </Filters>
        </div>
      </div>
      <ListCard l={l}>
        <table className="compact ops-table">
          <thead>
            <tr><th>ID</th><th>用户</th><th>产品</th><th>订单号</th><th>订单金额</th><th>实付</th><th>状态</th><th>设备 / 渠道</th><th>下单时间</th><th>支付时间</th></tr>
          </thead>
          <tbody>
            {l.data.list.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.nickname || '-'}<div className="ops-sub">aff {o.aff || '-'}</div></td>
                <td className="wrap">{o.productName || '-'}<div className="ops-sub">{o.descp}</div></td>
                <td>{o.orderId}<div className="ops-sub">{o.appOrder}</div></td>
                <td>¥{o.amount.toFixed(2)}</td>
                <td>¥{o.payAmount.toFixed(2)}</td>
                <td className={o.status === 3 ? 'ops-green' : o.status === 99 ? 'ops-red' : ''}>{o.statusStr || ORDER_STATUS[o.status] || o.status}</td>
                <td>{OAUTH_TYPES[o.oauthType] || o.oauthType}<div className="ops-sub">{o.channel}</div></td>
                <td>{o.createdAt}</td>
                <td>{o.paidAt || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListCard>
    </>
  );
}

function ExchangeCodes() {
  const l = useList(api.appOpsExchangeCodes, { code: '', status: '', productId: '' });
  const logs = useList(api.appOpsExchangeLogs, { code: '', aff: '' });
  const [products, setProducts] = useState([]);
  const [gen, setGen] = useState({ productId: '', qty: '1', expiredAt: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [codes, setCodes] = useState([]);
  const setG = (k) => (e) => setGen((g) => ({ ...g, [k]: e.target.value }));
  const productOptions = Object.fromEntries(products.map((p) => [p.id, p.name]));

  useEffect(() => { api.appOpsProducts().then(setProducts).catch(() => {}); }, []);

  const generate = async () => {
    setMsg(null);
    if (!gen.productId) return setMsg({ ok: false, text: '请选择产品' });
    const qty = Number(gen.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) return setMsg({ ok: false, text: '生成数量须为 1~100' });
    if (!window.confirm(`确认生成 ${qty} 个「${productOptions[gen.productId]}」兑换码?`)) return;
    setSaving(true);
    try {
      const r = await api.appOpsGenerateCodes({ productId: Number(gen.productId), qty, expiredAt: gen.expiredAt });
      setCodes(r.codes || []);
      setMsg({ ok: true, text: `已生成 ${r.codes?.length ?? qty} 个兑换码` });
      l.reload();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`确认删除兑换码 ${c.code}?`)) return;
    try {
      await api.appOpsDeleteCode(c.id, c.code);
      l.reload();
    } catch (err) {
      window.alert(err.message);
    }
  };

  const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

  return (
    <>
      <div className="card card--tight">
        <div className="card-head">生成兑换码</div>
        <div className="card-body">
          <div className="ops-form">
            <label>产品
              <select className="text-input" value={gen.productId} onChange={setG('productId')}>
                <option value="">请选择产品</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.status !== 1 && PRODUCT_STATUS[p.status] ? `(${PRODUCT_STATUS[p.status]})` : ''}</option>)}
              </select>
            </label>
            <label>生成数量(1~100)<input className="text-input" type="number" min="1" max="100" step="1" value={gen.qty} onChange={setG('qty')} /></label>
            <label>过期日期(可不填)<input className="text-input" type="date" value={gen.expiredAt} onChange={setG('expiredAt')} /></label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button className="btn-primary" style={{ height: 38 }} disabled={saving} onClick={generate}>{saving ? '生成中…' : '生成兑换码'}</button>
            {msg && <span className={msg.ok ? 'ops-green' : 'ops-red'}>{msg.text}</span>}
          </div>
          {codes.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span className="field-label" style={{ margin: 0 }}>本次生成的兑换码</span>
                <button className="ghost-btn" style={{ marginLeft: 0 }} onClick={() => copy(codes.join('\n'))}>全部复制</button>
              </div>
              <pre className="ops-codes">{codes.join('\n')}</pre>
            </div>
          )}
        </div>
      </div>

      <div className="card card--tight">
        <div className="card-head">兑换码管理</div>
        <div className="card-body">
          <Filters onSearch={l.search} onReset={l.reset}>
            <input className="text-input" placeholder="兑换码" value={l.filters.code} onChange={l.set('code')} />
            <Select value={l.filters.status} onChange={l.set('status')} placeholder="全部状态" options={CODE_STATUS} />
            <Select value={l.filters.productId} onChange={l.set('productId')} placeholder="全部产品" options={productOptions} />
          </Filters>
        </div>
      </div>
      <ListCard l={l}>
        <table className="compact ops-table">
          <thead>
            <tr><th>ID</th><th>兑换码</th><th>产品</th><th>状态</th><th>过期时间</th><th>使用时间</th><th>创建时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            {l.data.list.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td><span className="ops-red">{c.code}</span> <button className="ops-link" onClick={() => copy(c.code)}>复制</button></td>
                <td>{c.productName}{c.validDate ? ` (${c.validDate}天)` : ''}</td>
                <td className={c.status === 1 ? 'ops-green' : ''}>{CODE_STATUS[c.status] ?? c.statusStr}</td>
                <td>{c.expiredAt || '-'}</td>
                <td>{c.usedAt || '-'}</td>
                <td>{c.createdAt}</td>
                <td><button className="ops-link danger" onClick={() => remove(c)}>删除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListCard>

      <div className="card card--tight">
        <div className="card-head">兑换码日志</div>
        <div className="card-body">
          <Filters onSearch={logs.search} onReset={logs.reset}>
            <input className="text-input" placeholder="兑换码" value={logs.filters.code} onChange={logs.set('code')} />
            <input className="text-input" placeholder="aff" value={logs.filters.aff} onChange={logs.set('aff')} />
          </Filters>
        </div>
      </div>
      <ListCard l={logs}>
        <table className="compact ops-table">
          <thead>
            <tr><th>ID</th><th>aff</th><th>兑换码</th><th>备注</th><th>状态</th><th>时间</th></tr>
          </thead>
          <tbody>
            {logs.data.list.map((g) => (
              <tr key={g.id}>
                <td>{g.id}</td>
                <td>{g.aff}</td>
                <td>{g.code}</td>
                <td className="wrap">{g.remark}</td>
                <td>{g.statusStr}</td>
                <td>{g.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListCard>
    </>
  );
}

const EMPTY_CHARGE = { toAff: '', score: '', scoreType: '1', type: '2', des: '', logDesc: '' };

function Charges() {
  const l = useList(api.appOpsCharges, { toAff: '', type: '' });
  const [form, setForm] = useState(EMPTY_CHARGE);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setMsg(null);
    if (!form.toAff || !form.score || !form.des.trim()) {
      setMsg({ ok: false, text: '请填写用户 aff、分数和上下分理由' });
      return;
    }
    const text = `确认给 aff ${form.toAff} ${CHARGE_TYPE[form.type]} ${form.score} ${SCORE_TYPE[form.scoreType]}?`;
    if (!window.confirm(text)) return;
    setSaving(true);
    try {
      await api.appOpsCharge({ ...form, toAff: Number(form.toAff), score: Number(form.score), scoreType: Number(form.scoreType), type: Number(form.type) });
      setMsg({ ok: true, text: `操作成功:aff ${form.toAff} ${CHARGE_TYPE[form.type]} ${form.score} ${SCORE_TYPE[form.scoreType]}` });
      setForm(EMPTY_CHARGE);
      l.reload();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="card card--tight">
        <div className="card-head">上下分</div>
        <div className="card-body">
          <div className="ops-form">
            <label>用户 aff<input className="text-input" inputMode="numeric" placeholder="如 221489" value={form.toAff} onChange={setF('toAff')} /></label>
            <label>类型
              <select className="text-input" value={form.type} onChange={setF('type')}>
                {Object.entries(CHARGE_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>分数类型
              <select className="text-input" value={form.scoreType} onChange={setF('scoreType')}>
                {Object.entries(SCORE_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>分数<input className="text-input" type="number" min="1" step="1" placeholder="正整数" value={form.score} onChange={setF('score')} /></label>
            <label className="full">备注(上下分理由)<input className="text-input" placeholder="请输入上下分理由" value={form.des} onChange={setF('des')} /></label>
            <label className="full">用户日志说明(用户能看到,不填则同备注)<input className="text-input" placeholder="用户金币或积分的日志说明" value={form.logDesc} onChange={setF('logDesc')} /></label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button className="btn-primary" style={{ height: 38 }} disabled={saving} onClick={submit}>{saving ? '提交中…' : '确认提交'}</button>
            {msg && <span className={msg.ok ? 'ops-green' : 'ops-red'}>{msg.text}</span>}
          </div>
        </div>
      </div>

      <div className="card card--tight">
        <div className="card-head">上下分记录</div>
        <div className="card-body">
          <Filters onSearch={l.search} onReset={l.reset}>
            <input className="text-input" placeholder="用户 aff" value={l.filters.toAff} onChange={l.set('toAff')} />
            <Select value={l.filters.type} onChange={l.set('type')} placeholder="全部类型" options={CHARGE_TYPE} />
          </Filters>
        </div>
      </div>
      <ListCard l={l}>
        <table className="compact ops-table">
          <thead>
            <tr><th>ID</th><th>用户 aff</th><th>管理员</th><th>分值</th><th>分值类型</th><th>类型</th><th>描述</th><th>时间</th></tr>
          </thead>
          <tbody>
            {l.data.list.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.toAff}</td>
                <td>{c.admin}</td>
                <td className={c.type === 2 ? 'ops-green' : 'ops-red'}>{c.type === 2 ? '+' : '-'}{c.score}</td>
                <td>{c.scoreTypeStr}</td>
                <td>{c.typeStr || CHARGE_TYPE[c.type]}</td>
                <td className="wrap">{c.des}</td>
                <td>{c.addtime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListCard>
    </>
  );
}

export default function AppOps() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => localStorage.getItem('app_ops_tab') || 'members');
  const [status, setStatus] = useState({ configured: true });

  useEffect(() => { api.appOpsStatus().then(setStatus).catch(() => {}); }, []);
  useEffect(() => { localStorage.setItem('app_ops_tab', tab); }, [tab]);

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className="section-head" style={{ marginTop: 20 }}>
        <h2>App 日常运营</h2>
        <span className="hint">对接管理后台 · 用户列表 / 兑换码 / 订单列表 / 上下分</span>
      </div>

      {!status.configured && (
        <div className="tg-banner warn">⚠ 未配置管理后台账号(backend/.env 的 HANIME_ADMIN_*),数据拉不到</div>
      )}

      <div className="ops-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`ops-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'members' && <Members />}
      {tab === 'codes' && <ExchangeCodes />}
      {tab === 'orders' && <Orders />}
      {tab === 'charges' && <Charges />}
    </div>
  );
}
