import { describe, expect, it } from "vitest";
import { nextFocusState } from "../src/ux.ts";

describe("体验细节纯函数（C4）", () => {
  // 字号调节已移除（2026-08-14 用户判定伪需求——浏览器原生缩放已覆盖）

  describe("nextFocusState：专注模式 toggle", () => {
    it("开 → 关 → 开", () => {
      expect(nextFocusState(false)).toBe(true);
      expect(nextFocusState(true)).toBe(false);
    });
  });
});
