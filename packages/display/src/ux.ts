/**
 * 体验细节（C4）：专注模式 / Powered by。
 *
 * 核心逻辑抽成纯函数（可单测）；DOM 接线在 initUx() 薄层。全部持久化 localStorage。
 * - 专注模式：body.focus-mode → 隐藏侧栏/TOC、内容加宽聚焦（CSS 见 site.ts renderPage）
 * - Powered by：默认显示、可关闭（13 §4 传播机制；尊重自托管数据洁癖，非强制）
 * - 字号调节：已移除（2026-08-14 用户判定伪需求——浏览器原生缩放已覆盖，A−/A+ 冗余）
 */
import { bus } from "./event-bus.ts";

const FOCUS_KEY = "doclight-focus-mode";
const POWERED_KEY = "doclight-powered-by-hidden";

/** 纯函数：专注模式下一状态（toggle） */
export function nextFocusState(active: boolean): boolean {
  return !active;
}

function readNumber(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    return v === null ? null : Number(v);
  } catch {
    return null; // localStorage 不可用（隐私模式）降级
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 忽略写入失败 */
  }
}

/** 专注模式：toggle body.focus-mode + aria-pressed + 持久化 */
function initFocusMode(): void {
  const btn = document.querySelector<HTMLButtonElement>("#focus-toggle");
  if (!btn) return;
  const apply = (active: boolean) => {
    document.body.classList.toggle("focus-mode", active);
    btn.setAttribute("aria-pressed", String(active));
  };
  apply(readNumber(FOCUS_KEY) === 1);
  btn.addEventListener("click", () => {
    const next = nextFocusState(document.body.classList.contains("focus-mode"));
    apply(next);
    write(FOCUS_KEY, next ? "1" : "0");
    bus.emit("doclight:focuschange", { focus: next });
  });
}

/** Powered by：默认显示、关闭后隐藏 + 持久化（13 §4 一行关闭） */
function initPoweredBy(): void {
  const footer = document.querySelector<HTMLElement>(".powered-by");
  if (!footer) return;
  if (readNumber(POWERED_KEY) === 1) footer.hidden = true;
  footer.querySelector<HTMLButtonElement>("#powered-by-close")?.addEventListener("click", () => {
    footer.hidden = true;
    write(POWERED_KEY, "1");
  });
}

/** 阅读进度（04 §4.5.3 兑现，VIS-002）：顶栏下 2px 细线随滚动推进；滚动时浮现、停滚渐隐 */
function initReadingProgress(): void {
  const bar = document.querySelector<HTMLElement>(".reading-progress");
  if (!bar) return;
  let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

  const update = () => {
    const doc = document.documentElement;
    const total = doc.scrollHeight - doc.clientHeight;
    const ratio = total > 0 ? Math.min(1, Math.max(0, doc.scrollTop / total)) : 0;
    bar.style.setProperty("--progress", `${Math.round(ratio * 100)}%`);
    bar.classList.add("visible");
    if (hiddenTimer) clearTimeout(hiddenTimer);
    hiddenTimer = setTimeout(() => bar.classList.remove("visible"), 900);
  };

  window.addEventListener("scroll", update, { passive: true });
  // SPA 导航后重算（滚动位置复位，进度归零）
  bus.on("doclight:routechange", () => {
    bar.style.setProperty("--progress", "0%");
    bar.classList.remove("visible");
  });
  update();
}

/** 回到顶部（04 §4.5.4 兑现，VIS-002）：滚动超过 2 屏浮现，点击平滑回顶 */
function initBackToTop(): void {
  const btn = document.querySelector<HTMLButtonElement>(".back-to-top");
  if (!btn) return;

  const update = () => {
    const pastTwoScreens = window.scrollY > window.innerHeight * 2;
    btn.classList.toggle("visible", pastTwoScreens);
    btn.setAttribute("aria-hidden", String(!pastTwoScreens));
  };

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    btn.classList.remove("visible");
  });
  window.addEventListener("scroll", update, { passive: true });
  bus.on("doclight:routechange", update);
  update();
}

/** 页面切换过渡（04 §4.5.2 兑现，VIS-002）：SPA 导航后 article 150ms 淡入（克制） */
function initPageTransition(): void {
  const article = document.querySelector<HTMLElement>("article");
  if (!article) return;
  const play = () => {
    article.classList.remove("page-enter");
    // 强制重排以重触发动画
    void article.offsetWidth;
    article.classList.add("page-enter");
  };
  bus.on("doclight:routechange", play);
  play();
}

/** 挂载体验细节（mount() 调用） */
export function initUx(): void {
  initFocusMode();
  initPoweredBy();
  initReadingProgress();
  initBackToTop();
  initPageTransition();
}
