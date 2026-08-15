/**
 * XSS 防护（02 §2.3.7，强制安全层）
 *
 * DOMPurify + jsdom：渲染管线的最后一步，一次性清除危险 HTML。
 * linkedom 等轻量 DOM 经 spike 实测与 DOMPurify 不兼容（sanitize 静默失效），
 * 因此 Node 侧必须用 jsdom（完整 DOM 实现）——这是安全红线，不可替换。
 *
 * jsdom 实例惰性创建并复用（同一进程只建一次），避免每次渲染重建开销。
 * jsdom 是服务端运行依赖，不进浏览器产物，不计入展示层体积。
 */
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

let purifier: ReturnType<typeof DOMPurify> | null = null;

function getPurifier(): ReturnType<typeof DOMPurify> {
  if (!purifier) {
    const { window } = new JSDOM("<!DOCTYPE html><body></body>");
    purifier = DOMPurify(window);
  }
  return purifier;
}

/**
 * 内联图解 SVG 白名单（设计对齐 2026-08-16：宪法 §4.5 图解组件——inline SVG，
 * 复用全部 design token（class 标记），随主题自动切换）。
 *
 * DOMPurify html 配置文件默认不含 svg 标签（spike 实测整棵 svg 子树被剥离），
 * 此处显式放行一个**安全子集**：纯图形/文本元素 + 样式/几何属性，全部无脚本语义。
 * 安全边界（DOMPurify 默认行为仍然生效）：
 * - script/style/on* 事件属性照常剥离（svg 内 <script> 同被清理）
 * - href/xlink:href 的 javascript: 等危险 URL 照常拦截
 * - 禁止放行 <a>/<foreignObject>/<use xlink:href>（外部引用与跳转面）
 * 新增任一元素/属性前必须过 .spike/sanitize-svg-spike.mjs 的注入断言。
 */
const SVG_TAGS = [
  "svg", "g", "defs", "marker", "path", "rect", "circle", "ellipse", "line",
  "polyline", "polygon", "text", "tspan", "title", "desc", "symbol",
];
const SVG_ATTRS = [
  "viewBox", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height", "d", "points", "fill", "stroke", "stroke-width",
  "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "stroke-opacity",
  "fill-opacity", "opacity", "marker-end", "marker-start", "marker-mid",
  "text-anchor", "font-size", "font-family", "font-weight", "letter-spacing",
  "transform", "preserveAspectRatio", "orient", "refX", "refY", "markerWidth",
  "markerHeight", "markerUnits", "startOffset", "dx", "dy",
];

/**
 * 对已渲染 HTML 做白名单消毒（HTML 配置文件，剔除脚本/事件属性/危险 URL）。
 *
 * ADD_ATTR 放行的属性均为良性渐进增强，且由渲染器配套约束保证安全：
 * - target：仅外部链接带 rel="noopener"（渲染器强制），防 window.opener 劫持
 * - loading：图片懒加载，无脚本语义
 * DOMPurify 默认剥离二者（保守策略），此处显式放行。
 *
 * REND-002 扩展标记（doclight-container / doclight-code / language-* 等）无需
 * 额外放行，安全由「内容承载铁律」保证（spike 实测，2026-08-13）：
 * - 标记只用 class（DOMPurify 默认放行，且 class 无脚本语义）
 * - 扩展内容一律放子元素/文本（KaTeX 源码 / 插件 Mermaid 源码），**不依赖 data-***——
 *   实测 DOMPurify 对 data-* 的放行受属性值内容影响（含 > 时被剥离），不可依赖
 * - 源码经 escapeHtml 转义后入 DOM，展示层读取 textContent 还原（纯文本，无注入面）
 * 每新增扩展必须在注册表（extensions/registry.ts）登记其 class 与降级策略。
 */
export function sanitizeHtml(html: string): string {
  // HOOKS 为 DOMPurify 运行时支持的配置项（本版 .d.ts 未收录），经 Parameters 提取 Config 类型安全注入
  const config = {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "loading", ...SVG_ATTRS],
    ADD_TAGS: [...SVG_TAGS, "figure", "figcaption"],
    HOOKS: {
      // 图解内禁止链接元素（宪法 §4.5 图解为纯图形；防 svg 内 <a href> 的跳转面）
      uponSanitizeElement: (node: Element) => {
        if (node.nodeName === "A" && node.closest("svg")) {
          node.remove();
        }
      },
    },
  } as Parameters<ReturnType<typeof DOMPurify>["sanitize"]>[1];
  return getPurifier().sanitize(html, config);
}
