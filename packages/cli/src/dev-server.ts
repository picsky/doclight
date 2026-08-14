/**
 * dev server（02 §2.4 形态①，DEV-001 + PLUG-009 插件集成）
 *
 * Node 原生 http：请求文档路径 → 渲染内核输出完整 HTML（首屏直出）→ 返回。
 * 附 docs.json（导航数据）与 SSE 热重载（文件变更推送 reload 事件）。
 * PLUG-009：加载 doclight.json plugins → BuildPluginPipeline 运行构建时钩子。
 *
 * 安全：路径穿越防护——任何请求路径解析后必须落在文档根目录内，否则 404。
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdtempSync, readFileSync, rmSync, statSync, watch } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { buildNavTree, render } from "doclight-renderer";
import { loadSite, McpServer, mcpHttpHandler } from "doclight-mcp-server";
import { buildSite } from "./build.ts";
import { buildCapabilityManifest } from "./capabilities.ts";
import { buildSearchData, displayBundlePath, mimeFor, nodeModulesBase, renderNav, renderPage, VENDOR_FILES, walkMd } from "./site.ts";
import { BuildPluginPipeline } from "./plugins.ts";
import type { PluginDef, RenderContext } from "../../core/src/plugin.ts";

/** 从 Markdown 源提取 frontmatter 数据（轻量版，dev server 用） */
function extractFrontmatter(md: string): Record<string, unknown> {
  const m = /^---\r?\n([\s\S]*?)\r?\n?---/.exec(md);
  if (!m) return {};
  const fm: Record<string, unknown> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    fm[key] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  return fm;
}

export interface DevServerOptions {
  /** 文档根目录（含 .md 与静态资源） */
  dir: string;
  port?: number;
  host?: string;
  title?: string;
  /** MCP 插件模式（MCP-005）：同端口挂载 /mcp + /.well-known/mcp，开发中的站点可被 Agent 读取 */
  mcp?: boolean;
  /** PLUG-009：构建时插件列表（由 CLI 层从配置解析后注入） */
  buildPlugins?: PluginDef[];
  /** THEME-002：主题 CSS 覆盖层（由 CLI 层从配置解析后注入；缺省空 = 默认主题） */
  themeCss?: string;
  /** VIS-001：主题包默认模式（如 modern="dark"；由 CLI 层从主题包解析后注入） */
  defaultTheme?: "light" | "dark";
  /** PLUG-011：插件热重载 watch 文件（绝对路径；由 CLI 层用 configuredPluginWatchFiles 计算） */
  pluginFiles?: string[];
  /** PLUG-011：插件重新解析回调（watch 触发后调用；返回 null 表示加载期错误 → 保留旧管线；
   *   PLUG-013：支持异步（ESM/TS 插件经 import 绕过缓存取最新）） */
  reloadPlugins?: () => PluginDef[] | Promise<PluginDef[] | null> | null;
  /** PLUG-014：插件运行时配置（doclight.json plugins，由 CLI 层注入；注入页面供展示层自动注册） */
  pluginConfigs?: Array<{ name: string; config?: Record<string, unknown>; enabled?: boolean }>;
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
 * 展示层按需懒加载的扩展库（Prism / KaTeX）由 dev server 从 node_modules
 * 提供——不进展示层 bundle（守 <25KB gzip 门禁，ADR-0002）；SSG 形态由 doclight build
 * 拷贝进产物（site.ts copyVendor，window.DOCLIGHT_VENDOR_BASE 指到 /vendor/）。
 * PLUG-012：插件声明的 vendor（如 mermaid.min.js）同样按需服务——仅启用插件时
 * 端点可命中，未启用则 404（诚实降级：不伪造资源）。
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

/**
 * 组装 vendor 文件表：内置扩展（VENDOR_FILES）+ 启用插件声明（PLUG-012，按需）。
 * dev server 启动时从 buildPlugins 收集——仅启用插件的 vendor 可被端点命中。
 */
function resolveVendorFiles(buildPlugins: PluginDef[]): Record<string, { pkg: string; rel: string }> {
  const pipeline = new BuildPluginPipeline(buildPlugins);
  return { ...VENDOR_FILES, ...pipeline.collectVendorFiles() };
}

function serveVendor(vendorFiles: Record<string, { pkg: string; rel: string }>, urlPath: string, res: ServerResponse): void {
  const rest = urlPath.slice("/__doclight/vendor/".length);
  const entry = vendorFiles[rest];
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

  // PLUG-009：构建管线（插件由 CLI 层从配置解析后注入）
  const buildPlugins: PluginDef[] = options.buildPlugins ?? [];
  const pipeline = new BuildPluginPipeline(buildPlugins);
  // PLUG-012：vendor 按需表（内置 + 启用插件声明）
  const vendorFiles = resolveVendorFiles(buildPlugins);

  // PLUG-011：插件热重载——监听插件源文件/配置变更 → 重新解析 → 替换管线 → SSE reload。
  // 运行时侧（浏览器）由整页刷新完成全清理（PluginManager 全新实例，destroy/插槽全部归零）。
  const pluginWatchers: Array<ReturnType<typeof watch>> = [];
  let pluginReloadTimer: ReturnType<typeof setTimeout> | null = null;
  const pluginFiles = options.pluginFiles ?? [];
  if (pluginFiles.length && options.reloadPlugins) {
    // 按目录 watch（非递归）：编辑器原子替换文件不破坏监听；按文件名过滤事件
    const names = new Set(pluginFiles.map((f) => basename(f)));
    const dirs = new Set(pluginFiles.map((f) => dirname(f)));
    const schedulePluginReload = (): void => {
      if (pluginReloadTimer) clearTimeout(pluginReloadTimer);
      pluginReloadTimer = setTimeout(async () => {
        try {
          const fresh = await options.reloadPlugins!();
          // null = 加载期错误（文件缺失/语法错误）：保留旧管线，迭代中的半成品不打断浏览
          if (fresh) {
            pipeline.setPlugins(fresh);
            renderCache.clear(); // WORK-001：插件管线替换 → 页面渲染缓存失效（旧管线产物不得继续直出）
          }
        } catch {
          /* 解析异常保留旧管线（下轮变更再试） */
        }
        for (const res of sseClients) res.write("data: reload\n\n");
      }, 150); // 防抖：编辑器保存触发多次事件
    };
    for (const dir of dirs) {
      try {
        pluginWatchers.push(watch(dir, (_event, filename) => {
          if (filename && names.has(filename.toString())) schedulePluginReload();
        }));
      } catch {
        /* 平台不支持时降级：无插件热重载 */
      }
    }
  }

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

  /**
   * WORK-001 增量渲染：页面渲染缓存（路径 + mtime + 字节数 为键）——只重渲染变更文档。
   * 文件变更（onFsChange）时整体失效；未变更文档从缓存直出（dev 大站点往返渲染成本归零）。
   */
  const renderCache = new Map<string, { key: string; html: string }>();

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
    // MCP-006：dev --mcp 写入端指向内容源 docs/——Agent 写入 → 本函数触发的 watcher
    // onFsChange 置脏 → 下次 MCP 请求增量重建（写入触发增量重渲染联动，WORK-001）
    return loadSite(mcpSiteDir, { writeDir: docsDir });
  }

  /** 文件变更：重建导航 + 搜索索引 + 失效渲染缓存 + 推送 reload +（MCP 模式）置脏快照 */
  function onFsChange() {
    try {
      mdFiles = walkMd(docsDir);
      navHtml = renderNav(buildNavTree(mdFiles));
      searchIndexCache = buildSearchData(docsDir, mdFiles);
    } catch {
      /* 扫描失败（目录临时不可读）时保留旧导航 */
    }
    renderCache.clear(); // WORK-001：变更后缓存整体失效（下次请求只重渲染被请求的文档）
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

    // CAP-001：能力协议——/capabilities.json（dev 形态与 SSG 产物同路径同生成器，
    // 内容按 dev 状态实时计算：mdFiles 数 / 当前管线插件；Agent 写内容前先读）
    if (urlPath === "/capabilities.json") {
      sendJson(
        res,
        200,
        buildCapabilityManifest({
          siteTitle,
          base: "",
          form: "dev",
          plugins: pipeline.listPlugins().map((p) => ({ name: p.name, version: p.version, capabilities: p.capabilities })),
        })
      );
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

    // REND-002/PLUG-012 扩展 vendor 端点（内置 + 插件按需懒加载）
    if (urlPath.startsWith("/__doclight/vendor/")) {
      serveVendor(vendorFiles, urlPath, res);
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
      // WORK-001 增量渲染：源文件 mtime+字节数 未变 → 缓存直出（只重渲染变更文档）
      const stat = statSync(join(docsDir, doc));
      const cacheKey = `${doc}:${stat.mtimeMs}:${stat.size}`;
      const cached = renderCache.get(doc);
      if (cached && cached.key === cacheKey) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(cached.html);
        return;
      }
      const source = readFileSync(join(docsDir, doc), "utf8");
      const fallbackTitle = doc.replace(/\.md$/, "");
      const fm = extractFrontmatter(source);
      const title = typeof fm.title === "string" && fm.title ? fm.title as string : fallbackTitle;

      // PLUG-009：构建时钩子管线（beforeRender → render → afterRender）
      const ctx: RenderContext = { path: doc, title, frontmatter: fm, headings: [], isFirstRender: false };
      const transformedMd = pipeline.runBeforeRender(source, ctx);
      // PLUG-006 接线：插件 extendMarked 扩展挂载进渲染内核
      const { html: renderedHtml } = render(transformedMd, { currentPath: doc, extraMarkedExtensions: pipeline.collectMarkedExtensions() });
      const html = pipeline.runAfterRender(renderedHtml, ctx);
      const slotContent = pipeline.collectSlotContent(ctx);

      const page = renderPage({
        title,
        siteTitle,
        navHtml,
        contentHtml: html,
        form: "dev",
        searchVersion: searchIndexCache.version,
        slotContent,
        themeCss: options.themeCss,
        defaultTheme: options.defaultTheme, // VIS-001：modern 等默认暗色主题在 dev 形态同样生效
        pluginCss: pipeline.collectPluginStyles(),
        pluginConfigs: options.pluginConfigs, // PLUG-014：dev 形态注入运行时配置
      });
      renderCache.set(doc, { key: cacheKey, html: page });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page);
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
        if (pluginReloadTimer) clearTimeout(pluginReloadTimer);
        for (const w of pluginWatchers) w.close();
        if (mcpSiteDir) rmSync(mcpSiteDir, { recursive: true, force: true });
        server.close(() => done());
      }),
  };
}
