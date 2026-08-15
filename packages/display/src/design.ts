/**
 * 设计交互细节（设计对齐 2026-08-16：演示页第二层优化行为）
 *
 * - CJK 中西文混排空隙（盘古之白）：汉字与拉丁字符/数字间插入发丝空隙 U+200A
 *   （宪法 §3.2/§5；跳过 CODE/PRE/KBD 等，SPA 导航后自动重跑）
 * - 锚点跳转闪烁反馈：TOC 链接 / 标题锚点点击 → 目标章节短暂高亮（演示页 flash）
 * - Tabs 跨组联动：同名 tab 全局联动（演示页行为）
 * - 反馈卡片：TOC 卡「有帮助 / 需改进」点击 → 感谢语（演示页行为）
 * - 平台快捷键提示：macOS 显示 ⌘K，其余显示 Ctrl K（顶栏搜索按钮 kbd）
 */
import { bus } from "./event-bus.ts";

/* ===== 中西文混排微距（演示页脚本移植；SKIP 集合与过滤逻辑一致） ===== */

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "KBD"]);
const CJK_RE = "[\\u3400-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef\\u3000-\\u303f]";
const LAT_RE = "[A-Za-z0-9]";

/** 纯函数：为中西文交界插入发丝空隙（可测；整段文本级处理） */
export function addHairSpaces(text: string): string {
  return text
    .replace(new RegExp(`(${CJK_RE})(${LAT_RE})`, "g"), "$1\u200A$2")
    .replace(new RegExp(`(${LAT_RE})(${CJK_RE})`, "g"), "$1\u200A$2");
}

/** 应用空隙：遍历 article 文本节点（跳过 CODE/PRE/KBD 等），SPA 后重跑 */
export function applyCjkSpacing(scope: HTMLElement): void {
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode(n: Text) {
      if (!n.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      let p = n.parentElement;
      while (p) {
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) nodes.push(node);
  for (const n of nodes) {
    if (n.nodeValue) n.nodeValue = addHairSpaces(n.nodeValue);
  }
}

/* ===== 锚点跳转闪烁反馈（演示页 flash） ===== */

/** 纯函数：是否跳过锚点（无 id / 非 h2/h3 目标） */
export function isFlashTarget(el: Element | null): el is HTMLElement {
  return !!el && (el.tagName === "H2" || el.tagName === "H3");
}

/** 闪烁目标标题（移除后强制重排重触发动画，演示页逻辑） */
export function flashHeading(id: string): void {
  const el = document.getElementById(id);
  if (!isFlashTarget(el)) return;
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}

/* ===== Tabs 跨组联动（演示页：同名 tab 全局联动） ===== */

/** 绑定 tabs：点击任一 tab-btn → 同名 tab-btn/tab-panel 全局切换 */
export function bindTabs(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
    if (btn.dataset.tabsBound) return;
    btn.dataset.tabsBound = "1";
    btn.addEventListener("click", () => {
      const name = btn.dataset.tab;
      if (!name) return;
      document.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
      document.querySelectorAll<HTMLElement>(".tab-panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === name));
    });
  });
}

/* ===== 反馈卡片（演示页：感谢语 + 移除按钮组） ===== */

/** 绑定反馈卡（#fbYes / #fbNo）：点击 → 感谢语 + 移除按钮组 */
export function bindFeedback(root: ParentNode): void {
  for (const id of ["fbYes", "fbNo"]) {
    const btn = root.querySelector<HTMLButtonElement>(`#${id}`);
    if (!btn || btn.dataset.fbBound) continue;
    btn.dataset.fbBound = "1";
    btn.addEventListener("click", () => {
      const card = btn.closest<HTMLElement>(".toc-card");
      const q = card?.querySelector<HTMLElement>(".q");
      if (q) q.textContent = "感谢你的反馈！";
      const row = btn.parentElement;
      if (row) row.remove();
    });
  }
}

/* ===== 平台快捷键提示（顶栏 kbd：macOS ⌘K / 其余 Ctrl K） ===== */

/** 初始化平台提示：macOS 显示 ⌘K */
export function initPlatformHints(): void {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform ?? "");
  if (!isMac) return;
  document.querySelectorAll<HTMLElement>(".search-btn kbd").forEach((k) => {
    if (k.textContent?.trim() === "Ctrl K") k.textContent = "⌘K";
  });
}

/** 挂载设计交互细节（mount() 调用；SPA 导航后自动重跑） */
export function initDesign(): void {
  const article = document.querySelector<HTMLElement>("article");
  const toc = document.querySelector<HTMLElement>(".toc");
  if (article) applyCjkSpacing(article);
  bindTabs(document);
  if (toc) {
    bindFeedback(toc);
    // 锚点闪烁：TOC 链接 + 标题锚点点击（演示页行为）
    toc.querySelectorAll<HTMLElement>("a[data-toc-id], a.anchor").forEach((a) => {
      if (a.dataset.flashBound) return;
      a.dataset.flashBound = "1";
      a.addEventListener("click", () => {
        const id = (a.getAttribute("href") ?? "").slice(1);
        if (id) setTimeout(() => flashHeading(id), 350);
      });
    });
  }
  initPlatformHints();
  // SPA 导航后：新内容重跑空隙与 tabs（锚点/反馈由 router/toc 各自重建）
  bus.on("doclight:routechange", () => {
    if (article) applyCjkSpacing(article);
    bindTabs(document);
  });
}
