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
 *
 * —— 设计对齐（2026-08-16）：本模板的视觉与交互 1:1 对齐
 * docs/design-new/index.html（Aster 设计演示），设计最高准则见
 * docs/design-new/DESIGN.md（项目设计第一文档/宪法）。令牌全部来自宪法 §3。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { render, parseFrontmatter, type NavGroup, type NavNode } from "@doclight/renderer";

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

/**
 * 收集文档 frontmatter 标题（导航标题修复，2026-08 前端审查 P1-2）：
 * buildNavTree 不传 titles 时侧边栏显示文件名主干而非 frontmatter.title——
 * dev / SSG / bundle 三形态统一经此收集；frontmatter 缺失回退文件名主干（与 renderer 一致）。
 */
export function collectNavTitles(docsDir: string, files: string[]): Record<string, string> {
  const titles: Record<string, string> = {};
  for (const rel of files) {
    try {
      const { frontmatter } = parseFrontmatter(readFileSync(join(docsDir, rel), "utf8"));
      if (typeof frontmatter.title === "string" && frontmatter.title.trim()) {
        titles[rel] = frontmatter.title.trim();
      }
    } catch {
      /* 不可读文件回退文件名主干（buildNavTree 缺省行为） */
    }
  }
  return titles;
}

/**
 * DP-003：收集每篇文档的更新时间（rel 路径 → ISO 字符串）——
 * 规则与页面 meta 一致：frontmatter.date/updated 优先，缺省文件 mtime。
 * 供侧边栏「最近更新」徽标（renderNav updatedAts）使用，三形态同一数据源。
 */
export function collectNavUpdated(docsDir: string, files: string[]): Record<string, string> {
  const updated: Record<string, string> = {};
  for (const rel of files) {
    try {
      const { frontmatter } = parseFrontmatter(readFileSync(join(docsDir, rel), "utf8"));
      const raw = frontmatter.date ?? frontmatter.updated;
      if (typeof raw === "string") {
        const t = Date.parse(raw);
        if (!Number.isNaN(t)) {
          updated[rel] = new Date(t).toISOString();
          continue;
        }
      }
      updated[rel] = statSync(join(docsDir, rel)).mtime.toISOString();
    } catch {
      /* 不可读文件跳过（无徽标） */
    }
  }
  return updated;
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
 * @param nav 可选导航树：为每篇文档计算所属分组（搜索结果的「节」标签，与演示页 ri-sec 对齐）
 */
export function buildSearchData(
  docsDir: string,
  mdFiles: string[],
  options: { pathSuffix?: string; nav?: NavNode[] } = {}
): { version: string; docs: unknown[]; summaries: Record<string, string> } {
  const suffix = options.pathSuffix ?? "";
  const docs: unknown[] = [];
  const summaries: Record<string, string> = {};
  const sectionOf = options.nav ? sectionForPath(options.nav) : undefined;
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
      const section = sectionOf?.(rel) ?? "";
      const plain = text.trim().replace(/\s+/g, " ");
      // 摘要键 = rel 路径（与导航树路径一致——next-grid/上一页下一页按 nav path 取摘要）
      summaries[rel] = plain.slice(0, 80);
      docs.push({ path, title, headings, text, ...(section ? { section } : {}) });
    } catch {
      /* 单个文档渲染失败跳过（索引不因此中断） */
    }
  }
  return { version: searchIndexVersion(docs), docs, summaries };
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
 * 导航树 → 路径 → 所属顶层分组标题（eyebrow / 搜索结果节标签用）。
 * 返回 (relPath) => string（"" 表示不在任何分组内）。
 */
export function sectionForPath(nodes: NavNode[]): (relPath: string) => string {
  const map = new Map<string, string>();
  const walk = (items: NavNode[], groupTitle: string | null) => {
    for (const n of items) {
      if (n.type === "file") {
        if (groupTitle) map.set(n.path, groupTitle);
      } else {
        walk(n.items, n.title);
      }
    }
  };
  walk(nodes, null);
  return (relPath: string) => map.get(relPath) ?? "";
}

/** 顶层分组列表（topnav 数据源）：返回 [{ title, firstPath? }] */
export function topGroups(nodes: NavNode[]): Array<{ title: string; firstPath?: string }> {
  const out: Array<{ title: string; firstPath?: string }> = [];
  const walk = (items: NavNode[]): string | undefined => {
    for (const n of items) {
      if (n.type === "file") return n.path;
      const first = walk(n.items);
      if (first) return first;
    }
    return undefined;
  };
  for (const n of nodes) {
    if (n.type === "group") out.push({ title: n.title, firstPath: walk(n.items) });
  }
  return out;
}

/**
 * 渲染导航树为侧边栏结构（设计对齐：side-group / side-title / side-item / side-sub；
 * 顶层一律 <li> 包裹保证 ul 合法语义）。
 * 服务端直出，SEO 友好（03 §3.1.3）；当前页激活态由展示层按 data-path 归一（三形态一致）。
 * DP-003：updatedAts（rel 路径 → ISO）提供时，最近 14 天更新的文档加「最近更新」徽标
 * （class 承载：side-recent + 点状子元素，纯 CSS 标记）。
 * @param hash bundle 形态（05 §5.3.4）：href 前缀 "#"（file:// 不能 pushState，用 hash 路由）
 */
export function renderNav(
  nodes: NavNode[],
  linkSuffix = "",
  base = "",
  hash = false,
  updatedAts?: Record<string, string>
): string {
  const hrefFor = (p: string) => (hash ? `#${navHref(p, linkSuffix, base)}` : navHref(p, linkSuffix, base));
  const RECENT_MS = 14 * 24 * 3600 * 1000; // 最近 14 天
  const isRecent = (p: string): boolean => {
    const iso = updatedAts?.[p];
    if (!iso) return false;
    const t = Date.parse(iso);
    return !Number.isNaN(t) && Date.now() - t < RECENT_MS;
  };
  const fileItem = (n: { path: string; title: string }): string => {
    const recent = isRecent(n.path)
      ? `<span class="side-recent" aria-label="最近更新"></span>`
      : "";
    return `<a class="side-item${recent ? " has-recent" : ""}" href="${hrefFor(n.path)}" data-path="${escapeHtml(n.path)}">${escapeHtml(n.title)}${recent}</a>`;
  };
  const item = (n: NavNode): string => {
    if (n.type === "file") return fileItem(n);
    // 分组：side-title（含 index 时首页条目内联为组内首个 side-item）
    const indexItem = n.index ? fileItem({ path: n.index, title: n.title }) : "";
    const children = n.items.map(item).join("");
    const sub = children ? `<div class="side-sub">${children}</div>` : "";
    return `<div class="side-group">${indexItem}<div class="side-title">${escapeHtml(n.title)}</div>${sub}</div>`;
  };
  return `<ul>${nodes.map((n) => `<li>${item(n)}</li>`).join("")}</ul>`;
}

/**
 * 面包屑链（05 §5.4.2 进阶 SEO）：首页 → 分组链 → 当前页。
 * 仅链接有 index 页的分组（避免死链）；无 index 的分组只作层级标签。
 * 根标签「文档」与演示页 crumb 对齐（2026-08-16 设计对齐）。
 * 纯函数（可测）：输入导航树 + 文档相对路径 → 面包屑数组。
 */
export function breadcrumbFor(
  nodes: NavNode[],
  relPath: string,
  linkSuffix: string,
  base: string,
  title: string
): Array<{ label: string; href: string }> {
  const crumbs: Array<{ label: string; href: string }> = [{ label: "文档", href: base ? `${base}/` : "/" }];
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
 * 2026-08-16 设计对齐：品牌色改为松绿 Pine（宪法 §3.1 --accent 家族）。
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
    return `<text x="80" y="${y}" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif" font-size="32" fill="#b9e8d3">${safe(l)}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#14714e"/>
  <rect width="1200" height="14" fill="#0e5a3d"/>
  <text x="80" y="120" font-family="ui-monospace,Menlo,monospace" font-size="36" letter-spacing="6" fill="#8fe3bd">DOCLIGHT</text>
  ${titleLines.join("\n")}
  ${descLines.join("\n")}
  <text x="80" y="588" font-family="system-ui,'PingFang SC',sans-serif" font-size="28" fill="#b9e8d3">${safe(options.siteTitle)}</text>
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
  /** 阅读时长（分钟，FRONT-001 analyzeDoc 自动计算；2026-08 精致化：文章头部可见元信息） */
  readingTime?: number;
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
  /** 服务端直出的导航（renderNav 产物） */
  navHtml: string;
  /** 渲染内核输出的已 sanitize 内容 HTML */
  contentHtml: string;
  /** SEO meta description（缺省省略该标签）；同时作为正文引言 lede（演示页对齐） */
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
  /** 设计对齐（2026-08-16）：导航树（顶栏 topnav / 上一页下一页 / 下一步卡片 / eyebrow 数据源） */
  nav?: NavNode[];
  /** 设计对齐：当前文档相对路径（docs/ 根起，如 guide/quickstart.md） */
  currentPath?: string;
  /** 设计对齐：页面摘要表（path → 摘要，next-grid 卡片描述用；缺省由 contentHtml 提取首段） */
  summaries?: Record<string, string>;
  /** 设计对齐：站点镀铬（顶栏版本按钮 / GitHub 图标 / footer 链接与状态） */
  chrome?: {
    /** 版本号（如 "2.4"）：提供时顶栏渲染版本按钮 */
    version?: string;
    /** GitHub 仓库 URL：提供时顶栏渲染 GitHub 图标 + TOC 卡「在 GitHub 上编辑此页」 */
    github?: string;
    /** footer 链接（服务条款/隐私政策等） */
    footerLinks?: Array<{ label: string; href: string }>;
    /** footer 状态文案（缺省「所有系统正常」+ 对勾） */
    statusText?: string;
  };
  /** DP-002：404 页标记——跳过 TOC 链接/反馈卡（无章节的空态页） */
  notFound?: boolean;
}

/**
 * 三形态全局覆盖脚本：
 * - dev/ssg：window.DOCLIGHT_SEARCH_VERSION（搜索索引缓存校验，内容哈希）
 * - ssg：vendor/search 端点指到静态产物（base 子路径部署时带前缀）+ __DOCLLIGHT_SSG__ 标记
 * - 全部非 bundle 形态：window.DOCLIGHT_BASE（子路径基址；展示层导航高亮/搜索链接据此归一，
 *   修复 --base 部署下高亮失效与搜索 404——2026-08 前端审查 H4）
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
  if (form !== "bundle") {
    lines.push(`window.DOCLIGHT_BASE = ${JSON.stringify(base)};`);
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

/** 面包屑可见 UI（05 §5.4.2：结构化数据 + 可见导航；设计对齐：演示页 crumb 形态） */
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
  return `<nav class="crumb" aria-label="面包屑"><ol>${items}</ol></nav>`;
}

/**
 * 从内容 HTML 提取 h2/h3 目录（服务端直出 TOC 链接，SEO 友好 + 无 JS 可用；
 * 展示层挂载后接管滚动监听与指示条，结构与演示页 toc-list 对齐）。
 */
export function extractToc(contentHtml: string): Array<{ id: string; text: string; level: number }> {
  const out: Array<{ id: string; text: string; level: number }> = [];
  for (const m of contentHtml.matchAll(/<h([23]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)) {
    const text = m[3]!.replace(/<[^>]+>/g, "").trim();
    if (text) out.push({ id: m[2]!, text, level: Number(m[1]!) });
  }
  return out;
}

/** 导航树 → 有序文件列表（上一页/下一页数据源；分组 index 在前，与 renderNav 顺序一致） */
export function flattenNav(nodes: NavNode[]): string[] {
  const out: string[] = [];
  const walk = (items: NavNode[]) => {
    for (const n of items) {
      if (n.type === "file") out.push(n.path);
      else walk(n.items);
    }
  };
  walk(nodes);
  return out;
}

/** 上一页/下一页（导航顺序中的前一篇/后一篇文档；无则缺省） */
export function pagerFor(
  nav: NavNode[],
  relPath: string,
  linkSuffix: string,
  base: string,
  hash: boolean,
  titles: Record<string, string>
): { prev?: { href: string; title: string }; next?: { href: string; title: string } } {
  const flat = flattenNav(nav);
  const idx = flat.indexOf(relPath);
  const titleOf = (p: string) => titles[p] ?? p.replace(/\.md$/, "").split("/").pop()!;
  return {
    ...(idx > 0 ? { prev: { href: hash ? `#${navHref(flat[idx - 1]!, linkSuffix, base)}` : navHref(flat[idx - 1]!, linkSuffix, base), title: titleOf(flat[idx - 1]!) } } : {}),
    ...(idx >= 0 && idx < flat.length - 1 ? { next: { href: hash ? `#${navHref(flat[idx + 1]!, linkSuffix, base)}` : navHref(flat[idx + 1]!, linkSuffix, base), title: titleOf(flat[idx + 1]!) } } : {}),
  };
}

/** 子树是否包含指定文档路径 */
function containsPath(items: NavNode[], relPath: string): boolean {
  for (const n of items) {
    if (n.type === "file") {
      if (n.path === relPath) return true;
    } else if (containsPath(n.items, relPath)) {
      return true;
    }
  }
  return false;
}

/**
 * 「下一步」卡片（设计对齐：演示页 next-grid）——取当前页所属顶层分组的
 * 后续分组首页（≤4 张，与演示「核心概念/指南/API 参考/示例」语义一致）。
 */
export function nextCardsFor(
  nav: NavNode[],
  relPath: string,
  linkSuffix: string,
  base: string,
  hash: boolean,
  titles: Record<string, string>,
  summaries: Record<string, string> = {}
): Array<{ label: string; title: string; href: string; desc: string }> {
  const firstFile = (items: NavNode[]): NavNode | null => {
    for (const n of items) {
      if (n.type === "file") return n;
      const f = firstFile(n.items);
      if (f) return f;
    }
    return null;
  };
  // 当前页所在顶层分组下标（不在任何分组内 → -1）
  let currentGroupIdx = -1;
  for (let i = 0; i < nav.length; i++) {
    const n = nav[i]!;
    if (n.type !== "group") continue;
    if (containsPath(n.items, relPath)) {
      currentGroupIdx = i;
      break;
    }
  }
  const cards: Array<{ label: string; title: string; href: string; desc: string }> = [];
  if (currentGroupIdx < 0) {
    // 扁平站点：取后续兄弟文档（≤4）
    const flat = flattenNav(nav);
    const idx = flat.indexOf(relPath);
    const titleOf = (p: string) => titles[p] ?? p.replace(/\.md$/, "").split("/").pop()!;
    for (const p of flat.slice(idx + 1, idx + 5)) {
      cards.push({ label: "", title: titleOf(p), href: hash ? `#${navHref(p, linkSuffix, base)}` : navHref(p, linkSuffix, base), desc: summaries[p] ?? "" });
    }
    return cards;
  }
  for (const n of nav.slice(currentGroupIdx + 1)) {
    if (n.type !== "group") continue;
    const f = firstFile(n.items);
    if (!f) continue;
    cards.push({
      label: n.title,
      title: titles[f.path] ?? f.path.replace(/\.md$/, "").split("/").pop()!,
      href: hash ? `#${navHref(f.path, linkSuffix, base)}` : navHref(f.path, linkSuffix, base),
      desc: summaries[f.path] ?? "",
    });
    if (cards.length >= 4) break;
  }
  return cards;
}

/**
 * 默认主题设计令牌与组件样式（THEME-001 + 设计对齐 2026-08-16）。
 *
 * 视觉与交互 1:1 对齐 docs/design-new/index.html（Aster 设计演示）；
 * 设计最高准则 docs/design-new/DESIGN.md（项目设计第一文档）：
 * - 排版即界面：层级由字重/字号/字距/留白构建
 * - 唯一强调色松绿 Pine（#14714e 亮 / #63d2a0 暗），只出现在功能位
 * - 发丝线分隔、8pt 网格、圆角仅 8/10px、动效克制（≤300ms 反馈）
 * - 暗色模式独立设计（暖黑 #111110，禁止 #000）
 * - 对比度：正文 ≥7 AAA / 辅助 ≥4.5 AA / 强调色文字 ≥4.5（--text-3 按 AA 提级）
 * 独立导出：设计合规门禁（design-compliance）对默认主题同样断言（vitest + visual.mjs 双保险）。
 */
export const DEFAULT_THEME_CSS = `  :root {
    color-scheme: light;
    /* ===== 中性色：暖调，避免纯黑纯白（宪法 §3.1） ===== */
    --bg:            #ffffff;
    --bg-subtle:     #fafaf8;
    --surface:       #f5f5f2;
    --text:          #1b1b18;
    --text-2:        #57554e;
    --text-3:        #6e6b62;  /* 按宪法 AA 提级（演示 #8b887f 仅 3.56:1） */
    --line:          rgba(27,27,24,.08);
    --line-strong:   rgba(27,27,24,.16);
    /* ===== 唯一强调色：松绿 Pine（宪法 §3.1；职务 = 链接/激活/焦点/关键状态） ===== */
    --accent:        #14714e;
    --accent-hover:  #0e5a3d;
    --accent-soft:   rgba(20,113,78,.07);
    --accent-ink:    #14714e;
    /* ===== 语义色（宪法 §3.1：仅三枚，只用于状态指示，不用于大面积填充） ===== */
    --success:       #3d9e4f;
    --warning:       #b45309;
    --error:         #b3261e;
    /* ===== 代码 ===== */
    --code-bg:       #f7f7f4;
    --code-line:     rgba(27,27,24,.09);
    --syn-k:  #7c3aed;  /* keyword  */
    --syn-s:  #0e7490;  /* string   */
    --syn-c:  #8a877c;  /* comment（按 AA 提级，演示 #9b988d 仅 2.5:1） */
    --syn-n:  #b45309;  /* number   */
    --syn-f:  #14714e;  /* function（= 强调色，宪法 §3.1 联动） */
    --syn-p:  #57554e;  /* plain    */
    /* ===== 浮层 / 圆角 ===== */
    --topbar-bg: rgba(255,255,255,.82);
    --shadow-pop: 0 12px 40px -12px rgba(27,27,24,.18), 0 2px 8px -2px rgba(27,27,24,.08);
    --radius: 10px;
    --radius-sm: 8px;
    /* ===== 字体（宪法 §3.2；Inter 拉丁 / 系统中文 / JetBrains Mono 代码 / Source Serif 引言） ===== */
    --font-sans: "Inter", -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    --font-serif: "Source Serif 4", Georgia, "Songti SC", "STSong", "SimSun", serif;
    --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
    /* ===== 类型阶（宪法 §3.2 唯一批准档位） ===== */
    --font-size-xs: 0.75rem;    /* 12px  标签/辅助 */
    --font-size-sm: 0.8125rem;  /* 13px  次级 */
    --font-size-base: 0.969rem; /* 15.5px 正文 */
    --font-size-lg: 1.125rem;   /* 18px  引言 */
    --font-size-xl: 1.3125rem;  /* 21px  H2 */
    --font-size-2xl: 1.625rem;  /* 26px  备用档 */
    --font-size-3xl: 2.125rem;  /* 34px  H1 */
    /* ===== 间距（宪法 §3.3：8pt 网格，只许 4 的倍数） ===== */
    --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
    --space-5: 20px; --space-6: 24px; --space-7: 28px; --space-8: 32px;
    --space-9: 36px; --space-10: 40px; --space-11: 44px; --space-12: 48px;
    --space-14: 56px; --space-16: 64px; --space-24: 96px;
    /* ===== 动效（宪法 §3.4：唯一缓动；反馈 ≤300ms） ===== */
    --ease: cubic-bezier(.22,.68,.2,1);
    --dur-fast: .15s;
    --dur: .25s;
    --dur-slow: .6s;
    /* ===== 布局 ===== */
    --topbar-height: 60px;
    --sidebar-width: 264px;
    --toc-width: 224px;
    --content-max: 700px;
  }
  [data-theme="dark"] {
    /* 暗色是独立设计，不是反色（宪法 §3.1：暖黑，禁止 #000） */
    color-scheme: dark;
    --bg:            #111110;
    --bg-subtle:     #161614;
    --surface:       #1c1c19;
    --text:          #ebeae5;
    --text-2:        #a5a29a;
    --text-3:        #9a968c;  /* 按宪法 AA 提级 */
    --line:          rgba(235,234,229,.09);
    --line-strong:   rgba(235,234,229,.18);
    --accent:        #63d2a0;
    --accent-hover:  #85e0b8;
    --accent-soft:   rgba(99,210,160,.10);
    --accent-ink:    #63d2a0;
    --success:       #4cc36c;
    --warning:       #f59e0b;
    --error:         #f87171;
    --code-bg:       #151513;
    --code-line:     rgba(235,234,229,.10);
    --syn-k:  #d699b6;
    --syn-s:  #a7c080;
    --syn-c:  #7a8478;
    --syn-n:  #e69875;
    --syn-f:  #83c092;
    --syn-p:  #a5a29a;
    --topbar-bg: rgba(17,17,16,.8);
    --shadow-pop: 0 16px 48px -12px rgba(0,0,0,.6), 0 2px 8px -2px rgba(0,0,0,.4);
  }

  /* ===== Reset & Base（设计对齐：演示页 §Reset & Base） ===== */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-padding-top: 88px; }
  body {
    font-family: var(--font-sans);
    font-feature-settings: "cv11", "ss01", "ss03";
    background: var(--bg);
    color: var(--text);
    font-size: var(--font-size-base);
    line-height: 1.75;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    transition: background .35s ease, color .35s ease;
  }
  ::selection { background: var(--accent); color: #fff; }
  a { color: var(--accent-ink); text-decoration: none; }
  a:hover { text-decoration: underline; text-underline-offset: 3px; }
  button { font-family: inherit; cursor: pointer; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 6px; border: 3px solid transparent; background-clip: content-box; }
  ::-webkit-scrollbar-track { background: transparent; }
  .mono { font-family: var(--font-mono); }
  kbd {
    font-family: var(--font-mono);
    font-size: .78em; padding: 2px 6px;
    background: var(--surface); border: 1px solid var(--line-strong);
    border-bottom-width: 2px; border-radius: 5px; color: var(--text-2);
  }

  /* ===== 顶部阅读进度条（设计对齐：2px 存在但不喧哗） ===== */
  #progress {
    position: fixed; top: 0; left: 0; height: 2px; width: 0%;
    background: var(--accent); z-index: 100;
    transition: width .1s linear;
  }
  /* DP-002 签名时刻候选：读完脉冲——进度条右端光点呼吸一次（≤300ms） */
  #progress.complete { animation: progress-done .3s var(--ease); }
  @keyframes progress-done {
    0% { box-shadow: 0 0 0 0 transparent; }
    40% { box-shadow: 0 0 10px 1px var(--accent-soft), 0 0 0 1px var(--accent); }
    100% { box-shadow: 0 0 0 0 transparent; }
  }

  /* ===== Topbar ===== */
  .topbar {
    position: fixed; top: 0; left: 0; right: 0; height: var(--topbar-height); z-index: 50;
    display: flex; align-items: center; gap: 24px;
    padding: 0 24px;
    background: var(--topbar-bg);
    backdrop-filter: saturate(1.6) blur(14px);
    -webkit-backdrop-filter: saturate(1.6) blur(14px);
    border-bottom: 1px solid transparent;
    transition: border-color .3s ease, background .35s ease;
  }
  .topbar.scrolled { border-bottom-color: var(--line); }
  .brand { display: flex; align-items: center; gap: 10px; color: var(--text); font-weight: 600; font-size: 15px; letter-spacing: -.01em; }
  .brand:hover { text-decoration: none; }
  .brand .logo {
    width: 26px; height: 26px; border-radius: 7px;
    background: var(--text); color: var(--bg);
    display: grid; place-items: center; flex: none;
    transition: background .35s ease, color .35s ease;
  }
  .brand .tag {
    font-size: 11.5px; font-weight: 500; color: var(--text-3);
    border: 1px solid var(--line-strong); border-radius: 99px;
    padding: 1px 8px; margin-left: 2px;
  }
  .topnav { display: flex; gap: 4px; margin-left: 8px; }
  .topnav a {
    color: var(--text-2); font-size: 13.5px; font-weight: 500;
    padding: 6px 11px; border-radius: 7px;
  }
  .topnav a:hover { color: var(--text); background: var(--surface); text-decoration: none; }
  .topnav a.active { color: var(--text); background: var(--surface); }
  .topbar .spacer { flex: 1; }
  .search-btn {
    display: flex; align-items: center; gap: 10px;
    background: var(--surface); border: 1px solid var(--line);
    color: var(--text-3); font-size: 13px;
    padding: 6px 10px 6px 12px; border-radius: 8px;
    min-width: 220px; transition: border-color .2s, color .2s;
  }
  .search-btn:hover { border-color: var(--line-strong); color: var(--text-2); }
  .search-btn kbd { margin-left: auto; border-bottom-width: 1px; padding: 1px 5px; font-size: 11px; }
  .icon-btn {
    width: 34px; height: 34px; border-radius: 8px; flex: none;
    display: grid; place-items: center;
    background: transparent; border: 1px solid transparent;
    color: var(--text-2); transition: background .2s, color .2s;
  }
  .icon-btn:hover { background: var(--surface); color: var(--text); }
  .version-btn {
    display: flex; align-items: center; gap: 5px;
    font-size: 13px; font-weight: 500; color: var(--text-2);
    background: transparent; border: 1px solid var(--line);
    padding: 6px 10px; border-radius: 8px;
  }
  .version-btn:hover { border-color: var(--line-strong); color: var(--text); }
  .version-btn .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); }

  /* ===== Layout：三栏 —— 导航 / 内容 / 页内目录（设计对齐） ===== */
  .layout {
    display: grid;
    grid-template-columns: var(--sidebar-width) minmax(0, 1fr) var(--toc-width);
    max-width: 1440px; margin: 0 auto;
    padding-top: var(--topbar-height);
  }

  /* ---------- 左侧导航 ---------- */
  .sidebar {
    position: sticky; top: var(--topbar-height); height: calc(100vh - var(--topbar-height));
    overflow-y: auto; padding: 28px 20px 48px 24px;
    border-right: 1px solid var(--line);
  }
  .sidebar ul { list-style: none; margin: 0; padding: 0; }
  .sidebar nav > ul > li { margin: 0; }
  .side-group { margin-bottom: 24px; }
  .side-title {
    font-size: 11px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: var(--text-3);
    padding: 0 10px; margin-bottom: 6px;
  }
  .side-item {
    display: flex; align-items: center; gap: 8px;
    font-size: 13.5px; color: var(--text-2);
    padding: 8px 10px; border-radius: 7px;
    position: relative; transition: color .15s, background .15s;
  }
  .side-item:hover { color: var(--text); background: var(--surface); text-decoration: none; }
  .side-item.active { color: var(--accent-ink); background: var(--accent-soft); font-weight: 500; }
  .side-item.active::before {
    content: ""; position: absolute; left: -21px; top: 8px; bottom: 8px;
    width: 2px; border-radius: 2px; background: var(--accent);
  }
  .side-sub { margin: 2px 0 2px 13px; padding-left: 12px; border-left: 1px solid var(--line); }
  .side-sub .side-item { font-size: 13px; padding: 8px 10px; }

  /* ---------- 正文 ---------- */
  .content {
    min-width: 0; padding: 40px 56px 96px;
    animation: rise .6s var(--ease) .06s both;
  }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .article { max-width: var(--content-max); }
  .crumb {
    display: flex; align-items: center; gap: 7px;
    font-size: 12.5px; color: var(--text-3); margin-bottom: 18px;
  }
  .crumb ol { list-style: none; display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin: 0; padding: 0; }
  .crumb a { color: var(--text-3); }
  .crumb a:hover { color: var(--text-2); }
  .crumb li { display: inline-flex; align-items: center; gap: 7px; }
  .crumb li + li::before { content: "/"; opacity: .5; }
  .crumb [aria-current="page"] { color: var(--text-2); }
  .eyebrow {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
    color: var(--accent-ink); margin-bottom: 10px;
  }
  .eyebrow::before { content: ""; width: 16px; height: 1.5px; background: var(--accent); border-radius: 2px; }
  article h1 {
    font-size: 34px; font-weight: 700; letter-spacing: -.025em;
    line-height: 1.2; margin-bottom: 12px; color: var(--text);
  }
  .lede { font-size: 17px; line-height: 1.7; color: var(--text-2); margin-bottom: 16px; text-wrap: pretty; }
  .meta {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    font-size: 12.5px; color: var(--text-3);
    padding-bottom: 26px; margin-bottom: 32px;
    border-bottom: 1px solid var(--line);
  }
  .meta .sep { width: 3px; height: 3px; border-radius: 50%; background: var(--text-3); opacity: .6; }
  article h2 {
    font-size: 21px; font-weight: 650; letter-spacing: -.015em;
    margin: 44px 0 14px; padding-top: 8px;
    display: flex; align-items: center; gap: 8px;
  }
  article h3 { font-size: 16px; font-weight: 600; margin: 30px 0 10px; letter-spacing: -.01em; }
  .anchor {
    opacity: 0; color: var(--text-3); font-weight: 400; font-size: .85em;
    transition: opacity .2s, color .2s;
  }
  h2:hover .anchor, h3:hover .anchor { opacity: 1; }
  .anchor:hover { color: var(--accent-ink); text-decoration: none; }
  article p { margin-bottom: 16px; color: var(--text); text-wrap: pretty; }
  p code, li code, td code {
    font-family: var(--font-mono);
    font-size: .84em; background: var(--surface);
    border: 1px solid var(--line); border-radius: 5px;
    padding: 1.5px 5.5px; color: var(--text); white-space: nowrap;
  }
  article strong { font-weight: 600; }
  article ul, article ol { margin: 0 0 16px 22px; }
  article li { margin-bottom: 6px; }
  article li::marker { color: var(--text-3); }
  article blockquote {
    margin: 20px 0 24px; padding: 12px 16px;
    border-left: 2.5px solid var(--line-strong);
    color: var(--text-2); font-size: 14px; line-height: 1.7;
  }
  article blockquote > :first-child { margin-top: 0; }
  article blockquote > :last-child { margin-bottom: 0; }
  article hr { border: none; height: 1px; margin: 32px 0; background: var(--line); }
  article img { max-width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--line); }
  article del { color: var(--text-3); }
  /* 任务列表（GFM）：去掉默认标记，checkbox 用强调色 */
  article ul:has(> li > input[type="checkbox"]), article ol:has(> li > input[type="checkbox"]) { list-style: none; padding-left: 0.4em; }
  article li:has(> input[type="checkbox"]) { display: flex; align-items: baseline; gap: 8px; }
  article input[type="checkbox"] { accent-color: var(--accent); width: 15px; height: 15px; flex-shrink: 0; margin: 0; transform: translateY(2px); }

  /* ---------- 提示块（宪法 §4.4：左侧 2.5px 竖线 + 极浅同色系底色，不加彩色徽章） ---------- */
  .doclight-container {
    display: flex; gap: 12px;
    padding: 14px 16px; margin: 22px 0;
    border: 1px solid var(--line); border-left: 2.5px solid var(--accent);
    border-radius: 0 var(--radius) var(--radius) 0;
    background: var(--accent-soft);
    font-size: 14px; line-height: 1.7;
  }
  .doclight-container > :not(.icon) { min-width: 0; flex: 1; }
  .doclight-container .icon { flex: none; margin-top: 2px; color: var(--accent-ink); display: inline-flex; }
  .doclight-container p { margin: 0; font-size: 14px; color: var(--text-2); }
  .doclight-container > :first-child { margin-top: 0; }
  .doclight-container > :last-child { margin-bottom: 0; }
  .doclight-container strong { color: var(--text); }
  .doclight-tip { border-left-color: var(--success); background: rgba(61,158,79,.06); }
  .doclight-warning { border-left-color: var(--warning); background: rgba(180,83,9,.06); }
  .doclight-danger { border-left-color: var(--error); background: rgba(179,38,30,.06); }
  [data-theme="dark"] .doclight-tip { background: rgba(76,195,108,.08); }
  [data-theme="dark"] .doclight-warning { background: rgba(245,158,11,.08); }
  [data-theme="dark"] .doclight-danger { background: rgba(248,113,113,.08); }

  /* ---------- 代码块（设计对齐：头部条 = 文件名 + 语言 + 复制按钮） ---------- */
  .codeblock {
    margin: 20px 0 24px;
    border: 1px solid var(--code-line); border-radius: var(--radius);
    background: var(--code-bg); overflow: hidden;
  }
  .codeblock .code-head {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px 8px 14px;
    border-bottom: 1px solid var(--code-line);
    font-size: 12px; color: var(--text-3);
  }
  .codeblock .fname { font-family: var(--font-mono); font-weight: 500; color: var(--text-2); }
  .codeblock .lang { margin-left: auto; text-transform: uppercase; font-size: 10.5px; letter-spacing: .08em; }
  .copy-btn {
    display: flex; align-items: center; gap: 5px;
    background: transparent; border: none; color: var(--text-3);
    font-size: 11.5px; padding: 3px 6px; border-radius: 5px;
    transition: color .2s, background .2s;
  }
  .copy-btn:hover { color: var(--text); background: var(--surface); }
  .codeblock pre {
    padding: 16px 18px; overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 13px; line-height: 1.75; color: var(--text);
  }
  .codeblock pre.doclight-code { background: transparent; border: none; margin: 0; }
  /* 语法高亮令牌（宪法 §3.1：函数色 = 强调色；每主题一调色板 ≤6 色） */
  .tok-k, .token.keyword, .token.rule, .token.important { color: var(--syn-k); }
  .tok-s, .token.string, .token.char, .token.attr-value, .token.regex { color: var(--syn-s); }
  .tok-c, .token.comment, .token.prolog, .token.doctype, .token.cdata { color: var(--syn-c); font-style: italic; }
  .tok-n, .token.number, .token.boolean, .token.constant { color: var(--syn-n); }
  .tok-f, .token.function, .token.method { color: var(--syn-f); }
  .tok-p, .token.punctuation, .token.operator, .token.property, .token.variable, .token.builtin { color: var(--syn-p); }

  /* ---------- Tabs（跨组联动，设计对齐） ---------- */
  .tabs { margin: 20px 0 24px; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
  .tab-bar {
    display: flex; gap: 2px; padding: 5px;
    background: var(--bg-subtle); border-bottom: 1px solid var(--line);
  }
  .tab-btn {
    border: none; background: transparent; color: var(--text-2);
    font-size: 12.5px; font-weight: 500; font-family: var(--font-mono);
    padding: 5px 14px; border-radius: 6px; transition: all .18s;
  }
  .tab-btn:hover { color: var(--text); }
  .tab-btn.active { background: var(--bg); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 0 0 1px var(--line); }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }
  .tab-panel .codeblock { margin: 0; border: none; border-radius: 0; }
  .tab-panel .codeblock pre { padding: 14px 18px; }

  /* ---------- 步骤组件（设计对齐） ---------- */
  .steps { list-style: none; margin: 24px 0; counter-reset: step; }
  .steps li {
    counter-increment: step; position: relative;
    padding: 0 0 28px 44px; margin: 0;
  }
  .steps li::before {
    content: counter(step);
    position: absolute; left: 0; top: 1px;
    width: 26px; height: 26px; border-radius: 50%;
    background: var(--bg); border: 1px solid var(--line-strong);
    color: var(--text-2); font-size: 12.5px; font-weight: 600;
    display: grid; place-items: center;
  }
  .steps li::after {
    content: ""; position: absolute; left: 13px; top: 32px; bottom: 4px;
    width: 1px; background: var(--line-strong);
  }
  .steps li:last-child::after { display: none; }
  .steps li:last-child { padding-bottom: 4px; }
  .steps .step-title { font-weight: 600; font-size: 14.5px; margin-bottom: 4px; display: block; }
  .steps p { font-size: 14px; color: var(--text-2); margin: 0; }

  /* ---------- 表格：发丝线（宪法 §4.3：只有横线，没有竖线） ---------- */
  .table-wrap { margin: 20px 0 26px; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; font-variant-numeric: tabular-nums; }
  th {
    text-align: left; font-size: 11.5px; font-weight: 600;
    letter-spacing: .06em; text-transform: uppercase; color: var(--text-3);
    padding: 10px 16px; background: var(--bg-subtle);
    border-bottom: 1px solid var(--line);
  }
  td { padding: 11px 16px; border-bottom: 1px solid var(--line); color: var(--text-2); vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  td:first-child { font-family: var(--font-mono); font-size: 12.5px; color: var(--text); white-space: nowrap; }
  tbody tr { transition: background .15s; }
  tbody tr:hover { background: var(--bg-subtle); }
  .table-wrap.more-right { box-shadow: inset -16px 0 16px -16px rgba(0,0,0,.14); }

  /* ---------- 下一步卡片（设计对齐） ---------- */
  .next-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 22px 0 8px;
  }
  .next-card {
    display: block; padding: 16px 20px;
    border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--text); transition: border-color .2s, transform .2s, box-shadow .2s;
  }
  .next-card:hover { text-decoration: none; border-color: var(--line-strong); transform: translateY(-1px); box-shadow: 0 4px 16px -6px rgba(0,0,0,.1); }
  .next-card .nc-label { font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--text-3); margin-bottom: 6px; }
  .next-card .nc-title { font-size: 14.5px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .next-card .nc-title svg { color: var(--text-3); transition: transform .2s, color .2s; }
  .next-card:hover .nc-title svg { transform: translateX(3px); color: var(--accent-ink); }
  .next-card .nc-desc { font-size: 13px; color: var(--text-2); margin-top: 4px; line-height: 1.6; }

  /* ---------- 上一页 / 下一页（设计对齐） ---------- */
  .pager {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    margin-top: 56px; padding-top: 28px; border-top: 1px solid var(--line);
  }
  .pager a {
    padding: 16px 20px; border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--text); transition: border-color .2s;
  }
  .pager a:hover { text-decoration: none; border-color: var(--accent); }
  .pager .dir { font-size: 11.5px; color: var(--text-3); letter-spacing: .05em; text-transform: uppercase; font-weight: 600; margin-bottom: 3px; }
  .pager .pg-title { font-size: 14px; font-weight: 600; }
  .pager .next { text-align: right; }

  /* ---------- 右侧页内目录（设计对齐：指示条 + 链接 + 反馈卡） ---------- */
  .toc {
    position: sticky; top: var(--topbar-height); height: calc(100vh - var(--topbar-height));
    overflow-y: auto; padding: 40px 24px 48px 8px;
    border-left: 1px solid var(--line);
  }
  .toc-title {
    font-size: 11px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 10px; padding-left: 12px;
  }
  .toc-list { position: relative; }
  .toc-indicator {
    position: absolute; left: 0; top: 0; width: 2px; height: 20px;
    background: var(--accent); border-radius: 2px;
    transition: transform .25s cubic-bezier(.4,0,.2,1), opacity .25s;
    opacity: 0;
  }
  .toc a {
    display: block; font-size: 12.5px; color: var(--text-3);
    padding: 4px 0 4px 12px; line-height: 1.5;
    transition: color .18s;
  }
  .toc a:hover { color: var(--text); text-decoration: none; }
  .toc a.active { color: var(--accent-ink); font-weight: 500; }
  .toc a.l3 { padding-left: 24px; font-size: 12px; }
  /* DP-003：已读章节安静提级（--text-3 → --text-2，不加粗不变色） */
  .toc a.read:not(.active) { color: var(--text-2); }
  .toc-card {
    margin-top: 28px; padding: 14px 16px;
    border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--bg-subtle);
  }
  .toc-card .q { font-size: 12.5px; font-weight: 600; margin-bottom: 10px; }
  .toc-card .row { display: flex; gap: 8px; }
  .toc-card button {
    flex: 1; font-size: 12px; font-weight: 500; color: var(--text-2);
    background: var(--bg); border: 1px solid var(--line); border-radius: 7px;
    padding: 5px 0; transition: all .18s;
  }
  .toc-card button:hover { border-color: var(--accent); color: var(--accent-ink); }
  .toc-card .edit { display: block; margin-top: 12px; font-size: 12px; color: var(--text-3); }
  .toc-card .edit:hover { color: var(--accent-ink); }

  /* ---------- Footer ---------- */
  .footer {
    border-top: 1px solid var(--line);
    padding: 28px 24px;
  }
  .footer-inner {
    max-width: 1440px; margin: 0 auto;
    display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
    font-size: 12.5px; color: var(--text-3);
  }
  .footer a { color: var(--text-3); }
  .footer a:hover { color: var(--text-2); }
  .status { display: flex; align-items: center; gap: 7px; margin-left: auto; }
  .status svg { color: var(--success); flex: none; }
  .powered-by { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-3); }
  .powered-by a { color: var(--text-3); }
  .powered-by a:hover { color: var(--text-2); }
  .powered-by button { border: 0; background: transparent; color: var(--text-3); cursor: pointer; padding: 2px 6px; border-radius: 5px; }
  .powered-by button:hover { color: var(--error); }

  /* ---------- 搜索弹层（设计对齐） ---------- */
  .modal-mask {
    position: fixed; inset: 0; z-index: 90;
    background: rgba(15,15,14,.4);
    backdrop-filter: blur(3px);
    display: none; align-items: flex-start; justify-content: center;
    padding-top: 14vh;
  }
  .modal-mask.open { display: flex; animation: fadeIn .15s ease; }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  .modal {
    width: min(560px, 92vw);
    background: var(--bg); border: 1px solid var(--line-strong);
    border-radius: var(--radius); box-shadow: var(--shadow-pop);
    overflow: hidden;
    animation: pop .18s cubic-bezier(.2,.8,.3,1.1);
  }
  @keyframes pop { from { opacity: 0; transform: scale(.97) translateY(-6px); } to { opacity: 1; transform: none; } }
  .modal .search-row {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 16px; border-bottom: 1px solid var(--line);
  }
  .modal input {
    flex: 1; border: none; background: transparent; outline: none;
    font-size: 15px; color: var(--text); font-family: inherit;
  }
  .modal input::placeholder { color: var(--text-3); }
  .modal .esc { font-size: 10.5px; }
  .modal .results { max-height: 320px; overflow-y: auto; padding: 8px; }
  .result-item {
    display: flex; align-items: center; gap: 12px;
    padding: 9px 12px; border-radius: 8px; cursor: pointer;
  }
  .result-item.sel { background: var(--accent-soft); }
  .result-item .ri-icon { color: var(--text-3); flex: none; }
  .result-item.sel .ri-icon { color: var(--accent-ink); }
  .result-item .ri-title { font-size: 13.5px; font-weight: 500; color: var(--text); }
  .result-item .ri-sec { font-size: 11.5px; color: var(--text-3); margin-left: auto; }
  .modal .modal-foot {
    display: flex; gap: 16px; padding: 10px 16px;
    border-top: 1px solid var(--line);
    font-size: 11px; color: var(--text-3);
  }
  .modal .modal-foot span { display: flex; align-items: center; gap: 5px; }

  /* ---------- 图解（宪法 §4.5：inline SVG，复用全部 design token） ---------- */
  figure.diagram {
    margin: 24px 0 28px; padding: 26px 20px 14px;
    border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--bg-subtle); overflow-x: auto;
  }
  figure.diagram figcaption {
    font-size: 12px; color: var(--text-3); text-align: center; margin-top: 12px;
    font-variant-numeric: tabular-nums;
  }
  .diagram svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
  .d-box { fill: var(--bg); stroke: var(--line-strong); stroke-width: 1; }
  .d-box-accent { fill: var(--accent-soft); stroke: var(--accent); }
  .d-node-title { font-size: 12.5px; font-weight: 500; fill: var(--text); }
  .d-node-sub { font-family: var(--font-mono); font-size: 9.5px; fill: var(--text-3); letter-spacing: .04em; }
  .d-node-sub-accent { fill: var(--accent-ink); }
  .d-edge { stroke: var(--text-3); stroke-width: 1.2; fill: none; }
  .d-edge-dash { stroke-dasharray: 4 4; }
  .d-arrow { fill: var(--text-3); }
  .d-edge-label { font-size: 10px; fill: var(--text-3); font-family: var(--font-mono); }
  /* Mermaid（PLUG-012）：样式由 @doclight/plugin-mermaid 的 styles 声明提供
     （按需注入，令牌化对齐新设计语言——见 plugins-official/mermaid.ts） */

  /* ---------- KaTeX（REND-002 扩展） ---------- */
  .doclight-katex-block { overflow-x: auto; overflow-y: hidden; padding: 4px 0; margin: 0 0 16px; }
  .doclight-katex-inline { padding: 0 2px; }

  /* ---------- 跳转至主内容（键盘可达性，宪法 §6） ---------- */
  .skip {
    position: fixed; top: 10px; left: 10px; z-index: 200;
    background: var(--text); color: var(--bg);
    font-size: 12.5px; font-weight: 500; padding: 7px 14px; border-radius: 8px;
    transform: translateY(-300%); transition: transform .2s var(--ease);
  }
  .skip:focus { transform: none; text-decoration: none; }

  /* ---------- 第二层优化：工艺细节（设计对齐：编辑级排版 + 入场编排 + 锚点闪烁） ---------- */
  .lede {
    font-family: var(--font-serif);
    font-size: 18px; line-height: 1.8; letter-spacing: 0;
  }
  h1, h2, .lede { text-wrap: balance; }
  article p { hanging-punctuation: first allow-end; }
  table, .meta, .toc-card { font-variant-numeric: tabular-nums; }
  .sidebar { animation: rise .5s var(--ease) both; }
  .toc { animation: rise .5s var(--ease) .12s both; }
  @keyframes flash { 0% { background: var(--accent-soft); box-shadow: 0 0 0 6px var(--accent-soft); } 100% { background: transparent; box-shadow: 0 0 0 6px transparent; } }
  h2.flash { animation: flash 1.5s var(--ease); border-radius: 6px; }

  /* ---------- DP-002 首页 hero（排版化：留白节奏与内页分离，零插画零渐变） ---------- */
  article.home { padding-top: 8px; }
  article.home .crumb { display: none; }
  article.home h1 { margin-bottom: 16px; }
  article.home .lede { font-size: 19px; line-height: 1.85; margin-bottom: 20px; }
  article.home .meta { margin-bottom: 36px; }
  article.home h2:first-of-type { margin-top: 8px; }

  /* ---------- DP-003 阅读状态感 ---------- */
  /* 继续阅读提示：左下安静 pill（发丝边框 + 浮层阴影，不遮挡内容） */
  .resume-pill {
    position: fixed; left: 24px; bottom: 24px; z-index: 45;
    display: flex; align-items: center; gap: 6px;
    background: var(--bg); border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm); box-shadow: var(--shadow-pop);
    padding: 6px 8px 6px 14px; font-size: 12.5px; color: var(--text-2);
    animation: resume-in .25s var(--ease) both;
  }
  @keyframes resume-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .resume-pill.resume-out { opacity: 0; transform: translateY(6px); transition: opacity .3s ease, transform .3s ease; }
  .resume-pill button { border: none; background: transparent; cursor: pointer; }
  .resume-go { font-size: 12.5px; font-weight: 500; color: var(--accent-ink); padding: 2px 4px; }
  .resume-go:hover { text-decoration: underline; text-underline-offset: 3px; }
  .resume-close { font-size: 14px; color: var(--text-3); padding: 2px 6px; border-radius: 5px; }
  .resume-close:hover { color: var(--text); background: var(--surface); }
  @media (max-width: 860px) {
    .resume-pill { left: 12px; bottom: 84px; } /* 让开移动端 TOC FAB */
  }
  /* 阅读完成度（meta 行尾部一行文字，非仪表盘） */
  .read-status { font-variant-numeric: tabular-nums; }
  /* 侧边栏「最近更新」徽标：accent 圆点（纯 CSS 标记，安静驻留） */
  .side-item.has-recent { padding-right: 22px; }
  .side-recent {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    width: 5px; height: 5px; border-radius: 50%; background: var(--accent); flex: none;
  }

  /* ---------- DP-002 空态（404 / 未找到）：品牌化的失败时刻 ---------- */
  .notfound { padding: 48px 0 64px; max-width: var(--content-max); }
  .notfound .nf-code {
    font-family: var(--font-mono); font-size: 44px; font-weight: 500;
    letter-spacing: -.02em; color: var(--text-3); margin-bottom: 12px;
    font-variant-numeric: tabular-nums;
  }
  .notfound h1 { margin-bottom: 12px; }
  .notfound .nf-lede { font-size: 15.5px; color: var(--text-2); margin-bottom: 28px; }
  .notfound .nf-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .notfound .nf-btn {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13.5px; font-weight: 500; color: var(--accent-ink);
    border: 1px solid var(--line); border-radius: var(--radius-sm);
    padding: 8px 14px; background: var(--bg); cursor: pointer;
    transition: border-color .2s, background .2s;
  }
  .notfound .nf-btn:hover { border-color: var(--accent); text-decoration: none; }
  .notfound .nf-btn.ghost { color: var(--text-2); }

  /* ---------- 尊重用户的动效偏好（宪法 §3.4 + §6） ---------- */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
    html { scroll-behavior: auto; }
  }

  /* ---------- 打印（宪法 §6） ---------- */
  @media print {
    .topbar, .sidebar, .toc, .footer, .modal-mask, #progress, .pager, .skip { display: none !important; }
    .layout { display: block; padding-top: 0; }
    .content { padding: 0; animation: none; }
    body { background: #fff; color: #000; font-size: 12pt; }
    .codeblock, .table-wrap, figure.diagram { break-inside: avoid; }
    a { color: #000; }
  }

  /* ---------- 响应式（设计对齐） ---------- */
  @media (max-width: 1180px) {
    .layout { grid-template-columns: var(--sidebar-width) minmax(0, 1fr); }
    .toc { display: none; }
  }
  /* ---------- 移动端抽屉与 TOC 面板（DocLight 既有能力，设计语言一致；基类隐藏，媒体查询显示） ---------- */
  #sidebar-toggle { display: none; }
  .toc-fab { display: none; }
  .toc-sheet { display: none; }
  @media (max-width: 860px) {
    #sidebar-toggle { display: inline-flex; }
    .toc-fab { display: flex; align-items: center; justify-content: center; }
  }
  @media (max-width: 860px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .sidebar { display: none; }
    .topnav, .search-btn { display: none; }
    .content { padding: 32px 22px 72px; }
    .next-grid { grid-template-columns: 1fr; }
    /* 移动端抽屉侧边栏 */
    .icon-btn { width: 44px; height: 44px; }
    .sidebar {
      display: block; position: fixed; left: 0; top: var(--topbar-height); bottom: 0; height: auto;
      transform: translateX(-100%); visibility: hidden; z-index: 40;
      width: min(80vw, var(--sidebar-width)); background: var(--bg);
      border-right: 1px solid var(--line);
      transition: transform .2s ease, visibility 0s linear .2s;
      padding-bottom: calc(48px + env(safe-area-inset-bottom));
    }
    .sidebar.open { transform: translateX(0); visibility: visible; transition: transform .2s ease, visibility 0s; }
    .topbar { padding: 0 12px; gap: 12px; }
    .version-btn { display: none; }
    /* 移动端 TOC：右下角浮动按钮 + 底部面板 */
    .toc-fab { position: fixed; right: 16px; bottom: 24px; z-index: 40; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line); background: var(--bg-subtle); color: var(--text-2); font-size: 18px; cursor: pointer; box-shadow: 0 2px 8px -2px rgba(27,27,24,.12); }
    .toc-sheet { display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; max-height: 70%; background: var(--bg); border-top: 1px solid var(--line); border-radius: 10px 10px 0 0; transform: translateY(100%); visibility: hidden; transition: transform .2s ease, visibility 0s linear .2s; }
    .toc-sheet.open { transform: translateY(0); visibility: visible; transition: transform .2s ease, visibility 0s; }
    .toc-sheet-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--line); font-weight: 600; font-size: 14px; color: var(--text); }
    .toc-sheet-close { border: none; background: none; font-size: 20px; cursor: pointer; color: var(--text-2); }
    .toc-sheet-nav { padding: 12px; overflow-y: auto; max-height: calc(70vh - 48px); }
    .toc-sheet-nav .toc-list { position: static; }
    .toc-sheet-nav .toc-indicator { display: none; }
    .toc-sheet-nav a { font-size: 13.5px; }
  }
  /* 触摸反馈（移动端替代 hover）：按下微暗 */
  @media (max-width: 860px) {
    .icon-btn:active, .toc-fab:active { background: var(--surface); }
  }

  /* ---------- 页面切换过渡（SPA 导航后内容淡入，设计对齐 rise） ---------- */
  @keyframes doclight-page-in { from { opacity: 0; transform: translateY(8px); } }
  article.page-enter { animation: doclight-page-in .25s var(--ease); }
  body, .topbar, .sidebar, .content, .toc { transition: background-color .35s ease, color .35s ease, border-color .3s ease; }
`;

/**
 * 404 页面（DP-002 品牌层空态系统）：复用完整壳层渲染「页面未找到」空态——
 * 品牌化的失败时刻（大号 404 字码 + 引导文案 + 回首页/搜索行动），
 * dev server 与 preview 未命中路径时返回（status 404 + 完整设计页面）。
 */
export function render404Page(options: {
  siteTitle: string;
  navHtml: string;
  form: PageForm;
  base?: string;
  nav?: NavNode[];
  summaries?: Record<string, string>;
  themeCss?: string;
  chrome?: RenderPageOptions["chrome"];
}): string {
  const base = normalizeBase(options.base);
  const notFoundHtml = `<div class="notfound">
<div class="nf-code">404</div>
<h1>页面未找到</h1>
<p class="nf-lede">这个页面不存在，或已经被移动。你可以在下方搜索全站文档，或回到首页。</p>
<div class="nf-actions">
<a class="nf-btn" href="${base}/">← 回到首页</a>
<button class="nf-btn ghost" type="button" onclick="document.getElementById('searchBtn')?.click()">搜索文档…</button>
</div>
</div>`;
  return renderPage({
    title: "页面未找到",
    siteTitle: options.siteTitle,
    navHtml: options.navHtml,
    contentHtml: notFoundHtml,
    form: options.form,
    nav: options.nav,
    summaries: options.summaries,
    themeCss: options.themeCss,
    chrome: options.chrome,
    notFound: true,
  });
}

/**
 * 剥除正文首个 h1（页面标题由壳层 h1 承载——frontmatter.title 为单一事实来源，
 * 防「壳层标题 + markdown 标题」重复；无首个 h1 的正文原样返回）。
 * 安全性：正则只作用于渲染内核输出的已 sanitize HTML（< 已转义，代码块内无法匹配）。
 */
export function stripFirstH1(html: string): string {
  return html.replace(/^<h1\b[^>]*>[\s\S]*?<\/h1>\s*/, "");
}

/** 提取正文首个 h1 文本（frontmatter.title 缺失时的页标题回退；与 stripFirstH1 同规则） */
export function firstH1Text(html: string): string | undefined {
  const m = /^<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  if (!m) return undefined;
  const text = m[1]!
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  return text || undefined;
}

/**
 * 组装文章正文（三形态共享，SNAP-001 同构——dev / SSG / bundle 的 article 内容完全一致）。
 * 设计对齐（2026-08-16：演示页文章结构）：
 *   面包屑 → 插槽 content:before → eyebrow（所属分组）→ h1（frontmatter.title）→
 *   lede（description）→ meta（更新时间/阅读时长/字数）→ 正文（剥首个 h1）→
 *   「下一步」卡片（导航树驱动）→ 上一页/下一页 → 插槽 content:after
 * bundle 形态内嵌页面复用本函数：SPA 导航后每页拥有完整壳层（crumb/pager/meta）。
 */
export interface ArticleBodyOptions {
  title: string;
  contentHtml: string;
  description?: string;
  seo?: SeoOptions;
  nav?: NavNode[];
  currentPath?: string;
  summaries?: Record<string, string>;
  linkSuffix: string;
  hash: boolean;
  base: string;
  slotBefore?: string;
  slotAfter?: string;
}

export function articleBodyHtml(options: ArticleBodyOptions): string {
  const { title, contentHtml, description, seo, nav = [], currentPath = "", summaries = {}, linkSuffix, hash, base } = options;
  // 面包屑（设计对齐演示页 crumb：文档 / 分组链 / 当前页）
  const breadcrumb = nav.length && currentPath ? breadcrumbHtml(breadcrumbFor(nav, currentPath, linkSuffix, base, title)) : "";
  // eyebrow：当前页所属顶层分组
  const sectionOf = sectionForPath(nav);
  const eyebrow = currentPath ? sectionOf(currentPath) : "";
  // 文章头部元信息行（设计对齐：演示页 meta——更新时间 / 阅读时长 / 字数；有数据才渲染）
  let docMeta = "";
  if (seo && (seo.readingTime || seo.wordCount || seo.updatedAt)) {
    const metaItems: string[] = [];
    if (seo.updatedAt) {
      const d = new Date(seo.updatedAt);
      const ds = Number.isNaN(d.getTime()) ? seo.updatedAt.slice(0, 10) : d.toISOString().slice(0, 10);
      const parts = ds.split("-").map((s) => Number(s));
      const dateText = parts.length === 3 ? `${parts[0]} 年 ${parts[1]} 月 ${parts[2]} 日` : ds;
      // DP-003：<time> 语义标记——SSR 直出绝对日期（SEO），展示层改写为相对时间（「3 天前更新」）
      metaItems.push(`<span><time class="doc-updated" datetime="${escapeHtml(ds)}">最后更新于 ${escapeHtml(dateText)}</time></span>`);
    }
    if (seo.readingTime) metaItems.push(`<span>约 ${seo.readingTime} 分钟阅读</span>`);
    if (seo.wordCount) metaItems.push(`<span>${seo.wordCount.toLocaleString("zh-CN")} 字</span>`);
    if (metaItems.length) docMeta = `<div class="meta">${metaItems.map((m, i) => (i ? `<span class="sep"></span>${m}` : m)).join("")}</div>`;
  }
  // 下一步卡片 + 上一页/下一页（导航顺序驱动）
  const navTitles: Record<string, string> = {};
  const collectTitles = (items: NavNode[]) => {
    for (const n of items) {
      if (n.type === "file") navTitles[n.path] = n.title;
      else collectTitles(n.items);
    }
  };
  collectTitles(nav);
  const cards = nav.length && currentPath ? nextCardsFor(nav, currentPath, linkSuffix, base, hash, navTitles, summaries) : [];
  const nextGrid =
    cards.length > 0
      ? `<h2 id="next">下一步 <a class="anchor" href="#next">#</a></h2>
      <div class="next-grid">${cards
        .map(
          (c) => `<a class="next-card" href="${c.href}">
          ${c.label ? `<div class="nc-label">${escapeHtml(c.label)}</div>` : ""}
          <div class="nc-title">${escapeHtml(c.title)}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </div>
          ${c.desc ? `<div class="nc-desc">${escapeHtml(c.desc)}</div>` : ""}
        </a>`
        )
        .join("")}</div>`
      : "";
  const pager = nav.length && currentPath ? pagerFor(nav, currentPath, linkSuffix, base, hash, navTitles) : {};
  const pagerHtml =
    pager.prev || pager.next
      ? `<div class="pager">
      ${pager.prev ? `<a href="${pager.prev.href}"><div class="dir">← 上一页</div><div class="pg-title">${escapeHtml(pager.prev.title)}</div></a>` : `<span></span>`}
      ${pager.next ? `<a href="${pager.next.href}" class="next"><div class="dir">下一页 →</div><div class="pg-title">${escapeHtml(pager.next.title)}</div></a>` : ""}
    </div>`
      : "";
  const lede = description ? `<p class="lede">${escapeHtml(description)}</p>` : "";
  return `${breadcrumb}${options.slotBefore ?? ""}${eyebrow ? `<div class="eyebrow">${escapeHtml(eyebrow)}</div>` : ""}<h1>${escapeHtml(title)}</h1>${lede}${docMeta}${stripFirstH1(contentHtml)}${nextGrid}${pagerHtml}${options.slotAfter ?? ""}`;
}

/**
 * 组装完整 HTML 页（首屏直出：内容 + 导航服务端渲染；设计对齐 docs/design-new/index.html）。
 * 含：顶栏（品牌/导航/搜索/版本/主题/GitHub）、防闪烁脚本、完整设计令牌（THEME-001）、
 * 面包屑/引言/元信息/下一步/上一页下一页（articleBodyHtml 共享，三形态同构）、
 * TOC（服务端直出链接 + 反馈卡）、搜索弹层、阅读进度条、移动端侧边栏/TOC 面板、
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
  // SSG 产物 file:// 降级适配（2026-08 用户反馈）：SSG 形态需 HTTP（SPA fetch 在 file:// 被 CORS
  // 拦截、绝对链接指向盘符根目录）。双击打开时——跳过展示层、站内链接改相对整页跳转
  // （每页均为服务端直出的完整 HTML，可正常阅读与导航；TOC/搜索/主题等交互降级为静态）。
  // 仅 file: 协议生效，HTTP 零影响；file:// 离线完整体验请用 doclight bundle 单文件。
  const fileAdaptor =
    form === "ssg"
      ? `<script>
(function () {
  if (location.protocol !== "file:") return;
  // 移除展示层外链（file:// 下 /display.js 被 CORS 拦截，避免错误噪音）
  var s = document.currentScript;
  while (s && s.nextElementSibling) {
    if (s.nextElementSibling.tagName === "SCRIPT" && s.nextElementSibling.getAttribute("src")) s.nextElementSibling.remove();
    else s = s.nextElementSibling;
  }
  // 站内绝对链接 → 相对整页跳转（防跳盘符根）
  document.addEventListener("click", function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href");
    if (href && href.charAt(0) === "/" && href.charAt(1) !== "/") {
      e.preventDefault();
      var dir = location.href.slice(0, location.href.lastIndexOf("/") + 1);
      location.href = dir + href.replace(/^\\/+/, "");
    }
  }, true);
})();
</script>`
      : "";
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

  // ===== 设计对齐：顶栏/正文/页脚数据装配（nav / currentPath / chrome） =====
  const linkSuffix = form === "dev" ? "" : ".html";
  const hash = form === "bundle";
  const nav = options.nav ?? [];
  const currentPath = options.currentPath ?? "";
  const chrome = options.chrome ?? {};
  // 顶栏导航（topnav）：顶层分组（设计对齐演示页）
  const topnavLinks = topGroups(nav)
    .map((g) => {
      const href = g.firstPath ? (hash ? `#${navHref(g.firstPath, linkSuffix, base)}` : navHref(g.firstPath, linkSuffix, base)) : "#";
      return `<a href="${href}" data-topgroup="${escapeHtml(g.title)}">${escapeHtml(g.title)}</a>`;
    })
    .join("");
  // TOC：服务端直出 h2/h3 链接 + 「下一步」节（articleBodyHtml 渲染的 next-grid 锚点，
  // 演示页目录含「下一步」——1:1 对齐；展示层挂载后接管滚动监听与指示条）
  const hasNextSection =
    nav.length && currentPath ? nextCardsFor(nav, currentPath, linkSuffix, base, hash, {}).length > 0 : false;
  const tocEntries = options.notFound ? [] : extractToc(contentHtml);
  if (hasNextSection) tocEntries.push({ id: "next", text: "下一步", level: 2 });
  const tocLinks = tocEntries
    .map(
      (h) =>
        `<a href="#${h.id}" data-target="${h.id}"${h.level === 3 ? ' class="l3"' : ""}>${escapeHtml(h.text)}</a>`
    )
    .join("");
  const tocHtml = tocLinks
    ? `<div class="toc-title">本页内容</div>
    <div class="toc-list" id="tocList">
      <div class="toc-indicator" id="tocIndicator"></div>
      ${tocLinks}
    </div>`
    : "";
  const editLink = chrome.github && currentPath
    ? `<a class="edit" href="${escapeHtml(chrome.github.replace(/\/+$/, ""))}/edit/main/${escapeHtml(currentPath)}" target="_blank" rel="noopener">在 GitHub 上编辑此页 →</a>`
    : "";
  const statusText = chrome.statusText ?? "所有系统正常";
  const footerLinks = (chrome.footerLinks ?? [])
    .map((l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`)
    .join("");
  const year = new Date().getFullYear();

  const overrides = globalOverridesScript(form, base, options.searchVersion, options.bundleData);
  const pluginCfg = pluginConfigsScript(options.pluginConfigs);
  const overridesScript = overrides || pluginCfg ? `<script>\n${overrides}${overrides && pluginCfg ? "\n" : ""}${pluginCfg}\n</script>` : "";
  // PLUG-005：插槽内容注入（构建时静态 HTML + data-doclight-slot 标记供运行时追加）
  // head 插槽必须用 <template>：head 内不允许 span（HTML5 解析器遇 span 会隐式开 body，
  // 使全部 SEO 元数据落入 body——2026-08 前端审查 P1-1 实测修复）；template 是 head 合法内容。
  const slot = (name: string): string => {
    const html = options.slotContent?.[name] ?? "";
    if (name === "head:start" || name === "head:end") {
      return `${html}<template data-doclight-slot="${name}"${html ? ` data-doclight-static="1"` : ""}></template>`;
    }
    return `<span data-doclight-slot="${name}"${html ? ` data-doclight-static="1"` : ""}>${html}</span>`;
  };
  // 文章正文（articleBodyHtml 共享：三形态同构，SPA/bundle 内嵌页复用同一组装）
  const articleBody = articleBodyHtml({
    title,
    contentHtml,
    description: options.description,
    seo,
    nav,
    currentPath,
    summaries: options.summaries,
    linkSuffix,
    hash,
    base,
    slotBefore: slot("content:before"),
    slotAfter: slot("content:after"),
  });
  // DP-002 品牌层：首页 hero 形态（根 README/index → 更大留白节奏 + 入口卡，与内页分离）
  const isHome = isRootIndex(currentPath ?? "");
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="auto">
<head>
${slot("head:start")}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ${escapeHtml(siteTitle)}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2314714e'/%3E%3Cpath d='M16 7v18M8.5 12.5l15 9M23.5 12.5l-15 9' stroke='%23fff' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E">
${metaDescription}
${seoHead}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500&display=swap" rel="stylesheet">
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
  /* ===== 设计令牌与组件（设计对齐 docs/design-new/index.html，宪法 docs/design-new/DESIGN.md） ===== */
  ${DEFAULT_THEME_CSS}
</style>
${options.themeCss ? `<style data-doclight-theme>\n${options.themeCss}\n</style>` : ""}
${options.pluginCss ? `<style data-doclight-plugin-css>\n${options.pluginCss}\n</style>` : ""}
${options.extraHead ?? ""}
${slot("head:end")}
</head>
<body>
<a class="skip" href="#main">跳到主要内容</a>
<div id="progress"></div>

<!-- ================= Topbar（设计对齐：品牌 / 导航 / 搜索 / 版本 / 主题 / GitHub） ================= -->
<header class="topbar" id="topbar">
  ${slot("topbar:before")}
  <a class="brand" href="${base}/" aria-label="${escapeHtml(siteTitle)} 首页">
    <span class="logo">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
        <path d="M12 3v18M5 7.5l14 9M19 7.5l-14 9"/>
      </svg>
    </span>
    ${escapeHtml(siteTitle)}
    <span class="tag">文档</span>
  </a>
  <button id="sidebar-toggle" class="icon-btn" aria-label="菜单" aria-expanded="false"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>
  <nav class="topnav" aria-label="站点导航">${topnavLinks}</nav>
  <div class="spacer"></div>
  <button class="search-btn" id="searchBtn">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
    搜索文档…
    <kbd>Ctrl K</kbd>
  </button>
  ${chrome.version ? `<button class="version-btn"><span class="dot"></span> v${escapeHtml(chrome.version)}
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
  </button>` : ""}
  <button class="icon-btn" id="themeBtn" title="切换主题" aria-label="切换主题">
    <svg id="iconSun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    <svg id="iconMoon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:none"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>
  </button>
  ${chrome.github ? `<a class="icon-btn" href="${escapeHtml(chrome.github)}" target="_blank" rel="noopener" title="GitHub" aria-label="GitHub">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .4.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
  </a>` : ""}
  ${slot("topbar:after")}
</header>

<div class="layout">

  <!-- ================= 左侧导航（设计对齐：分组 + 子级） ================= -->
  <aside class="sidebar">
    ${slot("sidebar:before")}
    <nav aria-label="站点导航">${navHtml}</nav>
    ${slot("sidebar:after")}
  </aside>

  <!-- ================= 正文（articleBodyHtml 共享组装：三形态同构） ================= -->
  <main class="content" id="main">
    <article class="article${isHome ? " home" : ""}">
      ${articleBody}
    </article>
  </main>

  <!-- ================= 右侧目录（设计对齐：指示条 + 链接 + 反馈卡） ================= -->
  <aside class="toc" aria-label="本页目录">
    ${slot("toc:before")}
    ${tocHtml}
    ${options.notFound ? "" : `<div class="toc-card">
      <div class="q">本页内容是否有帮助？</div>
      <div class="row">
        <button id="fbYes">有帮助</button>
        <button id="fbNo">需改进</button>
      </div>
      ${editLink}
    </div>`}
    ${slot("toc:after")}
  </aside>
</div>

<!-- ================= Footer（设计对齐：版权 / 链接 / 状态） ================= -->
<footer class="footer">
  <div class="footer-inner">
    <span>© ${year} ${escapeHtml(siteTitle)}</span>
    ${footerLinks}
    <span class="status">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>
      ${escapeHtml(statusText)}
    </span>
    <span class="powered-by">${slot("footer")}Powered by <a href="https://doclight.tech" target="_blank" rel="noopener">DocLight</a><button id="powered-by-close" aria-label="隐藏 Powered by 标记">×</button></span>
  </div>
</footer>

<!-- ================= 移动端 TOC 面板（DocLight 既有能力，设计语言一致） ================= -->
<button class="toc-fab" aria-label="目录"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
<div class="toc-sheet">
  <div class="toc-sheet-header">本页目录<button class="toc-sheet-close" aria-label="关闭目录">×</button></div>
  <nav class="toc-sheet-nav" aria-label="本页目录"></nav>
</div>

<!-- ================= 搜索弹层（设计对齐） ================= -->
<div class="modal-mask" id="modalMask">
  <div class="modal" role="dialog" aria-label="搜索文档">
    <div class="search-row">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--text-3)"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input id="searchInput" type="text" placeholder="搜索文档、指南与 API…" autocomplete="off">
      <kbd class="esc">ESC</kbd>
    </div>
    <div class="results" id="results"></div>
    <div class="modal-foot">
      <span><kbd>↑↓</kbd> 导航</span>
      <span><kbd>⏎</kbd> 打开</span>
      <span><kbd>esc</kbd> 关闭</span>
    </div>
  </div>
</div>

${overridesScript}
${sseScript}
${fileAdaptor}${displayTag}
</body>
</html>`;
}
