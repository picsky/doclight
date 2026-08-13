/**
 * KaTeX 公式标记扩展（$...$ 内联 / $$...$$ 块级）
 *
 * 规则（防货币/价格误判，参考 markdown-it-texmath）：
 * - 内联：内容不含 $ 与换行，且首尾非空白（"$5 和 $10" 因尾随空格不匹配）
 * - 块级：$$ 独占行包裹
 *
 * 渲染产物（class 标记 + TeX 源码作文本，**不依赖 data-***）：
 *   <span class="doclight-katex-inline">x^2</span>
 *   <div class="doclight-katex-block">x^2</div>
 * 展示层读取 textContent 为 TeX 源码 → 懒加载 KaTeX → renderToString 替换 innerHTML。
 * 降级：未加载 KaTeX 时 TeX 源码直接可见（数学可读性保持）。
 */
import type { TokenizerAndRendererExtension, Tokens } from "marked";
import { escapeHtml } from "../core/link.ts";

/** 内联公式：$...$（内容无 $、无换行、首尾非空白） */
export const katexInlineExtension: TokenizerAndRendererExtension = {
  name: "doclightKatexInline",
  level: "inline",
  start(src: string) {
    return src.indexOf("$");
  },
  tokenizer(src: string) {
    const match = /^\$([^$\n]+)\$/.exec(src);
    if (!match) return undefined;
    const tex = match[1]!;
    // 防货币/价格误判：内容首尾非空白
    if (tex.length === 0 || tex[0] === " " || tex[tex.length - 1] === " ") return undefined;
    return { type: "doclightKatexInline", raw: match[0], tex };
  },
  renderer(token: Tokens.Generic) {
    return `<span class="doclight-katex-inline">${escapeHtml(token.tex)}</span>`;
  },
};

/** 块级公式：$$...$$（独立块） */
export const katexBlockExtension: TokenizerAndRendererExtension = {
  name: "doclightKatexBlock",
  level: "block",
  start(src: string) {
    return src.indexOf("$$");
  },
  tokenizer(src: string) {
    const match = /^\$\$\n?([\s\S]*?)\n?\$\$\s*/.exec(src);
    if (!match) return undefined;
    return { type: "doclightKatexBlock", raw: match[0], tex: match[1]! };
  },
  renderer(token: Tokens.Generic) {
    return `<div class="doclight-katex-block">${escapeHtml(token.tex)}</div>`;
  },
};
