/**
 * 路由系统（03 §3.2，SPA 导航 + 路由钩子，PLUG-002）
 *
 * 劫持站内链接点击 → fetch 目标页（dev server 首屏直出完整 HTML）→ 提取内容
 * 注入 <article> → history.pushState 更新 URL → 高亮当前导航项。
 * 浏览器只消费已渲染 HTML，不接触 Markdown（架构原则）。
 *
 * 路由钩子（03 §3.2.4，插件用）：
 * - beforeEach({ from, to })：返回 false 取消导航 / 返回字符串重定向 / 不返回则继续
 * - afterEach({ from, to })：导航完成后执行（TOC 重建、统计埋点等）
 * 导航成功后同步向事件总线发布 doclight:routechange（插件通过 bus 订阅）。
 * DOM 只在函数内访问；纯逻辑（isInternalLink / resolveBeforeHooks）可在 Node 中测试。
 */
import { bus, type Unsubscribe } from "./event-bus.ts";

/** 纯函数：判断链接是否为站内链接（同 origin 且非锚点） */
export function isInternalLink(href: string | null | undefined, base: string): boolean {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  try {
    return new URL(href, base).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/** 路由上下文（钩子参数） */
export interface RouteContext {
  /** 来源路径（首次加载为 null） */
  from: string | null;
  /** 目标路径 */
  to: string;
  /** 是否 history.replaceState（前进后退为 true） */
  replace: boolean;
}

export type BeforeHook = (ctx: RouteContext) => boolean | string | void;
export type AfterHook = (ctx: RouteContext) => void;

/** 纯函数：依次执行 beforeEach，得出导航决策（可测） */
export function resolveBeforeHooks(
  hooks: BeforeHook[],
  ctx: RouteContext
): { action: "continue" | "cancel" | "redirect"; to?: string } {
  for (const hook of hooks) {
    const r = hook(ctx);
    if (r === false) return { action: "cancel" };
    if (typeof r === "string") return { action: "redirect", to: r };
  }
  return { action: "continue" };
}

/** 浏览器专用：从完整 HTML 提取 <article> 内容 */
function extractArticle(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.querySelector("article")?.innerHTML ?? null;
}

/** 提取 <title>（用于 SPA 导航后更新文档标题） */
function extractTitle(html: string): string | null {
  return /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? null;
}

/**
 * 根据当前 URL 高亮导航中匹配项（data-path 与 URL 路径做 .md 归一比较）。
 * bundle 形态（05 §5.3.4）：hash 路由（#/guide/start.html），hash 优先于 pathname；
 * 普通锚点（#安装）不以 "#/" 开头，不受影响。
 */
export function highlightActive(url: string, navSelector = "aside.sidebar"): void {
  const path = (() => {
    try {
      const parsed = new URL(url, location.href);
      return parsed.hash.startsWith("#/") ? parsed.hash.slice(1) : parsed.pathname;
    } catch {
      return "/";
    }
  })();
  // .md / .html 后缀都归一（dev 用 .md URL、SSG 用 .html URL、bundle 用 .html hash，05 §5.3）
  const norm = (p: string) => p.replace(/^\/+/, "").replace(/\.(md|html)$/, "").replace(/\/$/, "") || "/";
  const target = norm(path);
  document.querySelectorAll<HTMLAnchorElement>(`${navSelector} a[data-path]`).forEach((a) => {
    a.classList.toggle("active", norm(a.getAttribute("data-path") ?? "") === target);
  });
}

/** 路由 API（initRouter 返回值，供 mount 与插件使用） */
export interface Router {
  /** 注册 beforeEach 钩子，返回退订函数 */
  beforeEach(hook: BeforeHook): Unsubscribe;
  /** 注册 afterEach 钩子，返回退订函数 */
  afterEach(hook: AfterHook): Unsubscribe;
  /** 主动导航到站内 URL */
  navigate(url: string, replace?: boolean): Promise<void>;
}

/** 导航到站内 URL：beforeEach 决策 → fetch → 注入内容 → 更新 URL → afterEach + 总线事件 */
async function navigateWithHooks(
  url: string,
  replace: boolean,
  state: { from: string | null; beforeHooks: BeforeHook[]; afterHooks: AfterHook[] }
): Promise<void> {
  const decision = resolveBeforeHooks(state.beforeHooks, { from: state.from, to: url, replace });
  if (decision.action === "cancel") return;
  let target = url;
  if (decision.action === "redirect" && decision.to) target = decision.to;

  const res = await fetch(target);
  if (!res.ok) return;
  const html = await res.text();
  const content = document.querySelector<HTMLElement>("article");
  const article = extractArticle(html);
  if (content && article !== null) {
    content.innerHTML = article;
    const title = extractTitle(html);
    if (title) document.title = title;
  }
  if (replace) history.replaceState(null, "", target);
  else history.pushState(null, "", target);

  const ctx: RouteContext = { from: state.from, to: target, replace };
  state.from = target;
  for (const hook of state.afterHooks) {
    try {
      hook(ctx);
    } catch {
      /* 隔离单个 afterEach 钩子异常 */
    }
  }
  bus.emit("doclight:routechange", ctx);
  highlightActive(target);
}

/** bundle 形态内嵌数据（__DOCLLIGHT_BUNDLE__：pages/titles，hash 路由 + 零网络） */
interface BundleData {
  pages?: Record<string, string>;
  titles?: Record<string, string>;
}

/** 纯函数：hash/路径 → 内嵌数据键（统一带前导斜杠；空 → 首页 "/"） */
export function bundlePageKey(raw: string): string {
  const p = raw.split("#").pop()!.split("?")[0]!.replace(/^\/+/, "");
  if (!p || p === "/") return "/";
  return `/${p}`;
}

/** 初始化：拦截站内链接点击 + popstate 前进后退 + 钩子注册 API */
export function initRouter(options: { contentSelector?: string; navSelector?: string } = {}): Router {
  const navSelector = options.navSelector ?? "aside.sidebar";
  const state = { from: null as string | null, beforeHooks: [] as BeforeHook[], afterHooks: [] as AfterHook[] };
  // bundle 形态（05 §5.3.4）：file:// 无法 pushState，用 hash 路由 + 内嵌页面数据，不发起 fetch
  const bundle = (window as unknown as Record<string, unknown>)["__DOCLLIGHT_BUNDLE__"] as BundleData | undefined;
  const bundleMode = !!bundle;

  function runAfterHooks(to: string): void {
    const ctx: RouteContext = { from: state.from, to, replace: false };
    state.from = to;
    for (const hook of state.afterHooks) {
      try {
        hook(ctx);
      } catch {
        /* 隔离单个 afterEach 钩子异常 */
      }
    }
    bus.emit("doclight:routechange", ctx);
  }

  /** bundle 导航：查内嵌数据注入内容，更新标题与高亮（不 fetch、不 pushState） */
  function handleBundleNavigation(): void {
    const key = bundlePageKey(location.hash);
    const content = document.querySelector<HTMLElement>("article");
    const html = bundle?.pages?.[key];
    if (content && html != null) {
      content.innerHTML = html;
      const title = bundle?.titles?.[key];
      if (title) document.title = title;
    }
    runAfterHooks(key);
    highlightActive(bundleMode && location.hash ? location.hash : location.href, navSelector);
  }

  if (bundleMode) {
    // 导航链接为 #/xxx（renderNav hash 模式）：浏览器天然维护 hash 历史，hashchange 接管
    window.addEventListener("hashchange", handleBundleNavigation);
    // 初次加载高亮（hash 路由：hash 优先）
    highlightActive(location.hash || location.href, navSelector);
  } else {
    document.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!target || target.target === "_blank") return;
      const href = target.getAttribute("href");
      if (!isInternalLink(href, location.href)) return;
      e.preventDefault();
      void navigateWithHooks(href!, false, state);
    });

    window.addEventListener("popstate", () => void navigateWithHooks(location.href, true, state));

    // 初次加载高亮（直出页）
    highlightActive(location.href, navSelector);
  }

  return {
    beforeEach(hook) {
      state.beforeHooks.push(hook);
      return () => {
        state.beforeHooks = state.beforeHooks.filter((h) => h !== hook);
      };
    },
    afterEach(hook) {
      state.afterHooks.push(hook);
      return () => {
        state.afterHooks = state.afterHooks.filter((h) => h !== hook);
      };
    },
    navigate(url, replace = false) {
      if (bundleMode) {
        location.hash = bundlePageKey(url);
        return Promise.resolve();
      }
      return navigateWithHooks(url, replace, state);
    },
  };
}
