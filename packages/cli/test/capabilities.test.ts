/**
 * CAP-001 能力协议测试：manifest 生成器 / build 产物 / dev 端点 / bundle 产物 / AGENTS.md 同源
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCapabilityManifest, FRONTMATTER_KEYS } from "../src/capabilities.ts";
import { buildAgentsMd } from "../src/agents.ts";
import { buildSite } from "../src/build.ts";
import { bundleSite } from "../src/bundle.ts";
import { startDevServer, type DevServer } from "../src/dev-server.ts";
import { createMermaidPlugin } from "../src/plugins-official/mermaid.ts";
import { TOOLS } from "@doclight/mcp-server";

let docsDir: string;
let outDir: string;
let dev: DevServer;

beforeAll(async () => {
  docsDir = mkdtempSync(join(tmpdir(), "doclight-cap-"));
  mkdirSync(join(docsDir, "guide"), { recursive: true });
  writeFileSync(join(docsDir, "README.md"), "# 首页\n\n欢迎。");
  writeFileSync(join(docsDir, "guide", "quickstart.md"), "# 快速开始");
  dev = await startDevServer({ dir: docsDir, port: 0 });
});

afterAll(async () => {
  await dev.close();
  rmSync(docsDir, { recursive: true, force: true });
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

function tmpBuildDir(): string {
  const d = mkdtempSync(join(tmpdir(), "doclight-cap-build-"));
  writeFileSync(join(d, "display.js"), "/* placeholder */");
  return d;
}

describe("buildCapabilityManifest（CAP-001 生成器，纯函数）", () => {
  it("扩展白名单来自渲染内核注册表（id/title/degradation）", () => {
    const m = buildCapabilityManifest({ siteTitle: "测试站", form: "ssg" });
    expect(m.schemaVersion).toBe(1);
    const ids = m.markdown.extensions.map((e) => e.id);
    expect(ids).toContain("container");
    expect(ids).toContain("katex");
    expect(ids).toContain("code-block");
    expect(m.markdown.extensions[0]!.title.length).toBeGreaterThan(0);
    // 每个扩展有降级说明（Agent 据此判断可用性）
    for (const e of m.markdown.extensions) expect(e.degradation?.length).toBeGreaterThan(0);
  });

  it("frontmatter 约定键齐全（FRONT-001 语义键）", () => {
    const m = buildCapabilityManifest({ siteTitle: "测试站", form: "ssg" });
    for (const k of ["title", "description", "priority", "tags", "category", "date"] as const) {
      expect(m.markdown.frontmatter).toContain(k);
    }
    expect(m.markdown.frontmatter).toEqual([...FRONTMATTER_KEYS]);
  });

  it("MCP 工具列表与 mcp-server 注册表一致（get_capabilities 置首）", () => {
    const m = buildCapabilityManifest({ siteTitle: "测试站", form: "ssg" });
    expect(m.mcp.tools).toEqual(TOOLS.map((t) => t.name));
    expect(m.mcp.tools[0]).toBe("get_capabilities");
  });

  it("插件段来自启用插件（含 capabilities 声明）", () => {
    const mermaid = createMermaidPlugin({});
    expect(mermaid).not.toBeNull();
    const m = buildCapabilityManifest({
      siteTitle: "测试站",
      form: "ssg",
      plugins: [{ name: mermaid!.name, version: mermaid!.version, capabilities: mermaid!.capabilities }],
    });
    expect(m.plugins).toHaveLength(1);
    expect(m.plugins[0]!.name).toBe("mermaid");
    expect(m.plugins[0]!.capabilities).toEqual(["mermaid"]);
  });

  it("形态差异：bundle 无 markdown 版本，ssg/dev 有", () => {
    expect(buildCapabilityManifest({ siteTitle: "测试站", form: "ssg" }).pages.markdownAlternate).toBe(true);
    expect(buildCapabilityManifest({ siteTitle: "测试站", form: "dev" }).pages.markdownAlternate).toBe(true);
    expect(buildCapabilityManifest({ siteTitle: "测试站", form: "bundle" }).pages.markdownAlternate).toBe(false);
  });
});

describe("capabilities.json 三形态输出（CAP-001）", () => {
  it("build 产物含 capabilities.json（ssg 形态，schemaVersion=1）", () => {
    outDir = tmpBuildDir();
    buildSite({ dir: docsDir, outDir, title: "能力测试站" });
    const file = join(outDir, "capabilities.json");
    expect(existsSync(file)).toBe(true);
    const m = JSON.parse(readFileSync(file, "utf8")) as {
      schemaVersion: number;
      site: { title: string; base: string };
      pages: { markdownAlternate: boolean };
      outputs: string[];
    };
    expect(m.schemaVersion).toBe(1);
    expect(m.site.title).toBe("能力测试站");
    expect(m.site.base).toBe("");
    expect(m.pages.markdownAlternate).toBe(true);
    expect(m.outputs).toContain("llms.txt");
    expect(m.outputs).toContain("capabilities.json");
  });

  it("dev server GET /capabilities.json 返回同 schema 清单", async () => {
    const res = await fetch(`${dev.url}capabilities.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const m = (await res.json()) as { schemaVersion: number; pages: { markdownAlternate: boolean } };
    expect(m.schemaVersion).toBe(1);
    expect(m.pages.markdownAlternate).toBe(true);
  });

  it("bundle 产物目录含 capabilities.json（markdownAlternate=false）", async () => {
    const bundleDir = mkdtempSync(join(tmpdir(), "doclight-cap-bundle-"));
    try {
      await bundleSite({ dir: docsDir, outDir: bundleDir, displayBundle: join(outDir, "display.js") });
      const file = join(bundleDir, "capabilities.json");
      expect(existsSync(file)).toBe(true);
      const m = JSON.parse(readFileSync(file, "utf8")) as { pages: { markdownAlternate: boolean } };
      expect(m.pages.markdownAlternate).toBe(false);
    } finally {
      rmSync(bundleDir, { recursive: true, force: true });
    }
  });
});

describe("AGENTS.md 与 capabilities.json 同源（CAP-001）", () => {
  it("buildAgentsMd 由 manifest 生成：语法/约定/发布链/端点齐备", () => {
    const m = buildCapabilityManifest({ siteTitle: "测试站", siteDescription: "描述", form: "ssg" });
    const md = buildAgentsMd(m);
    expect(md).toContain("# AGENTS.md — 测试站");
    expect(md).toContain("标准 Markdown + GFM");
    expect(md).toContain("frontmatter 约定");
    expect(md).toContain("doclight build");
    expect(md).toContain("doclight publish");
    expect(md).toContain("/capabilities.json");
    expect(md).toContain("/llms.txt");
  });

  it("插件能力写入 AGENTS.md（mermaid 示例）", () => {
    const mermaid = createMermaidPlugin({});
    const m = buildCapabilityManifest({
      siteTitle: "测试站",
      form: "ssg",
      plugins: [{ name: mermaid!.name, version: mermaid!.version, capabilities: mermaid!.capabilities }],
    });
    expect(buildAgentsMd(m)).toContain("插件能力：mermaid：mermaid");
  });
});
