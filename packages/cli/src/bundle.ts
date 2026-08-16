/**
 * doclight bundle —— 单文件便携包（05-ssg-build §5.3.4，CLI-002，形态③）
 *
 * 复用 SSG 渲染内核，输出单个自包含 doclight.html：
 * - 所有页面 HTML 打包为内嵌数据块（__DOCLLIGHT_BUNDLE__.pages，hash 路由）
 * - 内嵌搜索索引（searchIndex）+ docs.json（nav）+ 每页标题（titles）
 * - 展示层运行时内联（display.js），零外部请求
 * - 扩展 vendor（Prism/Mermaid/KaTeX）不内联：file:// 下加载失败自动降级
 *   （代码块纯文本可读可复制 / Mermaid 保留源码 / KaTeX 保留 TeX 源码，REND-003 容错）
 *
 * 产物特征（05 §5.3.4）：零依赖（file:// 三引擎可用）/ 跨浏览器 / 离线可用 / 可分发 / AI 就绪。
 */
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildNavTree, parseFrontmatter, render, analyzeDoc } from "@doclight/renderer";
import { toFile as qrToFile } from "qrcode";
import { loadConfig } from "./config.ts";
import { buildCapabilityManifest } from "./capabilities.ts";
import { resolveThemePackage } from "./themes.ts";
import { BuildPluginPipeline } from "./plugins.ts";
import { articleBodyHtml, buildSearchData, collectNavTitles, countWords, displayBundlePath, firstH1Text, nodeModulesBase, planSyntheticIndexPages, renderNav, renderPage, syntheticIndexMarkdown, syntheticIndexTitle, VENDOR_FILES, walkMd } from "./site.ts";
import type { PluginDef, RenderContext } from "../../core/src/plugin.ts";

export interface BundleOptions {
  /** 文档根目录，默认 ./docs */
  dir?: string;
  /** 输出目录（doclight.html 所在），默认 ./dist-bundle */
  outDir?: string;
  /** 站点标题 */
  title?: string;
  /** 展示层 bundle 源码路径（缺省 process.cwd()/dist/display.js） */
  displayBundle?: string;
  /** 输出文件名，默认 doclight.html */
  filename?: string;
  /** 下载二维码内容 URL（13 §3.2 分发四触点④）：提供则生成 bundle-qr.png（手机扫码打开/下载） */
  qrUrl?: string;
  /** 内联扩展库（C3）：Prism/Mermaid/KaTeX JS+CSS 内联进单文件，file:// 下扩展可用；
   *  默认不内联（保持体积小，扩展走 REND-003 容错降级）——体积换离线能力，opt-in。 */
  inlineVendor?: boolean;
  /** PLUG-009：构建时插件列表（由 CLI 层从配置解析后注入；bundle 形态补齐） */
  buildPlugins?: PluginDef[];
  /** PLUG-014：插件运行时配置（doclight.json plugins，注入页面供展示层自动注册；
   *  缺省回退 bundleSite 内部 loadConfig 解析结果） */
  pluginConfigs?: Array<{ name: string; config?: Record<string, unknown>; enabled?: boolean }>;
  /** 设计对齐（2026-08-16）：站点镀铬（顶栏版本按钮 / GitHub 图标 / footer 链接与状态） */
  chrome?: {
    version?: string;
    github?: string;
    footerLinks?: Array<{ label: string; href: string }>;
    statusText?: string;
  };
}

export interface BundleResult {
  /** 产物完整路径 */
  file: string;
  /** 产物字节数 */
  bytes: number;
  /** 打包页数 */
  pages: number;
  /** 二维码文件路径（提供 qrUrl 时） */
  qrFile?: string;
  /** 耗时（ms） */
  ms: number;
}

/** 页面内容键：根级置顶页 → "/"，其余 → "/{outRel}" */
function pageKey(outRel: string): string {
  return outRel === "index.html" ? "/" : `/${outRel}`;
}

/** 首页源路径（与 build 一致）：根级 README/index 中 README 优先；无则首篇文档 */
function rootHomePath(mdFiles: string[]): string {
  return mdFiles.find((rel) => /^README\.md$/i.test(rel)) ?? mdFiles.find((rel) => /^index\.md$/i.test(rel)) ?? mdFiles[0] ?? "";
}

/**
 * 内联扩展库 HTML（C3）：CSS 先于 JS；带 data-doclight-vendor 标记供展示层懒加载跳过 fetch。
 * @param extraVendor PLUG-012：插件声明的 vendor（mermaid 等按需启用插件）；缺省仅内联内置（Prism/KaTeX）。
 */
export function inlineVendorHtml(extraVendor?: Record<string, { pkg: string; rel: string }>): string {
  const css: string[] = [];
  const js: string[] = [];
  const files = { ...VENDOR_FILES, ...(extraVendor ?? {}) };
  for (const [file, { pkg, rel }] of Object.entries(files)) {
    const content = readFileSync(join(nodeModulesBase(pkg), rel), "utf8");
    if (file.endsWith(".css")) css.push(`<style data-doclight-vendor="${file}">${content}</style>`);
    else js.push(`<script data-doclight-vendor="${file}">${content}</script>`);
  }
  return [...css, ...js].join("\n");
}

/** 执行 bundle 构建（供命令与测试复用）。outDir 先清空重建。 */
export async function bundleSite(options: BundleOptions = {}): Promise<BundleResult> {
  const start = Date.now();
  const cfg = loadConfig([join(process.cwd(), "doclight.json"), join(resolve(options.dir ?? "docs"), "doclight.json")]);
  // 设计对齐：站点镀铬（CLI 选项优先，回退 doclight.json）
  const chrome = options.chrome ?? (cfg.version || cfg.github || cfg.footer
    ? { version: cfg.version, github: cfg.github, footerLinks: cfg.footer?.links, statusText: cfg.footer?.status }
    : undefined);
  const docsDir = resolve(options.dir ?? cfg.docsDir ?? "docs");
  const outDir = resolve(options.outDir ?? "dist-bundle");
  const siteTitle = options.title ?? cfg.title ?? "DocLight";
  const displayBundle = options.displayBundle ?? displayBundlePath();

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const mdFiles = walkMd(docsDir);

  // Phase 3 单遍流水：预渲染所有文档（read 1x + render 1x + analyze 1x + parse 1x + plugin pipeline 1x）
  // 后续 collectNavTitles / buildSearchData / 主循环 复用此 Map，避免重复读盘/渲染
  const preparedDocs = new Map<string, {
    source: string;
    frontmatter: Record<string, unknown>;
    html: string;
    slotContent: Record<string, string>;
    analysis: { readingTime: number; wordCount: number; hasCode: boolean; headings: Array<{ level: number; id: string; text: string }>; summary: string };
  }>();
  // PLUG-009：构建管线（bundle 形态补齐——beforeRender → render → afterRender，插槽注入壳层）
  const pipeline = new BuildPluginPipeline(options.buildPlugins ?? []);
  const extraMarkedExtensions = pipeline.collectMarkedExtensions();
  for (const rel of mdFiles) {
    try {
      const source = readFileSync(join(docsDir, rel), "utf8");
      const { frontmatter } = parseFrontmatter(source);
      const fallbackTitle = rel.replace(/\.md$/, "").split("/").pop()!;
      const ctx: RenderContext = { path: rel, title: fallbackTitle, frontmatter, headings: [], isFirstRender: false };
      const transformedMd = pipeline.runBeforeRender(source, ctx);
      const { html: renderedHtml } = render(transformedMd, {
        currentPath: rel,
        linkSuffix: ".html",
        extraMarkedExtensions,
      });
      const html = pipeline.runAfterRender(renderedHtml, ctx);
      ctx.frontmatter = frontmatter;
      const slotContent = pipeline.collectSlotContent(ctx);
      const analysis = analyzeDoc(source);
      preparedDocs.set(rel, { source, frontmatter, html, slotContent, analysis });
    } catch {
      /* 单文档准备失败跳过 */
    }
  }

  // 导航用 frontmatter 标题（Phase 3：复用 preparedDocs 的 frontmatter）
  const frontmatterMap = new Map<string, Record<string, unknown>>();
  for (const [rel, doc] of preparedDocs) frontmatterMap.set(rel, doc.frontmatter);
  const navTitles = collectNavTitles(docsDir, mdFiles, frontmatterMap);
  let navTree = buildNavTree(mdFiles, navTitles);
  // 嵌套目录合成总览页（2026-08 嵌套分区设计 v2）：无 README/index 的嵌套目录 →
  // 合成虚拟 index.md（标题=目录名，正文=子文档卡片列表）；有绑定走真实文件
  const synthetic = planSyntheticIndexPages(navTree);
  const mdFilesAll = synthetic.length ? [...mdFiles, ...synthetic] : mdFiles;
  const syntheticSet = new Set(synthetic);
  if (synthetic.length) {
    const titlesAll = { ...navTitles };
    for (const syn of synthetic) titlesAll[syn] = syntheticIndexTitle(syn);
    navTree = buildNavTree(mdFilesAll, titlesAll);
  }
  // hash 路由：导航链接 #/xxx（file:// 无法 pushState）
  const navHtml = renderNav(navTree, ".html", "", true);

  // 内嵌搜索索引（Phase 3：复用 preparedDocs 的渲染结果）
  const renderedMap = new Map<string, { html: string; frontmatter: Record<string, unknown> }>();
  for (const [rel, doc] of preparedDocs) renderedMap.set(rel, { html: doc.html, frontmatter: doc.frontmatter });
  const searchData = buildSearchData(docsDir, mdFiles, { pathSuffix: ".html", nav: navTree, renderedMap });

  const pages: Record<string, string> = {};
  const titles: Record<string, string> = {};
  let homeTitle = siteTitle;
  let homeContent = "";
  let homeSlotContent: Record<string, string> = {};
  // 设计对齐：首页文章头部元信息（meta 行——三形态同构 SNAP-001：bundle 与 dev/SSG 一致）
  let homeSeo: { readingTime?: number; wordCount?: number; updatedAt?: string } = {};

  const rootIndexFiles = mdFiles.filter((rel) => /^README\.md$/i.test(rel) || /^index\.md$/i.test(rel));
  const rootHome = rootIndexFiles.find((rel) => /^README\.md$/i.test(rel)) ?? rootIndexFiles[0];

  let count = 0;
  for (const rel of mdFilesAll) {
    const outRel = rel === rootHome ? "index.html" : rel.replace(/\.md$/, ".html");
    const prepared = preparedDocs.get(rel);
    // 合成总览页：磁盘无源文件，按形态（bundle = hash 路由）生成卡片列表 Markdown
    const source = prepared?.source ?? syntheticIndexMarkdown(navTree, rel, searchData.summaries, ".html", true);
    const frontmatter = prepared?.frontmatter ?? {};
    const html = prepared?.html ?? (() => {
      const fallbackTitle = rel.replace(/\.md$/, "").split("/").pop()!;
      const ctx: RenderContext = { path: rel, title: fallbackTitle, frontmatter, headings: [], isFirstRender: false };
      const transformedMd = pipeline.runBeforeRender(source, ctx);
      const { html: renderedHtml } = render(transformedMd, { currentPath: rel, linkSuffix: ".html", extraMarkedExtensions });
      return pipeline.runAfterRender(renderedHtml, ctx);
    })();
    const fallbackTitle = rel.replace(/\.md$/, "").split("/").pop()!;
    // 设计对齐（2026-08-16）：页标题 = frontmatter.title ?? 正文首个 h1 ?? 文件名主干
    const title =
      typeof frontmatter.title === "string" && frontmatter.title
        ? frontmatter.title
        : firstH1Text(html) ?? fallbackTitle;
    const key = pageKey(outRel);
    // 设计对齐：每页完整文章体（crumb / eyebrow / h1 / lede / meta / 正文 / 下一步 / 上一页下一页）——
    // SPA 导航后与 dev/SSG 同构（SNAP-001）；插槽为壳层单实例（bundle 形态边界），占位保持一致
    const description =
      typeof frontmatter.description === "string" && frontmatter.description
        ? frontmatter.description
        : typeof frontmatter.summary === "string" && frontmatter.summary
          ? frontmatter.summary
          : undefined;
    const analysis = prepared?.analysis ?? analyzeDoc(source);
    const rawDate = frontmatter.date ?? frontmatter.updated;
    let updatedAt: string | undefined;
    if (typeof rawDate === "string") {
      const t = Date.parse(rawDate);
      if (!Number.isNaN(t)) updatedAt = new Date(t).toISOString();
    }
    if (!updatedAt) {
      try {
        updatedAt = statSync(join(docsDir, rel)).mtime.toISOString();
      } catch {
        /* 无 mtime 时省略更新时间 */
      }
    }
    const pageSeo = {
      readingTime: analysis.readingTime,
      wordCount: countWords(html),
      ...(updatedAt ? { updatedAt } : {}),
      // DP-007：内容溯源（frontmatter provenance，与 build/dev 同规则）
      ...(frontmatter.provenance === "ai" || frontmatter.provenance === "human" || frontmatter.provenance === "mixed"
        ? { provenance: frontmatter.provenance as "ai" | "human" | "mixed" }
        : {}),
    };
    pages[key] = articleBodyHtml({
      title,
      contentHtml: html,
      description,
      seo: pageSeo,
      nav: navTree,
      currentPath: rel,
      summaries: searchData.summaries,
      linkSuffix: ".html",
      hash: true,
      base: "",
      slotBefore: '<span data-doclight-slot="content:before"></span>',
      slotAfter: '<span data-doclight-slot="content:after"></span>',
    });
    titles[key] = `${title} · ${siteTitle}`;
    if (key === "/") {
      homeTitle = title;
      homeContent = html;
      // 插槽内容注入壳层（Phase 3：复用 preparedDocs 的 slotContent）
      homeSlotContent = prepared?.slotContent ?? {};
      homeSeo = pageSeo;
    }
    count++;
  }

  // 首页回退：无根级置顶页用首篇文档（与 build 一致）
  if (!pages["/"] && mdFiles.length > 0) {
    const firstKey = pageKey(mdFiles[0]!.replace(/\.md$/, ".html"));
    homeContent = pages[firstKey] ?? "";
    homeTitle = mdFiles[0]!.replace(/\.md$/, "").split("/").pop()!;
    pages["/"] = homeContent;
    titles["/"] = `${homeTitle} · ${siteTitle}`;
  }

  const bundleData = { version: 1, pages, titles, nav: navTree, searchIndex: searchData };

  const displayScript = readFileSync(displayBundle, "utf8");
  // THEME-002 + VIS-001：主题包（bundle 形态同样生效——单文件内主题切换）
  const theme = resolveThemePackage(cfg.theme);

  const html = renderPage({
    title: homeTitle,
    siteTitle,
    navHtml,
    contentHtml: homeContent,
    form: "bundle",
    displayScript,
    bundleData,
    extraHead: options.inlineVendor ? inlineVendorHtml(pipeline.collectVendorFiles()) : "",
    slotContent: homeSlotContent,
    themeCss: theme.css,
    defaultTheme: theme.defaultTheme, // VIS-001：modern 默认暗色在 bundle 形态生效
    pluginCss: pipeline.collectPluginStyles(),
    pluginConfigs: options.pluginConfigs ?? cfg.plugins, // PLUG-014：bundle 形态同样注入运行时配置（展示层自动注册）
    // 设计对齐（2026-08-16）：顶栏 topnav / eyebrow / 下一步卡片 / 上一页下一页（首页为壳层锚点）
    nav: navTree,
    currentPath: rootHomePath(mdFiles),
    summaries: searchData.summaries,
    chrome,
    seo: homeSeo, // 首页文章头部元信息（meta 行，三形态同构）
  });

  const file = join(outDir, options.filename ?? "doclight.html");
  writeFileSync(file, html);
  // CAP-001：能力协议——bundle 产物目录同样输出 capabilities.json（三形态一致；
  // markdownAlternate=false：单文件 hash 路由，无独立页面 URL）
  writeFileSync(
    join(outDir, "capabilities.json"),
    JSON.stringify(
      buildCapabilityManifest({
        siteTitle,
        base: "",
        form: "bundle",
        plugins: pipeline.listPlugins().map((p) => ({ name: p.name, version: p.version, capabilities: p.capabilities })),
      }),
      null,
      2
    )
  );
  const result: BundleResult = { file, bytes: Buffer.byteLength(html, "utf8"), pages: count, ms: Date.now() - start };

  // C2 下载二维码（13 §3.2 分发四触点④）：--qr <url> 生成 bundle-qr.png，手机扫码打开/下载
  if (options.qrUrl) {
    const qrFile = join(outDir, "bundle-qr.png");
    await qrToFile(qrFile, options.qrUrl, { width: 480, margin: 2 });
    result.qrFile = qrFile;
  }
  return result;
}
