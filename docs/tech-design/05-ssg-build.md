# 05 · SSG 静态导出与 SEO

---

## 5.1 设计思路：从浏览器渲染到静态产物

### 5.1.1 为什么需要 SSG

纯客户端渲染方案（hash 路由 + 浏览器端渲染，如 docsify）有一个致命问题：**SEO 无效**。

- Google 爬虫拿到的是一个空壳 HTML，内容全靠 JS 渲染
- 虽然 Google 宣称能执行 JS，但实际索引效果很差
- hash 路由（`#/path/to/doc`）的页面 Google 基本不收录
- 其他搜索引擎（Bing、百度、DuckDuckGo）对 JS 站点的支持更差

这就是 docsify 最大的痛点——**好看好用，但搜索引擎找不到**。

### 5.1.2 DocLight 的解法：三形态

```
① dev server（写作）       ② SSG（发布）           ③ bundle（分发）
     │                            │                        │
     ├─ 本地热重载               ├─ SEO 友好              ├─ 双击即看
     ├─ 完整功能                 ├─ 首屏更快              ├─ 跨浏览器
     └─ 需 Node                  └─ 任意静态托管           └─ 零依赖
     │                            │                        │
     └──────────────── 同一份内容 / 同一渲染内核 ────────────┘
```

**核心理念**：三种形态不是三个产品，是同一渲染内核的三种产物。
- 内容完全一样（都是同一份 Markdown）
- 渲染逻辑完全一样（Node 渲染内核，含 sanitize）
- 只是产物的承载方式不同（本地服务 / 静态目录 / 单文件）
- 用户可在任意形态间切换，无迁移成本（详见 [02-2.4](./02-architecture.md)）

---

## 5.2 CLI 工具设计

### 5.2.1 命令清单

```bash
doclight init [path]          # 初始化新项目
doclight dev [path]           # 启动开发服务器（热重载）
doclight build [path]         # 构建静态站点（SSG）
doclight bundle [path]        # 构建单文件便携包（离线分发）
doclight deploy [path]        # 一键部署（GitHub Pages / Cloudflare / Netlify）
doclight embed [path]         # 生成 iframe 嵌入代码
doclight preview [path]       # 预览构建结果
doclight search-index [path]  # 仅生成搜索索引
doclight llms-txt [path]      # 仅生成 llms.txt
doclight info [path]          # 显示项目信息
```

**全局选项**：
- `--config <file>` 指定配置文件路径
- `--out-dir <dir>` 输出目录（默认 `dist`）
- `--quiet` 静默模式
- `--verbose` 详细输出

### 5.2.2 零依赖的 CLI

**不使用 Commander / yargs / cac 等 CLI 框架**，用原生 `process.argv` 手写解析。

理由：
- 命令很少（不到 10 个），手写更轻
- 减少依赖，降低安装体积和安全风险
- 启动更快（没有框架 overhead）

### 5.2.3 开发服务器

**功能**：
- 本地 HTTP 服务器（默认端口 5173，可配置）
- Markdown 文件变更自动刷新浏览器
- 支持 path 路由（HTML5 history API fallback）
- 支持热更新（HMR-lite：内容变更不刷新整页，只替换内容区）

**技术选型**：
- 不使用 Vite / Webpack Dev Server
- 用 Node.js 原生 `http` 模块 + `chokidar`（文件监听）
- 浏览器端通过 Server-Sent Events (SSE) 接收变更通知
- 轻量、快速、零构建

```
文件变更
  → chokidar 检测到
  → SSE 推送给浏览器
  → 浏览器 fetch 新的 Markdown
  → 重新渲染内容区（不刷新整页）
  → 滚动位置保持
```

---

## 5.3 构建流程详解

### 5.3.1 完整构建步骤

```
doclight build
    │
    ├─ 1. 读取配置（doclight.json）
    │
    ├─ 2. 扫描 docs/ 目录
    │     → 生成文档树
    │     → 提取 frontmatter
    │     → 统计字数、标签
    │
    ├─ 3. 渲染每个 Markdown 文件
    │     ├── marked 渲染 → HTML 片段
    │     ├── 代码高亮
    │     ├── 提取标题 → TOC 数据
    │     ├── 生成页面 meta（title/description）
    │     ├── 注入页面模板（侧边栏 + 顶栏 + 内容 + TOC）
    │     ├── 生成完整 HTML
    │     └── 写入 dist/path/to/doc.html
    │
    ├─ 4. 生成首页（index.html）
    │     → README.md 或 index.md 的渲染结果
    │
    ├─ 5. 构建搜索索引
    │     → 提取所有文档正文
    │     → 构建 MiniSearch/FlexSearch 索引
    │     → 序列化为 JSON
    │     → 写入 dist/search-index.json
    │
    ├─ 6. 生成 llms.txt
    │     → 按优先级排列文档
    │     → 提取摘要和标签
    │     → 写入 dist/llms.txt
    │
    ├─ 7. 生成 sitemap.xml
    │     → 列出所有页面 URL
    │     → 加上 lastmod 时间
    │
    ├─ 8. 生成 robots.txt
    │
    ├─ 9. 复制静态资源
    │     → public/ 目录下的所有文件
    │     → 图片、附件、字体等
    │
    ├─ 10. 生成 manifest.json（PWA 可选）
    │
    └─ 11. 输出构建报告
          → 页面数量
          → 构建时间
          → 输出体积
          → 提示下一步
```

### 5.3.2 模板渲染

**页面模板结构**：

```html
<!DOCTYPE html>
<html lang="zh-CN" data-theme="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><!-- TITLE --></title>
  <meta name="description" content="<!-- DESCRIPTION -->">
  <meta property="og:title" content="<!-- TITLE -->">
  <meta property="og:description" content="<!-- DESCRIPTION -->">
  <meta property="og:type" content="article">
  <link rel="canonical" href="<!-- URL -->">
  <!-- 内联 CSS（同运行时） -->
  <style>/* ... */</style>
  <!-- 防闪烁脚本（同运行时） -->
  <script>/* ... */</script>
  <!-- 结构化数据 -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "<!-- TITLE -->",
    "description": "<!-- DESCRIPTION -->",
    "wordCount": <!-- WORD_COUNT -->
  }
  </script>
</head>
<body>
  <!-- 完整的导航 HTML（预渲染，不是 JS 生成） -->
  <aside id="sidebar">
    <!-- 侧边栏完整 HTML -->
  </aside>

  <header id="topbar">
    <!-- 顶栏完整 HTML -->
  </header>

  <main id="main">
    <div class="paper">
      <!-- 内容区：预渲染的 HTML（SEO 关键） -->
      <article id="content" class="article">
        <!-- RENDERED MARKDOWN -->
      </article>
      <nav id="pager">
        <!-- 上一页/下一页 -->
      </nav>
    </div>
  </main>

  <!-- TOC：预渲染的完整列表 -->
  <aside id="toc">
    <div class="toc-rail"></div>
    <div class="toc-panel">
      <ul>
        <!-- TOC 列表 -->
      </ul>
    </div>
  </aside>

  <!-- 运行时 JS（接管交互，不接管内容） -->
  <script>/* 展示层运行时 */</script>
  <script>
    // 标记为 SSG 模式，JS 知道不要重新渲染首屏
    window.__DOCLLIGHT_SSG__ = true
  </script>
</body>
</html>
```

**关键设计**：
- 首屏内容完全是静态 HTML，爬虫直接能读到
- JS 加载后接管交互（导航切换、搜索、TOC 高亮），但不重新渲染内容
- 这叫「progressive hydration」——内容先有，交互渐进增强

### 5.3.3 渲染唯一性（架构简化后的保证）

**问题**：原「浏览器运行时渲染 + SSG 构建渲染」双端方案需要保证输出一致。三形态架构下渲染只在 Node 内核发生一次，**双端漂移问题天然消除**。

**剩余保证**：
1. **三种形态产物一致性**：dev / SSG / bundle 对同一篇 Markdown 输出相同 HTML（快照对比测试）
2. **单一事实来源**：所有渲染配置（代码高亮、自定义容器、sanitize）只在一套内核里
3. **快照测试**：同一 Markdown 在三种形态下的 HTML 逐字节一致

### 5.3.4 bundle 便携包构建

`doclight bundle` 复用 SSG 渲染内核，输出**单个自包含的 `doclight.html`**：

```
构建步骤：
  1-3. 与 SSG 相同（扫描 / 渲染 / sanitize）
  4. 所有页面 HTML 打包为 JSON 数据块
  5. 内嵌搜索索引 + llms.txt 全文 + docs.json
  6. 注入展示层运行时
  7. 输出单个 doclight.html

产物特征：
  - 零依赖：不发起网络 / file 读取请求（file:// 三引擎实测通过）
  - 跨浏览器：Chromium / Firefox / WebKit 全兼容
  - 离线可用：无网络完整运行
  - 可分发：一个文件传给任何人
  - AI 就绪：内嵌 llms.txt + docs.json，Agent 直接读
```

**体积参考**：100 页文档 ≈ 400KB HTML + 数据（gzip 后显著更小）。

**典型用途**：
- 给非技术用户/客户发文档（无需教他们安装 Node）
- 离线查阅（出差、无网环境）
- 教学素材分发
- 作为「文档的 PDF 导出」——写作用 dev，发布用 SSG，分发用 bundle

---

## 5.4 SEO 优化清单

### 5.4.1 基础 SEO

| 项 | 实现方式 |
|---|---|
| ✅ 语义化 HTML | `<article>`, `<nav>`, `<aside>`, `<header>` |
| ✅ 唯一 URL | 每个页面有独立的静态 HTML 文件 |
| ✅ `<title>` | 自动提取自一级标题或 frontmatter |
| ✅ `<meta description>` | 自动提取首段或 frontmatter 的 summary |
| ✅ 标题层级 | H1 唯一，H2/H3 结构清晰 |
| ✅ 图片 alt | 要求用户写，构建时检查缺失警告 |
| ✅ canonical URL | 每个页面有规范链接 |

### 5.4.2 进阶 SEO

| 项 | 实现方式 |
|---|---|
| ✅ sitemap.xml | 自动生成，包含所有页面 URL 和 lastmod |
| ✅ robots.txt | 自动生成，指向 sitemap |
| ✅ Open Graph | og:title / og:description / og:type |
| ✅ OG 分享卡片图 | 每页自动生成社交预览图（标题/摘要/主题色，Node 侧生成无浏览器依赖） |
| ✅ Twitter Card | twitter:title / twitter:description / twitter:image |
| ✅ JSON-LD 结构化数据 | TechArticle 类型，含 wordCount 等 |
| ✅ 面包屑导航 | 结构化数据 + 可见 UI |
| ✅ 链接文本 | 内部链接用描述性文字，不用「点击这里」 |

### 5.4.3 性能 SEO

| 项 | 目标 |
|---|---|
| ✅ 首屏 HTML 直出 | LCP < 1s |
| ✅ 内联 CSS/JS | 零阻塞渲染的网络请求 |
| ✅ 图片懒加载 | 首屏之外的图片不加载 |
| ✅ 代码分割 | 搜索、mermaid、高亮都按需加载 |
| ✅ 静态资源缓存 | 构建时加 hash，长效缓存 |

---

## 5.5 部署指南

### 5.5.1 零成本部署选项

**一键部署**：`doclight deploy` 自动完成「构建 + 推送」，支持 GitHub Pages / Cloudflare Pages / Netlify，返回可用 URL（行为设计见 [13-deployment-distribution](./13-deployment-distribution.md) §2.1）。手动选项如下：

| 平台 | 方法 | 自定义域名 | HTTPS |
|---|---|---|---|
| GitHub Pages | `doclight deploy` 或 push 到 `gh-pages` 分支 | ✅ | ✅ |
| Vercel | 导入仓库，自动检测 | ✅ | ✅ |
| Netlify | 导入仓库，自动检测 | ✅ | ✅ |
| Cloudflare Pages | `doclight deploy` 或导入仓库 | ✅ | ✅ |
| 任何静态托管 | 上传 dist/ 目录 | ✅ | 视平台而定 |

### 5.5.2 GitHub Actions 自动部署

```yaml
name: Deploy Docs
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g doclight
      - run: doclight build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          publish_dir: ./dist
```

---

## 5.6 性能基准

### 构建速度

| 文档数量 | 构建时间 | 输出体积 |
|---|---|---|
| 10 页 | < 0.5s | ~50KB + 资源 |
| 50 页 | < 2s | ~200KB + 资源 |
| 100 页 | < 5s | ~400KB + 资源 |
| 500 页 | < 20s | ~2MB + 资源 |

**性能优化策略**：
- 并发渲染（worker_threads，每核一个 worker）
- 增量构建（只重建变更的文件）
- 流式写入（边渲染边写文件，不等全部完成）

### Lighthouse 得分目标

| 指标 | 目标 |
|---|---|
| Performance | 95+ |
| Accessibility | 95+ |
| Best Practices | 100 |
| SEO | 100 |
