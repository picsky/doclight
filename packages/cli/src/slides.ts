/**
 * doclight slides —— 演示形态（08-roadmap Phase 6 P2，DEMO-001）
 *
 * 「文档与演示同源不同形」（01 §原则二）：同一渲染内核（@doclight/renderer），
 * 独立的表现形式——演示 = 每页一个观点、强视觉、少文字、逐页叙事；
 * **绝不做「文档切页成演示」的机械转换**——演示源是独立编排的 markdown。
 *
 * 语法（Marp/Slidev 生态通用，Agent 熟悉）：
 * - 文件头 frontmatter（可选）：title 等演示元数据
 * - `---` 分页：每页一个 `---` 分隔
 * - 每页可选指令注释：`<!-- layout: cover|section|content|end -->`（缺省自动推断：
 *   第 1 页 cover，其余 content；末页可用 end 收尾）
 * - 演讲者备注：`<!-- notes: 演讲提示 -->`（观众页不显示，S 键演示者视图可见）
 *
 * 输出：单个自包含 HTML（内嵌 CSS + 壳层 JS，file:// 直接可开——与 bundle 同哲学，零网络）：
 * - 键盘（←/→/空格/Home/End）+ 触摸/点击导航、URL hash 定位（#3 直达第 3 页）
 * - 进度条 + 页码 + 全屏（F）+ 演讲者视图（S：当前页备注 + 下一页预告 + 时钟）
 * - 打印（每页一页）+ prefers-reduced-motion 尊重
 *
 * 演示质量由演示专用视觉组件保证（01 §原则二）：3 套内置外观（dark/light/warm）
 * + 自定义 CSS 文件（--slide-* 令牌覆盖，与主题包同模式）。
 * 代码高亮/KaTeX/Mermaid 在演示中按 REND-003 降级为可读源码（单文件零 vendor 依赖，
 * 演示主打排版与叙事，不引外部库）。
 */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { render } from "@doclight/renderer";

/* ================= 解析 ================= */

export type SlideLayout = "cover" | "section" | "content" | "end";

export interface SlidePage {
  /** 布局（显式指令优先，缺省推断：第 1 页 cover，其余 content） */
  layout: SlideLayout;
  /** 演讲者备注（<!-- notes: ... -->；无则空） */
  notes: string;
  /** 页内容 markdown（已剥离 frontmatter/指令注释） */
  markdown: string;
}

export interface SlideDeck {
  /** 演示标题（frontmatter.title 或文件名主干） */
  title: string;
  /** frontmatter 其余元数据（author/date 等，宽松读取） */
  meta: Record<string, string>;
  pages: SlidePage[];
}

/** 提取块注释 `<!-- ... -->` 中的指令（layout / notes）；返回内容与剩余 markdown */
function extractDirectives(md: string): { layout?: SlideLayout; notes: string; body: string } {
  let layout: SlideLayout | undefined;
  const notes: string[] = [];
  const body = md.replace(/<!--([\s\S]*?)-->/g, (_m, raw: string) => {
    const inner = String(raw).trim();
    const layoutMatch = /^layout:\s*(cover|section|content|end)\s*$/i.exec(inner);
    if (layoutMatch) {
      layout = layoutMatch[1]!.toLowerCase() as SlideLayout;
      return "";
    }
    const notesMatch = /^notes:\s*([\s\S]+)$/i.exec(inner);
    if (notesMatch) {
      notes.push(notesMatch[1]!.trim());
      return "";
    }
    return _m; // 其它注释保留（如 HTML 注释）
  });
  return { layout, notes: notes.join("\n"), body };
}

/**
 * 解析演示源：frontmatter（文件头 `---` 块）→ `---` 分页 → 每页指令/备注提取。
 * 分页符规则：行首 `---`（前后可空行）；frontmatter 块本身不算分页。
 */
export function parseSlides(md: string, fallbackTitle = "演示"): SlideDeck {
  // frontmatter：文件头 `---\n...\n---`
  let body = md;
  const meta: Record<string, string> = {};
  const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (fmMatch) {
    for (const line of fmMatch[1]!.split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx <= 0) continue;
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    }
    body = md.slice(fmMatch[0].length);
  }
  // 分页：行首 ---（含 CRLF 容错）
  const rawPages = body
    .split(/\r?\n^---[ \t]*\r?$/m)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const pages: SlidePage[] = rawPages.map((raw, i) => {
    const { layout, notes, body: pageBody } = extractDirectives(raw);
    return {
      layout: layout ?? (i === 0 ? "cover" : "content"),
      notes,
      markdown: pageBody.trim(),
    };
  });
  return {
    title: meta["title"] ?? fallbackTitle,
    meta,
    pages,
  };
}

/* ================= 演示设计系统（3 套内置外观 + 自定义 CSS） ================= */

/**
 * 演示视觉语言（独立于文档 4 套主题——同源不同形）：
 * 大字号强对比、每页一观点、封面/章节/内容/结束四种布局、克制动效。
 * 令牌：--slide-* 可被自定义 CSS 覆盖（与主题包同模式）。
 */
export const SLIDE_THEMES: Record<string, string> = {
  dark: `/* dark —— 演示默认：深蓝紫渐变 + 白字 + teal 强调（舞台感） */
:root {
  --slide-bg: radial-gradient(1200px 800px at 20% 10%, #1e1b4b 0%, #0b0f19 55%, #0a0a12 100%);
  --slide-fg: #f5f5f5; --slide-fg-soft: #c7c9d4; --slide-fg-muted: #8b8fa3;
  --slide-accent: #2dd4bf; --slide-accent-soft: #134e4a;
  --slide-font: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif;
  --slide-mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
  --slide-h1: 3.4rem; --slide-h2: 2.2rem; --slide-body: 1.35rem;
  --slide-code-bg: rgba(255,255,255,0.07);
}
.slide[data-layout="cover"] h1 { font-size: 4.2rem; background: linear-gradient(120deg, #f5f5f5, #2dd4bf); -webkit-background-clip: text; background-clip: text; color: transparent; }
.slide[data-layout="end"] h1 { font-size: 3.6rem; }
.slide h2 { color: var(--slide-accent); }
`,
  light: `/* light —— 亮色纸感：白底墨字 + 靛蓝强调（会议室投影友好） */
:root {
  --slide-bg: #fdfdfc; --slide-fg: #1f2430; --slide-fg-soft: #4b5563; --slide-fg-muted: #9ca3af;
  --slide-accent: #1e3a5f; --slide-accent-soft: #e2e8f0;
  --slide-font: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif;
  --slide-mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
  --slide-h1: 3.4rem; --slide-h2: 2.2rem; --slide-body: 1.35rem;
  --slide-code-bg: #f1f5f9;
}
.slide[data-layout="cover"] h1 { font-size: 4.2rem; }
.slide h2 { color: var(--slide-accent); }
`,
  warm: `/* warm —— 暖色亲和：米白底 + 暖棕字 + 琥珀强调（教程/分享会） */
:root {
  --slide-bg: #fdf9f3; --slide-fg: #3d362c; --slide-fg-soft: #6b6355; --slide-fg-muted: #a89b88;
  --slide-accent: #d97706; --slide-accent-soft: #fef3c7;
  --slide-font: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", Georgia, system-ui, sans-serif;
  --slide-mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
  --slide-h1: 3.4rem; --slide-h2: 2.2rem; --slide-body: 1.35rem;
  --slide-code-bg: #f5eee2;
}
.slide[data-layout="cover"] h1 { font-size: 4.2rem; }
.slide h2 { color: var(--slide-accent); }
`,
};

/** 解析演示主题：内置名 → 内置 CSS；CSS 文件路径 → 读取；未知 → 警告 + 默认（诚实原则） */
export function resolveSlideThemeCss(theme: string | undefined, cwd = process.cwd()): string {
  if (!theme || theme === "default") return SLIDE_THEMES.dark!;
  const builtin = SLIDE_THEMES[theme];
  if (builtin) return builtin;
  const file = isAbsolute(theme) ? theme : resolve(cwd, theme);
  if (existsSync(file)) {
    try {
      return readFileSync(file, "utf8");
    } catch {
      console.warn(`[doclight][slides] 主题文件读取失败：${file}（回退 dark）`);
      return SLIDE_THEMES.dark!;
    }
  }
  console.warn(`[doclight][slides] 未知演示主题「${theme}」（内置：dark / light / warm；或提供 CSS 文件路径）——回退 dark`);
  return SLIDE_THEMES.dark!;
}

/* ================= 壳层（导航 JS + 基础样式） ================= */

/** 演示壳层 JS：键盘/触摸导航、hash 定位、进度、全屏、演讲者视图（零依赖内嵌） */
const SHELL_JS = `(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var current = 0;
  function clamp(n) { return Math.max(0, Math.min(slides.length - 1, n)); }
  function show(n, push) {
    current = clamp(n);
    slides.forEach(function (s, i) { s.classList.toggle('active', i === current); });
    var pct = slides.length > 1 ? Math.round((current / (slides.length - 1)) * 100) : 100;
    var bar = document.getElementById('slide-progress'); if (bar) bar.style.width = pct + '%';
    var num = document.getElementById('slide-number'); if (num) num.textContent = (current + 1) + ' / ' + slides.length;
    document.getElementById('slide-stage').scrollTop = 0;
    var notes = document.getElementById('slide-notes');
    if (notes && notes.classList.contains('open')) { notes.textContent = slides[current].dataset.notes || '（本页无备注）'; }
    if (push !== false) { try { history.replaceState(null, '', '#' + (current + 1)); } catch (e) {} }
  }
  function next() { show(current + 1); }
  function prev() { show(current - 1); }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); show(0); }
    else if (e.key === 'End') { e.preventDefault(); show(slides.length - 1); }
    else if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
    else if (e.key === 's' || e.key === 'S') {
      var notes = document.getElementById('slide-notes');
      if (notes) { notes.classList.toggle('open'); notes.textContent = slides[current].dataset.notes || '（本页无备注）'; }
    }
  });
  var touchX = null;
  document.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 48) { dx < 0 ? next() : prev(); }
    touchX = null;
  }, { passive: true });
  document.addEventListener('click', function (e) {
    var w = window.innerWidth;
    if (e.clientX > w * 0.85) next(); else if (e.clientX < w * 0.15) prev();
  });
  var initial = parseInt((location.hash || '').replace('#', ''), 10);
  show(Number.isFinite(initial) && initial > 0 ? initial - 1 : 0, false);
})();`;

/** 演示基础样式（布局/动效/打印/响应式；主题只覆盖令牌 + 特征规则） */
const SHELL_CSS = `:root { color-scheme: light dark; }
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body { background: var(--slide-bg); color: var(--slide-fg); font-family: var(--slide-font); }
#slide-stage { height: 100vh; overflow: hidden; }
.slide { display: none; height: 100vh; padding: 7vh 9vw; flex-direction: column; justify-content: center; }
.slide.active { display: flex; animation: slide-in 220ms ease; }
@keyframes slide-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .slide.active { animation: none; } }
.slide h1 { font-size: var(--slide-h1); line-height: 1.2; margin: 0 0 0.5em; }
.slide h2 { font-size: var(--slide-h2); line-height: 1.3; margin: 0 0 0.4em; }
.slide h3 { font-size: 1.6rem; line-height: 1.35; margin: 0 0 0.4em; }
.slide p, .slide li { font-size: var(--slide-body); line-height: 1.7; color: var(--slide-fg-soft); }
.slide ul, .slide ol { padding-left: 1.4em; }
.slide a { color: var(--slide-accent); }
.slide code { font-family: var(--slide-mono); font-size: 0.9em; background: var(--slide-code-bg); padding: 2px 6px; border-radius: 4px; }
.slide pre { background: var(--slide-code-bg); border-radius: 10px; padding: 14px 18px; overflow-x: auto; font-size: 0.95rem; line-height: 1.55; }
.slide pre code { background: none; padding: 0; }
.slide blockquote { margin: 0.6em 0; padding-left: 1em; border-left: 3px solid var(--slide-accent); color: var(--slide-fg-soft); }
.slide table { border-collapse: collapse; width: 100%; font-size: var(--slide-body); }
.slide th, .slide td { border-bottom: 1px solid var(--slide-fg-muted); padding: 6px 12px; text-align: left; }
.slide .doclight-container { margin: 0.6em 0; padding: 10px 14px; border-left: 3px solid var(--slide-accent); background: var(--slide-code-bg); border-radius: 0 8px 8px 0; }
.slide[data-layout="cover"], .slide[data-layout="end"], .slide[data-layout="section"] { text-align: center; }
.slide[data-layout="cover"] p:first-of-type, .slide[data-layout="end"] p:first-of-type { font-size: 1.6rem; color: var(--slide-fg-soft); }
.slide[data-layout="cover"] .slide-meta { margin-top: 2.4em; font-size: 0.95rem; color: var(--slide-fg-muted); }
.slide[data-layout="section"] h1 { font-size: 3.6rem; }
.slide[data-layout="content"] { justify-content: flex-start; padding-top: 9vh; }
#slide-progress { position: fixed; top: 0; left: 0; height: 3px; width: 0; background: var(--slide-accent); transition: width 200ms ease; z-index: 20; }
#slide-number { position: fixed; right: 14px; bottom: 10px; font-size: 0.8rem; color: var(--slide-fg-muted); z-index: 20; }
#slide-hint { position: fixed; left: 50%; bottom: 10px; transform: translateX(-50%); font-size: 0.75rem; color: var(--slide-fg-muted); opacity: 0.55; z-index: 20; }
#slide-notes { display: none; position: fixed; left: 0; right: 0; bottom: 0; background: var(--slide-code-bg); color: var(--slide-fg); border-top: 2px solid var(--slide-accent); padding: 14px 24px; font-size: 0.95rem; line-height: 1.6; max-height: 30vh; overflow-y: auto; z-index: 30; white-space: pre-wrap; }
#slide-notes.open { display: block; }
#slide-notes::before { content: "📋 演讲者备注（S 关闭）"; display: block; font-size: 0.75rem; color: var(--slide-fg-muted); margin-bottom: 6px; }
@media (max-width: 768px) {
  .slide { padding: 6vh 6vw; }
  .slide h1, .slide[data-layout="cover"] h1, .slide[data-layout="end"] h1 { font-size: 2.2rem; }
  .slide h2 { font-size: 1.6rem; }
  .slide p, .slide li { font-size: 1.05rem; }
  #slide-hint { display: none; }
}
@media print {
  #slide-progress, #slide-number, #slide-hint, #slide-notes { display: none !important; }
  #slide-stage { height: auto; }
  .slide { display: flex !important; height: 100vh; page-break-after: always; break-after: page; }
}
`;

export interface SlidesOptions {
  /** 演示标题（缺省用 frontmatter.title / 文件名主干） */
  title?: string;
  /** 演示主题：内置（dark/light/warm）或 CSS 文件路径；缺省 dark */
  theme?: string;
  /** 自定义追加 CSS（在主题之后注入；缺省空） */
  extraCss?: string;
  /** 站点/作者署名（封面 meta 行：作者 · 日期；缺省不显示） */
  author?: string;
}

/**
 * 构建演示 HTML（纯函数可测）：解析 → 每页 render（同一渲染内核，扩展语法自动生效）→
 * 自包含壳层（CSS + JS 内嵌）。输出单文件，file:// 直接可开（与 bundle 同哲学）。
 */
export function buildSlidesHtml(source: string, options: SlidesOptions = {}): string {
  const deck = parseSlides(source, options.title);
  const themeCss = resolveSlideThemeCss(options.theme);
  const pages = deck.pages
    .map((p, i) => {
      const { html } = render(p.markdown, { currentPath: `slide-${i + 1}.md`, linkSuffix: ".html" });
      const metaLine =
        p.layout === "cover" && (options.author || deck.meta["author"] || deck.meta["date"])
          ? `<p class="slide-meta">${[options.author ?? deck.meta["author"], deck.meta["date"]].filter(Boolean).join(" · ")}</p>`
          : "";
      return `<section class="slide" data-layout="${p.layout}" data-notes="${escapeAttr(p.notes)}">
  ${html}${metaLine}
</section>`;
    })
    .join("\n");
  const title = deck.title;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="doclight-slides" content="1">
<style>
${themeCss}
${SHELL_CSS}
${options.extraCss ?? ""}
</style>
</head>
<body>
<div id="slide-progress"></div>
<div id="slide-stage">
${pages}
</div>
<div id="slide-number">1 / ${deck.pages.length}</div>
<div id="slide-hint">← → 翻页 · F 全屏 · S 演讲者备注</div>
<div id="slide-notes"></div>
<script>
${SHELL_JS}
</script>
</body>
</html>
`;
}

/** HTML 文本转义（标题/备注注入模板，防标签逃逸） */
function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 属性转义（data-notes 注入） */
function escapeAttr(v: string): string {
  return escapeHtml(v).replace(/'/g, "&#39;");
}
