/**
 * VIS-001 设计合规测试：合规函数单测 + 默认/内置 4 主题全量断言（WCAG AA / 8pt / 1.25）
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
    expect(parseHexColor("#0d9488")).toEqual([13, 148, 136]);
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
    const css = ":root { --color-a: #111; --space-2: 8px; } [data-theme=\"dark\"] { --color-a: #eee; }";
    expect(extractTokenBlock(css, ":root").variables.get("color-a")).toBe("#111");
    expect(extractTokenBlock(css, ":root").variables.get("space-2")).toBe("8px");
    expect(extractTokenBlock(css, '[data-theme="dark"]').variables.get("color-a")).toBe("#eee");
  });

  it("checkSpacingGrid：非 4px 倍数报问题", () => {
    expect(checkSpacingGrid(":root { --space-1: 4px; --space-2: 8px; --space-3: 12px; }")).toEqual([]);
    expect(checkSpacingGrid(":root { --space-1: 5px; }")).toHaveLength(1);
    // rem 值跳过（相对单位由基准缩放）
    expect(checkSpacingGrid(":root { --space-1: 0.25rem; }")).toEqual([]);
  });

  it("checkTypeScale：base 起 1.25 节奏，偏离报问题", () => {
    const good = ":root { --font-size-base: 1rem; --font-size-lg: 1.25rem; --font-size-xl: 1.5625rem; --font-size-2xl: 1.953rem; --font-size-3xl: 2.441rem; }";
    expect(checkTypeScale(good)).toEqual([]);
    const bad = ":root { --font-size-base: 1rem; --font-size-lg: 1.125rem; --font-size-xl: 1.25rem; --font-size-2xl: 1.5rem; --font-size-3xl: 2rem; }";
    expect(checkTypeScale(bad).length).toBeGreaterThan(0);
  });
});

describe("内置主题全量合规（VIS-001 机器化门禁）", () => {
  const themes: Array<[string, string]> = [
    ["default（Minimal 设计语言）", DEFAULT_THEME_CSS],
    ...Object.entries(BUILTIN_THEMES),
  ];

  for (const [name, css] of themes) {
    it(`${name}：对比度 WCAG AA + 8pt 网格 + 1.25 字号节奏全合规`, () => {
      const issues = checkThemeCompliance(name, css);
      expect(issues, issues.map((i) => `${i.mode} --${i.token}: 期望≥${i.expected} 实测 ${i.actual}（${i.note}）`).join("\n")).toEqual([]);
    });
  }

  it("每套主题都定义亮 + 暗两套令牌（暗色不是亮色的简单反色）", () => {
    for (const [name, css] of Object.entries(BUILTIN_THEMES)) {
      const root = extractTokenBlock(css, ":root");
      const dark = extractTokenBlock(css, '[data-theme="dark"]');
      const light = extractTokenBlock(css, '[data-theme="light"]');
      // 常规亮色优先主题须有 dark 块；暗色优先主题（modern）须有 light 块
      const hasDark = dark.variables.size > 0;
      const hasLight = light.variables.size > 0;
      expect(hasDark || hasLight, `${name} 缺少暗色或亮色覆盖块`).toBe(true);
      if (hasDark) {
        // 暗色必须真的覆盖背景（不是简单反色：背景值不同）
        expect(dark.variables.get("color-bg")).not.toBe(root.variables.get("color-bg"));
      }
    }
  });

  it("modern 为暗色优先结构（:root 即暗色，[data-theme=light] 覆盖亮色）", () => {
    const css = BUILTIN_THEMES.modern!;
    const root = extractTokenBlock(css, ":root");
    const dark = extractTokenBlock(css, '[data-theme="dark"]');
    const light = extractTokenBlock(css, '[data-theme="light"]');
    expect(dark.variables.size).toBe(0); // 无 dark 块
    expect(light.variables.size).toBeGreaterThan(0); // light 块覆盖
    expect(root.variables.get("color-bg")).toBe("#0b0f19"); // :root 即暗色
  });

  it("checkContrast 对明显低对比度配色报问题（门禁有效性的反例）", () => {
    const bad = ":root { --color-bg: #ffffff; --color-text: #eeeeee; --color-text-strong: #dddddd; --color-text-secondary: #eeeeee; --color-text-muted: #eeeeee; --color-primary: #cccccc; --color-primary-hover: #cccccc; }";
    expect(checkContrast("bad", bad).length).toBeGreaterThan(0);
  });
});
