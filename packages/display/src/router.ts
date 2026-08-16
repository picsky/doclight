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

/** 纯函数：路径归一（剥前导斜杠 / 剥 .md、.html 后缀 / 剥尾斜杠；空 → "/"） */
export function normNavPath(p: string): string {
  return p.replace(/^\/+/, "").replace(/\.(md|html)$/, "").replace(/\/$/, "") || "/";
}

/**
 * 纯函数：URL → 归一化导航目标路径（可 Node 测试）。
 * 2026-08 中文路径激活态修复：URL.pathname / location.hash 是**百分号编码**形态
 * （/%E8%AF%AD%E6%B3%95/...），而导航项 data-path 是**解码**形态（语法/...）——必须先
 * decodeURIComponent 再归一，否则中文目录激活态永不命中（语法/ 中文改名后潜伏的 bug）。
 * 流程：解析（bundle hash 路由取 hash 段）→ 解码 → 剥 DOCLIGHT_BASE 前缀 → 归一。
 */
export function navTargetPath(url: string, resolveBase: string, appBase: string): string {
  let p: string;
  try {
    const parsed = new URL(url, resolveBase);
    p = parsed.hash.startsWith("#/") ? parsed.hash.slice(1) : parsed.pathname;
  } catch {
    return "/";
  }
  try {
    p = decodeURIComponent(p);
  } catch {
    /* 个别异常编码（裸 % 等）保留原样 */
  }
  if (appBase && p.startsWith(appBase)) p = p.slice(appBase.length);
  return normNavPath(p);
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

/** 浏览器专用：从完整 HTML 提取页面部件（article 内容 / title——SPA 导航同步用；
 *  设计对齐：crumb 已内置于 article，无需单独抽取） */
function extractPageParts(html: string): { article: string | null; title: string | null } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return {
    article: doc.querySelector("article")?.innerHTML ?? null,
    title: /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? null,
  };
}

/**
 * 根据当前 URL 高亮导航中匹配项（data-path 与 URL 路径做 .md 归一比较）。
 * 2026-08 修复：
 * - 子路径部署（--base）：剥掉 window.DOCLIGHT_BASE 前缀再归一（此前高亮永不命中）
 * - 首页高亮：根级 README/index.md 等价 "/"（与 site.ts isRootIndex 收敛一致）
 * - aria-current：激活项同步标注（读屏当前位置感知）
 * 设计对齐（2026-08-16）：topnav 高亮——当前页所属顶层分组对应的顶栏链接同步点亮。
 * bundle 形态（05 §5.3.4）：hash 路由（#/guide/start.html），hash 优先于 pathname；
 * 普通锚点（#安装）不以 "#/" 开头，不受影响。
 */
export function highlightActive(url: string, navSelector = "aside.sidebar", topnavSelector = ".topnav"): void {
  const base = ((window as unknown as Record<string, unknown>)["DOCLIGHT_BASE"] as string | undefined) ?? "";
  // 2026-08 修复：navTargetPath 负责百分号解码（中文路径）+ base 剥离 + .md/.html 归一
  // （dev 用 .md URL、SSG 用 .html URL、bundle 用 .html hash，05 §5.3）
  const target = navTargetPath(url, location.href, base);
  // 根级置顶页（README/index.md）等价首页（site.ts navHref isRootIndex 同一规则）
  const isRootIndex = (p: string) => /^(README|index)\.(md|html)$/i.test(p.replace(/^\/+/, ""));
  let activeGroup: string | null = null;
  document.querySelectorAll<HTMLAnchorElement>(`${navSelector} a[data-path]`).forEach((a) => {
    const dp = a.getAttribute("data-path") ?? "";
    const active = target === "/" ? isRootIndex(dp) : normNavPath(dp) === target;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
    if (active) {
      // 设计对齐：记录当前页所属顶层分组（topnav 联动）
      const group = a.closest<HTMLElement>(".side-group");
      const title = group?.querySelector<HTMLElement>(".side-title")?.textContent?.trim() ?? null;
      if (title) activeGroup = title;
    }
  });
  // topnav 联动：data-topgroup 与当前页所属分组匹配 → active + aria-current
  document.querySelectorAll<HTMLAnchorElement>(`${topnavSelector} a[data-topgroup]`).forEach((a) => {
    const on = activeGroup !== null && a.dataset.topgroup === activeGroup;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  // DP-005 双向联动：导航后侧边栏滚动到激活项可见（长侧边栏不迷路；nearest 避免整页跳动）
  const sideActive = document.querySelector<HTMLElement>(`${navSelector} .side-item.active`);
  sideActive?.scrollIntoView({ block: "nearest" });
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

/** 导航序号：快速连续点击时丢弃过期响应（2026-08 修复竞态——后发先至覆盖新 URL） */
let navSeq = 0;

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

  const seq = ++navSeq;
  let html: string;
  try {
    const res = await fetch(target);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch {
    // 2026-08 修复：fetch 失败/404 不再静默无操作——降级整页跳转（浏览器呈现错误页）
    if (seq === navSeq) location.href = target;
    return;
  }
  if (seq !== navSeq) return; // 已有更新的导航，丢弃本次结果

  const content = document.querySelector<HTMLElement>("article");
  const parts = extractPageParts(html);
  if (content && parts.article !== null) {
    content.innerHTML = parts.article;
    if (parts.title) document.title = parts.title;
  }
  if (replace) history.replaceState(null, "", target);
  else history.pushState(null, "", target);

  // 2026-08 修复：导航后重置滚动（读至 60% 处点击链接 → 新页面从顶部开始；
  // 带 #anchor 的目标定位到锚点）
  const anchor = target.split("#")[1];
  if (anchor) {
    const el = document.getElementById(anchor);
    if (el) el.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  } else {
    window.scrollTo(0, 0);
  }

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

  /** bundle 导航：查内嵌数据注入内容，更新标题与高亮（不 fetch、不 pushState）。
   *  2026-08 修复：未知键（普通 #锚点）提前返回，不触发路由副作用（L12 噪音）；导航后滚回顶部。 */
  function handleBundleNavigation(): void {
    const key = bundlePageKey(location.hash);
    const content = document.querySelector<HTMLElement>("article");
    const html = bundle?.pages?.[key];
    if (content && html != null) {
      content.innerHTML = html;
      const title = bundle?.titles?.[key];
      if (title) document.title = title;
      // 锚点定位（#/path#sec 或 #/path + 原生锚点）；无锚点滚回顶部
      const anchor = location.hash.includes("#") ? location.hash.split("#").pop() : undefined;
      if (anchor && document.getElementById(anchor)) {
        document.getElementById(anchor)!.scrollIntoView({ block: "start" });
      } else {
        window.scrollTo(0, 0);
      }
      runAfterHooks(key);
      highlightActive(bundleMode && location.hash ? location.hash : location.href, navSelector);
    }
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
      // 2026-08 修复：修饰键/非左键放行浏览器默认行为（Ctrl/Cmd/Shift/Alt+点击 = 新标签/新窗口，
      // 中键 = 后台标签——文档站最常用操作，此前被无条件 preventDefault 吞掉）
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
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
