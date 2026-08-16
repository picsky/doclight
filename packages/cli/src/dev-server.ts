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
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, watch, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { basename, dirname, join, resolve, sep } from "node:path";
import { buildNavTree, render, analyzeDoc, parseFrontmatter } from "@doclight/renderer";
import { loadSite, McpServer, mcpHttpHandler, hostHeaderAllowed, isLoopbackListenHost } from "@doclight/mcp-server";
import { buildSite } from "./build.ts";
import { buildCapabilityManifest } from "./capabilities.ts";
import { buildSearchData, collectNavTitles, countWords, displayBundlePath, firstH1Text, mimeFor, nodeModulesBase, planSyntheticIndexPages, render404Page, renderNav, renderPage, syntheticIndexMarkdown, syntheticIndexTitle, VENDOR_FILES, walkMd } from "./site.ts";
import { BuildPluginPipeline } from "./plugins.ts";
import type { PluginDef, RenderContext } from "../../core/src/plugin.ts";

/** 页面更新时间（与 build.docUpdatedAt 同一规则：frontmatter.date/updated 优先，缺省文件 mtime） */
function docUpdatedAtDev(frontmatter: Record<string, unknown>, filePath: string): string | undefined {
  const raw = frontmatter.date ?? frontmatter.updated;
  if (typeof raw === "string") {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  try {
    return statSync(filePath).mtime.toISOString();
  } catch {
    return undefined;
  }
}

export interface DevServerOptions {
  /** 文档根目录（含 .md 与静态资源） */
  dir: string;
  port?: number;
  host?: string;
  title?: string;
  /** MCP 插件模式（MCP-005）：同端口挂载 /mcp + /.well-known/mcp，开发中的站点可被 Agent 读取 */
  mcp?: boolean;
  /** MCP-006 写入端 Bearer token（mcp 开启时生效）。
   *  - 传入 → 使用该 token（写工具强制鉴权）
   *  - 未传 → 自动生成并写入 .doclight/mcp-token + 打印到终端（避免默认开放写接口）
   *  未启用 mcp 时此选项无效 */
  mcpToken?: string;
  /** MCP token 持久化路径。默认 .doclight/mcp-token（process.cwd() 下）。
   *  设为 null 禁用写盘（测试用）。 */
  mcpTokenFile?: string | null;
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
  /** Phase 2 + M1 修复：搜索索引正文截断长度（宽松读取 doclight.json build.searchMaxTextLength） */
  searchMaxTextLength?: number;
  /** 设计对齐（2026-08-16）：站点镀铬（顶栏版本按钮 / GitHub 图标 / footer 链接与状态） */
  chrome?: {
    version?: string;
    github?: string;
    footerLinks?: Array<{ label: string; href: string }>;
    statusText?: string;
  };
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

  // MCP-006 写入端鉴权（2026-08 审计后）：mcp 开启时强制要求 Bearer token。
  // 未显式传入 → 自动生成并持久化到 .doclight/mcp-token，便于 Agent 读取；
  // 终端打印一次，便于人类复制。
  let resolvedMcpToken: string | null = null;
  let mcpTokenFile: string | null = null;
  if (options.mcp) {
    if (options.mcpToken) {
      resolvedMcpToken = options.mcpToken;
    } else {
      resolvedMcpToken = randomBytes(24).toString("base64url");
      // mcpTokenFile 显式 null → 禁用写盘（测试/嵌入式调用用）；未传 → 默认写入 .doclight/
      if (options.mcpTokenFile !== null) {
        const target = options.mcpTokenFile ?? join(process.cwd(), ".doclight", "mcp-token");
        try {
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, resolvedMcpToken, "utf8");
          mcpTokenFile = target;
        } catch {
          mcpTokenFile = null;
        }
      }
    }
  }

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

  // 首次扫描：收集文档 + 构建导航（frontmatter 标题驱动，2026-08 修复文件名显示；
  // 嵌套目录合成总览页 v2：无 README/index 的嵌套目录 → 虚拟 index.md 入口）
  let mdFiles = walkMd(docsDir);
  let navTitles = collectNavTitles(docsDir, mdFiles);
  let navTree = buildNavTree(mdFiles, navTitles);
  let navHtml = renderNav(navTree);
  let synthetic: string[] = [];
  let mdFilesAll: string[] = mdFiles;
  let syntheticSet = new Set<string>();

  /** 重建导航（初始 + 文件变更）：扫描 → 导航树 → 嵌套目录合成入口注入 */
  function rebuildNav(): void {
    mdFiles = walkMd(docsDir);
    navTitles = collectNavTitles(docsDir, mdFiles);
    let tree = buildNavTree(mdFiles, navTitles);
    synthetic = planSyntheticIndexPages(tree);
    mdFilesAll = synthetic.length ? [...mdFiles, ...synthetic] : mdFiles;
    syntheticSet = new Set(synthetic);
    if (synthetic.length) {
      const titlesAll = { ...navTitles };
      for (const syn of synthetic) titlesAll[syn] = syntheticIndexTitle(syn);
      tree = buildNavTree(mdFilesAll, titlesAll);
    }
    navTree = tree;
    navHtml = renderNav(navTree);
  }
  rebuildNav();

  /** 解析请求路径为文档根目录内的相对路径；越界 / 非法编码返回 null */
  function safeRelPath(urlPath: string): string | null {
    const withoutQuery = urlPath.split("?")[0]!.split("#")[0]!;
    let decoded: string;
    try {
      decoded = decodeURIComponent(withoutQuery);
    } catch {
      // 非法 %XX 序列（如 %zz）→ URIError；返回 null 由调用方 404（不 crash，不挂起）
      return null;
    }
    const rel = decoded.replace(/^\/+/, "");
    const resolved = resolve(docsDir, rel);
    if (!resolved.startsWith(docsDir + sep) && resolved !== docsDir) return null; // 路径穿越防护
    return rel;
  }

  /** 解析路径到 .md 文档（支持带/不带 .md 后缀）；无则 null */
  function resolveDoc(rel: string): string | null {
    const candidates = rel.endsWith(".md") ? [rel] : [`${rel}.md`, `${rel}/README.md`, `${rel}/index.md`];
    for (const c of candidates) {
      // 嵌套目录合成总览页（磁盘无文件，2026-08 v2）
      if (syntheticSet.has(c)) return c;
      try {
        if (statSync(join(docsDir, c)).isFile()) return c;
      } catch {
        /* 不存在则试下一个 */
      }
    }
    return null;
  }

  const sseClients = new Set<ServerResponse>();
  /** 搜索索引缓存（启动即建 + 文件变更后重建；version 内联进页面供持久化校验，03 §3.8.5；
   *  nav 传入：搜索结果「节」标签，设计对齐演示页 ri-sec；
   *  M1 修复：maxTextLength 来自 doclight.json build.searchMaxTextLength，与 build/bundle 同源） */
  const searchOptions = () => ({ nav: navTree, maxTextLength: options.searchMaxTextLength });
  let searchIndexCache: ReturnType<typeof buildSearchData> = buildSearchData(docsDir, mdFiles, searchOptions());

  /**
   * WORK-001 增量渲染：页面渲染缓存（路径 + mtime + 字节数 为键）——只重渲染变更文档。
   * 文件变更（onFsChange）时整体失效；未变更文档从缓存直出（dev 大站点往返渲染成本归零）。
   */
  const renderCache = new Map<string, { key: string; html: string }>();

  // MCP 插件模式（MCP-005）：懒构建快照到临时目录，文件变更置脏后下次 MCP 请求重建。
  // 首次请求才 build（不拖慢 dev 启动）；与页面热重载解耦（MCP 面向 Agent 查询，容忍秒级滞后）。
  // P0-4 性能修复：site + McpServer 实例缓存复用，仅 mcpDirty 时重建——
  // 旧实现每个请求都重新 loadSite（重读临时目录全部 JSON），dirty 时任意请求触发全量 build。
  let mcpSiteDir: string | null = null;
  let mcpDirty = true;
  let mcpRuntime: { site: ReturnType<typeof loadSite>; mcpServer: McpServer } | null = null;
  function getMcpRuntime(): { site: ReturnType<typeof loadSite>; mcpServer: McpServer } {
    if (!mcpSiteDir) mcpSiteDir = mkdtempSync(join(tmpdir(), "doclight-mcp-dev-"));
    if (mcpDirty || !mcpRuntime) {
      rmSync(mcpSiteDir, { recursive: true, force: true });
      buildSite({ dir: docsDir, outDir: mcpSiteDir, title: siteTitle });
      const site = loadSite(mcpSiteDir, { writeDir: docsDir });
      mcpRuntime = { site, mcpServer: new McpServer(site) };
      mcpDirty = false;
    }
    return mcpRuntime!;
  }

  /** 文件变更：增量失效缓存（Phase 4.4 性能修复）
   *  - 编辑已存在文档：仅失效该文档的渲染缓存（导航/搜索仍全量重建，复杂度/收益权衡）
   *  - 新增/删除文档：全量重建导航 + 搜索索引 + 清空渲染缓存 */
  function onFsChange(_eventType: string, filename: string | null) {
    // H2 修复（2026-08 code review）：渲染缓存页内嵌 navHtml 与 searchVersion，
    // 若任一变化则必须整体失效，否则其他缓存页会显示旧导航/旧搜索版本
    const prevNavHtml = navHtml;
    const prevSearchVersion = searchIndexCache.version;
    const changedFileRel = filename ? filename.replace(/\\/g, "/") : null;
    const isKnownMd = changedFileRel ? mdFiles.includes(changedFileRel) : false;

    try {
      rebuildNav();
      searchIndexCache = buildSearchData(docsDir, mdFiles, searchOptions());
    } catch {
      /* 扫描失败（目录临时不可读）时保留旧导航 */
    }

    const structureChanged =
      !changedFileRel ||
      !changedFileRel.endsWith(".md") ||
      !isKnownMd ||
      prevNavHtml !== navHtml ||
      prevSearchVersion !== searchIndexCache.version;

    if (structureChanged) {
      // 结构性变化（新增/删除/重命名/导航/搜索版本）：整体失效
      renderCache.clear();
    } else {
      // 仅单篇内容变化：只失效该文档（其他缓存页的 navHtml/searchVersion 仍一致）
      renderCache.delete(changedFileRel);
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
    // P0-3：loopback 监听时校验 Host 头（DNS rebinding 防御：rebind 域名请求被 403）
    if (isLoopbackListenHost(host) && !hostHeaderAllowed(req)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden (Host not allowed)");
      return;
    }
    // P0-6：入口处统一剥离查询串/片段（?v= 缓存穿透不破坏端点匹配与静态资源服务）
    const urlPath = (req.url ?? "/").split("?")[0]!.split("#")[0]!;

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

    // 导航数据端点（展示层 / 后续形态用；navTree 已含嵌套目录合成入口）
    if (urlPath === "/__doclight/docs.json") {
      sendJson(res, 200, { version: 1, generatedAt: new Date().toISOString(), nav: navTree });
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

    // MCP 插件模式（MCP-005）：仅 MCP 路径进入（P0-4：普通文档/静态请求
    // 不触发快照构建与 loadSite）；capabilitiesAtRoot=false 不抢站点首页
    if (options.mcp && (urlPath === "/mcp" || urlPath === "/.well-known/mcp" || urlPath === "/health")) {
      const { site, mcpServer } = getMcpRuntime();
      // CORS 收紧：Origin 白名单限定本机 host:port（127.0.0.1/localhost 各一种，按实际监听端口）
      const addr = server.address();
      const listenPort = typeof addr === "object" && addr ? addr.port : (options.port ?? 0);
      const allowedOrigins = listenPort
        ? [`http://127.0.0.1:${listenPort}`, `http://localhost:${listenPort}`]
        : [];
      if (await mcpHttpHandler(site, mcpServer, {
        capabilitiesAtRoot: false,
        authToken: resolvedMcpToken ?? undefined,
        allowedOrigins,
      })(req, res)) return;
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
      // DP-002 品牌层空态：文档类路径（无扩展名/.md/.html）返回设计过的 404 页面；
      // 资源类路径保持 text/plain（机器端点诚实降级）
      const docLike = !/\.[a-z0-9]{1,8}$/i.test(rel) || /\.(md|html?)$/i.test(rel);
      if (docLike) {
        try {
          const page = render404Page({
            siteTitle,
            navHtml,
            form: "dev",
            nav: navTree,
            summaries: searchIndexCache.summaries,
            themeCss: options.themeCss,
            chrome: options.chrome,
          });
          res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
          res.end(page);
          return;
        } catch {
          /* 404 页渲染失败降级为纯文本 */
        }
      }
      send404(res, `未找到：${urlPath}`);
    }
  }

  function serveDoc(res: ServerResponse, doc: string): void {
    try {
      const isSyn = syntheticSet.has(doc);
      // WORK-001 增量渲染：源文件 mtime+字节数 未变 → 缓存直出；合成总览页无磁盘源
      // （内容随目录变化，onFsChange 已整体清缓存），固定 key 即可
      let cacheKey: string;
      if (isSyn) {
        cacheKey = `synthetic:${doc}`;
      } else {
        const stat = statSync(join(docsDir, doc));
        cacheKey = `${doc}:${stat.mtimeMs}:${stat.size}`;
      }
      const cached = renderCache.get(doc);
      if (cached && cached.key === cacheKey) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(cached.html);
        return;
      }
      // 2026-08 嵌套分区 v2：合成总览页源 = 子文档卡片列表 Markdown（内联链接已转最终 URL）
      const source = isSyn
        ? syntheticIndexMarkdown(navTree, doc, searchIndexCache.summaries)
        : readFileSync(join(docsDir, doc), "utf8");
      const fallbackTitle = doc.replace(/\.md$/, "");
      // Phase 4.5 性能修复：使用渲染内核的 parseFrontmatter（权威解析器），避免 extractFrontmatter 与 render 内部 parseFrontmatter 行为不一致
      const { frontmatter: fm } = parseFrontmatter(source);
      const fmTitle = typeof fm.title === "string" && fm.title ? fm.title : undefined;

      // PLUG-009：构建时钩子管线（beforeRender → render → afterRender）
      const ctx: RenderContext = { path: doc, title: fmTitle ?? fallbackTitle, frontmatter: fm, headings: [], isFirstRender: false };
      const transformedMd = pipeline.runBeforeRender(source, ctx);
      // PLUG-006 接线：插件 extendMarked 扩展挂载进渲染内核
      const { html: renderedHtml } = render(transformedMd, { currentPath: doc, extraMarkedExtensions: pipeline.collectMarkedExtensions() });
      const html = pipeline.runAfterRender(renderedHtml, ctx);
      const slotContent = pipeline.collectSlotContent(ctx);
      // 设计对齐（2026-08-16）：页标题 = frontmatter.title ?? 正文首个 h1 ?? 文件名主干
      const title = fmTitle ?? firstH1Text(html) ?? fallbackTitle;

      const page = renderPage({
        title,
        siteTitle,
        navHtml,
        contentHtml: html,
        form: "dev",
        description: typeof fm.description === "string" && fm.description ? fm.description : typeof fm.summary === "string" && fm.summary ? fm.summary : undefined,
        seo: {
          // 2026-08 精致化：dev 形态也显示文章头部元信息（阅读时长/字数/更新时间；
          // updatedAt 与 build 同一规则：frontmatter.date/updated 优先，缺省文件 mtime）
          readingTime: analyzeDoc(source).readingTime,
          wordCount: countWords(html),
          updatedAt: docUpdatedAtDev(fm, join(docsDir, doc)),
          // DP-007：内容溯源（frontmatter provenance，与 build 同规则）
          ...(fm.provenance === "ai" || fm.provenance === "human" || fm.provenance === "mixed"
            ? { provenance: fm.provenance as "ai" | "human" | "mixed" }
            : {}),
        },
        searchVersion: searchIndexCache.version,
        slotContent,
        themeCss: options.themeCss,
        defaultTheme: options.defaultTheme, // VIS-001：modern 等默认暗色主题在 dev 形态同样生效
        pluginCss: pipeline.collectPluginStyles(),
        pluginConfigs: options.pluginConfigs, // PLUG-014：dev 形态注入运行时配置
        // 设计对齐（2026-08-16）：顶栏 topnav / eyebrow / 下一步卡片 / 上一页下一页
        nav: navTree,
        currentPath: doc,
        summaries: searchIndexCache.summaries,
        chrome: options.chrome,
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

  // MCP-006 写入端鉴权：终端打印一次 token（人类/Agent 首次使用参考）
  if (options.mcp && resolvedMcpToken) {
    const hostLabel = host === "127.0.0.1" || host === "::1" || host === "localhost" ? host : `${host}:${port}`;
    const baseUrl = `http://${hostLabel}:${port}/mcp`;
    const tokenLoc = mcpTokenFile ? `（已写入 ${mcpTokenFile}）` : "";
    console.log(`[doclight-mcp] 写入端已启用（Bearer token 鉴权${tokenLoc}）`);
    console.log(`  Authorization: Bearer ${resolvedMcpToken}`);
    console.log(`  curl -X POST ${baseUrl} -H "Authorization: Bearer ${resolvedMcpToken}" ...`);
  }

  // P0-3：非 loopback 监听提示（此时跳过 Host 头校验，服务对局域网/公网可见）
  if (!isLoopbackListenHost(host)) {
    console.warn(`[doclight] 监听 ${host}（非 loopback）：已跳过 Host 头校验，服务对网络可见，请确认环境可信`);
  }

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
        if (mcpTokenFile) {
          try {
            rmSync(mcpTokenFile, { force: true });
          } catch {
            /* 清理失败不影响 server 关闭 */
          }
        }
        server.close(() => done());
      }),
  };
}
