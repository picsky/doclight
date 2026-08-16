/**
 * 链接与图片路径修正（03 §3.3.2 renderer 配套工具）
 *
 * 职责：判断外部链接、将相对链接/图片路径解析为站内绝对相对路径。
 * 纯函数，无 I/O、无状态，可单测。
 */

/** 判断是否为外部链接（http/https/mailto/tel/协议相对） */
export function isExternal(href: string): boolean {
  return /^(https?:|mailto:|tel:|data:)/.test(href) || href.startsWith("//");
}

/**
 * 将相对路径解析为站内路径（处理 ../ 归一化）。
 *
 * 例：fromPath="guide/quickstart.md", href="other.md" → "guide/other.md"
 *     fromPath="guide/quickstart.md", href="../img/logo.png" → "img/logo.png"
 * 外部链接 / 锚点 / 绝对路径原样返回。
 */
export function resolveRelative(fromPath: string, href: string): string {
  if (isExternal(href) || href.startsWith("#") || href.startsWith("/")) return href;
  const dir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/") + 1) : "";
  // 用 URL 解析器做 ../ 归一化（不需要额外依赖）
  const resolved = new URL(href, "https://doclight.invalid/" + dir);
  return resolved.pathname.slice(1);
}

/** 从标题文本生成锚点 id（中文保留，其余归一化为 -） */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * 从标题 raw 文本提取纯文本（2026-08 双读锚点修复 M5）：
 * 渲染内核（markdown.ts heading）与大纲分析（analyze.ts extractHeadings）共用此函数
 * 生成锚点 id——含链接/行内代码的标题（如 `## 参见 [MDN](url)`）两侧 id 一致，
 * docs.json / llms.txt / MCP 分节锚点与页面锚点不再分叉（REND-004）。
 */
export function headingPlainText(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // 图片（占位）
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接保留文本
    .replace(/[`*_~]/g, "") // 行内代码/强调标记
    .trim();
}
// escapeHtml 已收敛至 @doclight/core utils（P0-5）——renderer 内部各处直接从
// core/src/utils.ts 导入；本文件不再 re-export（拼接构建器下 re-export 会与
// 拼接进来的定义形成重复导出）。
