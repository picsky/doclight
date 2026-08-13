/**
 * 站点共享模块（SSG-001：dev server 与 SSG 构建共用的模板/扫描/MIME 工具）
 *
 * 三形态架构（05-ssg-build §5.1.2）：dev / SSG 是同一渲染内核的两种产物承载。
 * 本模块抽取 dev server（形态①）与 doclight build（形态②）共用的部分：
 * - walkMd：递归扫描 .md 文档列表
 * - renderNav：导航树 → 嵌套 <ul>（服务端直出，SEO 友好）
 * - renderPage：完整 HTML 页模板（支持 dev/ssg 双形态，渐进式水合）
 * - MIME / escapeHtml：静态服务与模板公共工具
 *
 * 双形态差异（renderPage 的 form 参数）：
 * - dev：展示层 /__doclight/display.js + SSE 热重载 + 默认 vendor/search 端点
 * - ssg：展示层 /display.js（拷贝进产物）+ 内联 DOCLIGHT_VENDOR_BASE / DOCLIGHT_SEARCH_INDEX
 *        + __DOCLLIGHT_SSG__ 标记（05 §5.3.2 渐进式水合）
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { render, type NavGroup, type NavNode } from "doclight-renderer";

// vendor 依赖定位：从 cli 包自身解析（pnpm workspace 把依赖 symlink 进包级 node_modules，
// process.cwd() 的根 node_modules 找不到——见 .spike/check-vendor.mjs 实测）
const require = createRequire(import.meta.url);
export function nodeModulesBase(pkg: string): string {
  return dirname(require.resolve(`${pkg}/package.json`));
}

/**
 * 展示层 bundle 定位：
 * 1. CLI 包自带的 packages/cli/dist/display.js（npm 安装后随包分发，任意 cwd 可用）
 * 2. 回退 monorepo 开发时 process.cwd()/dist/display.js（npm run build 产出）
 */
export function displayBundlePath(): string {
  const self = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "display.js"); // packages/cli/dist/display.js
  return existsSync(self) ? self : join(process.cwd(), "dist", "display.js");
}

/** REND-002 扩展 vendor 文件清单（Prism / Mermaid / KaTeX + KaTeX 字体） */
export const VENDOR_FILES: Record<string, { pkg: string; rel: string }> = {
  "mermaid.min.js": { pkg: "mermaid", rel: "dist/mermaid.min.js" },
  "prism.min.js": { pkg: "prismjs", rel: "prism.js" },
  "katex.min.js": { pkg: "katex", rel: "dist/katex.min.js" },
  "katex.min.css": { pkg: "katex", rel: "dist/katex.min.css" },
};

/** KaTeX 字体文件（katex.min.css 内相对引用 fonts/*，SSG 产物需一并拷贝） */
function katexFontFiles(): string[] {
  const fontsDir = join(nodeModulesBase("katex"), "dist", "fonts");
  return readdirSync(fontsDir).filter((f) => /\.(woff2?|ttf)$/.test(f));
}

/**
 * 构建搜索文档数据（SRCH-001：懒构建，供展示层 search.ts 建索引）。
 * 渲染内核输出已 sanitize HTML → 剥标签得纯文本；标题取 frontmatter.title 或文件名。
 * 展示层不接触原始 Markdown（架构原则），故索引数据在此生成后经 JSON 下发/写文件。
 * version 为内容哈希（03 §3.8.5 搜索索引持久化）：docs 变化 → 版本变化 →
 * 展示层 localStorage 缓存校验失配时重建，避免旧索引复用。
 * @param pathSuffix SSG 形态 ".html"：path 字段转静态产物 URL（dev 缺省保持 .md）
 */
export function buildSearchData(
  docsDir: string,
  mdFiles: string[],
  options: { pathSuffix?: string } = {}
): { version: string; docs: unknown[] } {
  const suffix = options.pathSuffix ?? "";
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
      const path = suffix ? rel.replace(/\.md$/, suffix) : rel;
      docs.push({ path, title, headings, text });
    } catch {
      /* 单个文档渲染失败跳过（索引不因此中断） */
    }
  }
  return { version: searchIndexVersion(docs), docs };
}

/**
 * 搜索索引版本 = docs 内容哈希（FNV-1a 32-bit → base36）。
 * 纯函数（可测）：内容不变 → 版本不变；任何文档变化 → 版本变化。
 */
export function searchIndexVersion(docs: unknown[]): string {
  const s = JSON.stringify(docs);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * 拷贝扩展 vendor 到产物目录（SSG-002：SSG 形态 vendor 基址决策——拷贝 dist/vendor，
 * 自包含 + 离线可用，页面经 window.DOCLIGHT_VENDOR_BASE="/vendor/" 指到产物）。
 */
export function copyVendor(outDir: string): void {
  const vendorOut = join(outDir, "vendor");
  for (const [name, { pkg, rel }] of Object.entries(VENDOR_FILES)) {
    const data = readFileSync(join(nodeModulesBase(pkg), rel));
    mkdirSync(vendorOut, { recursive: true });
    writeFileSync(join(vendorOut, name), data);
  }
  // KaTeX 字体：katex.min.css 相对引用 fonts/，一并拷贝
  const fontsOut = join(vendorOut, "fonts");
  mkdirSync(fontsOut, { recursive: true });
  for (const f of katexFontFiles()) {
    writeFileSync(join(fontsOut, f), readFileSync(join(nodeModulesBase("katex"), "dist", "fonts", f)));
  }
}

/** 递归收集 .md 相对路径（正斜杠），按字母序（构建 nav 前的原始列表） */
export function walkMd(dir: string, base = ""): string[] {
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

/** HTML 转义（转义 & < > " '，与 marked 默认 code escape 一致） */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
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

/** 按扩展名取 MIME；未知返回 application/octet-stream */
export function mimeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot).toLowerCase() : "";
  return MIME[ext] ?? "application/octet-stream";
}

/** 是否根级置顶页（README.md / index.md，SSG 时收敛为首页 /） */
export function isRootIndex(path: string): boolean {
  return /^README\.md$/i.test(path) || /^index\.md$/i.test(path);
}

/**
 * 子路径基址归一（GitHub Pages 项目页等，05 §5.5 后续 + 交接遗留）：
 * "" / "/" / "." → ""（根部署）；"/docs/" → "/docs"。返回值不含尾斜杠。
 */
export function normalizeBase(base?: string): string {
  const b = (base ?? "").trim();
  if (!b || b === "/" || b === ".") return "";
  const withSlash = b.startsWith("/") ? b : `/${b}`;
  return withSlash.replace(/\/+$/, "");
}

/**
 * 导航/面包屑链接（dev 与 SSG 双形态）：
 * - dev（linkSuffix=""）：保持 .md 链接（既有行为）
 * - SSG（linkSuffix=".html"）：.md → .html；根级置顶页收敛为首页；
 *   base 非空时给绝对链接加基址前缀（子路径部署）
 */
function navHref(path: string, linkSuffix: string, base: string): string {
  if (!linkSuffix) return `/${path}`;
  if (isRootIndex(path)) return base ? `${base}/` : "/";
  return `${base}/${path.replace(/\.md$/, linkSuffix)}`;
}

/**
 * 渲染导航树为嵌套 <ul>（服务端直出，SEO 友好，03 §3.1.3）。
 * @param hash bundle 形态（05 §5.3.4）：href 前缀 "#"（file:// 不能 pushState，用 hash 路由）
 */
export function renderNav(nodes: NavNode[], linkSuffix = "", base = "", hash = false): string {
  const hrefFor = (p: string) => (hash ? `#${navHref(p, linkSuffix, base)}` : navHref(p, linkSuffix, base));
  const items = nodes.map((n) => {
    if (n.type === "file") {
      const href = hrefFor(n.path);
      return `<li><a href="${href}" data-path="${n.path}">${escapeHtml(n.title)}</a></li>`;
    }
    const groupTitle = n.index
      ? `<a href="${hrefFor(n.index)}" data-path="${n.index}">${escapeHtml(n.title)}</a>`
      : escapeHtml(n.title);
    return `<li class="group">${groupTitle}<ul>${renderNav(n.items, linkSuffix, base, hash)}</ul></li>`;
  });
  return `<ul>${items.join("")}</ul>`;
}

/**
 * 面包屑链（05 §5.4.2 进阶 SEO）：首页 → 分组链 → 当前页。
 * 仅链接有 index 页的分组（避免死链）；无 index 的分组只作层级标签。
 * 纯函数（可测）：输入导航树 + 文档相对路径 → 面包屑数组。
 */
export function breadcrumbFor(
  nodes: NavNode[],
  relPath: string,
  linkSuffix: string,
  base: string,
  title: string
): Array<{ label: string; href: string }> {
  const crumbs: Array<{ label: string; href: string }> = [{ label: "首页", href: base ? `${base}/` : "/" }];
  const segments = relPath.split("/");
  segments.pop(); // 文件名
  let level = nodes;
  let prefix = "";
  for (const seg of segments) {
    const group = level.find((n): n is NavGroup => n.type === "group" && n.path === `${prefix}${seg}/`);
    if (group && group.index) {
      crumbs.push({ label: group.title, href: navHref(group.index, linkSuffix, base) });
      level = group.items;
    } else {
      crumbs.push({ label: group?.title ?? seg, href: "" }); // 无置顶页分组：不可链接
      if (group) level = group.items;
    }
    prefix += `${seg}/`;
  }
  crumbs.push({ label: title, href: "" });
  return crumbs;
}

/** 正文字数（JSON-LD wordCount）：CJK 逐字计 + 非 CJK 空白分词计 */
export function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  const cjk = text.match(/[一-鿿]/g) ?? [];
  const nonCjkWords = text.split(/\s+/).filter((w) => w && !/[一-鿿]/.test(w));
  return cjk.length + nonCjkWords.length;
}

/**
 * OG 分享卡片图（05 §5.4.2：Node 侧生成，无浏览器依赖）。
 * 1200×630 SVG：品牌色块 + 站点字标 + 标题/描述/站点名。
 * 注：部分平台不支持 SVG og:image（需光栅图），本实现为零依赖的先行版，后续可换 PNG/服务端。
 */
export function ogCardSvg(options: { title: string; description?: string; siteTitle: string }): string {
  const safe = (s: string) => escapeHtml(s.replace(/[\p{Cc}\p{Cf}]/gu, " ")); // 剥离控制字符（防 SVG 注入/渲染异常）
  const wrap = (s: string, max: number, maxLines: number): string[] => {
    const lines: string[] = [];
    let line = "";
    for (const ch of s) {
      if (line.length >= max) {
        lines.push(line);
        line = "";
        if (lines.length >= maxLines) break;
      }
      line += ch;
    }
    if (line && lines.length < maxLines) lines.push(line);
    return lines;
  };
  const titleLines = wrap(options.title, 24, 2).map((l, i) => {
    const y = 250 + i * 78;
    return `<text x="80" y="${y}" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif" font-size="64" font-weight="700" fill="#ffffff">${safe(l)}</text>`;
  });
  const descLines = wrap(options.description ?? "", 34, 2).map((l, i) => {
    const y = 500 + i * 44;
    return `<text x="80" y="${y}" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif" font-size="32" fill="#ccfbf1">${safe(l)}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0f766e"/>
  <rect width="1200" height="14" fill="#0d9488"/>
  <text x="80" y="120" font-family="ui-monospace,Menlo,monospace" font-size="36" letter-spacing="6" fill="#5eead4">DOCLIGHT</text>
  ${titleLines.join("\n")}
  ${descLines.join("\n")}
  <text x="80" y="588" font-family="system-ui,'PingFang SC',sans-serif" font-size="28" fill="#99f6e4">${safe(options.siteTitle)}</text>
</svg>
`;
}

export type PageForm = "dev" | "ssg" | "bundle";

/** SEO 元数据（05 §5.4，Phase 3 剩余）：传 seo 才输出；缺省保持既有页面（dev/最小闭环零回归） */
export interface SeoOptions {
  /** 子路径基址（normalizeBase 归一），影响产物内绝对 URL 前缀 */
  base?: string;
  /** 站点绝对 URL（不带头尾 /），缺省不输出 canonical / OG / sitemap 等绝对链接 */
  siteUrl?: string;
  /** 页面规范路径（站点根起，含 .html），如 "/guide/quickstart.html"；首页 "/" */
  canonicalPath?: string;
  /** 面包屑（首页 → 分组链 → 当前页）；缺省不渲染 */
  breadcrumb?: Array<{ label: string; href: string }>;
  /** 正文字数（JSON-LD wordCount） */
  wordCount?: number;
  /** 更新时间 ISO（JSON-LD dateModified） */
  updatedAt?: string;
  /** 作者（JSON-LD author） */
  author?: string;
  /** 社交卡片图绝对 URL（og:image / twitter:image） */
  ogImage?: string;
}

export interface RenderPageOptions {
  /** 当前页标题（frontmatter.title 或文件名主干） */
  title: string;
  /** 站点标题 */
  siteTitle: string;
  /** 服务端直出的导航 <ul> */
  navHtml: string;
  /** 渲染内核输出的已 sanitize 内容 HTML */
  contentHtml: string;
  /** SEO meta description（缺省省略该标签） */
  description?: string;
  /** 形态：dev（__doclight 端点 + SSE）/ ssg（静态产物路径 + 内联全局覆盖）/ bundle（单文件内嵌数据） */
  form: PageForm;
  /** SEO 元数据（05 §5.4）；不传则输出与最小闭环一致（无 canonical/OG/JSON-LD/面包屑） */
  seo?: SeoOptions;
  /** 搜索索引版本（03 §3.8.5 持久化）：内联 window.DOCLIGHT_SEARCH_VERSION 供展示层缓存校验 */
  searchVersion?: string;
  /** bundle 形态：展示层运行时源码（dist/display.js 转义内联；缺省用外部 src） */
  displayScript?: string;
  /** bundle 形态：内嵌数据块（pages/titles/nav/searchIndex），序列化为 __DOCLLIGHT_BUNDLE__ */
  bundleData?: unknown;
}

/**
 * 三形态全局覆盖脚本：
 * - dev/ssg：window.DOCLIGHT_SEARCH_VERSION（搜索索引缓存校验，内容哈希）
 * - ssg：vendor/search 端点指到静态产物（base 子路径部署时带前缀）+ __DOCLLIGHT_SSG__ 标记
 * - bundle：window.__DOCLLIGHT_BUNDLE__（内嵌 pages/titles/nav/searchIndex，hash 路由 + 零网络）
 */
function globalOverridesScript(
  form: PageForm,
  base: string,
  searchVersion?: string,
  bundleData?: unknown
): string {
  const lines: string[] = [];
  if (searchVersion && form !== "bundle") {
    lines.push(`window.DOCLIGHT_SEARCH_VERSION = ${JSON.stringify(searchVersion)};`);
  }
  if (form === "ssg") {
    lines.push(`window.DOCLIGHT_VENDOR_BASE = ${JSON.stringify(`${base}/vendor/`)};`);
    lines.push(`window.DOCLIGHT_SEARCH_INDEX = ${JSON.stringify(`${base}/search-index.json`)};`);
    lines.push("window.__DOCLLIGHT_SSG__ = true;");
  } else if (form === "bundle" && bundleData !== undefined) {
    lines.push(`window.__DOCLLIGHT_BUNDLE__ = ${safeJson(bundleData)};`);
  }
  return lines.length ? `  ${lines.join("\n  ")}` : "";
}

/** 站点根起的绝对 URL：siteUrl + base + path（折叠多余斜杠，不破坏协议双斜杠） */
function absUrl(siteUrl: string, base: string, path: string): string {
  return `${siteUrl}${base}${path}`.replace(/([^:])\/+/g, "$1/");
}

/** JSON 安全内嵌：防内容中的 </script> 逃逸（sanitize 只保证正文，meta 文本也需防逃逸） */
function safeJson(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/** 面包屑可见 UI（05 §5.4.2：结构化数据 + 可见导航） */
function breadcrumbHtml(crumbs: Array<{ label: string; href: string }>): string {
  const items = crumbs
    .map((c, i) => {
      const last = i === crumbs.length - 1;
      const inner = last
        ? `<span aria-current="page">${escapeHtml(c.label)}</span>`
        : c.href
          ? `<a href="${c.href}">${escapeHtml(c.label)}</a>`
          : escapeHtml(c.label);
      return `<li>${inner}</li>`;
    })
    .join("");
  return `<nav class="breadcrumb" aria-label="面包屑"><ol>${items}</ol></nav>`;
}

/**
 * 组装完整 HTML 页（首屏直出：内容 + 导航服务端渲染）。
 * 含：顶栏（站点标题/菜单/搜索/主题切换）、防闪烁脚本、完整设计令牌（THEME-001）、
 * TOC 导轨/移动端底部面板（TOC-001）、搜索框样式（SRCH-001）、移动端侧边栏、
 * 扩展语法渲染样式（REND-002/003）、展示层 bundle（自挂载）。
 * 渐进式水合（05 §5.3.2）：内容纯静态 HTML，JS 接管交互不重渲染。
 */
export function renderPage(options: RenderPageOptions): string {
  const { title, siteTitle, navHtml, contentHtml, form, seo } = options;
  const base = normalizeBase(seo?.base);
  const siteUrl = (seo?.siteUrl ?? "").trim().replace(/\/+$/, "");
  // bundle 形态：展示层运行时内联（单文件零外部请求）；dev/ssg 用外部 src
  const displayTag =
    form === "bundle" && options.displayScript
      ? `<script type="module">\n${options.displayScript}\n</script>`
      : `<script type="module" src="${base}/${form === "dev" ? "__doclight/display.js" : "display.js"}"></script>`;
  const sseScript =
    form === "dev"
      ? `<script>
  // 热重载：SSE 收到变更事件后整页刷新（SPA 导航由展示层接管）
  try {
    var es = new EventSource('/__doclight/events');
    es.onmessage = function (e) { if (e.data === 'reload') location.reload(); };
  } catch (err) { /* SSE 不可用时静默降级为手动刷新 */ }
</script>`
      : "";
  const metaDescription = options.description
    ? `<meta name="description" content="${escapeHtml(options.description)}">`
    : "";

  // ===== SEO（05 §5.4）：canonical / Open Graph / Twitter Card / JSON-LD / 面包屑 =====
  // bundle 为分发形态（file:// 单文件），不输出 SEO 绝对链接
  let seoHead = "";
  let breadcrumb = "";
  if (seo && form !== "bundle") {
    const canonical = siteUrl && seo.canonicalPath ? absUrl(siteUrl, base, seo.canonicalPath) : undefined;
    const ogDesc = options.description;
    const pageTitle = `${title} · ${siteTitle}`;
    if (canonical) seoHead += `<link rel="canonical" href="${escapeHtml(canonical)}">\n`;
    if (canonical) seoHead += `<meta property="og:url" content="${escapeHtml(canonical)}">\n`;
    seoHead += `<meta property="og:site_name" content="${escapeHtml(siteTitle)}">\n`;
    seoHead += `<meta property="og:title" content="${escapeHtml(pageTitle)}">\n`;
    seoHead += `<meta property="og:type" content="article">\n`;
    if (ogDesc) seoHead += `<meta property="og:description" content="${escapeHtml(ogDesc)}">\n`;
    if (seo.ogImage) seoHead += `<meta property="og:image" content="${escapeHtml(seo.ogImage)}">\n`;
    seoHead += `<meta name="twitter:card" content="summary_large_image">\n`;
    seoHead += `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">\n`;
    if (ogDesc) seoHead += `<meta name="twitter:description" content="${escapeHtml(ogDesc)}">\n`;
    if (seo.ogImage) seoHead += `<meta name="twitter:image" content="${escapeHtml(seo.ogImage)}">\n`;

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: title,
      ...(ogDesc ? { description: ogDesc } : {}),
      ...(typeof seo.wordCount === "number" ? { wordCount: seo.wordCount } : {}),
      ...(seo.author ? { author: { "@type": "Person", name: seo.author } } : {}),
      publisher: { "@type": "Organization", name: siteTitle },
      ...(seo.updatedAt ? { dateModified: seo.updatedAt } : {}),
      ...(canonical ? { url: canonical } : {}),
    };
    seoHead += `<script type="application/ld+json">${safeJson(jsonLd)}</script>\n`;

    if (seo.breadcrumb?.length) {
      const crumbsJson = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: seo.breadcrumb.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.label,
          ...(c.href ? { item: siteUrl ? absUrl(siteUrl, base, c.href) : c.href } : {}),
        })),
      };
      seoHead += `<script type="application/ld+json">${safeJson(crumbsJson)}</script>\n`;
      breadcrumb = breadcrumbHtml(seo.breadcrumb);
    }
  }

  const overrides = globalOverridesScript(form, base, options.searchVersion, options.bundleData);
  const overridesScript = overrides ? `<script>\n${overrides}\n</script>` : "";
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ${escapeHtml(siteTitle)}</title>
${metaDescription}
${seoHead}
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
  /* 面包屑（05 §5.4.2：结构化数据 + 可见 UI） */
  .breadcrumb { font-size: var(--font-size-sm); color: var(--color-text-muted); margin: 0 0 var(--space-6); }
  .breadcrumb ol { list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-2); padding: 0; margin: 0; }
  .breadcrumb li { display: inline-flex; align-items: center; }
  .breadcrumb li + li::before { content: "/"; margin-right: var(--space-2); color: var(--color-border); }
  .breadcrumb a { color: var(--color-text-secondary); text-decoration: none; }
  .breadcrumb a:hover { color: var(--color-primary); }
  .breadcrumb [aria-current="page"] { color: var(--color-text-strong); font-weight: 600; }
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
  /* ===== REND-002 扩展语法渲染（容器 / 代码块+复制 / Mermaid 容错 / KaTeX） ===== */
  /* 代码块容器（复制按钮定位基准） */
  pre.doclight-code { position: relative; }
  pre.doclight-code.has-copy { padding-right: 56px; }
  .doclight-copy {
    position: absolute; top: var(--space-2); right: var(--space-2);
    border: 1px solid var(--color-border); background: var(--color-bg-soft);
    color: var(--color-text-secondary); border-radius: var(--radius-sm);
    font-size: var(--font-size-xs); font-family: var(--font-sans);
    padding: 2px 8px; cursor: pointer; opacity: 0; transition: opacity var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
  }
  pre.doclight-code:hover .doclight-copy { opacity: 1; }
  .doclight-copy:hover { color: var(--color-primary); border-color: var(--color-primary); }
  .doclight-copy.copied { color: var(--color-success); border-color: var(--color-success); opacity: 1; }
  /* 代码高亮 token 配色（Prism token class，亮/暗两套；与设计令牌一致，不引 Prism 主题 CSS） */
  .token.comment, .token.prolog, .token.doctype, .token.cdata { color: var(--color-text-muted); font-style: italic; }
  .token.punctuation { color: var(--color-text-secondary); }
  .token.keyword, .token.rule, .token.important { color: var(--color-info); }
  .token.string, .token.attr-value, .token.char { color: var(--color-warning); }
  .token.number, .token.boolean, .token.constant, .token.symbol { color: #9333ea; }
  .token.function, .token.method { color: var(--color-primary); }
  .token.tag, .token.selector, .token.atrule { color: var(--color-primary); }
  .token.attr-name, .token.property, .token.builtin { color: var(--color-warning); }
  .token.class-name, .token.maybe-class-name, .token.type { color: #7c3aed; }
  .token.operator, .token.entity, .token.url { color: var(--color-text); }
  .token.regex, .token.variable { color: var(--color-warning); }
  [data-theme="dark"] .token.number, [data-theme="dark"] .token.boolean, [data-theme="dark"] .token.constant, [data-theme="dark"] .token.symbol { color: #c084fc; }
  [data-theme="dark"] .token.class-name, [data-theme="dark"] .token.maybe-class-name, [data-theme="dark"] .token.type { color: #a78bfa; }
  /* 自定义容器（:::tip / :::warning / :::danger / :::info） */
  .doclight-container { margin: 0 0 1.5em; padding: var(--space-3) var(--space-4); border-left: 3px solid var(--color-info); background: var(--color-bg-soft); border-radius: 0 var(--radius) var(--radius) 0; }
  .doclight-container > :first-child { margin-top: 0; }
  .doclight-container > :last-child { margin-bottom: 0; }
  .doclight-tip { border-left-color: var(--color-success); }
  .doclight-warning { border-left-color: var(--color-warning); }
  .doclight-danger { border-left-color: var(--color-error); }
  /* Mermaid：源码 fallback（降级不白屏，REND-003）+ 容错提示 */
  .doclight-mermaid { margin: 0 0 1.5em; text-align: center; }
  .doclight-mermaid .doclight-mermaid-src { text-align: left; margin: 0 auto; max-width: 100%; display: inline-block; }
  .doclight-mermaid-rendered svg { max-width: 100%; height: auto; }
  .doclight-mermaid-error { color: var(--color-error); font-size: var(--font-size-sm); margin: 0 0 var(--space-2); }
  /* KaTeX：块级公式居中 + 横向滚动 */
  .doclight-katex-block { overflow-x: auto; overflow-y: hidden; padding: var(--space-1) 0; margin: 0 0 1.5em; }
  .doclight-katex-inline { padding: 0 2px; }
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
  <span class="site-title">${escapeHtml(siteTitle)}</span>
  <button id="search-toggle" aria-label="搜索（Ctrl+K）">🔍</button>
  <button id="theme-toggle" aria-label="切换主题">🌓</button>
</header>
<div class="layout">
  <aside class="sidebar">${navHtml}</aside>
  <main class="paper">${breadcrumb}<article>${contentHtml}</article></main>
</div>
<!-- TOC（03 §3.7）：桌面导轨（hover 展开）+ 移动端底部面板；内容由展示层填充 -->
<aside class="toc-rail" aria-label="本页目录"><div class="toc-dots"></div><nav class="toc-panel"></nav></aside>
<button class="toc-fab" aria-label="目录">☰</button>
<div class="toc-sheet">
  <div class="toc-sheet-header">本页目录<button class="toc-sheet-close" aria-label="关闭目录">×</button></div>
  <nav class="toc-sheet-nav"></nav>
</div>
${overridesScript}
${sseScript}
${displayTag}
</body>
</html>`;
}
