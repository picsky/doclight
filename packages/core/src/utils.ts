/**
 * 共享纯工具（2026-08 review P0-5：escapeHtml 收敛到单一权威来源）。
 *
 * 此前 8 处本地实现存在语义分叉（转义 3/4/5 字符不等）——安全敏感工具函数
 * 分叉即风险（任何一处漏转义都是注入面）。core 零依赖且浏览器/Node 双端安全，
 * 是权威落点。语义取最严格超集（5 字符）：多转义的引号在 HTML 中渲染等价，
 * 对既有调用点零破坏。
 */

/** HTML 转义（& < > " ' 五字符，与 marked 默认 code escape 一致） */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
