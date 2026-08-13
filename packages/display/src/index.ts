/**
 * doclight-display 入口（浏览器展示层）
 *
 * 只消费渲染内核输出的 HTML（服务端直出/SSG/bundle），不接触原始 Markdown。
 * mount() 挂载：主题切换 + SPA 导航（含路由钩子）+ TOC + 内置搜索 + 移动端侧边栏
 * + 扩展语法增强器（REND-002：复制/高亮/Mermaid 容错/KaTeX，vendor 懒加载）
 * + 插件管理器（PLUG-004：init → onMount → onRouteChange → destroy）
 * + 体验细节（UX-001：专注模式 / 字号调节 / Powered by）。
 * 构建产物 dist/display.js 由 dev server / SSG 页面引用。
 */
import { initTheme } from "./theme.ts";
import { initRouter, type Router } from "./router.ts";
import { initSidebar } from "./sidebar.ts";
import { initToc, type TocApi } from "./toc.ts";
import { initSearch, type SearchApi } from "./search.ts";
import { initExtensions, type ExtensionsApi } from "./extensions.ts";
import { initUx } from "./ux.ts";
import { bus } from "./event-bus.ts";
import { PluginManager } from "./plugin-manager.ts";
import type { PluginDef } from "../../core/src/plugin.ts";

export const displayVersion = "0.1.0";

/** 全局插件注册入口（07 §7.5 doclight.use()） */
const pluginMgr = new PluginManager();

/** 注册插件（展示层全局入口，供页面脚本或 bundle 内联调用） */
export function use(plugin: PluginDef): void {
  pluginMgr.use(plugin);
}

/** 挂载展示层（页面 DOM 就绪后调用） */
export function mount(): Router & {
  toc: TocApi;
  search: SearchApi;
  extensions: ExtensionsApi;
  bus: typeof bus;
  plugins: PluginManager;
} {
  initTheme();
  const router = initRouter({ contentSelector: "article", navSelector: "aside.sidebar" });
  const toc = initToc({ articleSelector: "article" });
  const search = initSearch();
  const extensions = initExtensions();
  initSidebar();
  initUx(); // UX-001 体验细节：专注模式 / 字号调节 / Powered by

  // PLUG-004 插件管理器集成
  pluginMgr["opts"] = {
    navigate: router.navigate,
    currentPath: () => {
      try {
        return location.hash.startsWith("#/") ? location.hash.slice(1) : location.pathname;
      } catch {
        return "/";
      }
    },
    currentFrontmatter: () => {
      // frontmatter 由 SSG/dev 注入到 <meta> 或 window 全局（后续迭代）
      return {};
    },
  };
  const appApi = pluginMgr.initApp();
  pluginMgr.subscribeRouteChange();
  pluginMgr.notifyMount();

  bus.emit("doclight:mount");
  bus.emit("doclight:plugin:ready", appApi);

  return { ...router, toc, search, extensions, bus, plugins: pluginMgr };
}

// 以 <script type="module"> 加载时自动挂载（模块天然延迟执行，DOM 已就绪）
if (typeof window !== "undefined") {
  // 暴露全局 doclight.use 供外部插件脚本调用
  (window as unknown as Record<string, unknown>).doclight = {
    ...(typeof (window as unknown as Record<string, unknown>).doclight === "object"
      ? ((window as unknown as Record<string, unknown>).doclight as Record<string, unknown>)
      : {}),
    use,
  };
  window.addEventListener("DOMContentLoaded", () => mount());
}
