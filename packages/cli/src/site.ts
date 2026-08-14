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
import { render, type NavGroup, type NavNode } from "@doclight/renderer";

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

/** REND-002 内置扩展 vendor 文件清单（Prism / KaTeX + KaTeX 字体）。
 *  PLUG-012（Mermaid 迁移）：mermaid.min.js 已不在内置清单——由
 *  @doclight/plugin-mermaid 的 vendor 声明按需提供（见 plugins.ts collectVendorFiles）。 */
export const VENDOR_FILES: Record<string, { pkg: string; rel: string }> = {
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
 * @param extraVendor PLUG-012：插件声明的 vendor（mermaid 等按需启用插件）；
 *   缺省仅拷贝内置扩展 vendor（Prism/KaTeX）。
 */
export function copyVendor(outDir: string, extraVendor?: Record<string, { pkg: string; rel: string }>): void {
  const vendorOut = join(outDir, "vendor");
  const files = { ...VENDOR_FILES, ...(extraVendor ?? {}) };
  for (const [name, { pkg, rel }] of Object.entries(files)) {
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
  /** AEO-001：本页 markdown 版本 URL（站点根起，如 "/guide/foo.md"；输出
   *  <link rel="alternate" type="text/markdown">——Agent 免解析 HTML 直接取原稿） */
  markdownUrl?: string;
  /** AEO-001：本页 token 估算（<meta name="doclight:tokens">，Agent 读取成本） */
  tokens?: number;
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
  /** 额外 <head> 内容（C3 bundle --inline-vendor 的内联扩展库；缺省空） */
  extraHead?: string;
  /** PLUG-005：构建时插槽内容（插件 slotContent 合并结果，键为插槽名，值为 HTML） */
  slotContent?: Record<string, string>;
  /** THEME-002：主题 CSS 覆盖层（注入主样式之后，<style data-doclight-theme>；缺省空 = 默认主题） */
  themeCss?: string;
  /** PLUG-012：插件 CSS（合并各插件 styles，<style data-doclight-plugin-css>；缺省空） */
  pluginCss?: string;
  /** PLUG-014：插件运行时配置（doclight.json plugins 序列化，注入 window.DOCLIGHT_PLUGIN_CONFIGS
   *  供展示层自动注册 init/onMount——与页面脚本挂载的 DOCLIGHT_PLUGINS 定义表接线） */
  pluginConfigs?: Array<{ name: string; config?: Record<string, unknown>; enabled?: boolean }>;
  /** VIS-001：主题包默认模式（如 modern="dark"：首次进入即暗色，无 localStorage 记录时生效） */
  defaultTheme?: "light" | "dark";
  /** VIS-001：固定主题模式（主题画廊面板用——忽略 localStorage/系统偏好，钉死亮或暗） */
  fixedTheme?: "light" | "dark";
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

/** PLUG-014：插件运行时配置内联（window.DOCLIGHT_PLUGIN_CONFIGS，展示层自动注册 init/onMount） */
function pluginConfigsScript(pluginConfigs?: Array<{ name: string; config?: Record<string, unknown>; enabled?: boolean }>): string {
  if (!pluginConfigs?.length) return "";
  const safe = pluginConfigs.map((c) => ({
    name: c.name,
    ...(c.config && typeof c.config === "object" ? { config: c.config } : {}),
    ...(c.enabled === false ? { enabled: false } : {}),
  }));
  return `  window.DOCLIGHT_PLUGIN_CONFIGS = ${safeJson(safe)};`;
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
 * 默认主题设计令牌（THEME-001 + VIS-001）：即 Minimal 设计语言（11 §3.1——
 * teal/白/6px/680px，与 04-reading-experience 排版系统一致）。
 * 独立导出：设计合规门禁（design-compliance）对默认主题同样断言（WCAG AA/8pt/1.25）。
 */
export const DEFAULT_THEME_CSS = `  :root {
    /* 颜色 - 品牌（单一强调色 teal；Luminous 光之容器——晨光亮色面） */
    --color-primary: #0d9488; --color-primary-hover: #0f766e; --color-primary-light: #ccfbf1;
    /* 颜色 - 中性灰阶（8 级；晨光：微暖白纸感基底） */
    --color-bg: #fdfdfc; --color-bg-soft: #f7f7f5; --color-bg-code: #f3f4f6;
    --color-border: #e7e7e3; --color-border-soft: #f1f1ee;
    --color-text-muted: #71717a; --color-text-secondary: #6b7280;
    --color-text: #374151; --color-text-strong: #111827;
    /* 语义色（克制使用） */
    --color-success: #059669; --color-warning: #d97706; --color-error: #dc2626; --color-info: #2563eb;
    /* 字体（不引 Web Font，用系统最佳） */
    --font-sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --font-mono: "JetBrains Mono", "SF Mono", "Cascadia Code", "Fira Code", ui-monospace, Menlo, Consolas, monospace;
    /* 字号（模块化缩放 1.25，VIS-001：从 base 起严格 ×1.25——lg 20px / xl 25px / 2xl 31.25px / 3xl 39px；
       xs/sm 为基础 UI 字号（12/14px），不在正文节奏链上（design-compliance 门禁校验）） */
    --font-size-xs: 0.75rem; --font-size-sm: 0.875rem; --font-size-base: 1rem;
    --font-size-lg: 1.25rem; --font-size-xl: 1.5625rem;
    --font-size-2xl: 1.953rem; --font-size-3xl: 2.441rem;
    /* 行高 */
    --line-height-tight: 1.3; --line-height-normal: 1.5; --line-height-relaxed: 1.75;
    /* 字距（VIS-002：标题收紧 / 标签放宽） */
    --tracking-tight: -0.01em; --tracking-normal: 0; --tracking-wide: 0.04em;
    /* 间距（4px 基准，8pt 网格；VIS-002 补齐 5/10 档） */
    --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
    --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
    --space-12: 48px; --space-16: 64px;
    /* 布局 */
    --max-width-content: 680px; --sidebar-width: 280px; --toc-width: 220px; --topbar-height: 52px;
    /* 圆角 */
    --radius-sm: 4px; --radius: 6px; --radius-lg: 8px;
    /* 阴影（VIS-002 分层：克制使用） */
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05); --shadow: 0 1px 3px rgba(0,0,0,0.1);
    --shadow-lg: 0 4px 12px rgba(0,0,0,0.1); --shadow-xl: 0 12px 32px rgba(0,0,0,0.14);
    /* 过渡与缓动（VIS-002：标准反馈 / 柔和出场） */
    --transition-fast: 150ms ease; --transition: 200ms ease;
    --ease-standard: cubic-bezier(0.2, 0, 0, 1); --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    /* 聚焦环（WCAG 2.4.7；色相随主题） */
    --ring-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
    /* 代码块令牌（VIS-002 惊艳化：恒定深色基底——顶级文档站标准；
       亮暗主题共享深色代码区，主题可覆盖为纸色/暖色/玻璃等个性形态） */
    --code-bg: #0d1117; --code-text: #e6edf3; --code-border: rgba(148, 163, 184, 0.14);
    --code-token-comment: #7d8590; --code-token-punct: #8b949e; --code-token-keyword: #79c0ff;
    --code-token-string: #a5d6ff; --code-token-number: #d2a8ff; --code-token-func: #56d4dd;
    --code-token-tag: #7ee787; --code-token-attr: #79c0ff; --code-token-class: #ffa657;
    --code-token-op: #e6edf3; --code-token-regex: #a5d6ff;
    /* Luminous 光效令牌（VIS-002 惊艳化） */
    --gradient-brand: linear-gradient(135deg, var(--color-primary), #14b8a6);
    --glow-primary: 0 0 0 1px color-mix(in srgb, var(--color-primary) 16%, transparent), 0 8px 32px color-mix(in srgb, var(--color-primary) 12%, transparent);
  }
  [data-theme="dark"] {
    /* Luminous 夜航面：深蓝黑底 + teal 辉光 */
    --color-bg: #0a0e14; --color-bg-soft: #11161f; --color-bg-code: #262626;
    --color-border: #1e2530; --color-border-soft: #161c26;
    --color-text-muted: #73737f; --color-text-secondary: #a3a3ad;
    --color-text: #d4d4d8; --color-text-strong: #f5f5f7;
    --color-primary-light: #134e4a;
    --color-success: #10b981; --color-warning: #f59e0b; --color-error: #ef4444; --color-info: #3b82f6;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.3); --shadow: 0 1px 3px rgba(0,0,0,0.4);
    --shadow-lg: 0 4px 16px rgba(0,0,0,0.5); --shadow-xl: 0 16px 40px rgba(0,0,0,0.6);
    --code-token-comment: #8b949e; --code-token-punct: #8b949e;
    --gradient-brand: linear-gradient(135deg, #2dd4bf, #14b8a6);
  }
`;

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

    // AEO-001：发布产物 Agent 友好——
    // 1) 每页 markdown 版本（<link rel="alternate" type="text/markdown">，Agent 免解析 HTML 直接取原稿）
    // 2) llms.txt v2 Link 关系（rel="describedby" 指向 llms.txt；仅 SSG——dev 不产出 llms.txt，不输出死链）
    // 3) token 计数（<meta name="doclight:tokens">，Agent 读取成本一级指标）
    if (seo.markdownUrl) {
      seoHead += `<link rel="alternate" type="text/markdown" href="${escapeHtml(`${base}${seo.markdownUrl}`)}">\n`;
    }
    if (form === "ssg") {
      seoHead += `<link rel="describedby" href="${escapeHtml(`${base}/llms.txt`)}">\n`;
    }
    if (typeof seo.tokens === "number") {
      seoHead += `<meta name="doclight:tokens" content="${seo.tokens}">\n`;
    }
  }

  const overrides = globalOverridesScript(form, base, options.searchVersion, options.bundleData);
  const pluginCfg = pluginConfigsScript(options.pluginConfigs);
  const overridesScript = overrides || pluginCfg ? `<script>\n${overrides}${overrides && pluginCfg ? "\n" : ""}${pluginCfg}\n</script>` : "";
  // PLUG-005：插槽内容注入（构建时静态 HTML + data-doclight-slot 标记供运行时追加）
  const slot = (name: string): string => {
    const html = options.slotContent?.[name] ?? "";
    return `<span data-doclight-slot="${name}"${html ? ` data-doclight-static="1"` : ""}>${html}</span>`;
  };
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="auto">
<head>
${slot("head:start")}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ${escapeHtml(siteTitle)}</title>
${metaDescription}
${seoHead}
<script>
  // 防闪烁（03 §3.6.2）：同步确定主题，在 CSS 前执行
  // VIS-001：优先级 = fixedTheme（画廊面板钉死）→ localStorage → 主题包默认模式（modern 暗色）→ 系统偏好
  (function () {
    try {
      var fixed = ${options.fixedTheme ? `'${options.fixedTheme}'` : "null"};
      var def = ${options.defaultTheme ? `'${options.defaultTheme}'` : "null"};
      var t = null;
      if (fixed) { t = fixed; }
      else {
        t = localStorage.getItem('doclight-theme');
        if (!t || t === 'auto') t = def || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
      document.documentElement.setAttribute('data-theme', t);
    } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
  })();
</script>
<style>
  /* ===== 设计令牌（03 §3.6 + 04 §4.3，THEME-001；即 Minimal 设计语言，VIS-001）===== */
  ${DEFAULT_THEME_CSS}
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  }
  body { margin: 0; background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); font-size: var(--font-size-base); line-height: var(--line-height-relaxed); text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; }
  /* Luminous 光之容器：背景光晕（右上主光 + 左下补光；夜航面强度更高） */
  body::before { content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; background: radial-gradient(1100px 520px at 72% -12%, color-mix(in srgb, var(--color-primary) 8%, transparent), transparent 62%), radial-gradient(900px 480px at -10% 108%, color-mix(in srgb, var(--color-primary) 5%, transparent), transparent 55%); }
  /* Luminous 夜航面：光晕强度提升（辉光是夜航主场） */
  [data-theme="dark"] body::before { background: radial-gradient(1200px 600px at 74% -14%, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent 64%), radial-gradient(1000px 560px at -12% 110%, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent 58%); }
  /* Luminous 星芒微粒：极淡光点阵（夜航面如夜空、晨光面几乎不可见） */
  body::after { content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; opacity: 0.4; background-image: radial-gradient(1.5px 1.5px at 12% 22%, color-mix(in srgb, var(--color-primary) 35%, transparent) 50%, transparent 51%), radial-gradient(1px 1px at 28% 66%, color-mix(in srgb, var(--color-primary) 25%, transparent) 50%, transparent 51%), radial-gradient(1.5px 1.5px at 55% 34%, color-mix(in srgb, var(--color-primary) 20%, transparent) 50%, transparent 51%), radial-gradient(1px 1px at 78% 58%, color-mix(in srgb, var(--color-primary) 25%, transparent) 50%, transparent 51%), radial-gradient(1.5px 1.5px at 92% 18%, color-mix(in srgb, var(--color-primary) 30%, transparent) 50%, transparent 51%), radial-gradient(1px 1px at 64% 84%, color-mix(in srgb, var(--color-primary) 20%, transparent) 50%, transparent 51%); }
  /* VIS-002：表格数字列等宽数字对齐（金额/计数/版本号） */
  td, th { font-variant-numeric: tabular-nums; }
  /* ===== 顶栏（Luminous：毛玻璃 + 渐变光条 + 光芒品牌） ===== */
  .topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: var(--space-2); height: var(--topbar-height); padding: 0 var(--space-4); background: color-mix(in srgb, var(--color-bg) 82%, transparent); backdrop-filter: blur(12px) saturate(1.4); -webkit-backdrop-filter: blur(12px) saturate(1.4); border-bottom: 1px solid var(--color-border); }
  /* Luminous 顶栏光条：底缘一道渐变光线（晨光微弱 / 夜航明亮） */
  .topbar::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary) 50%, transparent) 50%, transparent); opacity: 0.5; pointer-events: none; }
  .topbar .brand { display: flex; align-items: center; gap: var(--space-2); margin-right: var(--space-2); text-decoration: none; }
  /* 光芒品牌（Luminous）：渐变底 + 柔和光晕 + 白色光芒 SVG */
  .topbar .brand-mark { position: relative; width: 26px; height: 26px; border-radius: 8px; background: var(--gradient-brand); display: inline-flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; box-shadow: 0 1px 3px color-mix(in srgb, var(--color-primary) 45%, transparent); }
  .topbar .brand-mark::after { content: ""; position: absolute; inset: -3px; border-radius: 10px; background: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 35%, transparent), transparent 70%); z-index: -1; }
  .topbar .brand-mark svg { width: 15px; height: 15px; filter: drop-shadow(0 0 2px rgba(255,255,255,0.45)); }
  .topbar .site-title { font-weight: 700; letter-spacing: -0.01em; color: var(--color-text-strong); white-space: nowrap; }
  .icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0; border: 1px solid transparent; background: transparent; color: var(--color-text-secondary); border-radius: var(--radius); cursor: pointer; transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast); }
  .icon-btn:hover { color: var(--color-primary); background: var(--color-bg-soft); border-color: var(--color-border); }
  .icon-btn:active { transform: scale(0.92); }
  .icon-btn.active { color: var(--color-primary); border-color: color-mix(in srgb, var(--color-primary) 40%, transparent); background: var(--color-bg-soft); }
  .icon-btn svg { width: 17px; height: 17px; }
  .icon-btn .label { font-size: var(--font-size-xs); font-weight: 600; }
  #sidebar-toggle { display: none; }
  /* 搜索触发器：顶栏内嵌的搜索框形态按钮（点击打开搜索层） */
  .search-trigger { margin-left: auto; display: inline-flex; align-items: center; gap: var(--space-2); height: 34px; min-width: 180px; padding: 0 var(--space-3); border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-bg-soft); color: var(--color-text-muted); font-size: var(--font-size-sm); font-family: var(--font-sans); cursor: pointer; transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast); }
  .search-trigger:hover { border-color: var(--color-primary); background: var(--color-bg); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent); }
  .search-trigger svg { width: 15px; height: 15px; flex-shrink: 0; }
  .search-trigger .placeholder { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .search-trigger .kbd { font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted); border: 1px solid var(--color-border); border-radius: 4px; padding: 1px 5px; background: var(--color-bg); white-space: nowrap; }
  /* ===== 布局：三栏（侧边栏 | 正文 | 右侧目录），侧边栏 sticky 独立滚动 ===== */
  .layout { display: grid; grid-template-columns: var(--sidebar-width) minmax(0, 1fr); min-height: calc(100vh - var(--topbar-height)); }
  .sidebar { position: sticky; top: var(--topbar-height); height: calc(100vh - var(--topbar-height)); overflow-y: auto; overscroll-behavior: contain; border-right: 1px solid var(--color-border); padding: var(--space-6) var(--space-3) var(--space-16); font-size: var(--font-size-sm); scrollbar-width: thin; scrollbar-color: var(--color-border) transparent; }
  .sidebar::-webkit-scrollbar { width: 8px; }
  .sidebar::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }
  .sidebar ul { list-style: none; padding-left: var(--space-3); margin: 0; }
  .sidebar > ul { padding-left: 0; }
  .sidebar li { margin: 0; }
  /* 分组：安静小标签（设计证据：Mintlify = 12px/600/深色/无字距无 uppercase；
     分组比导航项更醒目——目录结构用深色，内容项用灰色） */
  .sidebar .group { margin-top: var(--space-6); }
  .sidebar .group > a, .sidebar .group { display: block; font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-strong); letter-spacing: var(--tracking-normal); text-transform: none; padding: 0 var(--space-3); margin-bottom: var(--space-2); }
  .sidebar .group > a:hover { color: var(--color-primary); background: none; }
  /* 当前分组状态（设计师手笔：不仅当前页有状态，所在分组标题也高亮——
     纯 CSS :has()，随页面 active 自动联动，零 JS） */
  .sidebar .group:has(a.active) > a, .sidebar .group:has(a.active) { color: var(--color-primary); }
  /* 嵌套分组（二级+）：层级降级——间距收紧 + 次级色（弱于一级分组的深色） */
  .sidebar .group .group { margin-top: var(--space-4); }
  .sidebar .group .group > a, .sidebar .group .group { color: var(--color-text-secondary); margin-bottom: var(--space-1); }
  /* 导航项：极致安静（设计证据：Mintlify = 14px/400/无圆角/不对称 padding；
     hover = 文字变深 + 3% 超淡背景（rgba(10,13,12,0.03) 实测），active = 主色+字重+静态短竖线；
     hover≠active 是设计师手笔——3% 背景几乎不可见但提供微妙反馈） */
  .sidebar a { display: block; padding: 5px var(--space-3) 5px var(--space-4); border-radius: 0; color: var(--color-text-secondary); text-decoration: none; transition: color var(--transition-fast), background var(--transition-fast); position: relative; }
  .sidebar a:hover { color: var(--color-text-strong); background: color-mix(in srgb, var(--color-text-strong) 3%, transparent); }
  .sidebar a.active { color: var(--color-primary); font-weight: 600; background: none; box-shadow: none; }
  .sidebar a.active::before { content: ""; position: absolute; left: var(--space-2); top: 50%; transform: translateY(-50%); width: 2px; height: 12px; border-radius: 1px; background: var(--color-primary); }
  main { grid-column: 2; min-width: 0; max-width: var(--max-width-content); width: 100%; margin: 0 auto; padding: var(--space-12) var(--space-6) var(--space-16); }
  /* 正文排版（04 §4.2：16px × 1.75，680px 行宽） */
  article h1 { font-size: var(--font-size-3xl); line-height: var(--line-height-tight); font-weight: 700; margin: 0 0 0.8em; color: var(--color-text-strong); letter-spacing: -0.01em; }
  article h2 { font-size: var(--font-size-2xl); line-height: var(--line-height-tight); font-weight: 600; margin: 2.5em 0 0.6em; padding-top: 1.1em; border-top: 1px solid var(--color-border-soft); color: var(--color-text-strong); letter-spacing: -0.005em; }
  article h3 { font-size: var(--font-size-xl); line-height: 1.4; font-weight: 600; margin: 1.8em 0 0.5em; color: var(--color-text-strong); }
  article h4 { font-size: var(--font-size-lg); line-height: 1.4; font-weight: 600; margin: 1.2em 0 0.4em; color: var(--color-text-strong); }
  article h2[id], article h3[id] { scroll-margin-top: 80px; }
  /* 标题锚点（VIS-002 惊艳化：hover 显示 #，点击复制节链接——顶级文档站细节） */
  .doclight-anchor { position: absolute; margin-left: var(--space-2); font-family: var(--font-mono); font-size: 0.7em; font-weight: 400; color: var(--color-text-muted); text-decoration: none; border-bottom: none !important; opacity: 0; transform: translateX(-3px); transition: opacity var(--transition-fast), transform var(--transition-fast), color var(--transition-fast); }
  article h2, article h3 { position: relative; }
  article h2:hover .doclight-anchor, article h3:hover .doclight-anchor, .doclight-anchor:focus-visible { opacity: 1; transform: translateX(0); }
  .doclight-anchor:hover { color: var(--color-primary); }
  .doclight-anchor.copied { color: var(--color-success); opacity: 1; }
  article p { margin: 0 0 1.5em; text-indent: 0; }
  /* 列表（精致化：marker 用主色柔化 + 呼吸感行距） */
  article ul, article ol { margin: 0 0 1.5em; padding-left: 1.6em; }
  article li { margin: 0.35em 0; line-height: 1.7; }
  article li > ul, article li > ol { margin: 0.35em 0; }
  article ul li::marker { color: var(--color-primary); }
  article ol li::marker { color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
  article a { color: var(--color-primary); text-decoration: none; border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent); transition: color var(--transition-fast), border-color var(--transition-fast); }
  article a:hover { color: var(--color-primary-hover); border-bottom-color: var(--color-primary); }
  /* 面包屑（05 §5.4.2：结构化数据 + 可见 UI） */
  .breadcrumb { font-size: var(--font-size-sm); color: var(--color-text-muted); margin: 0 0 var(--space-6); }
  .breadcrumb ol { list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-2); padding: 0; margin: 0; }
  .breadcrumb li { display: inline-flex; align-items: center; }
  .breadcrumb li + li::before { content: "/"; margin-right: var(--space-2); color: var(--color-border); }
  .breadcrumb a { color: var(--color-text-secondary); text-decoration: none; }
  .breadcrumb a:hover { color: var(--color-primary); }
  .breadcrumb [aria-current="page"] { color: var(--color-text-strong); font-weight: 600; }
  pre { background: var(--code-bg); color: var(--code-text); border: 1px solid var(--code-border); padding: var(--space-4) var(--space-6); border-radius: var(--radius-lg); overflow-x: auto; font-size: var(--font-size-sm); line-height: 1.6; box-shadow: var(--shadow-sm), inset 0 1px 0 color-mix(in srgb, var(--code-text) 6%, transparent), 0 0 24px color-mix(in srgb, var(--color-primary) 7%, transparent); }
  code { font-family: var(--font-mono); font-size: 0.875em; padding: 2px 6px; background: var(--color-bg-code); border-radius: var(--radius-sm); color: var(--color-primary); border: 1px solid var(--color-border-soft); }
  pre code { background: none; border: none; padding: 0; color: var(--code-text); }
  blockquote { margin: 0 0 1.5em; padding: var(--space-3) var(--space-4); border-left: 3px solid var(--color-primary); border-radius: 0 var(--radius) var(--radius) 0; background: var(--color-bg-soft); color: var(--color-text-secondary); }
  blockquote > :first-child { margin-top: 0; }
  blockquote > :last-child { margin-bottom: 0; }
  /* 表格（精致化：垂直呼吸感 padding + 2px 表头分隔线 + 行 hover 微反馈） */
  .table-wrap { overflow-x: auto; margin-bottom: 1.5em; border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid var(--color-border-soft); padding: 10px var(--space-4); text-align: left; line-height: 1.6; vertical-align: top; }
  th { background: var(--color-bg-soft); font-weight: 600; color: var(--color-text-strong); border-bottom: 2px solid var(--color-border); white-space: nowrap; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: color-mix(in srgb, var(--color-text-strong) 2%, transparent); }
  /* 表格内行内代码/链接：与正文一致但不额外拥挤 */
  th code, td code { white-space: nowrap; }
  img { max-width: 100%; border-radius: var(--radius); }
  hr { border: none; border-top: 1px solid var(--color-border); margin: var(--space-8) 0; }
  /* 键盘可达性：全局焦点环（WCAG 2.4.7） */
  :focus-visible { outline: 2px solid var(--color-ring, var(--color-primary)); outline-offset: 2px; border-radius: 2px; }
  /* 跳转链接（04 §4.6.2 兑现，WCAG 2.4.1）：键盘用户 Tab 首键直达正文 */
  .skip-link { position: fixed; top: -48px; left: var(--space-3); z-index: 70; padding: var(--space-2) var(--space-4); background: var(--color-primary); color: #fff; font-size: var(--font-size-sm); border-radius: 0 0 var(--radius) var(--radius); transition: top var(--transition-fast); }
  .skip-link:focus { top: 0; }
  /* 页面切换过渡（04 §4.5.2 兑现，VIS-002）：SPA 导航后内容 150ms 淡入；reduced-motion 全局禁用 */
  @keyframes doclight-page-in { from { opacity: 0; transform: translateY(4px); } }
  article.page-enter { animation: doclight-page-in 150ms var(--ease-out); }
  /* 主题切换过渡（亮暗交替平滑；reduced-motion 下禁用） */
  body, .topbar, .sidebar, main, .toc-rail { transition: background-color var(--transition), color var(--transition), border-color var(--transition); }
  /* ===== TOC（03 §3.7，TOC-001；宽屏常驻右侧目录面板） ===== */
  .toc-rail { position: sticky; top: var(--topbar-height); height: calc(100vh - var(--topbar-height)); overflow-y: auto; overscroll-behavior: contain; padding: var(--space-8) 0 var(--space-16); width: var(--toc-width); scrollbar-width: thin; scrollbar-color: var(--color-border) transparent; }
  .toc-rail::-webkit-scrollbar { width: 8px; }
  .toc-rail::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }
  .toc-label { display: block; font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-strong); letter-spacing: var(--tracking-normal); text-transform: none; margin-bottom: var(--space-3); padding: 0 var(--space-2); }
  .toc-dots { display: none; }
  .toc-panel { display: flex; flex-direction: column; gap: 1px; }
  /* TOC 项：与侧边栏同设计语言——hover 文字变深+3% 微背景，active 主色+字重+静态竖线（无背景无光晕） */
  .toc-link { display: block; padding: 4px var(--space-2); border-radius: 0; font-size: var(--font-size-sm); line-height: var(--line-height-normal); color: var(--color-text-secondary); text-decoration: none; cursor: pointer; border-left: 2px solid transparent; transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast); }
  .toc-link-l3 { padding-left: var(--space-4); font-size: var(--font-size-xs); }
  .toc-link:hover { color: var(--color-text-strong); background: color-mix(in srgb, var(--color-text-strong) 3%, transparent); }
  .toc-link.active { color: var(--color-primary); font-weight: 600; border-left-color: var(--color-primary); background: none; box-shadow: none; }
  /* 移动端 TOC：右下角浮动按钮 + 底部面板 */
  .toc-fab { display: none; position: fixed; right: var(--space-4); bottom: var(--space-6); z-index: 40; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--color-border); background: var(--color-bg-soft); color: var(--color-text-secondary); font-size: 18px; cursor: pointer; box-shadow: var(--shadow); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
  .toc-sheet { display: none; position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; max-height: 70%; background: var(--color-bg); border-top: 1px solid var(--color-border); border-radius: var(--radius-lg) var(--radius-lg) 0 0; transform: translateY(100%); transition: transform var(--transition); box-shadow: var(--shadow); }
  .toc-sheet.open { transform: translateY(0); }
  .toc-sheet-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); font-weight: 600; color: var(--color-text-strong); }
  .toc-sheet-close { border: none; background: none; font-size: 20px; cursor: pointer; color: var(--color-text-secondary); }
  .toc-sheet-nav { padding: var(--space-3); overflow-y: auto; max-height: calc(70vh - 48px); }
  /* ===== 搜索（03 §3.5，SRCH-001；VIS-002：毛玻璃遮罩 + 面板层级） ===== */
  .search-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,0.35); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; animation: doclight-fade var(--transition) var(--ease-out); }
  .search-box { width: min(600px, calc(100vw - 32px)); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-xl), var(--glow-primary); overflow: hidden; animation: doclight-rise var(--transition) var(--ease-out); }
  @keyframes doclight-fade { from { opacity: 0; } }
  @keyframes doclight-rise { from { opacity: 0; transform: translateY(6px); } }
  .search-input { width: 100%; padding: var(--space-4) var(--space-5); border: none; outline: none; font-size: var(--font-size-lg); font-family: var(--font-sans); color: var(--color-text); background: var(--color-bg); border-bottom: 1px solid var(--color-border-soft); }
  .search-input::placeholder { color: var(--color-text-muted); }
  .search-status { padding: var(--space-2) var(--space-5); font-size: var(--font-size-sm); color: var(--color-text-muted); }
  .search-results { max-height: 55vh; overflow-y: auto; padding: var(--space-2); }
  .search-result { display: block; padding: var(--space-2) var(--space-3); border-radius: var(--radius); text-decoration: none; color: var(--color-text); cursor: pointer; transition: background var(--transition-fast); }
  .search-result.active, .search-result:hover { background: var(--color-bg-soft); }
  .search-result-title { display: block; font-weight: 600; color: var(--color-text-strong); }
  .search-result-path { display: block; font-size: var(--font-size-xs); color: var(--color-text-muted); font-family: var(--font-mono); }
  .search-result-snippet { display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: var(--line-height-normal); }
  .search-result mark, .search-result-title mark { background: none; color: var(--color-primary); font-weight: 600; }
  .search-empty { padding: var(--space-6) var(--space-4); text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm); }
  .search-recent-label { padding: var(--space-2) var(--space-3) var(--space-1); font-size: var(--font-size-xs); color: var(--color-text-muted); letter-spacing: var(--tracking-wide); }
  .search-recent-item { display: block; width: 100%; text-align: left; padding: var(--space-2) var(--space-3); border: none; background: none; cursor: pointer; color: var(--color-text); border-radius: var(--radius); font-size: var(--font-size-sm); font-family: var(--font-sans); transition: background var(--transition-fast), color var(--transition-fast); }
  .search-recent-item:hover { background: var(--color-bg-soft); color: var(--color-primary); }
  /* ===== REND-002 扩展语法渲染（容器 / 代码块+复制 / Mermaid 容错 / KaTeX） ===== */
  /* 代码块容器（复制按钮定位基准；VIS-002：语言标签右上角，深色代码区适配） */
  pre.doclight-code { position: relative; }
  pre.doclight-code.has-copy { padding-right: 56px; }
  .doclight-lang { position: absolute; top: 0; right: var(--space-5); padding: var(--space-1) var(--space-2); font-family: var(--font-mono); font-size: 11px; line-height: 1.4; color: var(--code-token-comment); background: color-mix(in srgb, var(--code-bg) 88%, transparent); border-bottom-left-radius: var(--radius-sm); user-select: none; pointer-events: none; }
  pre.doclight-code.has-copy .doclight-lang { right: var(--space-5); }
  .doclight-copy {
    position: absolute; top: var(--space-1); right: var(--space-1);
    border: 1px solid color-mix(in srgb, var(--code-text) 18%, transparent); background: color-mix(in srgb, var(--code-bg) 85%, transparent);
    color: var(--code-token-comment); border-radius: var(--radius-sm);
    font-size: var(--font-size-xs); font-family: var(--font-sans);
    padding: 2px 8px; cursor: pointer; opacity: 0; transition: opacity var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
  }
  pre.doclight-code:hover .doclight-copy { opacity: 1; }
  .doclight-copy:hover { color: var(--code-text); border-color: color-mix(in srgb, var(--code-text) 45%, transparent); background: color-mix(in srgb, var(--code-bg) 92%, transparent); }
  .doclight-copy.copied { color: #34d399; border-color: rgba(52, 211, 153, 0.5); opacity: 1; }
  /* 代码高亮 token 配色（Prism token class；VIS-002：令牌化，默认深色代码区配色——
     亮暗主题下代码区均为深色基底，语法色精心调校（slate 底 + 冷色系高亮）） */
  .token.comment, .token.prolog, .token.doctype, .token.cdata { color: var(--code-token-comment); font-style: italic; }
  .token.punctuation { color: var(--code-token-punct); }
  .token.keyword, .token.rule, .token.important { color: var(--code-token-keyword); }
  .token.string, .token.attr-value, .token.char { color: var(--code-token-string); }
  .token.number, .token.boolean, .token.constant, .token.symbol { color: var(--code-token-number); }
  .token.function, .token.method { color: var(--code-token-func); }
  .token.tag, .token.selector, .token.atrule { color: var(--code-token-tag); }
  .token.attr-name, .token.property, .token.builtin { color: var(--code-token-attr); }
  .token.class-name, .token.maybe-class-name, .token.type { color: var(--code-token-class); }
  .token.operator, .token.entity, .token.url { color: var(--code-token-op); }
  .token.regex, .token.variable { color: var(--code-token-regex); }
  /* 自定义容器（:::tip / :::warning / :::danger / :::info）
     VIS-002：圆底语义色徽标图标（纯 class 承载，符合扩展承载铁律，零 JS 依赖） */
  .doclight-container { position: relative; margin: 0 0 1.5em; padding: var(--space-4) var(--space-5) var(--space-4) var(--space-12); border-left: 3px solid var(--color-info); background: color-mix(in srgb, var(--color-bg-soft) 88%, var(--color-bg)); border-radius: 0 var(--radius) var(--radius) 0; }
  .doclight-container::before { position: absolute; left: var(--space-4); top: var(--space-4); width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--font-sans); font-size: 12px; line-height: 1; font-weight: 700; color: #fff; }
  .doclight-tip::before { content: "✓"; background: var(--color-success); }
  .doclight-info::before { content: "i"; background: var(--color-info); font-style: italic; }
  .doclight-warning::before { content: "!"; background: var(--color-warning); }
  .doclight-danger::before { content: "×"; background: var(--color-error); }
  .doclight-container > :first-child { margin-top: 0; }
  .doclight-container > :last-child { margin-bottom: 0; }
  .doclight-tip { border-left-color: var(--color-success); }
  .doclight-warning { border-left-color: var(--color-warning); }
  .doclight-danger { border-left-color: var(--color-error); }
  /* Mermaid（PLUG-012）：样式由 @doclight/plugin-mermaid 的 styles 声明提供（按需注入） */
  /* KaTeX：块级公式居中 + 横向滚动 */
  .doclight-katex-block { overflow-x: auto; overflow-y: hidden; padding: var(--space-1) 0; margin: 0 0 1.5em; }
  .doclight-katex-inline { padding: 0 2px; }
  /* 响应式（04 §4.8）：≥1280px 三栏（含右侧目录）；1024-1279 两栏；<768px 移动端 */
  @media (min-width: 1280px) {
    .layout { grid-template-columns: var(--sidebar-width) minmax(0, 1fr) var(--toc-width); }
    .toc-rail { display: block; border-left: 1px solid var(--color-border-soft); padding-left: var(--space-4); }
  }
  @media (max-width: 1279px) {
    .toc-rail { display: none; }
  }
  @media (max-width: 768px) {
    #sidebar-toggle { display: inline-flex; }
    .topbar .brand { margin-right: 0; }
    .search-trigger { min-width: 0; width: 34px; padding: 0; justify-content: center; border-radius: var(--radius); background: transparent; border-color: transparent; }
    .search-trigger .placeholder, .search-trigger .kbd { display: none; }
    .sidebar { position: fixed; left: 0; top: var(--topbar-height); bottom: 0; height: auto; transform: translateX(-100%); transition: transform 0.2s ease; background: var(--color-bg); z-index: 35; width: min(80vw, var(--sidebar-width)); box-shadow: none; padding-bottom: calc(var(--space-16) + env(safe-area-inset-bottom)); }
    .sidebar.open { transform: translateX(0); box-shadow: 0 8px 32px rgba(0,0,0,0.25); }
    .toc-fab { display: flex; align-items: center; justify-content: center; }
    .toc-sheet { display: block; padding-bottom: env(safe-area-inset-bottom); }
    main { grid-column: 1 / -1; padding: var(--space-6) var(--space-4) calc(var(--space-6) + env(safe-area-inset-bottom)); font-size: 15px; }
    .layout { grid-template-columns: minmax(0, 1fr); }
    .topbar { height: 48px; padding: 0 var(--space-3); }
    /* 触摸反馈（04 §4.8 移动端替代 hover）：按下微暗 */
    .icon-btn:active, .toc-fab:active, .back-to-top:active, .search-trigger:active { background: var(--color-bg-code); }
  }
  /* ===== C4 体验细节：专注模式 / 打印 / Powered by ===== */
  /* 阅读进度条（04 §4.5.3 兑现：顶栏下 2px teal 细线，展示层滚动驱动） */
  .reading-progress { position: fixed; top: 0; left: 0; height: 2px; width: 100%; z-index: 45; pointer-events: none; opacity: 0; transition: opacity var(--transition); }
  .reading-progress::after { content: ""; display: block; height: 100%; width: var(--progress, 0%); background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover)); border-radius: 0 2px 2px 0; transition: width 80ms linear; }
  .reading-progress.visible { opacity: 1; }
  /* 回到顶部（04 §4.5.4 兑现：滚动 2 屏后浮现，40px 圆形；移动端叠于 TOC FAB 上方） */
  .back-to-top { position: fixed; right: var(--space-4); bottom: var(--space-6); z-index: 39; width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--color-border); background: var(--color-bg-soft); color: var(--color-text-secondary); cursor: pointer; box-shadow: var(--shadow); display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(8px); pointer-events: none; transition: opacity var(--transition), transform var(--transition), color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
  .back-to-top svg { width: 18px; height: 18px; }
  .back-to-top.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
  .back-to-top:hover { color: var(--color-primary); border-color: var(--color-primary); background: var(--color-bg); }
  @media (max-width: 768px) { .back-to-top { bottom: calc(var(--space-6) + 56px); } }
  /* 专注模式：隐藏侧栏/TOC，内容加宽聚焦（展示层 toggle body.focus-mode） */
  body.focus-mode .sidebar, body.focus-mode .toc-rail, body.focus-mode .toc-fab, body.focus-mode .toc-sheet { display: none; }
  body.focus-mode .layout { grid-template-columns: minmax(0, 1fr); }
  body.focus-mode main { max-width: var(--max-width-focus, 840px); grid-column: 1; }
  body.focus-mode #focus-toggle { color: var(--color-primary); border-color: var(--color-primary); }
  /* Powered by：默认显示、一行可关闭（尊重自托管数据洁癖，13 §4） */
  .powered-by { display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-4); border-top: 1px solid var(--color-border-soft); color: var(--color-text-muted); font-size: var(--font-size-sm); }
  .powered-by a { color: var(--color-text-muted); text-decoration: none; border-bottom: 1px solid var(--color-border); }
  .powered-by a:hover { color: var(--color-primary); }
  .powered-by button { border: 0; background: transparent; color: var(--color-text-muted); cursor: pointer; padding: 2px 6px; border-radius: var(--radius-sm); }
  .powered-by button:hover { color: var(--color-error); }
  /* 打印（C4）：隐藏导航/控件，内容全宽纯文本 */
  @media print {
    .topbar, .sidebar, .toc-rail, .toc-fab, .toc-sheet, .powered-by, .reading-progress, .back-to-top { display: none !important; }
    .layout { display: block; }
    main { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
    .paper { box-shadow: none !important; border: 0 !important; }
    body { background: #fff !important; color: #000 !important; }
    article { font-size: 12pt; line-height: 1.6; }
    a { color: inherit; text-decoration: none; }
  }
</style>
${options.themeCss ? `<style data-doclight-theme>\n${options.themeCss}\n</style>` : ""}
${options.pluginCss ? `<style data-doclight-plugin-css>\n${options.pluginCss}\n</style>` : ""}
${options.extraHead ?? ""}
${slot("head:end")}
</head>
<body>
<a class="skip-link" href="#main-content">跳到正文</a>
<header class="topbar">
  ${slot("topbar:before")}
  <button id="sidebar-toggle" class="icon-btn" aria-label="菜单" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>
  <a class="brand" href="${base}/" aria-label="${escapeHtml(siteTitle)} 首页"><span class="brand-mark"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2c.5 3.9 1.6 5.2 4.4 6.2 1.2.4 1.2 2 0 2.4-2.8 1-3.9 2.3-4.4 6.2-.5-3.9-1.6-5.2-4.4-6.2-1.2-.4-1.2-2 0-2.4 2.8-1 3.9-2.3 4.4-6.2Z"/><path d="M19.5 13.8c.3 2 1.2 2.9 2.7 3.4.8.3.8 1.5 0 1.8-1.5.5-2.4 1.4-2.7 3.4-.3-2-1.2-2.9-2.7-3.4-.8-.3-.8-1.5 0-1.8 1.5-.5 2.4-1.4 2.7-3.4Z"/></svg></span><span class="site-title">${escapeHtml(siteTitle)}</span></a>
  <button id="search-toggle" class="search-trigger" aria-label="搜索（Ctrl+K）"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><span class="placeholder">搜索文档…</span><span class="kbd">Ctrl K</span></button>
  <button id="theme-toggle" class="icon-btn" aria-label="切换主题" title="切换主题"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg></button>
  <button id="focus-toggle" class="icon-btn" aria-label="专注模式" title="专注模式"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>
  ${slot("topbar:after")}
</header>
<div class="layout">
  <aside class="sidebar">${slot("sidebar:before")}${navHtml}${slot("sidebar:after")}</aside>
  <main class="paper" id="main-content">${breadcrumb}${slot("content:before")}<article>${contentHtml}</article>${slot("content:after")}</main>
  <aside class="toc-rail" aria-label="本页目录">${slot("toc:before")}<span class="toc-label">本页目录</span><div class="toc-dots"></div><nav class="toc-panel"></nav>${slot("toc:after")}</aside>
</div>
<button class="toc-fab" aria-label="目录"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
<div class="toc-sheet">
  <div class="toc-sheet-header">本页目录<button class="toc-sheet-close" aria-label="关闭目录">×</button></div>
  <nav class="toc-sheet-nav"></nav>
</div>
<!-- 阅读进度（04 §4.5.3）与回到顶部（04 §4.5.4）：展示层滚动驱动 -->
<div class="reading-progress" aria-hidden="true"></div>
<button class="back-to-top" aria-label="回到顶部" title="回到顶部"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
<!-- C4 Powered by：默认显示、可一行关闭（13 §4 传播机制） -->
<footer class="powered-by">${slot("footer")}Powered by <a href="https://doclight.tech" target="_blank" rel="noopener">DocLight</a><button id="powered-by-close" aria-label="隐藏 Powered by 标记">×</button></footer>
${overridesScript}
${sseScript}
${displayTag}
</body>
</html>`;
}
