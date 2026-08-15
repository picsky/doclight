/**
 * VIS-001 设计合规测试：合规函数单测 + 默认/内置主题全量断言
 * （设计对齐 2026-08-16：令牌体系与断言标准以 docs/design-new/DESIGN.md 宪法 §3 为准）
 * （DP-001：内置主题收敛为唯一一套 minimal；serif/modern/warm 已退役）
 */
import { describe, expect, it } from "vitest";
import {
  checkContrast,
  checkSpacingGrid,
  checkThemeCompliance,
  checkTypeScale,
  contrastRatio,
  extractTokenBlock,
  parseHexColor,
  relativeLuminance,
} from "../src/design-compliance.ts";
import { DEFAULT_THEME_CSS } from "../src/site.ts";
import { BUILTIN_THEMES } from "../src/themes.ts";

describe("design-compliance 纯函数（VIS-001）", () => {
  it("parseHexColor：6 位 / 3 位 / 无效", () => {
    expect(parseHexColor("#14714e")).toEqual([20, 113, 78]);
    expect(parseHexColor("#fff")).toEqual([255, 255, 255]);
    expect(parseHexColor("teal")).toBeNull();
    expect(parseHexColor("#12345")).toBeNull();
  });

  it("relativeLuminance / contrastRatio（WCAG 公式）", () => {
    // 黑 vs 白 = 21
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1);
    // 同色 = 1
    expect(contrastRatio([10, 20, 30], [10, 20, 30])).toBeCloseTo(1, 5);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 3);
  });

  it("extractTokenBlock：:root 与 [data-theme=dark] 分块提取", () => {
    const css = ":root { --bg: #fff; --space-2: 8px; } [data-theme=\"dark\"] { --bg: #111; }";
    expect(extractTokenBlock(css, ":root").variables.get("bg")).toBe("#fff");
    expect(extractTokenBlock(css, ":root").variables.get("space-2")).toBe("8px");
    expect(extractTokenBlock(css, '[data-theme="dark"]').variables.get("bg")).toBe("#111");
  });

  it("checkSpacingGrid：非 4px 倍数报问题", () => {
    expect(checkSpacingGrid(":root { --space-1: 4px; --space-2: 8px; --space-3: 12px; }")).toEqual([]);
    expect(checkSpacingGrid(":root { --space-1: 5px; }")).toHaveLength(1);
    // rem 值跳过（相对单位由基准缩放）
    expect(checkSpacingGrid(":root { --space-1: 0.25rem; }")).toEqual([]);
  });

  it("checkTypeScale：宪法 §3.2 批准类型阶，自定义档位报问题", () => {
    const good = ":root { --font-size-xs: 0.75rem; --font-size-sm: 0.8125rem; --font-size-base: 0.969rem; --font-size-lg: 1.125rem; --font-size-xl: 1.3125rem; --font-size-2xl: 1.625rem; --font-size-3xl: 2.125rem; }";
    expect(checkTypeScale(good)).toEqual([]);
    const bad = ":root { --font-size-base: 1rem; --font-size-lg: 1.25rem; }";
    expect(checkTypeScale(bad).length).toBeGreaterThan(0);
    // 未定义任何字号令牌 → 跳过（继承已合规的默认主题）
    expect(checkTypeScale(":root { --bg: #fff; }")).toEqual([]);
  });
});

describe("内置主题全量合规（VIS-001 机器化门禁，宪法标准）", () => {
  const themes: Array<[string, string]> = [
    ["default（设计宪法设计语言）", DEFAULT_THEME_CSS],
    ...Object.entries(BUILTIN_THEMES),
  ];

  for (const [name, css] of themes) {
    it(`${name}：对比度（正文 AAA / 辅助 AA）+ 代码色 + 状态色 + 8pt 网格 + 批准类型阶全合规`, () => {
      const issues = checkThemeCompliance(name, css);
      expect(issues, issues.map((i) => `${i.mode} --${i.token}: 期望≥${i.expected} 实测 ${i.actual}（${i.note}）`).join("\n")).toEqual([]);
    });
  }

  it("每套主题都定义亮 + 暗两套令牌（暗色不是亮色的简单反色）", () => {
    for (const [name, css] of Object.entries(BUILTIN_THEMES)) {
      const root = extractTokenBlock(css, ":root");
      const dark = extractTokenBlock(css, '[data-theme="dark"]');
      const light = extractTokenBlock(css, '[data-theme="light"]');
      // 常规亮色优先主题须有 dark 块；暗色优先主题（自定义 CSS 可能如此）须有 light 块
      const hasDark = dark.variables.size > 0;
      const hasLight = light.variables.size > 0;
      expect(hasDark || hasLight, `${name} 缺少暗色或亮色覆盖块`).toBe(true);
      if (hasDark) {
        // 暗色必须真的覆盖背景（不是简单反色：背景值不同）
        expect(dark.variables.get("bg")).not.toBe(root.variables.get("bg"));
      }
    }
  });

  it("minimal 为亮色优先结构（:root 即亮色，[data-theme=dark] 覆盖暗色）", () => {
    const css = BUILTIN_THEMES.minimal!;
    const root = extractTokenBlock(css, ":root");
    const dark = extractTokenBlock(css, '[data-theme="dark"]');
    expect(dark.variables.size).toBeGreaterThan(0); // 有 dark 块
    expect(root.variables.get("bg")).toBe("#ffffff"); // :root 即亮色
    expect(root.variables.get("accent")).toBe("#14714e"); // 松绿 Pine（与默认一致）
  });

  it("checkContrast 对明显低对比度配色报问题（门禁有效性的反例）", () => {
    const bad = ":root { --bg: #ffffff; --text: #eeeeee; --text-2: #eeeeee; --text-3: #eeeeee; --accent: #cccccc; --accent-hover: #cccccc; --accent-ink: #cccccc; }";
    expect(checkContrast("bad", bad).length).toBeGreaterThan(0);
  });
});
