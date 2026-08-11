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
 * 对已渲染 HTML 做白名单消毒（HTML 配置文件，剔除脚本/事件属性/危险 URL）。
 *
 * ADD_ATTR 放行的两个属性均为良性渐进增强，且由渲染器配套约束保证安全：
 * - target：仅外部链接带 rel="noopener"（渲染器强制），防 window.opener 劫持
 * - loading：图片懒加载，无脚本语义
 * DOMPurify 默认剥离二者（保守策略），此处显式放行。
 */
export function sanitizeHtml(html: string): string {
  return getPurifier().sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "loading"],
  });
}
