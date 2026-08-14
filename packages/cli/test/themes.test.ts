/**
 * 主题包测试（THEME-002 + VIS-001：4 套设计语言 / 主题包模型 / 解析规则）
 *
 * 覆盖：内置主题注册表（4 套）/ 默认模式（modern=dark）/ 解析规则（缺省/default/
 * 内置名/文件路径/未知警告）/ renderPage 注入与防闪烁默认模式 / build 产物。
 */
import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILTIN_THEMES, BUILTIN_THEME_DEFAULT_MODE, resolveThemeCss, resolveThemePackage } from "../src/themes.ts";
import { buildSite } from "../src/build.ts";
import { renderPage } from "../src/site.ts";

describe("BUILTIN_THEMES（THEME-002 + VIS-001 内置主题）", () => {
  it("4 套设计语言齐备（minimal / serif / modern / warm），每套覆盖令牌 + 亮暗两套", () => {
    expect(Object.keys(BUILTIN_THEMES).sort()).toEqual(["minimal", "modern", "serif", "warm"]);
    for (const css of Object.values(BUILTIN_THEMES)) {
      expect(css).toContain(":root");
      expect(css).toContain("--color-primary");
      expect(css).toContain("--color-bg");
    }
  });

  it("各主题特征值与 11-default-themes 规格一致", () => {
    expect(BUILTIN_THEMES.serif).toContain("--color-primary: #1e3a5f"); // 深靛蓝
    expect(BUILTIN_THEMES.serif).toContain("--font-serif"); // 衬线标题
    expect(BUILTIN_THEMES.modern).toContain("--color-primary: #7c3aed"); // violet
    expect(BUILTIN_THEMES.modern).toContain("backdrop-filter"); // 玻璃拟态
    expect(BUILTIN_THEMES.warm).toContain("--color-primary: #d97706"); // 暖橙
    expect(BUILTIN_THEMES.warm).toContain("--radius: 12px"); // 大圆角
    expect(BUILTIN_THEMES.minimal).toContain("--color-primary: #0d9488"); // teal（与默认一致）
  });

  it("modern 默认暗色（defaultTheme=dark，其余无声明）", () => {
    expect(BUILTIN_THEME_DEFAULT_MODE).toEqual({ modern: "dark" });
  });
});

describe("resolveThemePackage / resolveThemeCss（THEME-002 + VIS-001 解析规则）", () => {
  it("缺省 / default 零注入空包", () => {
    expect(resolveThemePackage(undefined).css).toBe("");
    expect(resolveThemePackage("").css).toBe("");
    expect(resolveThemePackage("default").css).toBe("");
    expect(resolveThemeCss(undefined)).toBe("");
  });

  it("内置主题名返回包（css + defaultTheme）", () => {
    expect(resolveThemeCss("serif")).toBe(BUILTIN_THEMES.serif);
    const modern = resolveThemePackage("modern");
    expect(modern.css).toBe(BUILTIN_THEMES.modern);
    expect(modern.defaultTheme).toBe("dark");
    expect(resolveThemePackage("warm").defaultTheme).toBeUndefined();
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

describe("主题注入（THEME-002 + VIS-001 renderPage / build）", () => {
  it("renderPage 注入 <style data-doclight-theme>，缺省不注入", () => {
    const withTheme = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg", themeCss: BUILTIN_THEMES.serif });
    expect(withTheme).toContain('<style data-doclight-theme>');
    expect(withTheme).toContain("--color-primary: #1e3a5f");
    const noTheme = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg" });
    expect(noTheme).not.toContain("data-doclight-theme");
  });

  it("renderPage defaultTheme 注入防闪烁脚本（modern 首次进入即暗色）", () => {
    const html = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg", defaultTheme: "dark" });
    expect(html).toContain(`var def = 'dark';`);
    const plain = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg" });
    expect(plain).toContain("var def = null;");
  });

  it("renderPage fixedTheme 钉死模式（画廊面板用）", () => {
    const html = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg", fixedTheme: "dark" });
    expect(html).toContain(`var fixed = 'dark';`);
  });

  it("buildSite 产物含主题覆盖层 + modern 默认暗色（doclight.json theme 配置）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-theme-build-"));
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "doclight.json"), JSON.stringify({ title: "主题站", theme: "modern" }));
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
      expect(html).toContain("--color-primary: #7c3aed");
      expect(html).toContain(`var def = 'dark';`); // VIS-001：modern 默认暗色
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
