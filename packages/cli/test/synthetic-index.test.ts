/**
 * 嵌套目录合成总览页端到端（2026-08 嵌套分区设计 v2，用户决策）：
 * - 无 README/index 绑定的嵌套目录 → SSG 产物生成 目录/index.html（文档卡片列表总览页），
 *   侧边栏出现入口条目（文本统一目录名）
 * - 有 README 绑定 → 不合成，入口链接真实文件（文本仍统一目录名）
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildSite } from "../src/build.ts";

describe("嵌套目录合成总览页（SSG 端到端）", () => {
  it("无绑定 → 合成 index.html（卡片列表）+ 侧边栏入口；有绑定 → 走用户内容", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-synth-"));
    const docs = join(root, "docs");
    mkdirSync(join(docs, "语法", "测试"), { recursive: true });
    writeFileSync(join(docs, "README.md"), "---\ntitle: 首页\n---\n# 首页");
    writeFileSync(join(docs, "语法", "a.md"), "---\ntitle: A\n---\n# A");
    writeFileSync(join(docs, "语法", "测试", "00-x.md"), "---\ntitle: X 文档\nsummary: X 摘要\n---\n# X 内容");
    writeFileSync(join(docs, "语法", "测试", "01-y.md"), "---\ntitle: Y 文档\n---\n# Y 内容");

    const out = join(root, "out");
    buildSite({ dir: docs, outDir: out });

    // 合成总览页产物 + 卡片列表（SSG 链接 .html；desc = 正文摘要前 80 字符）
    const synHtml = readFileSync(join(out, "语法", "测试", "index.html"), "utf8");
    expect(synHtml).toContain("dir-card");
    expect(synHtml).toContain('href="./00-x.html"');
    expect(synHtml).toContain("X 文档");
    expect(synHtml).toContain("X 内容"); // 正文摘要（summaries = 正文前 80 字符）
    expect((synHtml.match(/class="dir-card"/g) ?? []).length).toBe(2); // 00-x + 01-y
    expect((synHtml.match(/class="dir-desc"/g) ?? []).length).toBe(2); // 两卡均有正文摘要
    // 首页侧边栏入口（文本统一目录名）
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('data-path="语法/测试/index.md">测试</a>');

    // 有 README 绑定 → 不合成，入口链接真实文件（文本仍统一目录名）
    writeFileSync(join(docs, "语法", "测试", "README.md"), "---\ntitle: 用户总览\n---\n# 用户内容");
    const out2 = join(root, "out2");
    buildSite({ dir: docs, outDir: out2 });
    const index2 = readFileSync(join(out2, "index.html"), "utf8");
    expect(index2).toContain('data-path="语法/测试/README.md">测试</a>');
    expect(index2).not.toMatch(/class="dir-card"/); // 无合成卡片（CSS 中的 .dir-card 规则不算）
    // 用户内容直出（README 渲染为其页面，标题 = frontmatter.title「用户总览」）
    const bound = readFileSync(join(out2, "语法", "测试", "README.html"), "utf8");
    expect(bound).toContain("用户总览");

    rmSync(root, { recursive: true, force: true });
  });
});
