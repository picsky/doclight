/**
 * doclight-renderer 入口（Node 渲染内核，单一事实来源）
 *
 * 渲染管线（03 §3.3.1）：frontmatter 提取 → marked 渲染 → DOMPurify sanitize。
 * 三形态（dev / SSG / bundle）产物全部复用本入口，浏览器展示层不接触原始 Markdown。
 *
 * 需求 ID：REND-001（渲染管线 + sanitize 安全测试集）/ REND-002（扩展语法注册表）
 */
import { parseFrontmatter, type Frontmatter } from "./core/frontmatter.ts";
import { renderMarkdown } from "./core/markdown.ts";
import { sanitizeHtml } from "./core/sanitize.ts";
export { buildDocsJson, buildNavTree } from "./nav.ts";
export type { DocsJson, NavFile, NavGroup, NavNode } from "./nav.js";
// FRONT-001 语义 frontmatter 自动计算（summary/readingTime/wordCount/headings，06 §6.3.1）
export { analyzeDoc, countWords } from "./analyze.ts";
export type { DocAnalysis, DocHeading } from "./analyze.ts";
// REND-002 扩展语法注册表（白名单式：schema / 注册 / 懒加载映射 / 降级策略）
export {
  DEFAULT_EXTENSIONS,
  getExtensions,
  getExtension,
  isEnabled,
  setExtensions,
  collectExtensionClasses,
} from "./extensions/registry.ts";
export type { ExtensionDef, ClientDependency } from "./extensions/types.ts";

export const rendererVersion = "0.1.0";

export interface RenderOptions {
  /** 当前文档路径，用于相对链接/图片修正，如 "guide/quickstart.md" */
  currentPath?: string;
  /** 站内链接后缀（SSG 形态 ".html"；dev 缺省 "" 保持 .md 链接，见 05 §5.3） */
  linkSuffix?: string;
  /** PLUG-006：插件提供的额外 marked 扩展（追加到注册表扩展之后） */
  extraMarkedExtensions?: unknown[];
}

export interface RenderResult {
  /** 已 sanitize 的 HTML（可直接注入展示层） */
  html: string;
  /** 从 frontmatter 提取的元数据 */
  frontmatter: Frontmatter;
}

/** 渲染 Markdown 为安全的 HTML（frontmatter → marked → sanitize 全管线） */
export function render(markdown: string, options: RenderOptions = {}): RenderResult {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const rawHtml = renderMarkdown(body, {
    currentPath: options.currentPath,
    linkSuffix: options.linkSuffix,
    extraMarkedExtensions: options.extraMarkedExtensions,
  });
  const html = sanitizeHtml(rawHtml);
  return { html, frontmatter };
}
