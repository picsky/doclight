/**
 * 文档语义分析（06 §6.3.1 语义 frontmatter 的自动计算侧，FRONT-001）
 *
 * 纯函数、零依赖（Node 侧可测）：输入 Markdown 原文，输出 AI 可直接消费的语义
 * 字段——summary（首段自动提取）/ wordCount / readingTime / headings（大纲）/
 * hasCode。frontmatter 中已有的语义字段（summary/tags/difficulty/ai.* 等）原样
 * 透传，由调用方（cli/llms/MCP）合并；本模块只负责「没写就自动算」的部分。
 *
 * 为什么放 renderer：与渲染内核同一事实来源（标题 id 用同一 slugify），保证
 * MCP get_outline / read_doc section 锚点与页面锚点一致（REND-004 双读友好）。
 * 刻意放在 src/ 而非受保护 core/：只新增不改既有渲染管线。
 */
import { parseFrontmatter } from "./core/frontmatter.ts";
import { slugify } from "./core/link.ts";

export interface DocHeading {
  level: number;
  /** 与渲染内核一致的锚点 id（slugify），页面可跳转 */
  id: string;
  text: string;
}

export interface DocAnalysis {
  /** 摘要：frontmatter.summary/description 优先，否则正文首个非空段落（截断 ~200 字） */
  summary: string;
  /** 正文字数：CJK 逐字 + 非 CJK 空白分词（与 05 §5.4 JSON-LD 口径一致） */
  wordCount: number;
  /** 预估阅读分钟数（中文 ~300 字/分，向下取整，最少 1） */
  readingTime: number;
  /** 大纲：正文标题（H1-H6，排除代码块内），按出现顺序 */
  headings: DocHeading[];
  /** 是否含代码块（``` 围栏），MCP find_examples 的候选 */
  hasCode: boolean;
}

/** 去除行首 Markdown 标记与行内语法，取纯文本（标题/摘要用） */
function stripLine(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "") // 标题标记
    .replace(/^\s*(>|\*|-|\+|\d+\.)\s+/, "") // 引用/无序/有序列表标记
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // 图片（占位）
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接保留文本
    .replace(/[`*_~]/g, "") // 行内代码/强调标记
    .trim();
}

/** 正文 → 纯文本（统计用）：剥 frontmatter/代码块/HTML/图片/链接/块级标记 */
function bodyToText(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "") // 标题标记（否则 "#" 会被当单词计数）
    .replace(/^\s{0,3}([-*+>]|\d+\.)\s+/gm, " "); // 列表/引用标记
}

/** 正文字数：CJK 逐字 + 非 CJK 空白分词（纯函数，可测；内部剥 frontmatter） */
export function countWords(markdown: string): number {
  const { body } = parseFrontmatter(markdown);
  const text = bodyToText(body);
  const cjk = text.match(/[一-鿿]/g) ?? [];
  const nonCjk = text.split(/\s+/).filter((w) => w && !/[一-鿿]/.test(w));
  return cjk.length + nonCjk.length;
}

/** 是否为标题行（摘要提取跳过：首段指内容段落，不含标题） */
function isHeadingLine(line: string): boolean {
  return /^#{1,6}\s+/.test(line);
}

/** 提取摘要：显式 summary/description 优先，否则正文首个非空内容段落（截断 ~200 字） */
function extractSummary(frontmatter: Record<string, unknown>, body: string): string {
  for (const key of ["summary", "description"]) {
    const v = frontmatter[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  let inFence = false;
  const firstPara = body
    .split(/\r?\n/)
    .find((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return false;
      }
      if (inFence || isHeadingLine(line)) return false;
      return stripLine(line).length > 0;
    });
  const text = firstPara ? stripLine(firstPara) : "";
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

/** 提取大纲：正文标题行（H1-H6），排除代码围栏内 */
function extractHeadings(body: string): DocHeading[] {
  const headings: DocHeading[] = [];
  let inFence = false;
  for (const line of body.split(/\r?\n/)) {
    const fence = /^\s*```/.test(line);
    if (fence) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!m) continue;
    const text = stripLine(line);
    if (!text) continue;
    headings.push({ level: m[1]!.length, id: slugify(text), text });
  }
  return headings;
}

/** 语义分析入口：parseFrontmatter 剥 frontmatter → 计算各字段。纯函数无 I/O。 */
export function analyzeDoc(markdown: string): DocAnalysis {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const wordCount = countWords(markdown);
  return {
    summary: extractSummary(frontmatter, body),
    wordCount,
    readingTime: Math.max(1, Math.round(wordCount / 300)),
    headings: extractHeadings(body),
    hasCode: /```/.test(body),
  };
}
