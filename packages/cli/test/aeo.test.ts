/**
 * AEO-001 发布产物 Agent 友好测试：每页 markdown 版本 / llms.txt v2 Link 关系 / token 计数
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "../src/build.ts";

let docsDir: string;
let outDir: string;

beforeAll(() => {
  docsDir = mkdtempSync(join(tmpdir(), "doclight-aeo-"));
  mkdirSync(join(docsDir, "guide"), { recursive: true });
  writeFileSync(join(docsDir, "README.md"), "# 首页\n\n欢迎来到测试站。");
  writeFileSync(join(docsDir, "guide", "quickstart.md"), "---\ntitle: 快速开始\n---\n\n# 快速开始\n\n安装 DocLight 只需要一条命令。");
  outDir = mkdtempSync(join(tmpdir(), "doclight-aeo-out-"));
  writeFileSync(join(outDir, "display.js"), "/* placeholder */");
  buildSite({ dir: docsDir, outDir, title: "AEO 测试站", siteUrl: "https://docs.example.com" });
});

afterAll(() => {
  rmSync(docsDir, { recursive: true, force: true });
  rmSync(outDir, { recursive: true, force: true });
});

describe("AEO-001 每页 markdown 版本", () => {
  it("产物含每篇 .md 源文件（与 .html 同相对路径）", () => {
    expect(existsSync(join(outDir, "README.md"))).toBe(true);
    expect(existsSync(join(outDir, "guide", "quickstart.md"))).toBe(true);
    expect(readFileSync(join(outDir, "guide", "quickstart.md"), "utf8")).toContain("# 快速开始");
  });

  it("每页 <head> 含 link rel=alternate type=text/markdown（指向 .md 版本）", () => {
    const html = readFileSync(join(outDir, "guide", "quickstart.html"), "utf8");
    expect(html).toContain('<link rel="alternate" type="text/markdown" href="/guide/quickstart.md">');
  });

  it("首页 markdown 版本指向根级源路径（README.md）", () => {
    const html = readFileSync(join(outDir, "index.html"), "utf8");
    expect(html).toContain('<link rel="alternate" type="text/markdown" href="/README.md">');
  });

  it("sitemap.xml 不含 .md URL（SEO 不重复收录）", () => {
    const sitemap = readFileSync(join(outDir, "sitemap.xml"), "utf8");
    expect(sitemap).not.toContain(".md");
    expect(sitemap).toContain("guide/quickstart.html");
  });
});

describe("AEO-001 llms.txt v2 Link 关系", () => {
  it("每页 <head> 含 rel=describedby 指向 llms.txt", () => {
    const html = readFileSync(join(outDir, "guide", "quickstart.html"), "utf8");
    expect(html).toContain('<link rel="describedby" href="/llms.txt">');
    expect(readFileSync(join(outDir, "index.html"), "utf8")).toContain('<link rel="describedby" href="/llms.txt">');
  });
});

describe("AEO-001 token 计数", () => {
  it("docs.json 每篇含 tokens 且头部含 totalTokens", () => {
    const docsJson = JSON.parse(readFileSync(join(outDir, "docs.json"), "utf8")) as {
      totalTokens: number;
      docs: Array<{ path: string; tokens: number }>;
    };
    expect(typeof docsJson.totalTokens).toBe("number");
    expect(docsJson.totalTokens).toBeGreaterThan(0);
    expect(docsJson.docs.length).toBeGreaterThan(0);
    for (const d of docsJson.docs) {
      expect(typeof d.tokens).toBe("number");
      expect(d.tokens).toBeGreaterThan(0);
    }
    // totalTokens = 各篇之和（与 estimateTokens 一致）
    const sum = docsJson.docs.reduce((acc, d) => acc + d.tokens, 0);
    expect(docsJson.totalTokens).toBe(sum);
  });

  it("llms.txt 头部含总 token 数，条目含「约 N tokens」", () => {
    const llms = readFileSync(join(outDir, "llms.txt"), "utf8");
    expect(llms).toContain("总 token 数：约");
    expect(llms).toContain("约 ");
    expect(llms).toContain("tokens");
  });

  it("llms-full.txt 头部含总 token 数", () => {
    const full = readFileSync(join(outDir, "llms-full.txt"), "utf8");
    expect(full).toContain("总 token 数：约");
  });

  it("每页 <head> 含 meta name=doclight:tokens", () => {
    const html = readFileSync(join(outDir, "guide", "quickstart.html"), "utf8");
    expect(html).toMatch(/<meta name="doclight:tokens" content="\d+">/);
  });

  it("llms.txt Agent 端点含 capabilities.json（CAP-001 联动）", () => {
    const llms = readFileSync(join(outDir, "llms.txt"), "utf8");
    expect(llms).toContain("/capabilities.json");
  });
});

describe("AEO-001 --base 子路径部署", () => {
  it("alternate/describedby href 带 base 前缀", () => {
    const baseDir = mkdtempSync(join(tmpdir(), "doclight-aeo-base-"));
    try {
      writeFileSync(join(baseDir, "display.js"), "/* placeholder */");
      buildSite({ dir: docsDir, outDir: baseDir, title: "AEO 测试站", base: "/docs" });
      const html = readFileSync(join(baseDir, "guide", "quickstart.html"), "utf8");
      expect(html).toContain('<link rel="alternate" type="text/markdown" href="/docs/guide/quickstart.md">');
      expect(html).toContain('<link rel="describedby" href="/docs/llms.txt">');
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });
});
