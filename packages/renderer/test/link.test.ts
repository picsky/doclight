import { describe, expect, it } from "vitest";
import { isExternal, resolveRelative, slugify } from "../src/core/link.ts";

describe("链接工具（REND-001）", () => {
  describe("isExternal", () => {
    it("识别 http/https/mailto/tel/data 与协议相对", () => {
      expect(isExternal("https://example.com")).toBe(true);
      expect(isExternal("http://example.com")).toBe(true);
      expect(isExternal("mailto:a@b.com")).toBe(true);
      expect(isExternal("tel:+86123")).toBe(true);
      expect(isExternal("//cdn.example.com/x.js")).toBe(true);
      expect(isExternal("data:text/html,x")).toBe(true);
    });
    it("站内链接非外部", () => {
      expect(isExternal("other.md")).toBe(false);
      expect(isExternal("../img/a.png")).toBe(false);
      expect(isExternal("#anchor")).toBe(false);
      expect(isExternal("/absolute/path")).toBe(false);
    });
  });

  describe("resolveRelative", () => {
    it("同目录相对路径拼接", () => {
      expect(resolveRelative("guide/quickstart.md", "other.md")).toBe("guide/other.md");
    });
    it("../ 归一化", () => {
      expect(resolveRelative("guide/quickstart.md", "../img/logo.png")).toBe("img/logo.png");
      expect(resolveRelative("guide/sub/a.md", "../../b.md")).toBe("b.md");
    });
    it("外部 / 锚点 / 绝对路径原样返回", () => {
      expect(resolveRelative("a.md", "https://x.com/y")).toBe("https://x.com/y");
      expect(resolveRelative("a.md", "#sec")).toBe("#sec");
      expect(resolveRelative("a.md", "/docs/x.md")).toBe("/docs/x.md");
    });
    it("根级文档相对路径", () => {
      expect(resolveRelative("README.md", "quickstart.md")).toBe("quickstart.md");
    });
  });

  describe("slugify", () => {
    it("英文转小写 + 连字符", () => {
      expect(slugify("Install Guide")).toBe("install-guide");
    });
    it("中文保留", () => {
      expect(slugify("安装指南")).toBe("安装指南");
    });
    it("混合与特殊字符归一化", () => {
      expect(slugify("Hello 世界! Test")).toBe("hello-世界-test");
    });
  });
});
