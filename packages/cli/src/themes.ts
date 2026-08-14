/**
 * 主题包（THEME-002 + VIS-001，11-default-themes 主题包规范）
 *
 * 规范：主题 = CSS 变量覆盖层（可选加组件级微调规则），注入到页面主样式之后
 * （<style data-doclight-theme>），仅覆盖设计令牌即可换肤——组件样式已全部消费
 * 令牌（THEME-001），主题不改结构、零 JS。
 *
 * VIS-001（4 套设计语言兑现）：内置主题为独立 CSS 文件（packages/cli/src/themes/*.css）：
 * - minimal —— Minimal（默认）设计语言的显式主题包（与默认视觉一致 + 组件打磨）
 * - serif —— 学术（衬线标题/纸感/深靛蓝/2px 圆角）
 * - modern —— 科技（默认暗色/violet/玻璃拟态/8px 圆角，defaultTheme:"dark"）
 * - warm —— 温暖（暖橙/米白/12px 大圆角/卡片感）
 * CSS 文件独立成资源：设计合规门禁（scripts/checks/visual.mjs）直接读取做机器断言；
 * 也是未来主题市场/分发的载体（主题 = 一个 CSS 文件）。
 *
 * 解析顺序（doclight.json theme 键）：
 * 1. 缺省 / "default" → 空（零注入零回归，默认模板即 Minimal 设计语言）
 * 2. 内置主题名（minimal / serif / modern / warm）→ 读内置 CSS 文件
 * 3. 相对/绝对路径 → 读取用户 CSS 文件内容
 * 4. 未知 → 警告 + 空（诚实原则：不静默失败也不伪造成功）
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.ts";

/** 主题包（VIS-001）：CSS 覆盖层 + 元数据 */
export interface ThemePackage {
  /** 主题名（doclight.json theme 键） */
  name: string;
  /** CSS 覆盖层内容（注入 <style data-doclight-theme>） */
  css: string;
  /** 默认模式（modern="dark"：首次进入即暗色；缺省跟随系统偏好） */
  defaultTheme?: "light" | "dark";
}

const THEMES_DIR = join(dirname(fileURLToPath(import.meta.url)), "themes");

/** 内置主题包元数据（CSS 文件 + 默认模式；CSS 内容运行时读取） */
export const BUILTIN_THEME_PACKAGES: Array<{ name: string; file: string; defaultTheme?: "light" | "dark" }> = [
  { name: "minimal", file: "minimal.css" },
  { name: "serif", file: "serif.css" },
  { name: "modern", file: "modern.css", defaultTheme: "dark" },
  { name: "warm", file: "warm.css" },
];

/** 内置主题注册表（键 = doclight.json theme 值；"default" 刻意不在表内——空 CSS 即默认） */
export const BUILTIN_THEMES: Record<string, string> = Object.fromEntries(
  BUILTIN_THEME_PACKAGES.map((p) => [p.name, readFileSync(join(THEMES_DIR, p.file), "utf8")])
);

/** 内置主题默认模式表（VIS-001：modern 默认暗色） */
export const BUILTIN_THEME_DEFAULT_MODE: Record<string, "light" | "dark"> = Object.fromEntries(
  BUILTIN_THEME_PACKAGES.filter((p) => p.defaultTheme).map((p) => [p.name, p.defaultTheme!])
);

/**
 * 解析主题为主题包（VIS-001）：缺省/default 返回空 CSS 的包；内置主题读文件；
 * 用户 CSS 文件路径直接读取；未知主题警告 + 空包（诚实原则）。
 */
export function resolveThemePackage(theme: string | undefined, cwd = process.cwd()): ThemePackage {
  if (!theme || theme === "default") return { name: "default", css: "" };
  const builtin = BUILTIN_THEMES[theme];
  if (builtin !== undefined) {
    return { name: theme, css: builtin, ...(BUILTIN_THEME_DEFAULT_MODE[theme] ? { defaultTheme: BUILTIN_THEME_DEFAULT_MODE[theme] } : {}) };
  }
  // 用户自定义 CSS 文件（相对项目根或绝对路径）
  const file = isAbsolute(theme) ? theme : resolve(cwd, theme);
  if (existsSync(file)) {
    try {
      return { name: theme, css: readFileSync(file, "utf8") };
    } catch {
      console.warn(`[doclight] 主题文件读取失败：${file}（回退默认主题）`);
      return { name: "default", css: "" };
    }
  }
  console.warn(
    `[doclight] 未知主题「${theme}」（内置：default / minimal / serif / modern / warm；或提供 CSS 文件路径）——回退默认主题`
  );
  return { name: "default", css: "" };
}

/**
 * 解析主题为 CSS（THEME-002，向后兼容签名）。返回空串表示零注入（默认主题）。
 */
export function resolveThemeCss(theme: string | undefined, cwd = process.cwd()): string {
  return resolveThemePackage(theme, cwd).css;
}

/**
 * 一站解析站点配置中的主题包（与 loadConfiguredPlugins 同模式）：
 * loadConfig → resolveThemePackage。供 runDev/runBuild 等入口复用（决策⑪单一事实来源）。
 */
export function loadConfiguredTheme(dir: string, cwd = process.cwd()): ThemePackage {
  const cfg = loadConfig([join(cwd, "doclight.json"), join(resolve(dir), "doclight.json")]);
  return resolveThemePackage(cfg.theme, cwd);
}
