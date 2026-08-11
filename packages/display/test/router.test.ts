import { describe, expect, it } from "vitest";
import { isInternalLink } from "../src/router.ts";

describe("路由内部链接判定（展示层最简骨架）", () => {
  const base = "http://localhost:3000/";

  it("站内相对链接为内部", () => {
    expect(isInternalLink("/guide/quickstart.md", base)).toBe(true);
    expect(isInternalLink("guide/quickstart.md", base)).toBe(true);
    expect(isInternalLink("/", base)).toBe(true);
  });

  it("外部链接 / 锚点 / 协议非内部", () => {
    expect(isInternalLink("https://example.com", base)).toBe(false);
    expect(isInternalLink("//example.com/x", base)).toBe(false);
    expect(isInternalLink("#section", base)).toBe(false);
    expect(isInternalLink("mailto:a@b.com", base)).toBe(false);
    expect(isInternalLink("javascript:alert(1)", base)).toBe(false);
  });

  it("空值安全", () => {
    expect(isInternalLink(null, base)).toBe(false);
    expect(isInternalLink(undefined, base)).toBe(false);
    expect(isInternalLink("", base)).toBe(false);
  });
});
