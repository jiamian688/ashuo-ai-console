# 部署上线指引(GitHub + Render + Vercel,全免费)

架构:**前端**(静态站)部署到 Vercel,**后端**(Node 服务)部署到 Render,两者通过 `VITE_API_BASE` 连接。

代码已是可部署状态,且已 git 初始化并完成首次提交。按下面顺序操作即可。

---

## 第 1 步:推到 GitHub

1. 打开 https://github.com/new,建一个**空**仓库(不要勾 README / .gitignore),名字如 `yule-agentcenter`,Private/Public 都行。
2. 建好后,在本机项目目录执行(把 `你的用户名` 换成你的 GitHub 用户名):

```bash
cd ~/yule-agentcenter
git remote add origin https://github.com/你的用户名/yule-agentcenter.git
git push -u origin main
```

> 推送时若让你登录,用 GitHub 用户名 + **Personal Access Token**(不是密码)。token 在 https://github.com/settings/tokens 生成(勾 `repo` 权限)。

`.env` 已被 `.gitignore` 排除,你的 Telegram token 不会被推上去,放心。

---

## 第 2 步:部署后端到 Render

1. 打开 https://render.com,用 GitHub 账号登录。
2. 右上 **New +** → **Blueprint**。
3. 选你刚推的 `yule-agentcenter` 仓库 → Render 会自动读取根目录的 `render.yaml`,识别出后端服务。
4. 点 **Apply** / **Create**。它会问几个环境变量(`render.yaml` 里标了 `sync:false` 的):
   - **APP_PASSWORD**:登录口令,自己设一个(别再用 admin)
   - 其余 Telegram / X / Anthropic 的先**留空**,以后要用再回来填
   - `JWT_SECRET` 会自动生成,不用管
5. 等构建完成(首次约 2–4 分钟)。完成后在服务页顶部会看到后端地址,形如:
   `https://yule-agentcenter-backend.onrender.com`
6. 验证:浏览器打开 `https://你的后端地址/api/health`,看到 `{"ok":true}` 就成功。

**记下这个后端地址,下一步要用。**

> ⚠️ Render 免费档注意:① 15 分钟无访问会休眠,下次访问冷启动约 30–50 秒(正常现象);② 磁盘是临时的,重新部署或休眠后**上传的视频和 SQLite 数据会重置**——演示足够,长期用需换托管数据库 + 对象存储。

---

## 第 3 步:部署前端到 Vercel

1. 打开 https://vercel.com,用 GitHub 账号登录。
2. **Add New → Project** → 选 `yule-agentcenter` 仓库 → Import。
3. 关键设置:
   - **Root Directory**:点 Edit,选 `frontend`(一定要选,否则 Vercel 在根目录找不到前端)
   - Framework 会自动识别为 **Vite**,Build Command `npm run build`、Output `dist` 保持默认即可
   - 展开 **Environment Variables**,加一条:
     - Name: `VITE_API_BASE`
     - Value: 第 2 步记下的后端地址(如 `https://yule-agentcenter-backend.onrender.com`,**结尾不要带斜杠**)
4. 点 **Deploy**,等 1–2 分钟。
5. 完成后拿到你的网址,形如 `https://yule-agentcenter.vercel.app` —— 这就是最终免费网址,手机电脑都能打开。

---

## 第 4 步:验证

1. 打开 Vercel 给的网址 → 用第 2 步设的 `APP_PASSWORD` 登录。
2. 进各页点点看(后端刚休眠时第一次会慢几十秒,属正常)。
3. 剪辑管理上传个小视频试裁剪;社媒生成文案;社群管理上传(演示模式)。

---

## 以后怎么更新

改完代码后:
```bash
cd ~/yule-agentcenter
git add -A && git commit -m "你的改动说明"
git push
```
Render 和 Vercel 都会**自动重新部署**,不用再手动操作。

---

## 想要自定义域名 / 真 .org
- 在 Vercel 项目 **Settings → Domains** 添加你买的域名,按提示去域名商配 DNS(CNAME)即可,Vercel 侧不收费。
- `.org` 需在注册商付费购买(约 ¥80–120/年),没有免费的。
