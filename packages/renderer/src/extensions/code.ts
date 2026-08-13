/**
 * 代码块渲染（REND-002 code-block 扩展）
 *
 * 职责：围栏代码块 → 高亮+复制标记
 * - 普通代码块：<pre class="doclight-code"><code class="language-js">…</code></pre>
 *   —— 语言走 class="language-*"（DOMPurify 稳定放行，**不依赖 data-***），
 *     展示层据此懒加载 Prism 高亮 + 注入复制按钮（零依赖）。
 * - Mermaid 围栏（PLUG-012 迁移）：不再内置分流——由 @doclight/plugin-mermaid 的
 *   extendMarked 扩展接管（输出 .doclight-mermaid fallback + 运行时容错渲染）。
 *   未启用插件时 ```mermaid 按普通代码块渲染（高亮 + 可复制）。
 * 降级：无 Prism → 纯代码块（可读 + 可复制）。
 */
import { escapeHtml } from "../core/link.ts";

export function renderCodeBlock(text: string, lang: string | undefined): string {
  const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : "";
  return `<pre class="doclight-code"><code${langClass}>${escapeHtml(text)}</code></pre>`;
}
