import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleSite } from "../src/bundle.ts";

let docsDir: string;

beforeAll(() => {
  docsDir = mkdtempSync(join(tmpdir(), "doclight-bundle-"));
  mkdirSync(join(docsDir, "guide"), { recursive: true });
  writeFileSync(join(docsDir, "README.md"), "# 首页\n\n欢迎来到便携包。\n\n[去入门](intro.md)");
  writeFileSync(join(docsDir, "intro.md"), "---\ntitle: 入门\n---\n\n# 入门内容");
  writeFileSync(join(docsDir, "guide", "quickstart.md"), "# 快速开始\n\n参见 [基础](./basic.md)");
  writeFileSync(join(docsDir, "guide", "basic.md"), "# 基础");
});

afterAll(() => {
  rmSync(docsDir, { recursive: true, force: true });
});

function tmpOut(): string {
  return mkdtempSync(join(tmpdir(), "doclight-bundle-out-"));
}

/** 展示层占位 bundle（bundleSite 会清空 outDir，故独立于 outDir 创建） */
function tmpDisplay(): string {
  const d = mkdtempSync(join(tmpdir(), "doclight-bundle-display-"));
  const f = join(d, "display.js");
  writeFileSync(f, "// 占位展示层");
  return f;
}

describe("doclight bundle（CLI-002 单文件便携包，05 §5.3.4）", () => {
  it("输出单个自包含 doclight.html：内嵌数据块 + hash 导航 + 内联展示层", () => {
    const out = tmpOut();
    const display = tmpDisplay();
    const result = bundleSite({ dir: docsDir, outDir: out, title: "测试站", displayBundle: display });
    expect(result.pages).toBe(4);
    expect(result.file.endsWith("doclight.html")).toBe(true);
    expect(existsSync(result.file)).toBe(true);

    const html = readFileSync(result.file, "utf8");
    // 内嵌数据块（pages/titles/nav/searchIndex）
    expect(html).toContain("window.__DOCLLIGHT_BUNDLE__ =");
    expect(html).toContain('"/guide/quickstart.html"');
    expect(html).toContain('"searchIndex"');
    // hash 路由导航链接
    expect(html).toContain('href="#/intro.html"');
    expect(html).toContain('href="#/guide/quickstart.html"');
    expect(html).toContain('href="#/"');
    // 展示层内联（无外部 script src）
    expect(html).toContain("<script type=\"module\">\n// 占位展示层");
    expect(html).not.toMatch(/<script type="module" src=/);
    // 首页内容直出（file:// 首屏无需 JS）
    expect(html).toContain("欢迎来到便携包");
    // 无 SEO 绝对链接（分发形态）
    expect(html).not.toContain("canonical");
    rmSync(out, { recursive: true, force: true });
  });

  it("bundle 数据块可解析：pages/titles/searchIndex/nav 完整", () => {
    const out = tmpOut();
    const display = tmpDisplay();
    bundleSite({ dir: docsDir, outDir: out, title: "测试站", displayBundle: display });
    const html = readFileSync(join(out, "doclight.html"), "utf8");
    const m = /window\.__DOCLLIGHT_BUNDLE__ = (\{[\s\S]*?\});\n?<\/script>/.exec(html);
    expect(m).not.toBeNull();
    const data = JSON.parse(m![1]!) as {
      pages: Record<string, string>;
      titles: Record<string, string>;
      searchIndex: { version: string; docs: Array<{ path: string }> };
    };
    expect(data.pages["/"]).toContain("欢迎来到便携包");
    expect(data.pages["/guide/quickstart.html"]).toContain("快速开始");
    expect(data.titles["/intro.html"]).toBe("入门 · 测试站");
    expect(data.searchIndex.docs.every((d) => d.path.endsWith(".html"))).toBe(true);
    expect(data.searchIndex.version).toMatch(/^[0-9a-z]+$/);
    rmSync(out, { recursive: true, force: true });
  });
});
