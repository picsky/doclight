/**
 * 主题包测试（THEME-002：主题包模型 / 解析规则；DP-001 单主题收敛）
 *
 * 覆盖：内置主题注册表（唯一一套 minimal）/ 退役主题警告降级 / 解析规则（缺省/default/
 * 内置名/文件路径/未知警告）/ renderPage 注入与防闪烁 / build 产物。
 */
import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILTIN_THEMES, BUILTIN_THEME_DEFAULT_MODE, RETIRED_THEMES, resolveThemeCss, resolveThemePackage } from "../src/themes.ts";
import { buildSite } from "../src/build.ts";
import { renderPage } from "../src/site.ts";

describe("BUILTIN_THEMES（THEME-002 内置主题；DP-001 单主题收敛）", () => {
  it("唯一内置主题 = minimal（serif/modern/warm 已退役），覆盖令牌 + 亮暗两套", () => {
    expect(Object.keys(BUILTIN_THEMES).sort()).toEqual(["minimal"]);
    for (const css of Object.values(BUILTIN_THEMES)) {
      expect(css).toContain(":root");
      expect(css).toContain("--accent");
      expect(css).toContain("--bg");
    }
  });

  it("minimal 与默认设计语言一致（松绿 Pine #14714e，宪法风格）", () => {
    expect(BUILTIN_THEMES.minimal).toContain("--accent: #14714e"); // 松绿 Pine（与默认一致）
    expect(BUILTIN_THEMES.minimal).toContain("--radius: 10px"); // 宪法圆角档位
  });

  it("唯一内置主题无默认模式声明（跟随系统偏好）", () => {
    expect(BUILTIN_THEME_DEFAULT_MODE).toEqual({});
  });

  it("退役主题清单 = serif / modern / warm", () => {
    expect([...RETIRED_THEMES].sort()).toEqual(["modern", "serif", "warm"]);
  });
});

describe("resolveThemePackage / resolveThemeCss（THEME-002 + DP-001 解析规则）", () => {
  it("缺省 / default 零注入空包", () => {
    expect(resolveThemePackage(undefined).css).toBe("");
    expect(resolveThemePackage("").css).toBe("");
    expect(resolveThemePackage("default").css).toBe("");
    expect(resolveThemeCss(undefined)).toBe("");
  });

  it("内置主题名返回包（css）", () => {
    expect(resolveThemeCss("minimal")).toBe(BUILTIN_THEMES.minimal);
    const pkg = resolveThemePackage("minimal");
    expect(pkg.css).toBe(BUILTIN_THEMES.minimal);
    expect(pkg.defaultTheme).toBeUndefined();
  });

  it("DP-001：退役内置主题警告并降级默认（明确提示，不伪造成功）", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      for (const t of RETIRED_THEMES) {
        expect(resolveThemeCss(t, process.cwd())).toBe("");
        expect(warn).toHaveBeenCalled();
        const msgs = warn.mock.calls.map((c) => String(c[0]));
        expect(msgs.some((m) => m.includes("已退役") && m.includes(t))).toBe(true);
        warn.mockClear();
      }
    } finally {
      warn.mockRestore();
    }
  });

  it("CSS 文件路径加载（相对 cwd 与绝对路径；自定义主题机制保留）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-theme-"));
    try {
      const file = join(root, "my-theme.css");
      writeFileSync(file, ":root { --accent: #7c3aed; }");
      expect(resolveThemeCss("./my-theme.css", root)).toContain("--accent: #7c3aed");
      expect(resolveThemeCss(file, root)).toContain("--accent: #7c3aed");
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
    expect(withTheme).toContain("--accent: #14714e");
    const noTheme = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg" });
    expect(noTheme).not.toContain("data-doclight-theme");
  });

  it("renderPage defaultTheme 注入防闪烁脚本（自定义主题可声明暗色优先）", () => {
    const html = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg", defaultTheme: "dark" });
    expect(html).toContain(`var def = 'dark';`);
    const plain = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg" });
    expect(plain).toContain("var def = null;");
  });

  it("renderPage fixedTheme 钉死模式（画廊面板用）", () => {
    const html = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg", fixedTheme: "dark" });
    expect(html).toContain(`var fixed = 'dark';`);
  });

  it("buildSite 产物含主题覆盖层（doclight.json theme 配置）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-theme-build-"));
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "doclight.json"), JSON.stringify({ title: "主题站", theme: "minimal" }));
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
      expect(html).toContain("--accent: #14714e"); // minimal = 默认松绿 Pine
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("DP-001：buildSite 旧主题配置（serif）警告降级 → 产物 = 默认视觉（零注入）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-theme-retired-"));
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "doclight.json"), JSON.stringify({ title: "旧主题站", theme: "serif" }));
      writeFileSync(join(root, "docs", "README.md"), "# 退役主题测试");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const prev = process.cwd();
      process.chdir(root);
      let calls: string[] = [];
      try {
        buildSite({ dir: "docs", outDir: "dist" });
      } finally {
        process.chdir(prev);
        calls = warn.mock.calls.map((c) => String(c[0]));
        warn.mockRestore();
      }
      expect(calls.some((m) => m.includes("已退役") && m.includes("serif"))).toBe(true);
      const html = readFileSync(join(root, "dist", "index.html"), "utf8");
      expect(html).not.toContain('<style data-doclight-theme>'); // 降级默认 = 零注入
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
