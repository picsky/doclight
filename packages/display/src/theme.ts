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

/** 初始化：应用已存/系统主题，绑定切换按钮（点击在亮/暗间显式切换并持久化） */
export function initTheme(): void {
  const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(resolveTheme(getStoredTheme(), prefersDark()));

  document.querySelector<HTMLButtonElement>("#theme-toggle")?.addEventListener("click", () => {
    const current: Theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next: Theme = current === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 忽略持久化失败，仅本次生效 */
    }
    applyTheme(next);
  });
}
