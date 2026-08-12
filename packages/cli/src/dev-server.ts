/**
 * dev server（02 §2.4 形态①，DEV-001）
 *
 * Node 原生 http：请求文档路径 → 渲染内核输出完整 HTML（首屏直出）→ 返回。
 * 附 docs.json（导航数据）与 SSE 热重载（文件变更推送 reload 事件）。
 *
 * 安全：路径穿越防护——任何请求路径解析后必须落在文档根目录内，否则 404。
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readdirSync, readFileSync, statSync, watch } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { buildNavTree, render, type NavNode } from "doclight-renderer";

export interface DevServerOptions {
  /** 文档根目录（含 .md 与静态资源） */
  dir: string;
  port?: number;
  host?: string;
  title?: string;
}

export interface DevServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

/** 递归收集 .md 相对路径（正斜杠），按字母序（构建 nav 前的原始列表） */
function walkMd(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      out.push(...walkMd(full, rel));
    } else if (entry.endsWith(".md")) {
      out.push(rel);
    }
  }
  return out;
}

/**
 * 构建搜索文档数据（SRCH-001：懒构建，供展示层 search.ts 建索引）。
 * 渲染内核输出已 sanitize HTML → 剥标签得纯文本；标题取 frontmatter.title 或文件名。
 * 展示层不接触原始 Markdown（架构原则），故索引数据在此生成后经 JSON 端点下发。
 */
function buildSearchIndex(docsDir: string, mdFiles: string[]): { version: number; docs: unknown[] } {
  const docs: unknown[] = [];
  for (const rel of mdFiles) {
    try {
      const source = readFileSync(join(docsDir, rel), "utf8");
      const { html, frontmatter } = render(source, { currentPath: rel });
      const text = html.replace(/<[^>]+>/g, " ");
      // 标题：frontmatter.title 优先，缺省取文件名主干（与 nav.ts stem 一致）
      const title =
        typeof frontmatter.title === "string" ? frontmatter.title : rel.slice(rel.lastIndexOf("/") + 1).replace(/\.md$/, "");
      const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g)].map((m) =>
        m[1]!.replace(/<[^>]+>/g, "").trim()
      );
      docs.push({ path: rel, title, headings, text });
    } catch {
      /* 单个文档渲染失败跳过（索引不因此中断） */
    }
  }
  return { version: 1, docs };
}

/** 渲染导航树为嵌套 <ul>（服务端直出，SEO 友好，03 §3.1.3） */
function renderNav(nodes: NavNode[]): string {
  const items = nodes.map((n) => {
    if (n.type === "file") {
      const href = `/${n.path}`;
      return `<li><a href="${href}" data-path="${n.path}">${escapeHtml(n.title)}</a></li>`;
    }
    const groupTitle = n.index
      ? `<a href="/${n.index}" data-path="${n.index}">${escapeHtml(n.title)}</a>`
      : escapeHtml(n.title);
    return `<li class="group">${groupTitle}<ul>${renderNav(n.items)}</ul></li>`;
  });
  return `<ul>${items.join("")}</ul>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/**
 * 组装完整 HTML 页（首屏直出：内容 + 导航服务端渲染）。
 * 含：顶栏（站点标题/菜单/搜索/主题切换）、防闪烁脚本、完整设计令牌（THEME-001）、
 * TOC 导轨/移动端底部面板（TOC-001）、搜索框样式（SRCH-001）、移动端侧边栏、
 * SSE 热重载、展示层 bundle（自挂载）。
 */
function renderPage(options: { title: string; siteTitle: string; navHtml: string; contentHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)} · ${escapeHtml(options.siteTitle)}</title>
<script>
  // 防闪烁（03 §3.6.2）：同步确定主题，在 CSS 前执行
  (function () {
    try {
      var t = localStorage.getItem('doclight-theme');
      if (!t || t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
    } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
  })();
</script>
<style>
  /* ===== 设计令牌（03 §3.6 + 04 §4.3，THEME-001）===== */
  :root {
    /* 颜色 - 品牌（单一强调色 teal） */
    --color-primary: #0d9488; --color-primary-hover: #0f766e; --color-primary-light: #ccfbf1;
    /* 颜色 - 中性灰阶（8 级） */
    --color-bg: #ffffff; --color-bg-soft: #f9fafb; --color-bg-code: #f3f4f6;
    --color-border: #e5e7eb; --color-border-soft: #f3f4f6;
    --color-text-muted: #9ca3af; --color-text-secondary: #6b7280;
    --color-text: #374151; --color-text-strong: #111827;
    /* 语义色（克制使用） */
    --color-success: #059669; --color-warning: #d97706; --color-error: #dc2626; --color-info: #2563eb;
    /* 字体（不引 Web Font，用系统最佳） */
    --font-sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --font-mono: "JetBrains Mono", "SF Mono", "Cascadia Code", "Fira Code", ui-monospace, Menlo, Consolas, monospace;
    /* 字号（模块化缩放 1.25） */
    --font-size-xs: 0.75rem; --font-size-sm: 0.875rem; --font-size-base: 1rem; --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem; --font-size-2xl: 1.5rem; --font-size-3xl: 2rem;
    /* 行高 */
    --line-height-tight: 1.3; --line-height-normal: 1.5; --line-height-relaxed: 1.75;
    /* 间距（4px 基准） */
    --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
    --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px;
    /* 布局 */
    --max-width-content: 680px; --sidebar-width: 280px; --toc-width: 220px; --topbar-height: 52px;
    /* 圆角 */
    --radius-sm: 4px; --radius: 6px; --radius-lg: 8px;
    /* 阴影（克制使用） */
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05); --shadow: 0 1px 3px rgba(0,0,0,0.1);
    /* 过渡 */
    --transition-fast: 150ms ease; --transition: 200ms ease;
  }
  [data-theme="dark"] {
    --color-bg: #0a0a0a; --color-bg-soft: #171717; --color-bg-code: #262626;
    --color-border: #262626; --color-border-soft: #1f1f1f;
    --color-text-muted: #737373; --color-text-secondary: #a3a3a3;
    --color-text: #d4d4d4; --color-text-strong: #f5f5f5;
    --color-primary-light: #134e4a;
    --color-success: #10b981; --color-warning: #f59e0b; --color-error: #ef4444; --color-info: #3b82f6;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.3); --shadow: 0 1px 3px rgba(0,0,0,0.4);
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  }
  body { margin: 0; background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); font-size: var(--font-size-base); line-height: var(--line-height-relaxed); }
  /* 顶栏 */
  .topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: var(--space-3); height: var(--topbar-height); padding: 0 var(--space-4); background: var(--color-bg-soft); border-bottom: 1px solid var(--color-border); }
  .topbar button { border: 1px solid var(--color-border); background: transparent; color: var(--color-text-secondary); border-radius: var(--radius); padding: 4px 10px; cursor: pointer; transition: color var(--transition-fast), border-color var(--transition-fast); }
  .topbar button:hover { color: var(--color-primary); border-color: var(--color-primary); }
  .topbar .site-title { font-weight: 600; color: var(--color-text-strong); }
  #sidebar-toggle { display: none; }
  /* 布局：侧边栏 + 内容 */
  .layout { display: flex; min-height: calc(100vh - var(--topbar-height)); }
  .sidebar { width: var(--sidebar-width); flex-shrink: 0; border-right: 1px solid var(--color-border); padding: var(--space-6) var(--space-4); font-size: var(--font-size-sm); overflow-y: auto; }
  .sidebar ul { list-style: none; padding-left: var(--space-3); margin: var(--space-1) 0; }
  .sidebar > ul { padding-left: 0; }
  .sidebar a { color: var(--color-text-secondary); text-decoration: none; }
  .sidebar a:hover, .sidebar a.active { color: var(--color-primary); }
  main { flex: 1; min-width: 0; max-width: var(--max-width-content); margin: 0 auto; padding: var(--space-8) var(--space-6); }
  /* 正文排版（04 §4.2：16px × 1.75，680px 行宽） */
  article h1 { font-size: var(--font-size-3xl); line-height: var(--line-height-tight); font-weight: 700; margin: 0 0 0.8em; color: var(--color-text-strong); }
  article h2 { font-size: var(--font-size-2xl); line-height: var(--line-height-tight); font-weight: 600; margin: 2.5em 0 0.6em; color: var(--color-text-strong); }
  article h3 { font-size: var(--font-size-xl); line-height: 1.4; font-weight: 600; margin: 1.8em 0 0.5em; color: var(--color-text-strong); }
  article h4 { font-size: var(--font-size-lg); line-height: 1.4; font-weight: 600; margin: 1.2em 0 0.4em; }
  article h2[id], article h3[id] { scroll-margin-top: 80px; }
  article p { margin: 0 0 1.5em; text-indent: 0; }
  article a { color: inherit; text-decoration: none; border-bottom: 1px solid transparent; transition: color var(--transition-fast), border-color var(--transition-fast); }
  article a:hover { color: var(--color-primary); border-bottom-color: var(--color-primary); }
  pre { background: var(--color-bg-code); border: 1px solid var(--color-border); padding: var(--space-4) var(--space-6); border-radius: var(--radius); overflow-x: auto; font-size: var(--font-size-sm); line-height: 1.6; }
  code { font-family: var(--font-mono); font-size: 0.875em; padding: 2px 6px; background: var(--color-bg-code); border-radius: var(--radius-sm); color: var(--color-primary); }
  pre code { background: none; border: none; padding: 0; color: var(--color-text); }
  blockquote { margin: 0 0 1.5em; padding-left: var(--space-4); border-left: 3px solid var(--color-primary); color: var(--color-text-secondary); }
  .table-wrap { overflow-x: auto; margin-bottom: 1.5em; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid var(--color-border); padding: 6px var(--space-3); text-align: left; }
  th { background: var(--color-bg-soft); font-weight: 600; }
  img { max-width: 100%; border-radius: var(--radius); }
  hr { border: none; border-top: 1px solid var(--color-border); margin: var(--space-8) 0; }
  /* ===== TOC（03 §3.7，TOC-001）===== */
  .toc-rail { position: fixed; right: 0; top: 50%; transform: translateY(-50%); width: 28px; z-index: 25; display: flex; align-items: center; justify-content: center; padding: var(--space-6) 0; }
  .toc-dots { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); }
  .toc-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-border); cursor: pointer; transition: background var(--transition-fast); }
  .toc-dot-l3 { width: 4px; height: 4px; }
  .toc-dot:hover, .toc-dot.active { background: var(--color-primary); }
  .toc-panel { position: absolute; right: 24px; top: 50%; transform: translateY(-50%); width: var(--toc-width); max-height: 60vh; overflow-y: auto; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: var(--space-3) var(--space-2); opacity: 0; pointer-events: none; transition: opacity var(--transition); }
  .toc-rail:hover .toc-panel { opacity: 1; pointer-events: auto; }
  .toc-link { display: block; padding: 3px var(--space-2); border-radius: var(--radius-sm); font-size: var(--font-size-sm); line-height: var(--line-height-normal); color: var(--color-text-secondary); text-decoration: none; cursor: pointer; }
  .toc-link-l3 { padding-left: var(--space-4); font-size: var(--font-size-xs); }
  .toc-link:hover, .toc-link.active { color: var(--color-primary); background: var(--color-bg-soft); }
  /* 移动端 TOC：右下角浮动按钮 + 底部面板 */
  .toc-fab { display: none; position: fixed; right: var(--space-4); bottom: var(--space-6); z-index: 40; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--color-border); background: var(--color-bg-soft); color: var(--color-text-secondary); font-size: 18px; cursor: pointer; box-shadow: var(--shadow); }
  .toc-sheet { display: none; position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; max-height: 70%; background: var(--color-bg); border-top: 1px solid var(--color-border); border-radius: var(--radius-lg) var(--radius-lg) 0 0; transform: translateY(100%); transition: transform var(--transition); box-shadow: var(--shadow); }
  .toc-sheet.open { transform: translateY(0); }
  .toc-sheet-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); font-weight: 600; color: var(--color-text-strong); }
  .toc-sheet-close { border: none; background: none; font-size: 20px; cursor: pointer; color: var(--color-text-secondary); }
  .toc-sheet-nav { padding: var(--space-3); overflow-y: auto; max-height: calc(70vh - 48px); }
  /* ===== 搜索（03 §3.5，SRCH-001）===== */
  .search-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,0.35); display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; }
  .search-box { width: min(560px, calc(100vw - 32px)); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow); overflow: hidden; }
  .search-input { width: 100%; padding: var(--space-4); border: none; outline: none; font-size: var(--font-size-lg); font-family: var(--font-sans); color: var(--color-text); background: var(--color-bg); border-bottom: 1px solid var(--color-border-soft); }
  .search-status { padding: var(--space-2) var(--space-4); font-size: var(--font-size-sm); color: var(--color-text-muted); }
  .search-results { max-height: 55vh; overflow-y: auto; padding: var(--space-2); }
  .search-result { display: block; padding: var(--space-2) var(--space-3); border-radius: var(--radius); text-decoration: none; color: var(--color-text); cursor: pointer; }
  .search-result.active, .search-result:hover { background: var(--color-bg-soft); }
  .search-result-title { display: block; font-weight: 600; color: var(--color-text-strong); }
  .search-result-path { display: block; font-size: var(--font-size-xs); color: var(--color-text-muted); font-family: var(--font-mono); }
  .search-result-snippet { display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: var(--line-height-normal); }
  .search-result mark, .search-result-title mark { background: none; color: var(--color-primary); font-weight: 600; }
  .search-empty { padding: var(--space-4); text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm); }
  .search-recent-label { padding: var(--space-2) var(--space-3) var(--space-1); font-size: var(--font-size-xs); color: var(--color-text-muted); }
  .search-recent-item { display: block; width: 100%; text-align: left; padding: var(--space-2) var(--space-3); border: none; background: none; cursor: pointer; color: var(--color-text); border-radius: var(--radius); font-size: var(--font-size-sm); font-family: var(--font-sans); }
  .search-recent-item:hover { background: var(--color-bg-soft); color: var(--color-primary); }
  /* 响应式（04 §4.8） */
  @media (max-width: 1024px) {
    .toc-rail { display: none; }
  }
  @media (max-width: 768px) {
    #sidebar-toggle { display: block; }
    .sidebar { position: fixed; left: 0; top: var(--topbar-height); bottom: 0; transform: translateX(-100%); transition: transform 0.2s ease; background: var(--color-bg); z-index: 35; }
    .sidebar.open { transform: translateX(0); box-shadow: 0 0 24px rgba(0,0,0,0.25); }
    .toc-fab { display: flex; align-items: center; justify-content: center; }
    .toc-sheet { display: block; }
    main { padding: var(--space-6) var(--space-4); font-size: 15px; }
    .topbar { height: 48px; }
  }
</style>
</head>
<body>
<header class="topbar">
  <button id="sidebar-toggle" aria-label="菜单">☰</button>
  <span class="site-title">${escapeHtml(options.siteTitle)}</span>
  <button id="search-toggle" aria-label="搜索（Ctrl+K）">🔍</button>
  <button id="theme-toggle" aria-label="切换主题">🌓</button>
</header>
<div class="layout">
  <aside class="sidebar">${options.navHtml}</aside>
  <main class="paper"><article>${options.contentHtml}</article></main>
</div>
<!-- TOC（03 §3.7）：桌面导轨（hover 展开）+ 移动端底部面板；内容由展示层填充 -->
<aside class="toc-rail" aria-label="本页目录"><div class="toc-dots"></div><nav class="toc-panel"></nav></aside>
<button class="toc-fab" aria-label="目录">☰</button>
<div class="toc-sheet">
  <div class="toc-sheet-header">本页目录<button class="toc-sheet-close" aria-label="关闭目录">×</button></div>
  <nav class="toc-sheet-nav"></nav>
</div>
<script>
  // 热重载：SSE 收到变更事件后整页刷新（SPA 导航由展示层接管）
  try {
    var es = new EventSource('/__doclight/events');
    es.onmessage = function (e) { if (e.data === 'reload') location.reload(); };
  } catch (err) { /* SSE 不可用时静默降级为手动刷新 */ }
</script>
<script type="module" src="/__doclight/display.js"></script>
</body>
</html>`;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function send404(res: ServerResponse, message: string): void {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

/**
 * 启动 dev server。port 缺省用 0（系统分配，便于测试）；返回后即可请求。
 */
export async function startDevServer(options: DevServerOptions): Promise<DevServer> {
  const docsDir = resolve(options.dir);
  const host = options.host ?? "127.0.0.1";
  const siteTitle = options.title ?? "DocLight";

  // 首次扫描：收集文档 + 构建导航
  let mdFiles = walkMd(docsDir);
  let navHtml = renderNav(buildNavTree(mdFiles));

  /** 解析请求路径为文档根目录内的相对路径；越界返回 null */
  function safeRelPath(urlPath: string): string | null {
    const withoutQuery = urlPath.split("?")[0]!.split("#")[0]!;
    const decoded = decodeURIComponent(withoutQuery);
    const rel = decoded.replace(/^\/+/, "");
    const resolved = resolve(docsDir, rel);
    if (!resolved.startsWith(docsDir + sep) && resolved !== docsDir) return null; // 路径穿越防护
    return rel;
  }

  /** 解析路径到 .md 文档（支持带/不带 .md 后缀）；无则 null */
  function resolveDoc(rel: string): string | null {
    const candidates = rel.endsWith(".md") ? [rel] : [`${rel}.md`, `${rel}/README.md`, `${rel}/index.md`];
    for (const c of candidates) {
      try {
        if (statSync(join(docsDir, c)).isFile()) return c;
      } catch {
        /* 不存在则试下一个 */
      }
    }
    return null;
  }

  const sseClients = new Set<ServerResponse>();
  /** 搜索索引缓存（懒构建，文件变更后失效） */
  let searchIndexCache: ReturnType<typeof buildSearchIndex> | null = null;
  /** 文件变更：重建导航 + 失效搜索索引 + 推送 reload */
  function onFsChange() {
    try {
      mdFiles = walkMd(docsDir);
      navHtml = renderNav(buildNavTree(mdFiles));
      searchIndexCache = null;
    } catch {
      /* 扫描失败（目录临时不可读）时保留旧导航 */
    }
    for (const res of sseClients) res.write("data: reload\n\n");
  }

  let watcher: ReturnType<typeof watch> | null = null;
  try {
    watcher = watch(docsDir, { recursive: true }, onFsChange);
  } catch {
    watcher = null; // 某些平台不支持 recursive 时降级：仅无热重载
  }

  const server: Server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const urlPath = req.url ?? "/";

    // SSE 热重载端点
    if (urlPath === "/__doclight/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      return;
    }

    // 导航数据端点（展示层 / 后续形态用）
    if (urlPath === "/__doclight/docs.json") {
      sendJson(res, 200, { version: 1, generatedAt: new Date().toISOString(), nav: buildNavTree(mdFiles) });
      return;
    }

    // 搜索索引端点（SRCH-001：懒构建，文件变更后失效）
    if (urlPath === "/__doclight/search-index.json") {
      searchIndexCache ??= buildSearchIndex(docsDir, mdFiles);
      sendJson(res, 200, searchIndexCache);
      return;
    }

    // 展示层 bundle（需先 npm run build 产出 dist/display.js；缺失时页面仍可服务端直出）
    if (urlPath === "/__doclight/display.js") {
      const displayPath = join(process.cwd(), "dist", "display.js");
      try {
        const data = readFileSync(displayPath);
        res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
        res.end(data);
      } catch {
        send404(res, "dist/display.js 未构建（先运行 npm run build）");
      }
      return;
    }

    const rel = safeRelPath(urlPath);
    if (rel === null) {
      send404(res, "路径越界");
      return;
    }

    // 首页
    if (rel === "" || rel === "/") {
      const doc = resolveDoc("README") ?? resolveDoc("index") ?? mdFiles[0];
      if (!doc) {
        send404(res, "docs/ 下没有 Markdown 文档");
        return;
      }
      void serveDoc(res, doc);
      return;
    }

    // .md 文档
    const doc = resolveDoc(rel);
    if (doc) {
      void serveDoc(res, doc);
      return;
    }

    // 静态资源（图片等）
    const staticPath = join(docsDir, rel);
    try {
      const data = readFileSync(staticPath);
      const mime = MIME[extname(staticPath)] ?? "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      res.end(data);
    } catch {
      send404(res, `未找到：${urlPath}`);
    }
  }

  function serveDoc(res: ServerResponse, doc: string): void {
    try {
      const source = readFileSync(join(docsDir, doc), "utf8");
      const { html, frontmatter } = render(source, { currentPath: doc });
      const docTitle = typeof frontmatter.title === "string" ? frontmatter.title : doc.replace(/\.md$/, "");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderPage({ title: docTitle, siteTitle, navHtml, contentHtml: html }));
    } catch (err) {
      send404(res, `渲染失败：${doc}（${(err as Error).message}）`);
    }
  }

  await new Promise<void>((resolveListen) => {
    server.listen(options.port ?? 0, host, () => resolveListen());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : (options.port ?? 0);

  return {
    url: `http://${host}:${port}/`,
    port,
    close: () =>
      new Promise<void>((done) => {
        sseClients.forEach((c) => c.end());
        sseClients.clear();
        if (watcher) watcher.close();
        server.close(() => done());
      }),
  };
}
