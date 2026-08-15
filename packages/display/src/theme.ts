/**
 * 主题系统（03 §3.6，最简骨架）
 *
 * 亮/暗切换 + 跟随系统（auto）。DOM 只在函数内访问，模块可在 Node 中导入测试。
 * 防闪烁脚本由 HTML 壳在 <head> 内联（03 §3.6.2），本模块负责交互与持久化。
 */

export type Theme = "light" | "dark";
export type ThemeSetting = Theme | "auto";

const STORAGE_KEY = "doclight-theme";

/** 纯函数：根据设置与系统偏好解析最终主题（可测） */
export function resolveTheme(setting: ThemeSetting, prefersDark: boolean): Theme {
  if (setting === "auto") return prefersDark ? "dark" : "light";
  return setting;
}

/** 读取持久化的主题设置（默认 auto，异常降级） */
export function getStoredTheme(): ThemeSetting {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {
    /* localStorage 不可用（隐私模式等）时降级 auto */
  }
  return "auto";
}

/** 将主题应用到 <html data-theme> */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

/** 初始化：应用已存/系统主题，绑定切换按钮（点击在亮/暗间显式切换并持久化；
 *  设计对齐 2026-08-16：太阳/月亮图标随主题切换显示，演示页行为） */
export function initTheme(): void {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const prefersDark = () => mql.matches;
  applyTheme(resolveTheme(getStoredTheme(), prefersDark()));

  const toggle = document.querySelector<HTMLButtonElement>("#themeBtn");
  const iconSun = document.querySelector<HTMLElement>("#iconSun");
  const iconMoon = document.querySelector<HTMLElement>("#iconMoon");
  const syncIcons = () => {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    if (iconSun) iconSun.style.display = dark ? "none" : "block";
    if (iconMoon) iconMoon.style.display = dark ? "block" : "none";
  };
  // 2026-08（L4）：aria-pressed 同步当前主题状态（读屏状态播报）
  const syncPressed = () => {
    toggle?.setAttribute("aria-pressed", String(document.documentElement.getAttribute("data-theme") === "dark"));
  };
  const sync = () => {
    syncPressed();
    syncIcons();
  };

  toggle?.addEventListener("click", () => {
    const current: Theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next: Theme = current === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 忽略持久化失败，仅本次生效 */
    }
    applyTheme(next);
    sync();
  });

  // 2026-08 修复（M5）：auto 模式实时跟随系统偏好变化——
  // 此前只在 mount 时取一次，系统日夜切换页面不跟随
  try {
    mql.addEventListener("change", () => {
      if (getStoredTheme() === "auto") {
        applyTheme(resolveTheme("auto", prefersDark()));
        sync();
      }
    });
  } catch {
    /* 旧浏览器 addListener 降级：忽略实时跟随 */
  }

  sync();
}
