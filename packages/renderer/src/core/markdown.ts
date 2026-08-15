/**
 * Markdown 渲染（03 §3.3，marked 封装 + 自定义 renderer）
 *
 * 基于 marked v18 扩展：渲染器方法接收 token 对象（非旧版字符串签名），
 * 内联内容用 this.parser.parseInline(tokens) 保留加粗/斜体/链接等格式。
 * 每次调用新建独立 Marked 实例，避免全局实例状态污染。
 *
 * 注意：renderer 必须用对象字面量（自带可枚举方法 key）——
 * marked.use 只遍历 renderer 的自有可枚举 key，类实例的方法在原型上、
 * #私有字段不可见，会导致自定义 renderer 静默不生效。
 *
 * 自定义能力（03 §3.3.2 + REND-002 扩展注册表）：
 * - 标题：注入锚点 id（供 TOC / 跳转）
 * - 链接：区分外部链接（新标签打开）与站内相对链接（路径修正）
 * - 图片：相对路径修正 + 懒加载
 * - 代码块：renderCodeBlock 分流（普通 → 高亮+复制标记；Mermaid 围栏由
 *   @doclight/plugin-mermaid 的 extendMarked 扩展接管，PLUG-012 迁移）
 * - 表格：包裹 .table-wrap 容器（横向滚动）
 * - 扩展语法：从注册表（getExtensions）挂载容器 / KaTeX 等 marked 扩展
 */
import { Marked, type RendererObject, type TokenizerAndRendererExtension, type Tokens } from "marked";
import { headingPlainText, isExternal, resolveRelative, slugify } from "./link.ts";
import { renderCodeBlock } from "../extensions/code.ts";
import { getExtensions } from "../extensions/registry.ts";

export interface MarkdownOptions {
  /** 当前文档路径，用于相对链接/图片修正，如 "guide/quickstart.md" */
  currentPath?: string;
  /** 站内链接后缀（SSG 形态 ".html"；dev 缺省 "" 保持 .md 链接，见 05 §5.3） */
  linkSuffix?: string;
  /** PLUG-006：插件提供的额外 marked 扩展（追加到注册表扩展之后） */
  extraMarkedExtensions?: unknown[];
}

/** 将 Markdown 渲染为（未消毒的）HTML 片段。调用方必须再过 sanitizeHtml。 */
export function renderMarkdown(md: string, options: MarkdownOptions = {}): string {
  const currentPath = options.currentPath ?? "README.md";
  const linkSuffix = options.linkSuffix ?? "";
  const renderer: RendererObject = {
    heading({ tokens, depth }: Tokens.Heading) {
      const raw = tokens.map((t) => t.raw ?? "").join("");
      // 2026-08 双读锚点修复：先剥行内标记再 slugify（与 analyze.ts 大纲同源，REND-004）
      return `<h${depth} id="${slugify(headingPlainText(raw))}">${this.parser.parseInline(tokens)}</h${depth}>`;
    },
    link({ href, tokens }: Tokens.Link) {
      const text = this.parser.parseInline(tokens);
      if (isExternal(href)) {
        return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
      }
      // SSG 形态：内部 markdown 链接转 .html 后缀（05 §5.3.2 静态产物 URL）
      const resolved = resolveRelative(currentPath, href);
      const hrefOut = linkSuffix && resolved.endsWith(".md") ? `${resolved.slice(0, -3)}${linkSuffix}` : resolved;
      return `<a href="${hrefOut}">${text}</a>`;
    },
    image({ href, text }: Tokens.Image) {
      const src = resolveRelative(currentPath, href);
      return `<img src="${src}" alt="${text}" loading="lazy" />`;
    },
    code({ text, lang }: Tokens.Code) {
      // REND-002：普通代码块分流（含转义，纵深防御）；Mermaid 围栏由插件扩展接管
      return renderCodeBlock(text, lang);
    },
    table(token: Tokens.Table) {
      const cell = (c: Tokens.TableCell) => `<td>${this.parser.parseInline(c.tokens)}</td>`;
      const head = `<tr>${token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join("")}</tr>`;
      const body = token.rows.map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("");
      return `<div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
    },
  };
  const marked = new Marked();
  marked.use({ renderer });
  // REND-002：挂载注册表中启用的扩展（容器 / KaTeX 等）
  for (const ext of getExtensions()) {
    if (ext.markedExtensions?.length) marked.use({ extensions: ext.markedExtensions });
  }
  // PLUG-006：挂载插件提供的额外 marked 扩展（extendMarked 钩子收集）
  if (options.extraMarkedExtensions?.length) {
    for (const ext of options.extraMarkedExtensions) {
      if (ext) marked.use({ extensions: ext as TokenizerAndRendererExtension[] });
    }
  }
  // 本项目始终同步渲染（不启用 async），parse 返回 Promise 的分支不会被触发
  return marked.parse(md) as string;
}
