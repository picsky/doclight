/**
 * REND-002/003 展示层扩展增强器 —— 纯函数单测
 * （DOM 增强逻辑由 e2e 覆盖：高亮生效 / 复制 / Mermaid 容错 / KaTeX 渲染）
 */
import { describe, expect, it } from "vitest";
import { extractLanguage } from "../src/extensions.ts";

describe("extractLanguage（REND-002 代码语言提取）", () => {
  it("从 language-* class 提取语言", () => {
    expect(extractLanguage("language-js")).toBe("js");
    expect(extractLanguage("language-typescript")).toBe("typescript");
    expect(extractLanguage("language-tsx")).toBe("tsx");
  });

  it("多 class 中提取（doclight 标记 + language 并存）", () => {
    expect(extractLanguage("doclight-code language-js")).toBe("js");
    expect(extractLanguage("language-python foo")).toBe("python");
  });

  it("无语言返回 null", () => {
    expect(extractLanguage("doclight-code")).toBeNull();
    expect(extractLanguage("")).toBeNull();
  });
});
