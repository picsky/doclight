import { describe, expect, it } from "vitest";
import { resolveTheme, type ThemeSetting } from "../src/theme.ts";

describe("主题解析（展示层最简骨架）", () => {
  const cases: Array<{ setting: ThemeSetting; prefersDark: boolean; expected: "light" | "dark" }> = [
    { setting: "auto", prefersDark: false, expected: "light" },
    { setting: "auto", prefersDark: true, expected: "dark" },
    { setting: "light", prefersDark: true, expected: "light" },
    { setting: "dark", prefersDark: false, expected: "dark" },
  ];

  for (const c of cases) {
    it(`${c.setting} + prefersDark=${c.prefersDark} → ${c.expected}`, () => {
      expect(resolveTheme(c.setting, c.prefersDark)).toBe(c.expected);
    });
  }
});
