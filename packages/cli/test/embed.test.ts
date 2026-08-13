import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { embedIframe, embedSnippet, embedSite } from "../src/embed.ts";

let docsDir: string;

beforeAll(() => {
  docsDir = mkdtempSync(join(tmpdir(), "doclight-embed-docs-"));
  writeFileSync(join(docsDir, "README.md"), "# 首页\n\n欢迎。");
  writeFileSync(join(docsDir, "intro.md"), "# 入门");
});

afterAll(() => {
  rmSync(docsDir, { recursive: true, force: true });
});

describe("doclight embed（CLI-007，13 §3.1 分发四触点③）", () => {
  it("embedSnippet：自推导基址 + 响应式 iframe 注入", () => {
    const js = embedSnippet();
    expect(js).toContain("snippet\\.js"); // 从自身 script src 定位
    expect(js).toContain("createElement(\"iframe\")");
    expect(js).toContain('frame.style.width = "100%"');
    expect(js).toContain("minHeight");
    expect(js).toContain("index.html"); // 基址 + 首页
  });

  it("embedIframe：可复制 iframe 代码块", () => {
    const html = embedIframe("https://docs.example.com/");
    expect(html).toContain('<iframe src="https://docs.example.com/"');
    expect(html).toContain("width:100%");
    expect(html).toContain("loading=\"lazy\"");
  });

  it("embedSite：构建 + 写出 snippet.js + 返回 iframe 片段", () => {
    const out = mkdtempSync(join(tmpdir(), "doclight-embed-out-"));
    try {
      const result = embedSite({ dir: docsDir, outDir: out, siteUrl: "https://docs.example.com/" });
      expect(existsSync(result.snippetFile)).toBe(true);
      expect(result.outDir).toBe(out);
      expect(result.iframeHtml).toContain("https://docs.example.com/");
      expect(result.build?.pages).toBeGreaterThan(0);
      // snippet.js 与站点产物同目录（base 推导可用）
      expect(result.snippetFile.startsWith(out)).toBe(true);
      const js = readFileSync(result.snippetFile, "utf8");
      expect(js).toContain("iframe");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("embedSite skipBuild：复用既有产物只写 snippet.js", () => {
    const out = mkdtempSync(join(tmpdir(), "doclight-embed-out2-"));
    try {
      const result = embedSite({ outDir: out, skipBuild: true });
      expect(result.build).toBeUndefined();
      expect(existsSync(result.snippetFile)).toBe(true);
      // 无 siteUrl → 相对占位（不伪造绝对 URL）
      expect(result.url).toBe("./index.html");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
