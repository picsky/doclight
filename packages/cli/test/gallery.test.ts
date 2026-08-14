/**
 * VIS-001 主题画廊测试：产物结构 / 固定模式 / 主题覆盖层 / 与真实站点同构
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGallery, SAMPLE_GALLERY_DOC } from "../src/gallery.ts";
import { buildSite } from "../src/build.ts";

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), "doclight-gallery-"));
}

describe("buildGallery（VIS-001 主题画廊）", () => {
  it("产物：索引 + 4 主题 × 亮/暗 共 9 个 HTML", () => {
    const dir = tmpDir();
    try {
      const res = buildGallery({ outDir: dir, siteTitle: "测试站" });
      expect(res.files.sort()).toEqual([
        "index.html",
        "minimal/dark/index.html",
        "minimal/light/index.html",
        "modern/dark/index.html",
        "modern/light/index.html",
        "serif/dark/index.html",
        "serif/light/index.html",
        "warm/dark/index.html",
        "warm/light/index.html",
      ]);
      expect(res.bytes).toBeGreaterThan(100_000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("面板 fixedTheme 钉死模式（防闪烁脚本不读 localStorage）", () => {
    const dir = tmpDir();
    try {
      buildGallery({ outDir: dir });
      const light = readFileSync(join(dir, "minimal", "light", "index.html"), "utf8");
      expect(light).toContain(`var fixed = 'light';`);
      const dark = readFileSync(join(dir, "serif", "dark", "index.html"), "utf8");
      expect(dark).toContain(`var fixed = 'dark';`);
      // 面板带对应主题覆盖层
      expect(light).toContain("data-doclight-theme");
      expect(light).toContain("--color-primary");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("示例文档覆盖全语法特性（标题/代码/表格/容器/公式/图表/引用/列表）", () => {
    expect(SAMPLE_GALLERY_DOC).toContain("# 一级标题");
    expect(SAMPLE_GALLERY_DOC).toContain("```ts");
    expect(SAMPLE_GALLERY_DOC).toContain("| 特性 |");
    expect(SAMPLE_GALLERY_DOC).toContain(":::tip");
    expect(SAMPLE_GALLERY_DOC).toContain("$$");
    expect(SAMPLE_GALLERY_DOC).toContain("```mermaid");
    expect(SAMPLE_GALLERY_DOC).toContain("> 技术本质");
    expect(SAMPLE_GALLERY_DOC).toContain("- [x]");
  });

  it("面板内容与真实站点同构（同一渲染内核：示例文档渲染进 article）", () => {
    const dir = tmpDir();
    try {
      buildGallery({ outDir: dir });
      const panel = readFileSync(join(dir, "warm", "light", "index.html"), "utf8");
      expect(panel).toContain("<article>");
      expect(panel).toContain("把 Markdown 变成作品"); // 示例文档渲染内容
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("build --themes 在产物中生成 gallery/（与站点同目录可部署）", () => {
    const docsDir = tmpDir();
    const outDir = tmpDir();
    try {
      mkdirSync(join(docsDir, "guide"), { recursive: true });
      writeFileSync(join(docsDir, "README.md"), "# 首页");
      writeFileSync(join(docsDir, "guide", "a.md"), "# A");
      writeFileSync(join(outDir, "display.js"), "/* placeholder */");
      buildSite({ dir: docsDir, outDir, title: "画廊站", themes: true });
      expect(existsSync(join(outDir, "gallery", "index.html"))).toBe(true);
      expect(existsSync(join(outDir, "gallery", "modern", "dark", "index.html"))).toBe(true);
    } finally {
      rmSync(docsDir, { recursive: true, force: true });
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
