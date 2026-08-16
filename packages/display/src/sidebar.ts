/**
 * 侧边栏（03 §3.4.4；DP-005 导航智能）
 *
 * 移动端：菜单按钮拉出侧边栏（.open 类），点击内容区关闭。
 * 桌面端侧边栏常驻。
 * DP-005：
 * - 键盘翻页：←/→ 上一页/下一页（pager 链接驱动；输入/弹层内不劫持）
 * - 2026-08 用户决策：分组折叠（collapsed 持久化）移除——side-title 复原为
 *   演示页 design-new 的纯文字标签（不可点击）；结构保留（router topnav
 *   联动读取 .side-title 文本做顶栏高亮）。
 */

/** 纯函数：是否劫持翻页键（输入框/搜索弹层开/修饰键按下时不劫持） */
export function shouldHandlePagingKey(
  e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean },
  target: EventTarget | null,
  searchOpen: boolean
): boolean {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return false;
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false;
  if (searchOpen) return false;
  // 鸭子类型判定（Node 单测无 HTMLElement 类）：tagName / isContentEditable 即可
  const el = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!el || typeof el.tagName !== "string") return false;
  return !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable;
}

/** 初始化移动端侧边栏开关 + DP-005 键盘翻页 */
export function initSidebar(): void {
  const btn = document.querySelector<HTMLButtonElement>("#sidebar-toggle");
  const sidebar = document.querySelector<HTMLElement>("aside.sidebar");
  if (!btn || !sidebar) return;

  // VIS-002：抽屉开合同步 aria-expanded（无障碍）
  const sync = () => {
    const open = sidebar.classList.contains("open");
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "关闭菜单" : "菜单");
  };
  const close = () => {
    sidebar.classList.remove("open");
    sync();
  };
  btn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    sync();
  });
  // 点击抽屉外任意处关闭（移动端遮罩效果；排除汉堡按钮自身——按钮冒泡先触发开合）
  document.addEventListener("click", (e) => {
    if (!sidebar.classList.contains("open")) return;
    const t = e.target as Node | null;
    if (t instanceof Node && (sidebar.contains(t) || btn.contains(t))) return;
    close();
  });
  // 导航后关闭（移动端点击链接跳转后收起侧边栏）
  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement | null)?.closest?.("a[href]")) close();
  });
  // Esc 关闭（无障碍惯例）
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("open")) close();
  });
  // DP-006 抽屉边缘滑动手势（保守实现：抽屉内向右横扫 >60px 关闭；不劫持点击/纵向滚动）
  let swipeStart: number | null = null;
  sidebar.addEventListener(
    "touchstart",
    (e) => {
      swipeStart = e.touches[0]?.clientX ?? null;
    },
    { passive: true }
  );
  sidebar.addEventListener(
    "touchend",
    (e) => {
      if (swipeStart === null) return;
      const endX = e.changedTouches[0]?.clientX ?? swipeStart;
      const dx = swipeStart - endX;
      swipeStart = null;
      if (dx > 60 && sidebar.classList.contains("open")) close(); // 右滑（向边缘）关闭
    },
    { passive: true }
  );
  sync();

  /* ===== DP-005 键盘翻页（←/→ 上一页/下一页，pager 链接驱动） ===== */
  document.addEventListener("keydown", (e) => {
    const searchOpen = document.querySelector("#modalMask")?.classList.contains("open") ?? false;
    if (!shouldHandlePagingKey(e, e.target, searchOpen)) return;
    const pager = document.querySelector<HTMLElement>(".pager");
    if (!pager) return;
    const links = [...pager.querySelectorAll<HTMLAnchorElement>("a")];
    const prev = links.find((a) => !a.classList.contains("next"));
    const next = links.find((a) => a.classList.contains("next"));
    const target = e.key === "ArrowLeft" ? prev : next;
    if (!target) return;
    e.preventDefault();
    target.click();
  });
}
