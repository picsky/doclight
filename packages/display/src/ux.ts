/**
 * 体验细节（C4 + 设计对齐 2026-08-16：演示页交互行为）
 *
 * 核心逻辑抽成纯函数（可单测）；DOM 接线在 initUx() 薄层。全部持久化 localStorage。
 * - 顶部阅读进度条（#progress）：2px 强调色，滚动推进（演示页行为，常驻不喧哗）
 * - 顶栏滚动态（.scrolled）：滚动后出现发丝底线（演示页行为）
 * - Powered by：默认显示、可关闭（13 §4 传播机制；尊重自托管数据洁癖，非强制）
 * - 页面切换过渡：SPA 导航后 article 淡入（设计对齐 rise 动效）
 * - back-to-top 已移除（2026-08-16 设计对齐：演示页无此组件）
 */
import { bus } from "./event-bus.ts";

const POWERED_KEY = "doclight-powered-by-hidden";

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

/** 纯函数：阅读进度比例（0-100；无可滚动高度返回 0） */
export function progressPercent(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const total = scrollHeight - clientHeight;
  return total > 0 ? Math.min(100, Math.max(0, (scrollTop / total) * 100)) : 0;
}

/** 阅读进度（设计对齐演示页 #progress）+ 顶栏滚动态（.scrolled）+ 签名时刻（DP-002 候选原型） */
function initProgressAndTopbar(): void {
  const bar = document.querySelector<HTMLElement>("#progress");
  const topbar = document.querySelector<HTMLElement>("#topbar");

  // DP-002 签名时刻候选：读完（100%）时进度条右端光点脉冲一次——「读完的确认感」，
  // 只出现一次、≤300ms、reduced-motion 下降级（宪法 §3.4）
  let completed = false;
  const update = () => {
    const doc = document.documentElement;
    const pct = progressPercent(doc.scrollTop, doc.scrollHeight, doc.clientHeight);
    if (bar) bar.style.width = `${pct}%`;
    topbar?.classList.toggle("scrolled", window.scrollY > 8);
    if (bar && pct >= 100 && !completed) {
      completed = true;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) {
        bar.classList.remove("complete");
        void bar.offsetWidth;
        bar.classList.add("complete");
      }
    } else if (bar && pct < 100) {
      completed = false;
      bar.classList.remove("complete");
    }
  };

  window.addEventListener("scroll", update, { passive: true });
  // SPA 导航后重算（滚动位置复位，进度归零）
  bus.on("doclight:routechange", update);
  update();
}

/** 页面切换过渡（04 §4.5.2 兑现，VIS-002 + 设计对齐）：SPA 导航后 article 淡入（克制）。
 *  DP-006 方向感知：前进从右入（默认），后退（popstate/bundle 回退）从左入。 */
function initPageTransition(): void {
  const article = document.querySelector<HTMLElement>("article");
  if (!article) return;
  const play = (back: boolean): void => {
    article.classList.remove("page-enter", "page-enter-back");
    // 强制重排以重触发动画
    void article.offsetWidth;
    article.classList.add(back ? "page-enter-back" : "page-enter");
  };
  bus.on("doclight:routechange", (payload) => {
    const ctx = payload as { replace?: boolean } | undefined;
    play(!!ctx?.replace);
  });
  play(false);
}

/** 挂载体验细节（mount() 调用） */
export function initUx(): void {
  initPoweredBy();
  initProgressAndTopbar();
  initPageTransition();
}
