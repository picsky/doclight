/**
 * DP-005 导航智能测试（Phase 7，18-design-polish §3.5）：
 * 分组折叠状态解析/序列化 + 键盘翻页劫持判定（纯函数）。
 */
import { describe, expect, it } from "vitest";
import { parseCollapsedGroups, serializeCollapsedGroups, shouldHandlePagingKey } from "../src/sidebar.ts";

function fakeTarget(tag: string): EventTarget {
  // 鸭子类型即可满足 shouldHandlePagingKey（Node 环境无 HTMLElement）；
  // EventTarget 交集类型承载 tagName/isContentEditable
  return { tagName: tag, isContentEditable: false } as unknown as EventTarget;
}

describe("DP-005 导航智能（纯函数）", () => {
  it("parseCollapsedGroups：合法/损坏/缺失", () => {
    expect([...parseCollapsedGroups(JSON.stringify(["guide", "api"]))]).toEqual(["guide", "api"]);
    expect(parseCollapsedGroups("not-json").size).toBe(0);
    expect(parseCollapsedGroups(null).size).toBe(0);
    expect(parseCollapsedGroups(JSON.stringify([1, "a"])).size).toBe(1); // 非字符串过滤
  });

  it("serializeCollapsedGroups：空集返回空串（不写空键）", () => {
    expect(serializeCollapsedGroups(new Set(["a"]))).toBe(JSON.stringify(["a"]));
    expect(serializeCollapsedGroups(new Set())).toBe("");
  });

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
