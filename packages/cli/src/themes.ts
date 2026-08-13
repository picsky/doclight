/**
 * 主题包（THEME-002，11-default-themes §3 主题包规范）
 *
 * 规范：主题 = CSS 变量覆盖层（可选加组件级微调规则），注入到页面主样式之后
 * （<style data-doclight-theme>），仅覆盖设计令牌即可换肤——组件样式已全部消费
 * 令牌（THEME-001），主题不改结构、零 JS。
 *
 * 解析顺序（doclight.json theme 键）：
 * 1. 缺省 / "default" → 空（零注入零回归，模板内置令牌即默认主题）
 * 2. 内置主题名（minimal / warm）→ 内置 CSS
 * 3. 相对/绝对路径 → 读取用户 CSS 文件内容
 * 4. 未知 → 警告 + 空（诚实原则：不静默失败也不伪造成功）
 */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { loadConfig } from "./config.ts";

/* ================= 内置主题 ================= */

/**
 * minimal —— 极简黑白：无色相强调（primary 走墨色）、更小圆角、紧凑节奏。
 * 适合技术手册 / API 文档气质。
 */
export const THEME_MINIMAL = `:root {
  --color-primary: #111827; --color-primary-hover: #000000; --color-primary-light: #e5e7eb;
  --color-bg: #ffffff; --color-bg-soft: #fafafa; --color-bg-code: #f5f5f5;
  --color-border: #e5e5e5; --color-border-soft: #f0f0f0;
  --radius-sm: 2px; --radius: 4px; --radius-lg: 6px;
  --font-size-base: 0.9375rem;
  --line-height-relaxed: 1.7;
  --shadow: 0 1px 2px rgba(0,0,0,0.06);
}
[data-theme="dark"] {
  --color-primary: #e5e7eb; --color-primary-hover: #ffffff; --color-primary-light: #374151;
  --color-bg: #0a0a0a; --color-bg-soft: #141414; --color-bg-code: #1f1f1f;
}
`;

/**
 * warm —— 暖纸：米色纸张底 + 琥珀棕强调 + 衬线标题（宋体/Georgia）。
 * 适合博客 / 散文 / 长文阅读气质。
 */
export const THEME_WARM = `:root {
  --color-primary: #b45309; --color-primary-hover: #92400e; --color-primary-light: #fef3c7;
  --color-bg: #fdfbf7; --color-bg-soft: #f8f4ec; --color-bg-code: #f5f0e6;
  --color-border: #e7dfd0; --color-border-soft: #f0eadf;
  --color-text: #44403c; --color-text-strong: #292524;
  --color-text-secondary: #78716c; --color-text-muted: #a8a29e;
  --color-success: #3f6212; --color-warning: #b45309; --color-error: #b91c1c; --color-info: #1d4ed8;
  --radius-lg: 10px;
  --shadow: 0 1px 3px rgba(120, 90, 40, 0.08);
}
[data-theme="dark"] {
  --color-primary: #f59e0b; --color-primary-hover: #fbbf24; --color-primary-light: #451a03;
  --color-bg: #1c1917; --color-bg-soft: #292524; --color-bg-code: #2f2a26;
  --color-border: #44403c; --color-border-soft: #38332f;
  --color-text: #d6d3d1; --color-text-strong: #f5f5f4;
  --color-text-secondary: #a8a29e; --color-text-muted: #78716c;
}
article h1, article h2, article h3, article h4 { font-family: Georgia, "Songti SC", "SimSun", "Noto Serif CJK SC", serif; }
`;

/** 内置主题注册表（键 = doclight.json theme 值；"default" 刻意不在表内——空 CSS 即默认） */
export const BUILTIN_THEMES: Record<string, string> = {
  minimal: THEME_MINIMAL,
  warm: THEME_WARM,
};

/* ================= 解析 ================= */

/**
 * 解析主题为 CSS（THEME-002）。返回空串表示零注入（默认主题）。
 * 未知主题输出警告（诚实原则，不静默失败）。
 */
export function resolveThemeCss(theme: string | undefined, cwd = process.cwd()): string {
  if (!theme || theme === "default") return "";
  const builtin = BUILTIN_THEMES[theme];
  if (builtin) return builtin;
  // 用户自定义 CSS 文件（相对项目根或绝对路径）
  const file = isAbsolute(theme) ? theme : resolve(cwd, theme);
  if (existsSync(file)) {
    try {
      return readFileSync(file, "utf8");
    } catch {
      console.warn(`[doclight] 主题文件读取失败：${file}（回退默认主题）`);
      return "";
    }
  }
  console.warn(`[doclight] 未知主题「${theme}」（内置：default / minimal / warm；或提供 CSS 文件路径）——回退默认主题`);
  return "";
}

/**
 * 一站解析站点配置中的主题（与 loadConfiguredPlugins 同模式）：
 * loadConfig → resolveThemeCss。供 runDev 等入口复用（决策⑪单一事实来源）。
 */
export function loadConfiguredTheme(dir: string, cwd = process.cwd()): string {
  const cfg = loadConfig([join(cwd, "doclight.json"), join(resolve(dir), "doclight.json")]);
  return resolveThemeCss(cfg.theme, cwd);
}
