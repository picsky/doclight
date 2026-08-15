/**
 * @doclight/display 入口（浏览器展示层）
 *
 * 只消费渲染内核输出的 HTML（服务端直出/SSG/bundle），不接触原始 Markdown。
 * mount() 挂载：主题切换 + SPA 导航（含路由钩子）+ TOC + 内置搜索 + 移动端侧边栏
 * + 扩展语法增强器（REND-002：复制/高亮/KaTeX，vendor 懒加载；Mermaid 已迁移为插件）
 * + 插件管理器（PLUG-004：init → onRouteChange（前置守卫）→ onMount → destroy）
 * + 体验细节（UX-001：阅读进度 / 回到顶部 / Powered by）。
 * 构建产物 dist/display.js 由 dev server / SSG 页面引用。
 */
import { initTheme } from "./theme.ts";
import { initRouter, type Router } from "./router.ts";
import { initSidebar } from "./sidebar.ts";
import { initToc, type TocApi } from "./toc.ts";
import { initSearch, type SearchApi } from "./search.ts";
import { initExtensions, type ExtensionsApi, winGlobal } from "./extensions.ts";
import { initUx } from "./ux.ts";
import { initDesign } from "./design.ts";
import { bus } from "./event-bus.ts";
import { PluginManager, registerConfiguredPlugins } from "./plugin-manager.ts";
import type { PluginDef } from "../../core/src/plugin.ts";

export const displayVersion = "0.1.0";

// 惰性初始化：build-display 拼接产物为字母序，class PluginManager 声明在
// index.ts 之后——顶层 new 会触发 TDZ（Cannot access before initialization）。
let pluginMgr: PluginManager | null = null;

function getPluginMgr(): PluginManager {
  if (!pluginMgr) pluginMgr = new PluginManager();
  return pluginMgr;
}

/** 注册插件（展示层全局入口，供页面脚本或 bundle 内联调用） */
export function use(plugin: PluginDef): void {
  getPluginMgr().use(plugin);
}

let mounted = false;
let mountedApi: ReturnType<typeof mount> | null = null;

/** 挂载展示层（页面 DOM 就绪后调用；幂等——重复调用返回既有实例，2026-08 修复 L6） */
export function mount(): Router & {
  toc: TocApi;
  search: SearchApi;
  extensions: ExtensionsApi;
  bus: typeof bus;
  plugins: PluginManager;
} {
  if (mounted && mountedApi) return mountedApi;
  mounted = true;

  initTheme();
  const router = initRouter({ contentSelector: "article", navSelector: "aside.sidebar" });
  const toc = initToc({ articleSelector: "article" });
  const search = initSearch();
  const extensions = initExtensions();
  initSidebar();
  initUx(); // UX-001 体验细节：阅读进度 / 顶栏滚动态 / Powered by
  initDesign(); // 设计对齐（2026-08-16）：CJK 空隙 / 锚点闪烁 / Tabs 联动 / 反馈卡 / 平台快捷键

  // PLUG-014：doclight.json 插件运行时配置自动注册（构建时注入
  // window.DOCLIGHT_PLUGIN_CONFIGS + 页面脚本挂 window.DOCLIGHT_PLUGINS）
  registerConfiguredPlugins(
    winGlobal("DOCLIGHT_PLUGIN_CONFIGS") as Array<{ name: string; config?: Record<string, unknown>; enabled?: boolean }> | undefined,
    winGlobal("DOCLIGHT_PLUGINS") as Record<string, PluginDef> | undefined,
    (p) => getPluginMgr().use(p)
  );

  // PLUG-004 插件管理器集成（configure 注入运行时依赖——2026-08 替换 ["opts"] 私有越界写入；
  // registerRouteGuard 把 onRouteChange 接入 router.beforeEach 决策链，H1 契约修复）
  getPluginMgr().configure({
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
    registerRouteGuard: (guard) => {
      router.beforeEach((ctx) => guard(ctx.to));
    },
  });
  const appApi = getPluginMgr().initApp();
  getPluginMgr().subscribeRouteChange();
  getPluginMgr().notifyMount();

  bus.emit("doclight:mount");
  bus.emit("doclight:plugin:ready", appApi);

  mountedApi = { ...router, toc, search, extensions, bus, plugins: getPluginMgr() };
  return mountedApi;
}

// 以 <script type="module"> 加载时自动挂载（模块天然延迟执行，DOM 已就绪；
// 2026-08 修复：readyState 兜底——DOMContentLoaded 已过时直接挂载，避免永不挂载）
if (typeof window !== "undefined") {
  // 暴露全局 doclight.use 供外部插件脚本调用
  (window as unknown as Record<string, unknown>).doclight = {
    ...(typeof (window as unknown as Record<string, unknown>).doclight === "object"
      ? ((window as unknown as Record<string, unknown>).doclight as Record<string, unknown>)
      : {}),
    use,
  };
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => mount());
  } else {
    // 拼接式产物（build-display.mjs）按字母序拼接：index.ts 先于 ux.ts 等模块执行，
    // 同步 mount 会命中后续模块顶层 const 的 TDZ（Cannot access before initialization）——
    // 微任务保证整包求值完成后再挂载
    queueMicrotask(() => mount());
  }
}
