/**
 * DP-007 AI 原生身份测试（Phase 7，18-design-polish §3.7）：
 * 溯源徽标（三形态同构 + 合法值白名单）/ llms.txt 提示（仅 SSG）/
 * 画廊设计宣言 / frontmatter provenance 登记 capabilities。
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "../src/build.ts";
import { bundleSite } from "../src/bundle.ts";
import { renderPage } from "../src/site.ts";
import { buildGallery } from "../src/gallery.ts";
import { FRONTMATTER_KEYS } from "../src/capabilities.ts";

describe("DP-007 AI 原生身份", () => {
  it("溯源徽标：provenance 白名单（ai/human/mixed），三形态同构渲染", () => {
    for (const kind of ["ai", "human", "mixed"] as const) {
      const html = renderPage({
        title: "t",
        siteTitle: "s",
        navHtml: "",
        contentHtml: "<p>x</p>",
        form: "ssg",
        seo: { provenance: kind },
      });
      expect(html).toContain(`origin-badge origin-${kind}`);
      expect(html).toContain("origin-close");
    }
    const labels = { ai: "AI 生成", human: "人工撰写", mixed: "AI 辅助" } as const;
    for (const [k, v] of Object.entries(labels)) {
      const html = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "dev", seo: { provenance: k as "ai" } });
      expect(html).toContain(v);
    }
    // 缺省不渲染（CSS 规则存在，但无 HTML 元素）
    const plain = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg" });
    expect(plain).not.toContain('class="origin-badge');
  });

  it("llms.txt 收录提示：仅 SSG 形态（dev/bundle 无 llms.txt 产物，诚实不伪造）", () => {
    const ssg = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "ssg" });
    expect(ssg).toContain('class="llms-note"');
    expect(ssg).toContain("已收录于 llms.txt");
    const dev = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "dev" });
    expect(dev).not.toContain('class="llms-note"');
    const bundle = renderPage({ title: "t", siteTitle: "s", navHtml: "", contentHtml: "<p>x</p>", form: "bundle" });
    expect(bundle).not.toContain('class="llms-note"');
  });

  it("画廊索引含设计宣言（宪法五原则 + 令牌事实）", () => {
    const dir = mkdtempSync(join(tmpdir(), "doclight-dp007-"));
    try {
      buildGallery({ outDir: dir });
      const idx = readFileSync(join(dir, "index.html"), "utf8");
      expect(idx).toContain("设计宣言");
      expect(idx).toContain("排版即界面");
      expect(idx).toContain("颜色有职务");
      expect(idx).toContain("#14714e");
      expect(idx).toContain("圆角仅 8 / 10px");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("buildSite：frontmatter provenance 进产物（meta 徽标直出）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-dp007b-"));
    const prev = process.cwd();
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(
        join(root, "docs", "README.md"),
        "---\ntitle: 首页\nprovenance: ai\n---\n\n# 首页\n\n内容。"
      );
      process.chdir(root);
      buildSite({ dir: "docs", outDir: "dist" });
      const html = readFileSync(join(root, "dist", "index.html"), "utf8");
      expect(html).toContain("origin-badge origin-ai");
      expect(html).toContain("AI 生成");
    } finally {
      process.chdir(prev);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("bundle：frontmatter provenance 进内嵌页（三形态同构）", async () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-dp007c-"));
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(
        join(root, "docs", "README.md"),
        "---\ntitle: 首页\nprovenance: mixed\n---\n\n# 首页\n\n内容。"
      );
      const res = await bundleSite({ dir: join(root, "docs"), outDir: join(root, "out") });
      const html = readFileSync(res.file, "utf8");
      expect(html).toContain("origin-badge origin-mixed");
      expect(html).toContain("AI 辅助");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("provenance 已登记 capabilities frontmatter 键清单", () => {
    expect(FRONTMATTER_KEYS).toContain("provenance");
  });
});
