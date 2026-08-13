/**
 * 插槽管理器测试（PLUG-005，07 §7.4 浏览器端纯逻辑）
 *
 * 覆盖：insert / remove / removeAll / renderHtml / clear / size
 * 纯函数测试，无 DOM 依赖（renderToDom 在 e2e 测试中覆盖）。
 */
import { describe, expect, it } from "vitest";
import { SlotManager } from "../src/slots.ts";

describe("SlotManager（PLUG-005 插槽管理）", () => {
  it("insert + renderHtml：静态内容拼接", () => {
    const mgr = new SlotManager();
    mgr.insert("content:after", "plugin-a", "<div>A</div>");
    mgr.insert("content:after", "plugin-b", "<div>B</div>");
    expect(mgr.renderHtml("content:after", { path: "/" })).toBe("<div>A</div><div>B</div>");
  });

  it("同一 id 不重复插入（幂等）", () => {
    const mgr = new SlotManager();
    mgr.insert("footer", "p1", "<span>1</span>");
    mgr.insert("footer", "p1", "<span>2</span>"); // 重复
    expect(mgr.renderHtml("footer", { path: "/" })).toBe("<span>1</span>");
    expect(mgr.size("footer")).toBe(1);
  });

  it("remove 按 id 移除", () => {
    const mgr = new SlotManager();
    mgr.insert("sidebar:after", "a", "A");
    mgr.insert("sidebar:after", "b", "B");
    mgr.remove("sidebar:after", "a");
    expect(mgr.renderHtml("sidebar:after", { path: "/" })).toBe("B");
  });

  it("removeAll 移除某 id 在全部插槽的内容", () => {
    const mgr = new SlotManager();
    mgr.insert("head:end", "analytics", "<script>track()</script>");
    mgr.insert("footer", "analytics", "<noscript></noscript>");
    mgr.insert("footer", "other", "keep");
    mgr.removeAll("analytics");
    expect(mgr.renderHtml("head:end", { path: "/" })).toBe("");
    expect(mgr.renderHtml("footer", { path: "/" })).toBe("keep");
  });

  it("函数型内容：每次 renderHtml 重新执行", () => {
    const mgr = new SlotManager();
    let calls = 0;
    mgr.insert("content:before", "dynamic", (ctx) => {
      calls++;
      return `<span>${ctx.path}</span>`;
    });
    expect(mgr.renderHtml("content:before", { path: "/a" })).toBe("<span>/a</span>");
    expect(mgr.renderHtml("content:before", { path: "/b" })).toBe("<span>/b</span>");
    expect(calls).toBe(2);
  });

  it("非法插槽名静默忽略（容错）", () => {
    const mgr = new SlotManager();
    mgr.insert("nonexistent:slot", "p", "content");
    expect(mgr.renderHtml("nonexistent:slot", { path: "/" })).toBe("");
    expect(mgr.size("nonexistent:slot")).toBe(0);
  });

  it("clear 清空全部", () => {
    const mgr = new SlotManager();
    mgr.insert("footer", "p", "x");
    mgr.insert("head:end", "q", "y");
    mgr.clear();
    expect(mgr.size("footer")).toBe(0);
    expect(mgr.size("head:end")).toBe(0);
  });

  it("11 个标准插槽名均可使用", () => {
    const mgr = new SlotManager();
    const names = [
      "head:start", "head:end", "sidebar:before", "sidebar:after",
      "topbar:before", "topbar:after", "content:before", "content:after",
      "toc:before", "toc:after", "footer",
    ] as const;
    for (const name of names) {
      mgr.insert(name, "test", `<i>${name}</i>`);
      expect(mgr.renderHtml(name, { path: "/" })).toBe(`<i>${name}</i>`);
    }
  });
});
