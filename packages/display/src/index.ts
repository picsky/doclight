/**
 * doclight-display 入口（浏览器展示层）
 *
 * 只消费渲染内核输出的 HTML（服务端直出/SSG/bundle），不接触原始 Markdown。
 * mount() 挂载：主题切换 + SPA 导航（含路由钩子）+ TOC + 内置搜索 + 移动端侧边栏。
 * 构建产物 dist/display.js 由 dev server / SSG 页面引用。
 */
import { initTheme } from "./theme.ts";
import { initRouter, type Router } from "./router.ts";
import { initSidebar } from "./sidebar.ts";
import { initToc, type TocApi } from "./toc.ts";
import { initSearch, type SearchApi } from "./search.ts";
import { bus } from "./event-bus.ts";

export const displayVersion = "0.1.0";

/** 挂载展示层（页面 DOM 就绪后调用） */
export function mount(): Router & { toc: TocApi; search: SearchApi; bus: typeof bus } {
  initTheme();
  const router = initRouter({ contentSelector: "article", navSelector: "aside.sidebar" });
  const toc = initToc({ articleSelector: "article" });
  const search = initSearch();
  initSidebar();
  bus.emit("doclight:mount");
  return { ...router, toc, search, bus };
}

// 以 <script type="module"> 加载时自动挂载（模块天然延迟执行，DOM 已就绪）
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => mount());
}
