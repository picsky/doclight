---
title: 从 docsify 迁移到 DocLight
description: docsify 用户迁移指南：一键迁移工具 + 概念对照 + 常见差异处理
---

# 从 docsify 迁移到 DocLight

docsify 是「零构建 + Markdown」文档站的开创者，但有两个硬伤：**SEO 无效**（Google 爬虫拿到空壳 HTML，hash 路由基本不收录）和 **无 AI 可读性**（没有 llms.txt / MCP 通道）。DocLight 在保留「一个文件夹 + Markdown = 文档站」体验的同时，补齐了 SEO（SSG）与 AI 原生（llms.txt/MCP/双读）两条能力。

> 迁移路线：`docs/` 文件夹本身就能被 DocLight 直接读取——大多数站点**改一行命令即可上线**，只有少量 docsify 专属文件需要处理。

## 一、快速迁移（命令行工具）

```bash
# 1. 安装 DocLight CLI
npm i -g doclight

# 2. 进入你的 docsify 项目，一键迁移
doclight migrate-docsify --dir ./            # 默认源目录 ./docsify-site
# 输出：
#   复制: 23 篇 Markdown → <cwd>/docs
#   _sidebar 导航: 12 项（DocLight 自动导航替代）
#   跳过（docsify 专属）: _sidebar.md, _navbar.md

# 3. 本地预览
doclight dev

# 4. 构建静态站点（SEO 就绪）并部署
doclight build --site-url https://你的域名
doclight deploy
```

迁移工具做什么：

| 动作 | 说明 |
|---|---|
| 复制 `.md` | 保持目录结构原样复制到 `docs/`（每级 `README.md` 保留为置顶页/首页） |
| 跳过 `_sidebar.md` | DocLight 用**文件夹结构自动生成导航**，无需手写侧边栏 |
| 跳过 `_navbar.md` | 顶栏导航由主题模板接管（后续配置系统可覆盖） |
| 跳过 `index.html` | DocLight 构建时生成自己的入口页 |
| 解析 `_sidebar` | 把 docsify 自定义导航顺序输出到报告，供你决定是否用数字前缀调整排序 |

## 二、概念对照

| docsify | DocLight | 说明 |
|---|---|---|
| `index.html`（docsify 配置） | `doclight.json`（可选） | 声明站点标题/描述/子路径等 |
| `_sidebar.md` | 自动生成 | 文件夹 = 分组，文件按「README 置顶 → 数字前缀 → 字母序」排序 |
| `_navbar.md` | 主题模板顶栏 | 无需维护，默认即用 |
| 前端运行时渲染 | 三种形态 | dev（写作）/ **SSG（SEO 发布）** / bundle（单文件分发） |
| hash 路由 `#/path` | dev/SSG 用 path 路由 | SSG 每页是独立 `.html`，Google 直接收录 |
| — | **llms.txt / MCP** | AI Agent 可直接读取/检索你的文档（docsify 没有） |
| 扩展语法 | 内置 | Mermaid 容错 / 代码高亮+复制 / KaTeX / 自定义容器 |

## 三、导航排序调整

DocLight 默认排序：**README/index 置顶 → 数字前缀优先 → 字母序**（中英文友好）。

想保留 docsify `_sidebar.md` 里的自定义顺序，给文件加数字前缀即可：

```
docs/
├── 01-快速开始.md
├── 02-安装.md
└── 03-进阶/
    └── 01-主题.md
```

> 注意：改文件名会破坏旧链接，请同步更新站内引用（或用 `git mv` 追踪）。

## 四、常见差异处理

| 情况 | 处理 |
|---|---|
| 站内链接是相对 `.md` | 无需改——DocLight 渲染时自动按形态转换（dev 保持 `.md`，SSG 转 `.html`） |
| 图片/附件路径 | 相对路径原样保留，`docs/` 下非 `.md` 文件构建时自动拷贝 |
| docsify 插件（搜索/高亮等） | 内置搜索（Ctrl+K）、代码高亮、复制按钮全部开箱即用，无需配置 |
| 自定义主题 | DocLight 设计令牌（CSS 变量）可在 `doclight.json` 覆盖 |
| 部署 | `doclight deploy` 一键推 GitHub Pages；或上传 `dist-site/` 到任意静态托管 |

## 五、迁移后验证

```bash
doclight build            # 应生成 dist-site/（含 sitemap.xml / robots.txt）
doclight preview          # 本地预览产物
npm run verify            # （在 DocLight 仓库内）全量验证
```

- 打开 `dist-site/index.html` 检查首页与导航
- 检查 `dist-site/sitemap.xml` 是否包含全部页面
- 给一个页面配 `--site-url` 后用浏览器看 `<link rel="canonical">` 与 `og:*`

## 六、FAQ

**迁移会破坏我的文档吗？** 不会——迁移工具只复制 `.md` 到 `docs/`，不删改源目录；幂等设计，目标文件已存在时不覆盖。

**docsify 的 hash 链接还能用吗？** 站内旧链接（如 `#/guide/start`）建议换成新 URL 或让用户重新导航；SSG 形态下每页有独立 URL，SEO 收益更高。

**一定要 SSG 吗？** 不——`doclight dev` 即可先用起来（和 docsify 一样的零构建体验），SSG 是「发布时」的选择。

---

> 相关：DocLight 三形态（[05-ssg-build](tech-design/05-ssg-build.md)）、AI 原生（[06-ai-native](tech-design/06-ai-native.md)）、部署分发（[13-deployment-distribution](tech-design/13-deployment-distribution.md)）。
