import { describe, expect, it } from "vitest";
import { nextFocusState, stepFontScale } from "../src/ux.ts";

describe("体验细节纯函数（C4）", () => {
  describe("stepFontScale：字号步进 ±0.125，夹在 [0.875, 1.25]", () => {
    it("从 1 增大 → 1.125，再增大 → 1.25 封顶", () => {
      expect(stepFontScale(1, 1)).toBe(1.125);
      expect(stepFontScale(1.125, 1)).toBe(1.25);
      expect(stepFontScale(1.25, 1)).toBe(1.25); // 封顶
    });
    it("从 1 减小 → 0.875 触底", () => {
      expect(stepFontScale(1, -1)).toBe(0.875);
      expect(stepFontScale(0.875, -1)).toBe(0.875); // 触底
    });
    it("越界/非档值仍归一到档位内（不溢出）", () => {
      expect(stepFontScale(1.07, 1)).toBeLessThanOrEqual(1.25);
      expect(stepFontScale(0.9, -1)).toBeGreaterThanOrEqual(0.875);
      // 正常用法：从档值步进（localStorage 恒为步进结果）
      expect(stepFontScale(1.125, 1)).toBe(1.25);
      expect(stepFontScale(1.125, -1)).toBe(1);
    });
  });

  describe("nextFocusState：专注模式 toggle", () => {
    it("开 → 关 → 开", () => {
      expect(nextFocusState(false)).toBe(true);
      expect(nextFocusState(true)).toBe(false);
    });
  });
});
