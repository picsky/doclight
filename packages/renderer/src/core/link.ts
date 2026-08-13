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

/** HTML 转义（转义 & < > " '，与 marked 默认 code escape 一致） */
export function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return s.replace(/[&<>"']/g, (ch) => map[ch]!);
}
