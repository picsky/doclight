/**
 * dev server（02 §2.4 形态①，DEV-001）
 *
 * Node 原生 http：请求文档路径 → 渲染内核输出完整 HTML（首屏直出）→ 返回。
 * 附 docs.json（导航数据）与 SSE 热重载（文件变更推送 reload 事件）。
 *
 * 安全：路径穿越防护——任何请求路径解析后必须落在文档根目录内，否则 404。
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdtempSync, readFileSync, rmSync, statSync, watch } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { buildNavTree, render } from "doclight-renderer";
import { loadSite, McpServer, mcpHttpHandler } from "doclight-mcp-server";
import { buildSite } from "./build.ts";
import { buildSearchData, displayBundlePath, mimeFor, nodeModulesBase, renderNav, renderPage, VENDOR_FILES, walkMd } from "./site.ts";

export interface DevServerOptions {
  /** 文档根目录（含 .md 与静态资源） */
  dir: string;
  port?: number;
  host?: string;
  title?: string;
  /** MCP 插件模式（MCP-005）：同端口挂载 /mcp + /.well-known/mcp，开发中的站点可被 Agent 读取 */
  mcp?: boolean;
}

export interface DevServer {
  url: string;
  port: number;
  close(): Promise<void>;
}


function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function send404(res: ServerResponse, message: string): void {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

/**
 * REND-002 扩展 vendor 静态资源端点（/__doclight/vendor/*）。
 * 展示层按需懒加载的扩展库（Prism / Mermaid / KaTeX）由 dev server 从 node_modules
 * 提供——不进展示层 bundle（守 <25KB gzip 门禁，ADR-0002）；SSG 形态由 doclight build
 * 拷贝进产物（site.ts copyVendor，window.DOCLIGHT_VENDOR_BASE 指到 /vendor/）。
 * KaTeX 字体走 fonts/* 子路径（katex.min.css 内相对引用）。全程路径穿越防护。
 */

/** 从 node_modules 读取并返回文件（穿越防护：解析后必须落在包目录内） */
function serveNodeModulesFile(pkg: string, rel: string, res: ServerResponse): void {
  const base = nodeModulesBase(pkg);
  const resolved = resolve(base, rel);
  if (!resolved.startsWith(base + sep) && resolved !== base) {
    send404(res, "路径越界");
    return;
  }
  try {
    const data = readFileSync(resolved);
    res.writeHead(200, { "Content-Type": mimeFor(resolved) });
    res.end(data);
  } catch {
    send404(res, `vendor 文件缺失：${pkg}/${rel}（先运行 pnpm install）`);
  }
}

function serveVendor(urlPath: string, res: ServerResponse): void {
  const rest = urlPath.slice("/__doclight/vendor/".length);
  const entry = VENDOR_FILES[rest];
  if (entry) {
    serveNodeModulesFile(entry.pkg, entry.rel, res);
    return;
  }
  // KaTeX 字体：fonts/<file> → katex/dist/fonts/<file>
  if (rest.startsWith("fonts/")) {
    serveNodeModulesFile("katex", `dist/fonts/${rest.slice("fonts/".length)}`, res);
    return;
  }
  send404(res, `vendor 资源不存在：${urlPath}`);
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
  /** 搜索索引缓存（启动即建 + 文件变更后重建；version 内联进页面供持久化校验，03 §3.8.5） */
  let searchIndexCache: ReturnType<typeof buildSearchData> = buildSearchData(docsDir, mdFiles);

  // MCP 插件模式（MCP-005）：懒构建快照到临时目录，文件变更置脏后下次 MCP 请求重建。
  // 首次请求才 build（不拖慢 dev 启动）；与页面热重载解耦（MCP 面向 Agent 查询，容忍秒级滞后）。
  let mcpSiteDir: string | null = null;
  let mcpDirty = true;
  function getMcpSite(): ReturnType<typeof loadSite> {
    if (!mcpSiteDir) mcpSiteDir = mkdtempSync(join(tmpdir(), "doclight-mcp-dev-"));
    if (mcpDirty) {
      rmSync(mcpSiteDir, { recursive: true, force: true });
      buildSite({ dir: docsDir, outDir: mcpSiteDir, title: siteTitle });
      mcpDirty = false;
    }
    return loadSite(mcpSiteDir);
  }

  /** 文件变更：重建导航 + 搜索索引 + 推送 reload +（MCP 模式）置脏快照 */
  function onFsChange() {
    try {
      mdFiles = walkMd(docsDir);
      navHtml = renderNav(buildNavTree(mdFiles));
      searchIndexCache = buildSearchData(docsDir, mdFiles);
    } catch {
      /* 扫描失败（目录临时不可读）时保留旧导航 */
    }
    mcpDirty = true;
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
      sendJson(res, 200, searchIndexCache);
      return;
    }

    // 展示层 bundle（需先 npm run build 产出；缺失时页面仍可服务端直出）
    if (urlPath === "/__doclight/display.js") {
      const displayPath = displayBundlePath();
      try {
        const data = readFileSync(displayPath);
        res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
        res.end(data);
      } catch {
        send404(res, "dist/display.js 未构建（先运行 npm run build）");
      }
      return;
    }

    // REND-002 扩展 vendor 端点（Prism / Mermaid / KaTeX 按需懒加载）
    if (urlPath.startsWith("/__doclight/vendor/")) {
      serveVendor(urlPath, res);
      return;
    }

    // MCP 插件模式（MCP-005）：/mcp + /.well-known/mcp + /health 交给 MCP handler（capabilitiesAtRoot=false 不抢站点首页）
    if (options.mcp) {
      const site = getMcpSite();
      if (await mcpHttpHandler(site, new McpServer(site), { capabilitiesAtRoot: false })(req, res)) return;
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
      res.writeHead(200, { "Content-Type": mimeFor(staticPath) });
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
      res.end(
        renderPage({ title: docTitle, siteTitle, navHtml, contentHtml: html, form: "dev", searchVersion: searchIndexCache.version })
      );
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
        if (mcpSiteDir) rmSync(mcpSiteDir, { recursive: true, force: true });
        server.close(() => done());
      }),
  };
}
