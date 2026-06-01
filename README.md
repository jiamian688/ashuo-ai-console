# Yule AgentCenter V2.0

内容运营私人工作台。前端 React + Vite,后端 Express + SQLite。

页面板块:
- **首页仪表盘** — 问候 + 统计卡(今日完成/当前队列/今日失败/X 账号活跃)+ 工作工具 + 今日/明日待办
- **社群管理** — 视频拖拽上传 + 任务列表(状态/创建时间/耗时),后台异步发布到 Telegram
- **社媒管理** — 关键词 → 多版本推特文案(配置 Claude API key 后由 AI 生成,否则走模板)
- **剪辑管理** — ffmpeg 真实处理:上传视频 → 按起止时间裁剪 → 在指定时间点生成封面图 → 在线预览/下载(ffmpeg 二进制由 `ffmpeg-static` 自带,无需系统安装)
- **Agent 会议室** — 外部应用入口

社群管理页顶部有 Telegram 配置状态条和「测试连接」按钮(调用 getMe + 发一条测试消息验证 token/chat)。上传时可填写配文,作为 Telegram caption;>50MB 自动改用 sendDocument。

---

## 本地运行

```bash
cd yule-agentcenter

# 1. 安装依赖(根 + 后端 + 前端)
npm run install:all

# 2. 配置后端环境变量
cp backend/.env.example backend/.env
#   按需填入 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID / ANTHROPIC_API_KEY
#   不填也能跑:上传走"演示模式"直接标记 posted,文案走本地模板

# 3. 同时启动前后端
npm run dev
```

- 前端: http://localhost:5173
- 后端: http://localhost:4000
- 默认登录口令: `admin`(在 `backend/.env` 的 `APP_PASSWORD` 修改)

---

## 接入真实能力

| 功能 | 需要配置 | 在哪拿 |
|------|---------|--------|
| Telegram 发布(社群管理) | `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID` | Telegram 里找 `@BotFather` 创建 bot 拿 token;把 bot 拉进频道/群,chat id 形如 `@your_channel` 或 `-1001234567890` |
| AI 文案(社媒管理) | `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| 发布到 X / 推特(社媒管理) | `X_API_KEY`、`X_API_SECRET`、`X_ACCESS_TOKEN`、`X_ACCESS_SECRET` | https://developer.x.com — 见下方步骤 |

### 申请 X(推特)API 密钥
1. 打开 https://developer.x.com 用你的 X 账号登录,申请开发者账号(免费档可发推,约 1500 条/月)
2. 创建一个 App(Project → App)
3. 在 App 的 **User authentication settings** 里把权限设为 **Read and Write**(只读发不了推)
4. 到 **Keys and tokens** 页:
   - 拿 **API Key / API Key Secret** → 对应 `X_API_KEY` / `X_API_SECRET`
   - 生成 **Access Token / Access Token Secret**(确保是在改成 Read and Write 之后生成的)→ 对应 `X_ACCESS_TOKEN` / `X_ACCESS_SECRET`
5. 四个值填进 `backend/.env`,重启后端,在社媒管理页点「测试连接」验证,成功会显示授权账号

配置后重启后端即可。未配置时系统自动降级为演示模式,不会报错。

---

## 部署(免费域名)

> ⚠️ `.org` 域名是付费的,没有免费 `.org`。以下用各平台的免费子域名,可后续再绑定自定义域名。

这是前后端分离应用,前端是静态站,后端是 Node 服务,分别部署:

### 前端 → Vercel / Netlify / Cloudflare Pages(免费子域名)
```bash
npm --prefix frontend run build   # 产物在 frontend/dist
```
- 上传 `frontend/dist`,得到 `xxx.vercel.app` / `xxx.netlify.app` / `xxx.pages.dev`
- 把前端请求的 `/api` 指向你部署的后端地址(见下方“连接前后端”)

### 后端 → Render / Railway / Fly.io(免费额度)
- 部署 `backend/`,启动命令 `npm start`
- 在平台后台填好 `.env` 里的环境变量
- 注意:SQLite 是单文件数据库,免费容器重启可能丢数据;长期使用建议换托管数据库

### 连接前后端
生产环境前端不再走 vite 代理,需把 API 基址指向后端域名。最简单的做法:
在 `frontend/src/api/client.js` 顶部加一个基址变量,例如
```js
const BASE = import.meta.env.VITE_API_BASE || '';
// fetch(`${BASE}/api${path}`, ...)
```
并在前端部署平台设置环境变量 `VITE_API_BASE=https://你的后端域名`。

### 想要真正的自定义域名 / .org
1. 在任意注册商(Namecheap、Cloudflare、阿里云等)购买,约 ¥80–120/年
2. 在 Vercel/Netlify 等平台的项目设置里添加该域名
3. 按提示在注册商配置 DNS(CNAME / A 记录),绑定本身不额外收费

---

## 目录结构
```
yule-agentcenter/
├── backend/          Express + SQLite + Telegram + AI
│   ├── src/
│   │   ├── index.js          服务入口 + 鉴权中间件
│   │   ├── db.js             SQLite 表结构 + 演示数据
│   │   ├── routes/           auth / tasks / todos / ai
│   │   └── services/         telegram 发布
│   └── .env.example
└── frontend/         React + Vite
    └── src/
        ├── pages/            Login / Dashboard / Community / SocialMedia / ClipManagement
        ├── components/       Nav
        └── api/client.js     带 token 的 fetch 封装
```
