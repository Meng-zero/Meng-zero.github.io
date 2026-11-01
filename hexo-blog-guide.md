# Hexo + GitHub Pages + OpenKounter 个人博客搭建指南

> 环境：Windows 10/11 · Node.js 22/24（Hexo 8 要求 ≥ 20.19）· Git · GitHub 账号 · 腾讯云账号（部署 OpenKounter）
> 文中示例：GitHub 用户名 `meng-zero`，仓库 `blog`，站点 `https://meng-zero.github.io/blog/`，计数器 `https://counter.example.com`。请全局替换成你自己的。

---

## 0. 先看全局

这套组合由三块拼成，各司其职：

```
你的电脑（Hexo 源码 + Markdown）
        │  git push
        ▼
GitHub 仓库（main 分支）
        │  GitHub Actions 自动构建
        ▼
gh-pages 分支 ──► GitHub Pages（免费托管 + HTTPS）
                        │  访客浏览器加载页面
                        │  页面里的 openkounter.js 发请求
                        ▼
              OpenKounter（部署在腾讯云 EdgeOne Pages 的云函数）
                        │
                        ▼
                   Blob 存储（计数器 JSON）
```

| 组件 | 负责什么 | 你要做什么 |
| --- | --- | --- |
| Hexo | 把 Markdown 渲染成静态 HTML | 本地写文章、`hexo generate` |
| GitHub Pages | 免费托管静态文件、提供 HTTPS | 推代码，Actions 自动发布 |
| OpenKounter | 记录站点 PV/UV 和每篇文章阅读量 | 单独部署到 EdgeOne Pages，博客里引一段 JS |

**为什么计数器要单独部署？** GitHub Pages 是纯静态托管，不能跑后端、不能存数据；OpenKounter 是「云函数 + 对象存储」的轻量计数服务，正好补上这块。它也是 LeanCloud 访客统计停服后的常见替代方案。

**费用**：GitHub Pages 对公开仓库免费；EdgeOne Pages 有免费额度（作者文中给出：Cloud Functions 100 万次/月、Blob 1 GB 等，以控制台实际套餐为准）。个人博客基本用不完。

**最终验收标准**：`https://<你的域名>/` 能打开；文章页显示「阅读 x」；页脚显示站点总访问/访客数；后台能看到计数增长；24 小时内刷新不会重复增加 UV。

---

## 1. 环境准备（约 10 分钟）

### 1.1 Node.js

Hexo 8 要求 Node.js ≥ 20.19.0，推荐 22 LTS 或 24 LTS。

```powershell
winget install OpenJS.NodeJS.LTS
```

装完重开一个终端验证：

```powershell
node -v
npm -v
```

> 如果 `node -v` 低于 v20.19，请升级，否则 `hexo` 会直接报引擎不兼容。
> 国内网络慢可以换源：`npm config set registry https://registry.npmmirror.com`

### 1.2 Git

```powershell
winget install Git.Git
git --version
git config --global user.name "你的名字"
git config --global user.email "你的GitHub邮箱"
git config --global core.autocrlf true
```

### 1.3 账号

- **GitHub**：托管源码 + Pages。
- **腾讯云**：部署 OpenKounter（需要开通 EdgeOne Pages，可能要求实名认证）。
- **域名（可选，但强烈建议）**：GitHub Pages 和 OpenKounter 都用得上。

---

## 2. 创建 Hexo 站点

### 2.1 新建项目

```powershell
cd D:\blogs
npx hexo-cli init my-blog
cd my-blog
npm install
```

首次执行 `npx` 会提示安装 `hexo-cli`，输入 `y` 即可。也可以先 `npm i -g hexo-cli`，之后直接用 `hexo` 命令。

目录结构（只需要关心这几个）：

```
my-blog/
├─ _config.yml          # 站点配置（第 3 节）
├─ _config.fluid.yml    # 主题配置（第 4 节，需自己创建）
├─ package.json
├─ source/
│  ├─ _posts/           # 文章 Markdown
│  ├─ about/            # 关于页等自定义页面
│  ├─ CNAME             # 自定义域名（第 7.5 节）
│  └─ js/               # 自定义脚本
├─ themes/              # 用 npm 装主题时可为空
└─ public/              # 生成结果（不要提交）
```

### 2.2 先跑起来

```powershell
npx hexo server
```

浏览器打开 `http://localhost:4000`，能看到 Hexo 默认首页就说明环境没问题。`Ctrl + C` 停止。

### 2.3 如果你直接用现有的 `D:\blogs\my-blog`

当前这个项目有三处需要修：

1. `_config.yml` 里写了 `theme: fluid`，但 `themes/` 是空的、`package.json` 里也没有 `hexo-theme-fluid` —— 直接构建会找不到主题。
2. `url` 还是 `http://example.com`，会导致 CSS/JS 链接全错。
3. 还没有初始化 git 仓库。

先补主题：

```powershell
cd D:\blogs\my-blog
npm install hexo-theme-fluid --save
Copy-Item .\node_modules\hexo-theme-fluid\_config.yml .\_config.fluid.yml
```

然后按第 3、4 节改配置即可。项目里同时存在 `package-lock.json` 和 `pnpm-lock.yaml`，建议统一用 npm（删掉 `pnpm-lock.yaml`），避免 CI 里选错包管理器。

> 命令若因权限失败，请在普通 PowerShell 窗口里执行，不要用受限终端。

---

## 3. 站点配置 `_config.yml`

只改下面这些，其余保持默认。注意 YAML 语法：**冒号后面必须有空格**，不要用 Tab，中文建议加引号。

```yaml
# Site
title: Meng-zero Blog
subtitle: '记录与分享'
description: '一个用来写技术笔记的地方'
keywords: 'Hexo,GitHub Pages,博客'
author: Meng-zero
language: zh-CN
timezone: 'Asia/Shanghai'

# URL —— 最容易错的地方，见下方说明
url: https://meng-zero.github.io
root: /
permalink: :year/:month/:day/:title/

# Writing
post_asset_folder: true     # 每篇文章一个同名资源目录，方便放图
relative_link: false
future: true

# Extensions
theme: fluid

# Deployment（用 GitHub Actions 部署，这里留空）
deploy:
  type: ''
```

### 3.1 `url` 和 `root` 怎么填

| 仓库类型 | 仓库名 | 访问地址 | `url` | `root` |
| --- | --- | --- | --- | --- |
| 用户站（推荐新手） | `<用户名>.github.io` | `https://meng-zero.github.io/` | `https://meng-zero.github.io` | `/`（可省略） |
| 项目站 | 任意，如 `blog` | `https://meng-zero.github.io/blog/` | `https://meng-zero.github.io/blog` | `/blog/` |
| 绑定自定义域名后 | 任意 | `https://blog.example.com/` | `https://blog.example.com` | `/` |

填错的典型症状：首页能开但样式全丢、文章链接 404、图片裂开。

> 项目站改成自定义域名后，页面路径会从 `/blog/...` 变成 `/...`，OpenKounter 的页面计数 key 也会跟着变（旧数据还在，新 key 从 1 开始）。如果打算长期做，建议一开始就上自定义域名。

---

## 4. 主题：Fluid

选 Fluid 的原因：Material 风格、中文文档全，而且 **1.9.9 起原生支持 OpenKounter**，不用改模板。

### 4.1 安装

```powershell
npm install hexo-theme-fluid --save
Copy-Item .\node_modules\hexo-theme-fluid\_config.yml .\_config.fluid.yml
```

主题配置放在根目录的 `_config.fluid.yml`（Hexo 会优先用它，升级主题不会覆盖）。

### 4.2 必改项

```yaml
# 导航栏标题
navbar:
  blog_title: "Meng-zero"

# 首页副标题
index:
  slogan:
    enable: true
    text: "把学到的东西写下来"

# 关于页
about:
  enable: true
  name: "Meng-zero"
  intro: "后端 / 折腾 / 记录"
  icons:
    - { class: "iconfont icon-github-fill", link: "https://github.com/meng-zero", tip: "GitHub" }

# 页脚
footer:
  content: '© 2026 <a href="https://github.com/meng-zero">Meng-zero</a> · Powered by Hexo & Fluid'
```

其余按需：`dark_mode`、`search`、`post.meta`（字数/阅读时长）、`post.copyright`、评论插件（giscus 等）。

### 4.3 升级注意

```powershell
npm update hexo-theme-fluid
```

升级后 `_config.fluid.yml` 不会自动加新字段。做法：把新版的 `node_modules/hexo-theme-fluid/_config.yml` 复制成 `_config.fluid.new.yml`，和旧的对比后手动合并，别直接覆盖。

---

## 5. 写第一篇文章和页面

```powershell
npx hexo new post "Hello Hexo"
npx hexo new page about
```

文章在 `source/_posts/hello-hexo.md`，页面在 `source/about/index.md`。

Front-matter 示例：

```yaml
---
title: Hello Hexo
date: 2026-10-31 22:30:00
updated: 2026-10-31 22:30:00
categories:
  - 随笔
tags:
  - Hexo
  - 建站
description: 第一篇文章
---

正文从这里开始。

<!-- more -->

`<!-- more -->` 之后的内容只在文章页显示，首页只显示摘要。
```

插图（配合 `post_asset_folder: true`）：

```markdown
{% asset_img demo.png 图片说明 %}
```

图片放在 `source/_posts/hello-hexo/demo.png`。

常用命令：

| 命令 | 作用 |
| --- | --- |
| `npx hexo new post "标题"` | 新建文章 |
| `npx hexo new page about` | 新建页面 |
| `npx hexo server` | 本地预览（4000 端口） |
| `npx hexo server -p 4001` | 端口被占用时换端口 |
| `npx hexo clean` | 清掉 `public/` 和缓存 |
| `npx hexo generate` | 生成静态文件到 `public/` |

写完先本地看一眼，再进入部署环节。

---

## 6. 推到 GitHub

### 6.1 建仓库

在 GitHub 新建仓库：

- **用户站**：仓库名必须是 `<用户名>.github.io`，例如 `meng-zero.github.io`。
- **项目站**：名字随意，例如 `blog`。
- 可见性选 **Public**（私有仓库使用 Pages 需要付费计划）。
- 不要勾选初始化 README / .gitignore / License，保持空仓库。

### 6.2 初始化并推送

```powershell
cd D:\blogs\my-blog
git init -b main
git add .
git commit -m "chore: init hexo blog"
git remote add origin https://github.com/meng-zero/blog.git
git push -u origin main
```

推送时会弹出浏览器登录 GitHub（Git Credential Manager）。若提示密码，请用 **Personal Access Token** 代替密码，不要用账号密码。

### 6.3 `.gitignore` 确认

Hexo 默认生成的 `.gitignore` 应包含以下内容，没有就补上：

```
node_modules/
public/
db.json
.deploy_git/
*.log
```

`public/` 是构建产物，交给 CI 生成；`db.json` 是本地缓存，都不该进仓库。

---

## 7. GitHub Actions：push 即发布

### 7.1 新增 workflow

新建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy Hexo to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build site
        run: |
          npx hexo clean
          npx hexo generate

      - name: Publish to gh-pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_branch: gh-pages
          publish_dir: ./public
          user_name: github-actions[bot]
          user_email: github-actions[bot]@users.noreply.github.com
```

这个 workflow 做四件事：检出代码 → 装依赖 → 生成静态文件 → 把 `public/` 推到 `gh-pages` 分支（并自动加 `.nojekyll`，防止 GitHub 用 Jekyll 处理你的文件）。

> `npm ci` 依赖仓库里的 `package-lock.json`。如果报「lock 文件不同步」，本地执行一次 `npm install`，把更新后的 `package-lock.json` 提交上去。

### 7.2 两处仓库设置

1. **Settings → Actions → General → Workflow permissions**：选 **Read and write permissions**，保存。否则 `GITHUB_TOKEN` 没有推分支的权限。
2. **Settings → Pages → Build and deployment**：
   - Source 选 **Deploy from a branch**
   - Branch 选 `gh-pages`，目录 `/ (root)`，保存。

第一次运行结束后 `gh-pages` 分支才会出现，所以先推代码、等 Actions 变绿，再回来选分支也可以。

### 7.3 验收

- 打开仓库 **Actions** 标签页，最新一次运行应该是绿色对勾。
- 打开 **Settings → Pages**，顶部会显示 `Your site is live at https://...`。
- 访问该地址，检查首页、文章页、归档页、关于页、暗色模式、手机端。
- 打开 `gh-pages` 分支，确认根目录有 `index.html`、`.nojekyll`，以及 `CNAME`（如果配了域名）。

### 7.4 部署后 404 / 样式丢失排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 首页 404 | Pages 分支选错 / 还没构建完 | 确认 `gh-pages` + `/ (root)`，等 1–3 分钟 |
| 首页能开，样式全丢 | `url` / `root` 配错 | 项目站必须 `root: /blog/` 且 `url` 带 `/blog` |
| 文章详情 404 | 链接带 `.html` 或大小写不一致 | 统一用目录式 permalink；GitHub Pages 区分大小写 |
| 页面出来是源码/README | 没有 `.nojekyll` | 用上面的 action 会自动加；手动部署时自己 `touch .nojekyll` |
| Actions 报 403 | 工作流权限是只读 | 7.2 第 1 步改成 Read and write |

### 7.5 自定义域名（推荐）

1. 在域名服务商加解析：
   - 子域名 `blog.example.com` → CNAME → `meng-zero.github.io`
   - 根域名 `example.com` → A 记录 → `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`
2. 在仓库 `source/` 下新建 `CNAME` 文件，内容只有一行（不带协议）：

   ```
   blog.example.com
   ```

3. 提交推送，等 Actions 跑完。
4. **Settings → Pages → Custom domain** 填入 `blog.example.com`，保存；DNS 检查通过后勾选 **Enforce HTTPS**（证书签发可能要等几分钟到 24 小时）。
5. 把 `_config.yml` 的 `url` 改成 `https://blog.example.com`，`root` 改回 `/`，再推一次。

### 7.6 备选：不用 gh-pages 分支的官方方案

如果更喜欢 GitHub 官方 Pages Actions，把 workflow 换成下面这版，并把 **Settings → Pages → Source** 改成 **GitHub Actions**：

```yaml
name: Deploy Hexo to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx hexo clean && npx hexo generate
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

两套方案二选一，不要同时启用。

---

## 8. 部署 OpenKounter（计数器后端）

### 8.1 它是什么

OpenKounter 是开源的 PV/UV 计数器：前端一段 JS + 边缘云函数 + Blob 存储，提供 `GET/POST /api/counter` 接口，自带 Web 管理后台（Token / Passkey / OIDC 登录）、域名白名单、数据导入导出。

三个计数 key 的约定（Fluid 内置脚本用的就是它们）：

| key | 含义 |
| --- | --- |
| `site-pv` | 站点总浏览量，每次页面加载 +1 |
| `site-uv` | 站点访客数，浏览器本地 24 小时内只 +1 |
| `/2026/10/31/hello-hexo/` | 单篇文章浏览量，key 是页面路径 |

### 8.2 一键部署（推荐）

1. 先 Fork 仓库（用你自己的 Fork 部署，方便以后改）：打开 <https://github.com/Mintimate/open-kounter> → **Fork**。
2. 登录腾讯云，开通 **EdgeOne Pages**（新用户有免费额度，可能需要实名）。
3. 打开部署入口：

   ```
   https://console.cloud.tencent.com/edgeone/pages/new?repository-url=https://github.com/<你的用户名>/open-kounter
   ```

4. 在控制台按提示授权 GitHub、选择**你自己的 Fork**、分支 `main`。
5. 构建配置（仓库里的 `edgeone.json` 通常会自动带出，核对一遍）：

   | 配置项 | 值 |
   | --- | --- |
   | 框架预设 | Vite |
   | 构建命令 | `npm run build:makers` |
   | 输出目录 | `dist` |
   | Node 版本 | 22 |

6. 点部署，等待构建完成。
7. **项目设置 → 存储**：确认已开通 **Blob**。首次访问接口时云函数会自动创建名为 `open-kounter` 的 Store；想改名就设环境变量 `OPEN_KOUNTER_BLOB_STORE`，改完**重新部署**一次。
8. 打开项目域名，按页面提示**创建管理员 Token**。也可以用环境变量 `ADMIN_TOKEN` 预置（优先级高于后台保存的 Token），建议 32 位以上随机串，存进密码管理器。

### 8.3 命令行部署（备选）

```powershell
git clone https://cnb.cool/Mintimate/tool-forge/open-kounter.git
cd open-kounter
npm ci
npm install -g edgeone@1.6.13
edgeone login
edgeone makers deploy -n open-kounter
```

需要 Node 22 和 Git；`-n` 后面是项目名。

### 8.4 绑定自定义域名（很重要）

EdgeOne Pages 的项目域名/部署域名有访问限制（按官方文档：加速区域含中国大陆时需用 3 小时有效的预览链接访问；选「全球可用区（不含中国大陆）」时大陆网络访问会返回 401）。**生产环境请务必绑定自己的域名**，否则博客里的计数请求可能间歇性 401。

1. 控制台 → 项目 → **域名管理** → 添加自定义域名，例如 `counter.example.com`。
2. 按提示到域名服务商加 CNAME 记录。
3. 验证通过后平台自动签发 HTTPS 证书。
4. 之后博客里统一用 `https://counter.example.com`。

同理，加速区域如果没有备案域名，选「全球可用区（不含中国大陆）」。

### 8.5 配置域名白名单

登录后台 → 域名白名单，加入博客的**完整 Origin**（协议 + 域名，不带路径）：

```
https://meng-zero.github.io
https://blog.example.com
```

规则要点：

- `https://meng-zero.github.io` 匹配的是整个 Origin，仓库子路径 `/blog/` 不用写。
- 子域通配写 `*.example.com`，它**不匹配**根域 `example.com`，也不匹配 `evil-example.com`。
- 白名单只约束浏览器端的写入请求；它不是防刷手段。

### 8.6 接口自测

```powershell
# 读计数
Invoke-RestMethod "https://counter.example.com/api/counter?target=site-pv" | ConvertTo-Json -Depth 5

# 批量自增（会真的 +1）
Invoke-RestMethod -Method Post -Uri "https://counter.example.com/api/counter" `
  -ContentType "application/json" `
  -Body '{"action":"batch_inc","requests":[{"target":"site-pv"},{"target":"/2026/10/31/hello-hexo/"}]}' `
  | ConvertTo-Json -Depth 5
```

成功返回形如：

```json
{ "code": 0, "data": [ { "target": "site-pv", "time": 1 }, { "target": "/2026/10/31/hello-hexo/", "time": 1 } ] }
```

`code` 为 0 才算成功（HTTP 状态通常是 200）。

### 8.7 额度与安全

- 免费额度足够个人博客；超出后按平台计费，具体看控制台套餐。
- 管理员 Token 只存在服务端和你的密码管理器里，**不要写进博客前端**。
- 公开的 `/api/counter` 只能读和 +1，改值/删除/导出都需要 Bearer Token。
- 定期在后台「数据备份」导出 JSON，Blob 里的数据只有你这份。

---

## 9. 博客接入 OpenKounter

### 9.1 Fluid 1.9.9+ 原生接入（推荐）

在 `_config.fluid.yml` 里加三处配置：

```yaml
# 1) 打开统计并填服务地址
web_analytics:
  enable: true          # 关键：false 时只读取、不自增
  follow_dnt: true      # 尊重浏览器“请勿追踪”
  openkounter:
    server_url: "https://counter.example.com"
    path: window.location.pathname
    ignore_local: true  # 本地 localhost 预览不计数

# 2) 页脚显示站点 PV / UV
footer:
  statistics:
    enable: true
    source: "openkounter"

# 3) 文章页显示阅读量
post:
  meta:
    views:
      enable: true
      source: "openkounter"
```

说明：

- 三个开关是独立的：只开页脚就只显示站点 PV/UV；只开 `post.meta.views` 就只显示文章阅读量。
- `enable: true` 才会发写请求；设为 `false` 时页面只显示历史值，适合本地调试。
- 页面路径计数会自动去掉末尾的 `/index.html`，所以 `hello-hexo/` 和 `hello-hexo/index.html` 算同一个 key。
- Fluid 生成的 DOM 结构（想自定义样式可以 CSS 覆盖）：

  | 元素 | id |
  | --- | --- |
  | 站点 PV 容器 / 数值 | `#openkounter-site-pv-container` / `#openkounter-site-pv` |
  | 站点 UV 容器 / 数值 | `#openkounter-site-uv-container` / `#openkounter-site-uv` |
  | 文章阅读容器 / 数值 | `#openkounter-page-views-container` / `#openkounter-page-views` |

改完配置推代码，等 Actions 发布，打开线上页面验证。

### 9.2 其他主题 / 旧版 Fluid：手动接入

原理一样：放一个脚本 + 放几个占位元素。下面这份脚本不依赖任何主题，复制到 `source/js/openkounter.js`：

```js
/*!
 * OpenKounter 通用接入脚本
 * 用法：
 *   1. 改下面的 SERVER 常量；
 *   2. 页面里放占位元素（见文件底部注释）；
 *   3. 引入本脚本。
 */
(function () {
  'use strict';

  var SERVER = 'https://counter.example.com'; // ← 改成你的 OpenKounter 地址

  var cfg = {
    increment: true,     // false = 只读
    ignoreLocal: true,
    respectDNT: true,
    timeout: 15000,
    uvKey: 'OpenKounter_UV_Flag',
    uvTTL: 86400000,
    pagePath: function () { return location.pathname; }
  };

  var BASE = SERVER.replace(/\/+$/, '');

  function isLocal() {
    if (!cfg.ignoreLocal) return false;
    var h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  }

  function dntOn() {
    if (!cfg.respectDNT) return false;
    var d = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    return d === '1' || d === 'yes';
  }

  function pageTarget() {
    var p = (cfg.pagePath() || '/').split('#')[0].split('?')[0];
    return decodeURI(p.replace(/\/+(index\.html)?$/, '/'));
  }

  function api(url, options) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, cfg.timeout);
    var opts = Object.assign({}, options || {});
    if (controller) opts.signal = controller.signal;

    return fetch(url, opts)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (body) {
        if (!body || body.code !== 0) throw new Error((body && body.message) || '接口返回异常');
        return body.data;
      })
      .finally(function () { clearTimeout(timer); });
  }

  function read(target) {
    return api(BASE + '/api/counter?target=' + encodeURIComponent(target));
  }

  function inc(targets) {
    return api(BASE + '/api/counter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'batch_inc',
        requests: targets.map(function (t) { return { target: t }; })
      })
    });
  }

  function canCountUV() {
    try {
      var last = parseInt(localStorage.getItem(cfg.uvKey) || '0', 10);
      return !(last > 0 && Date.now() - last < cfg.uvTTL);
    } catch (e) { return true; }
  }

  function markUV() {
    try { localStorage.setItem(cfg.uvKey, String(Date.now())); } catch (e) {}
  }

  function paint(key, value) {
    document.querySelectorAll('[data-openkounter="' + key + '"]').forEach(function (el) {
      el.textContent = String(value);
    });
    var box = document.querySelector('[data-openkounter-container="' + key + '"]');
    if (box) box.style.display = '';
  }

  var slots = { 'site-pv': 'site-pv', 'site-uv': 'site-uv', 'page': pageTarget() };
  var present = Object.keys(slots).filter(function (key) {
    return document.querySelector('[data-openkounter="' + key + '"]');
  });
  if (!present.length) return;

  var counting = cfg.increment && !isLocal() && !dntOn();
  var incKeys = present.filter(function (key) {
    if (!counting) return false;
    return key === 'site-uv' ? canCountUV() : true;
  });

  // 只读的 key
  present.filter(function (key) { return incKeys.indexOf(key) === -1; }).forEach(function (key) {
    read(slots[key]).then(function (record) {
      if (record && typeof record.time === 'number') paint(key, record.time);
    }).catch(function (err) { console.error('[OpenKounter] 读取失败', key, err); });
  });

  if (!incKeys.length) return;

  // 需要自增的 key：一次 batch_inc 拿回最新值
  inc(incKeys.map(function (key) { return slots[key]; })).then(function (records) {
    var map = {};
    (records || []).forEach(function (r) { if (r && r.target) map[r.target] = r.time; });
    incKeys.forEach(function (key) {
      if (typeof map[slots[key]] === 'number') paint(key, map[slots[key]]);
    });
    if (incKeys.indexOf('site-uv') !== -1) markUV(); // 服务端确认后才记 24h
  }).catch(function (err) {
    console.error('[OpenKounter] 自增失败', err);
    incKeys.forEach(function (key) {
      read(slots[key]).then(function (record) {
        if (record && typeof record.time === 'number') paint(key, record.time);
      }).catch(function () {});
    });
  });
})();

/*
 * 页面占位元素（放在想显示的位置，按需取舍）：
 *
 * <span data-openkounter-container="site-pv">总访问 <span data-openkounter="site-pv">--</span> 次</span>
 * <span data-openkounter-container="site-uv">访客 <span data-openkounter="site-uv">--</span> 人</span>
 * <span data-openkounter-container="page">阅读 <span data-openkounter="page">--</span></span>
 *
 * 容器可以先用 CSS 隐藏（例如 style="display:none"），脚本取到数据后改为显示。
 */
```

接入步骤：

1. 文件放到 `source/js/openkounter.js`。
2. 主题支持 `custom_js`（Fluid 用 `_config.fluid.yml` 的 `custom_js`）就加进去；否则在主题的 `head`/`body` 模板里加 `<script src="/js/openkounter.js" defer></script>`。
3. 在页脚模板放站点 PV/UV 占位，在文章模板放 `page` 占位。
4. 若主题用 PJAX/无刷新跳转，需要在页面切换后重新执行一次初始化逻辑（把 IIFE 改成具名函数并挂到 `window`）。

### 9.3 验证三步

1. **看请求**：线上文章页 F12 → Network，应看到 `GET /api/counter?target=...` 和 `POST /api/counter`（先有一次 `OPTIONS` 预检），状态 200/204。
2. **看后台**：登录 OpenKounter 后台，`site-pv` 和对应文章 key 的数值 +1。
3. **看去重**：同一浏览器 24 小时内再刷新，`site-pv` 继续 +1，`site-uv` 不变。

### 9.4 排错表

| 现象 | 排查方向 |
| --- | --- |
| 数字一直是 `--` | `server_url` 写错；脚本没加载（404）；DOM id 不匹配；被广告拦截插件拦了 |
| 数字显示但不增长 | `web_analytics.enable` 为 false；白名单没加当前 Origin；接口返回 `code != 0` |
| 控制台报 CORS | 白名单必须是精确 Origin（协议+域名+端口），加完要重新保存 |
| 401 / 403 | 用了默认项目域名且预览链接过期；改用自定义域名 |
| UV 不涨 | 24 小时内已计过；无痕模式/禁用了 localStorage；浏览器开了 DNT |
| 本地预览也在涨 | `ignore_local: true`；或把 `enable` 设为 false |
| 换域名后阅读量从 1 开始 | 页面 key 基于 pathname，属正常现象，可用后台 `set` 或导入把旧值迁过去 |
| 文章页没有阅读量 | `post.meta.views.enable` 没开，或 `source` 不是 `openkounter` |

---

## 10. 日常写作与维护

### 10.1 一条龙流程

```powershell
cd D:\blogs\my-blog
npx hexo new post "文章标题"
# 写内容、放图片
npx hexo server          # 本地看效果（可选）
git add .
git commit -m "post: 文章标题"
git push
```

推送后 1–3 分钟自动上线。

### 10.2 备份与迁移

- **备份**：OpenKounter 后台 →「数据备份」→ 导出 JSON，存到网盘/私有仓库。
- **换机器/重建**：同样位置导入即可；导入结构是 `{ counters: { "site-pv": { time, created_at, updated_at } }, allowedDomains: [...] }`。
- **从 LeanCloud 迁移**：导出 LeanCloud 的 Counter 数据，按上面的结构整理成 `counters` 后导入；后台也提供旧 KV 迁移入口（仅旧版部署需要）。

### 10.3 升级

```powershell
npm outdated
npm update hexo hexo-theme-fluid
```

Hexo 大版本升级前先看 [Hexo 更新日志](https://hexo.io/news/)，Fluid 升级后按 4.3 合并配置。

### 10.4 可选增强

| 需求 | 方案 |
| --- | --- |
| 评论 | Fluid 内置 giscus / utterances / waline，改 `post.comments` 与对应插件配置 |
| 搜索 | Fluid 默认开启本地搜索，确认 `search.enable: true` |
| SEO | 装 `hexo-generator-sitemap`、`hexo-generator-feed`，配置 `url` 后提交搜索引擎 |
| 国内访问 | 同一份 `public/` 再部署一份到 EdgeOne Pages，做双线 |
| 图片 | 图床或对象存储，`post_asset_folder` 只适合少量图片 |

---

## 附录 A：最小文件清单

```
my-blog/
├─ _config.yml
├─ _config.fluid.yml
├─ package.json / package-lock.json
├─ .gitignore
├─ .github/workflows/deploy.yml
├─ source/
│  ├─ _posts/*.md
│  ├─ about/index.md
│  ├─ CNAME                 # 可选
│  └─ js/openkounter.js     # 仅手动接入时需要
└─ node_modules/            # 不提交
```

## 附录 B：命令速查

| 目的 | 命令 |
| --- | --- |
| 本地预览 | `npx hexo server` |
| 清缓存 | `npx hexo clean` |
| 生成静态文件 | `npx hexo generate` |
| 新建文章 / 页面 | `npx hexo new post "标题"` / `npx hexo new page about` |
| 安装主题 | `npm install hexo-theme-fluid --save` |
| 读计数 | `Invoke-RestMethod "https://counter.example.com/api/counter?target=site-pv"` |
| 查看 Actions | 仓库 → Actions |
| 查看线上站点 | Settings → Pages |

## 附录 C：参考链接

- Hexo 文档：<https://hexo.io/docs/>
- Hexo 部署到 GitHub Pages：<https://hexo.io/docs/github-pages>
- GitHub Pages 文档：<https://docs.github.com/pages>
- Fluid 文档：<https://hexo.fluid-dev.com/docs/>
- OpenKounter 仓库：<https://github.com/Mintimate/open-kounter>
- OpenKounter 部署说明：<https://github.com/Mintimate/open-kounter/blob/main/docs/deployment.md>
- OpenKounter API：<https://github.com/Mintimate/open-kounter/blob/main/docs/api.md>
- EdgeOne Pages 文档：<https://edgeone.cloud.tencent.com/pages/document>
- 作者介绍文章：<https://www.mintimate.cn/2026/02/14/openKounter/>
