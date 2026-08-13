/**
 * 代码块渲染（REND-002 code-block / mermaid 扩展共用）
 *
 * 职责：围栏代码块 → 分流渲染产物
 * - mermaid 围栏：<div class="doclight-mermaid"><pre class="doclight-mermaid-src"><code>源码</code></pre></div>
 *   —— class 标记 + 源码 fallback 子元素。展示层读 fallback 文本渲染 Mermaid；
 *     渲染失败/未加载时源码天然可见（降级不白屏，REND-003）。
 * - 普通代码块：<pre class="doclight-code"><code class="language-js">…</code></pre>
 *   —— 语言走 class="language-*"（DOMPurify 稳定放行，**不依赖 data-***），
 *     展示层据此懒加载 Prism 高亮 + 注入复制按钮（零依赖）。
 * 降级：无 Prism → 纯代码块（可读 + 可复制）。
 */
import { escapeHtml } from "../core/link.ts";

export function renderCodeBlock(text: string, lang: string | undefined): string {
  if (lang === "mermaid") {
    return `<div class="doclight-mermaid"><pre class="doclight-mermaid-src"><code>${escapeHtml(text)}</code></pre></div>`;
  }
  const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : "";
  return `<pre class="doclight-code"><code${langClass}>${escapeHtml(text)}</code></pre>`;
}
