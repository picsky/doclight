/**
 * 主题包测试（THEME-002：CSS 变量覆盖层）
 *
 * 覆盖：内置主题注册表 / 解析规则（缺省/default/内置名/文件路径/未知警告）/
 * renderPage 注入 data-doclight-theme 标记 / build 产物含主题覆盖层。
 */
import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILTIN_THEMES, resolveThemeCss } from "../src/themes.ts";
import { buildSite } from "../src/build.ts";
import { renderPage } from "../src/site.ts";

describe("BUILTIN_THEMES（THEME-002 内置主题）", () => {
  it("含 minimal 与 warm，且覆盖令牌 + 暗色令牌", () => {
    expect(Object.keys(BUILTIN_THEMES).sort()).toEqual(["minimal", "warm"]);
    for (const css of Object.values(BUILTIN_THEMES)) {
      expect(css).toContain(":root");
      expect(css).toContain("--color-primary");
      expect(css).toContain('[data-theme="dark"]');
    }
  });

  it("warm 主题含衬线标题微调规则（非令牌规则也允许）", () => {
    expect(BUILTIN_THEMES.warm).toContain("article h1");
  });
});

describe("resolveThemeCss（THEME-002 解析规则）", () => {
  it("缺省 / default 零注入（返回空串）", () => {
    expect(resolveThemeCss(undefined)).toBe("");
    expect(resolveThemeCss("")).toBe("");
    expect(resolveThemeCss("default")).toBe("");
  });

  it("内置主题名返回内置 CSS", () => {
    expect(resolveThemeCss("minimal")).toBe(BUILTIN_THEMES.minimal);
    expect(resolveThemeCss("warm")).toBe(BUILTIN_THEMES.warm);
  });

  it("CSS 文件路径加载（相对 cwd 与绝对路径）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-theme-"));
    try {
      const file = join(root, "my-theme.css");
      writeFileSync(file, ":root { --color-primary: #7c3aed; }");
      expect(resolveThemeCss("./my-theme.css", root)).toContain("--color-primary: #7c3aed");
      expect(resolveThemeCss(file, root)).toContain("--color-primary: #7c3aed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("未知主题警告 + 回退默认（不伪造成功）", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(resolveThemeCss("nonexistent", process.cwd())).toBe("");
      expect(warn).toHaveBeenCalled();
      expect(warn.mock.calls[0]![0]).toContain("未知主题");
    } finally {
      warn.mockRestore();
    }
  });
});

describe("主题注入（THEME-002 renderPage / build）", () => {
  it("renderPage 注入 <style data-doclight-theme>，缺省不注入", () => {
    const withTheme = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg", themeCss: BUILTIN_THEMES.minimal });
    expect(withTheme).toContain('<style data-doclight-theme>');
    expect(withTheme).toContain("--color-primary: #111827");
    const noTheme = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg" });
    expect(noTheme).not.toContain("data-doclight-theme");
  });

  it("buildSite 产物含主题覆盖层（doclight.json theme 配置）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-theme-build-"));
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "doclight.json"), JSON.stringify({ title: "主题站", theme: "warm" }));
      writeFileSync(join(root, "docs", "README.md"), "# 主题测试");
      const prev = process.cwd();
      process.chdir(root);
      try {
        buildSite({ dir: "docs", outDir: "dist" });
      } finally {
        process.chdir(prev);
      }
      const html = readFileSync(join(root, "dist", "index.html"), "utf8");
      expect(html).toContain('<style data-doclight-theme>');
      expect(html).toContain("--color-primary: #b45309");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
