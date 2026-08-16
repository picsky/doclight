/**
 * DP-005 导航智能测试（Phase 7，18-design-polish §3.5）：
 * 键盘翻页劫持判定（纯函数）。
 * 2026-08 用户决策：分组折叠移除（side-title 复原为演示页纯标签）——
 * parseCollapsedGroups/serializeCollapsedGroups 随折叠功能一并删除。
 */
import { describe, expect, it } from "vitest";
import { shouldHandlePagingKey } from "../src/sidebar.ts";

function fakeTarget(tag: string): EventTarget {
  // 鸭子类型即可满足 shouldHandlePagingKey（Node 环境无 HTMLElement）；
  // EventTarget 交集类型承载 tagName/isContentEditable
  return { tagName: tag, isContentEditable: false } as unknown as EventTarget;
}

describe("DP-005 导航智能（纯函数）", () => {
  it("shouldHandlePagingKey：仅 ←/→ 且非输入/弹层/修饰键", () => {
    expect(shouldHandlePagingKey({ key: "ArrowLeft" }, fakeTarget("DIV"), false)).toBe(true);
    expect(shouldHandlePagingKey({ key: "ArrowRight" }, fakeTarget("DIV"), false)).toBe(true);
    expect(shouldHandlePagingKey({ key: "ArrowDown" }, fakeTarget("DIV"), false)).toBe(false);
    expect(shouldHandlePagingKey({ key: "ArrowLeft", shiftKey: true }, fakeTarget("DIV"), false)).toBe(false);
    expect(shouldHandlePagingKey({ key: "ArrowLeft", metaKey: true }, fakeTarget("DIV"), false)).toBe(false);
    expect(shouldHandlePagingKey({ key: "ArrowLeft" }, fakeTarget("INPUT"), false)).toBe(false);
    expect(shouldHandlePagingKey({ key: "ArrowLeft" }, fakeTarget("TEXTAREA"), false)).toBe(false);
    expect(shouldHandlePagingKey({ key: "ArrowLeft" }, fakeTarget("DIV"), true)).toBe(false); // 搜索弹层开
  });
});
