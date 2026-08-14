/**
 * DEMO-001 演示形态测试：解析（分页/frontmatter/备注/布局）/ 构建（自包含/主题/安全）/ CLI 接线
 */
import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSlidesHtml, parseSlides, resolveSlideThemeCss, SLIDE_THEMES } from "../src/slides.ts";
import { runSlides } from "../src/index.ts";

const SAMPLE = `---
title: DocLight 演示
author: DocLight 团队
date: 2026-08-14
---

# 把 Markdown 变成作品

DocLight 演示形态——每页一个观点。

<!-- notes: 开场：先讲一句话定位 -->

---

<!-- layout: section -->

# 为什么是演示

---
<!-- layout: content -->

## 同源不同形

文档是密度，演示是强度。**绝不做机械切页**。

- 每页一个观点
- 少文字、强视觉
- 逐页叙事

<!-- notes: 强调"不是文档切片" -->

---

<!-- layout: end -->

# 谢谢

欢迎试用 doclight slides。
`;

describe("parseSlides（DEMO-001 分页/元数据/指令）", () => {
  it("frontmatter 元数据 + `---` 分页（frontmatter 块不算分页）", () => {
    const deck = parseSlides(SAMPLE);
    expect(deck.title).toBe("DocLight 演示");
    expect(deck.meta["author"]).toBe("DocLight 团队");
    expect(deck.pages).toHaveLength(4);
  });

  it("布局：首页自动 cover，显式指令生效（section/content/end）", () => {
    const deck = parseSlides(SAMPLE);
    expect(deck.pages[0]!.layout).toBe("cover");
    expect(deck.pages[1]!.layout).toBe("section");
    expect(deck.pages[2]!.layout).toBe("content");
    expect(deck.pages[3]!.layout).toBe("end");
  });

  it("演讲者备注提取（<!-- notes: --> 不进正文）", () => {
    const deck = parseSlides(SAMPLE);
    expect(deck.pages[0]!.notes).toContain("开场");
    expect(deck.pages[2]!.notes).toContain("不是文档切片");
    expect(deck.pages[0]!.markdown).not.toContain("notes:");
    expect(deck.pages[2]!.markdown).toContain("同源不同形");
  });

  it("无 frontmatter / 无分页：单页 cover 兜底", () => {
    const deck = parseSlides("# 单页", "缺省标题");
    expect(deck.title).toBe("缺省标题");
    expect(deck.pages).toHaveLength(1);
    expect(deck.pages[0]!.layout).toBe("cover");
  });
});

describe("buildSlidesHtml（DEMO-001 自包含产物）", () => {
  it("自包含单文件：CSS + 壳层 JS 内嵌，无外部引用", () => {
    const html = buildSlidesHtml(SAMPLE, { title: "DocLight 演示" });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("id=\"slide-stage\"");
    expect(html).toContain("slide-progress");
    expect(html).toContain("addEventListener('keydown'");
    expect(html).not.toContain("<script src="); // 无外部脚本
    expect(html).not.toContain("<link rel=\"stylesheet\""); // 无外部样式
  });

  it("每页渲染为 .slide section（data-layout + data-notes 承载）", () => {
    const html = buildSlidesHtml(SAMPLE);
    const slides = html.match(/<section class="slide"/g) ?? [];
    expect(slides).toHaveLength(4);
    expect(html).toContain('data-layout="cover"');
    expect(html).toContain('data-layout="end"');
    expect(html).toContain("把 Markdown 变成作品");
    expect(html).toContain("同源不同形");
  });

  it("内容经渲染内核 sanitize（XSS 不注入）", () => {
    const evil = "# 标题\n\n<script>alert('x')</script>\n\n<img src=x onerror=alert(1)>";
    const html = buildSlidesHtml(`---\n# 封面\n\n---\n${evil}`);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("onerror");
  });

  it("主题：内置三套 + 未知警告回退 + 自定义 CSS 文件", () => {
    expect(Object.keys(SLIDE_THEMES).sort()).toEqual(["dark", "light", "warm"]);
    expect(buildSlidesHtml(SAMPLE, { theme: "light" })).toContain("--slide-accent: #1e3a5f");
    expect(buildSlidesHtml(SAMPLE, { theme: "warm" })).toContain("--slide-accent: #d97706");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(resolveSlideThemeCss("nope")).toBe(SLIDE_THEMES.dark);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
    const root = mkdtempSync(join(tmpdir(), "doclight-slides-theme-"));
    try {
      const file = join(root, "custom.css");
      writeFileSync(file, ":root { --slide-accent: #ff0000; }");
      expect(buildSlidesHtml(SAMPLE, { theme: file })).toContain("--slide-accent: #ff0000");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("备注转义注入 data-notes（引号/尖括号安全）", () => {
    const withQuote = "# A\n\n<!-- notes: 他说 \"hi\" <tag> -->";
    const html = buildSlidesHtml(withQuote);
    expect(html).not.toContain("<tag>"); // 转义后不存在原始标签
  });
});

describe("doclight slides CLI（DEMO-001 接线）", () => {
  it("runSlides 输出自包含 HTML（文件名主干 + 页数 + 字节）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-slides-cli-"));
    try {
      const src = join(root, "my-talk.md");
      writeFileSync(src, SAMPLE);
      const result = runSlides({ file: src, theme: "dark", author: "DocLight 团队" });
      expect(result.pages).toBe(4);
      expect(result.file.endsWith("my-talk.html")).toBe(true);
      expect(result.bytes).toBeGreaterThan(5_000);
      const html = readFileSync(result.file, "utf8");
      expect(html).toContain("DocLight 演示");
      expect(html).toContain("DocLight 团队"); // 封面署名
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
