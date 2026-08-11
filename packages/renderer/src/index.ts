/**
 * doclight-renderer 入口（Node 渲染内核，单一事实来源）
 *
 * 渲染管线（03 §3.3.1）：frontmatter 提取 → marked 渲染 → DOMPurify sanitize。
 * 三形态（dev / SSG / bundle）产物全部复用本入口，浏览器展示层不接触原始 Markdown。
 *
 * 需求 ID：REND-001（渲染管线 + sanitize 安全测试集）
 */
import { parseFrontmatter, type Frontmatter } from "./core/frontmatter.js";
import { renderMarkdown } from "./core/markdown.js";
import { sanitizeHtml } from "./core/sanitize.js";

export const rendererVersion = "0.1.0";

export interface RenderOptions {
  /** 当前文档路径，用于相对链接/图片修正，如 "guide/quickstart.md" */
  currentPath?: string;
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
  const rawHtml = renderMarkdown(body, { currentPath: options.currentPath });
  const html = sanitizeHtml(rawHtml);
  return { html, frontmatter };
}
