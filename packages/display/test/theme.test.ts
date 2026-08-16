import { describe, expect, it } from "vitest";
import { applyTheme, resolveTheme, type ThemeSetting } from "../src/theme.ts";

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

describe("applyTheme（2026-08：mermaid 主题跟随通道）", () => {
  it("应用 data-theme 并派发 doclight:themechange（detail 含主题）", () => {
    // node 测试环境无 DOM：注入最小 document mock（只覆盖 applyTheme 用到的面）
    const events: Array<{ type: string; detail?: unknown }> = [];
    const origDocument = (globalThis as Record<string, unknown>).document;
    (globalThis as Record<string, unknown>).document = {
      documentElement: { setAttribute: () => {} },
      dispatchEvent: (e: { type: string; detail?: unknown }) => {
        events.push({ type: e.type, detail: e.detail });
        return true;
      },
    };
    (globalThis as Record<string, unknown>).CustomEvent = class {
      type: string;
      detail?: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
    try {
      applyTheme("dark");
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("doclight:themechange");
      expect((events[0]!.detail as { theme: string }).theme).toBe("dark");
    } finally {
      (globalThis as Record<string, unknown>).document = origDocument;
      delete (globalThis as Record<string, unknown>).CustomEvent;
    }
  });
});
