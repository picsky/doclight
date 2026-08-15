/**
 * 代码块渲染（REND-002 code-block 扩展；设计对齐 2026-08-16：演示页 codeblock 结构）
 *
 * 职责：围栏代码块 → 代码块组件（头部条 + 代码体）：
 * - 头部条（.code-head）：文件名（可选，等宽）+ 语言标签（大写小字）+ 复制按钮
 *   （复制按钮服务端直出，展示层只绑事件——渐进增强，无 JS 也可读可复制）
 * - 代码体：<pre class="doclight-code"><code class="language-*">…</code></pre>
 *   —— 语言走 class="language-*"（DOMPurify 稳定放行，**不依赖 data-***），
 *     展示层据此懒加载 Prism 高亮。
 *
 * info string 解析（marked 把整个 info string 传入 lang，spike 实测）：
 *   ```ts title="lib/aster.ts"    → 语言 ts + 文件名 lib/aster.ts
 *   ```ts lib/aster.ts            → 同上（裸文件名）
 *   ```bash                       → 语言 bash（无文件名）
 * 文件名前缀支持 title=/file=/filename= 三种写法（与 marked 社区惯例兼容）。
 *
 * 降级：无 Prism → 纯代码块（可读 + 可复制）。
 */
import { escapeHtml } from "../core/link.ts";

const FILE_ICON =
  '<svg class="fname-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
const COPY_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';

/** 解析围栏 info string → { lang, fname? }（spike 实测：marked 传入完整 info string） */
export function parseCodeInfo(info: string | undefined): { lang: string; fname?: string } {
  const raw = (info ?? "").trim();
  if (!raw) return { lang: "" };
  const [first, ...rest] = raw.split(/\s+/);
  const lang = first ?? "";
  const restText = rest.join(" ").trim();
  if (!restText) return { lang };
  // 支持 title=/file=/filename= 前缀；其余按裸文件名处理
  let fname = restText;
  const m = /^(?:title|file|filename)\s*=\s*(.+)$/i.exec(restText);
  if (m) fname = m[1]!;
  fname = fname.replace(/^["']|["']$/g, "").trim();
  return { lang, ...(fname ? { fname } : {}) };
}

export function renderCodeBlock(text: string, lang: string | undefined): string {
  const { lang: language, fname } = parseCodeInfo(lang);
  const langClass = language ? ` class="language-${escapeHtml(language)}"` : "";
  const head = `<div class="code-head">${fname ? `${FILE_ICON}<span class="fname">${escapeHtml(fname)}</span>` : ""}${language ? `<span class="lang">${escapeHtml(language)}</span>` : ""}<button class="copy-btn" type="button" aria-label="复制代码">${COPY_ICON}<span>复制</span></button></div>`;
  return `<div class="codeblock">${head}<pre class="doclight-code"><code${langClass}>${escapeHtml(text)}</code></pre></div>`;
}
