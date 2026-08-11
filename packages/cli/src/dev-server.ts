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

/** 组装完整 HTML 页（首屏直出：内容 + 导航服务端渲染，内联 SSE 热重载脚本） */
function renderPage(options: { title: string; siteTitle: string; navHtml: string; contentHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)} · ${escapeHtml(options.siteTitle)}</title>
<style>
  :root { --max-w: 720px; --sidebar-w: 280px; --color-border: #e5e7eb; --color-text: #374151; --color-text-2: #6b7280; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: var(--color-text); line-height: 1.75; }
  .layout { display: flex; min-height: 100vh; }
  .sidebar { width: var(--sidebar-w); border-right: 1px solid var(--color-border); padding: 20px; font-size: 14px; overflow-y: auto; }
  .sidebar ul { list-style: none; padding-left: 14px; margin: 4px 0; }
  .sidebar > ul { padding-left: 0; }
  .sidebar a { color: var(--color-text-2); text-decoration: none; }
  .sidebar a:hover { color: var(--color-text); }
  main { flex: 1; max-width: var(--max-w); margin: 0 auto; padding: 32px 24px; }
  pre { background: #f6f8fa; padding: 14px; border-radius: 6px; overflow-x: auto; }
  code { background: #f6f8fa; padding: 2px 4px; border-radius: 4px; }
  pre code { background: none; padding: 0; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid var(--color-border); padding: 6px 12px; }
</style>
</head>
<body>
<div class="layout">
  <aside class="sidebar">${options.navHtml}</aside>
  <main class="paper"><article>${options.contentHtml}</article></main>
</div>
<script>
  // 热重载：SSE 收到变更事件后整页刷新（展示层接管后升级为不刷新的局部更新）
  try {
    var es = new EventSource('/__doclight/events');
    es.onmessage = function (e) { if (e.data === 'reload') location.reload(); };
  } catch (err) { /* SSE 不可用时静默降级为手动刷新 */ }
</script>
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
  /** 文件变更：重建导航 + 推送 reload */
  function onFsChange() {
    try {
      mdFiles = walkMd(docsDir);
      navHtml = renderNav(buildNavTree(mdFiles));
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
