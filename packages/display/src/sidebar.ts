/**
 * 侧边栏（03 §3.4.4，最简骨架）
 *
 * 移动端：菜单按钮拉出侧边栏（.open 类），点击内容区关闭。
 * 桌面端侧边栏常驻；折叠/展开等交互留 Phase 2。
 */

/** 初始化移动端侧边栏开关 */
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
  // 点击内容区（移动端遮罩效果）关闭
  document.querySelector("main")?.addEventListener("click", close);
  // 导航后关闭（移动端点击链接跳转后收起侧边栏）
  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement | null)?.closest?.("a[href]")) close();
  });
  // Esc 关闭（无障碍惯例）
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("open")) close();
  });
  sync();
}
