import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSite, parseLlmsFull } from "../src/site.ts";
import { makeFixtureSite } from "./helpers.ts";

let siteDir: string;

beforeAll(() => {
  siteDir = makeFixtureSite();
});

afterAll(() => {
  rmSync(siteDir, { recursive: true, force: true });
});

describe("parseLlmsFull（节头解析）", () => {
  it("按 `## 路径：<path>` 分节为 路径→全文 map", () => {
    const map = parseLlmsFull("## 路径：a.md\n\n# A\n内容 A\n\n## 路径：b.md\n\n# B\n内容 B\n");
    expect([...map.keys()]).toEqual(["a.md", "b.md"]);
    expect(map.get("a.md")).toBe("# A\n内容 A");
    expect(map.get("b.md")).toBe("# B\n内容 B");
  });

  it("空/无节头内容返回空 map", () => {
    expect(parseLlmsFull("").size).toBe(0);
    expect(parseLlmsFull("无节头文本").size).toBe(0);
  });
});

describe("loadSite（加载 dist 产物）", () => {
  it("读 docs.json / search-index.json / llms-full.txt", () => {
    const site = loadSite(siteDir);
    expect(site.title).toBe("测试站");
    expect(site.description).toBe("测试站点描述");
    expect(site.docs.length).toBe(2);
    expect(site.docs[0]!.path).toBe("guide/a.md");
    expect(site.search.docs.length).toBe(2);
    expect(site.fullByPath.get("guide/a.md")).toContain("安装 DocLight");
    expect(site.fullByPath.get("guide/b.md")).toContain("const x = 1;");
  });

  it("产物缺失时优雅降级（空数据，不抛错）", () => {
    const empty = mkdtempSync(join(tmpdir(), "doclight-mcp-empty-"));
    const site = loadSite(empty);
    expect(site.title).toBe("DocLight"); // 缺省
    expect(site.docs).toEqual([]);
    expect(site.fullByPath.size).toBe(0);
    rmSync(empty, { recursive: true, force: true });
  });
});
