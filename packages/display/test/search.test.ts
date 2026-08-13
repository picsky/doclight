import { describe, expect, it } from "vitest";
import {
  buildIndex,
  highlight,
  readSearchCache,
  search,
  searchCacheKey,
  tokenize,
  writeSearchCache,
  type SearchDoc,
} from "../src/search.ts";

/** 内存版 localStorage mock（getItem 缺失键返回 null，与浏览器一致） */
function mockStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
  };
}

const DOCS: SearchDoc[] = [
  { path: "README.md", title: "首页", headings: ["安装", "配置"], text: "欢迎来到文档站，从这里开始使用。" },
  { path: "guide/quickstart.md", title: "快速开始", headings: ["快速上手"], text: "三步完成安装并启动 dev server。" },
  { path: "api/reference.md", title: "API 参考", headings: ["函数列表"], text: "install(config) 是全局安装函数。" },
];

describe("检索切词（SRCH-001，03 §3.5.4 中文检测）", () => {
  it("拉丁词按词切分并小写", () => {
    expect(tokenize("Dev Server Install")).toContain("dev");
    expect(tokenize("Dev Server Install")).toContain("server");
  });

  it("CJK 生成单字 + 二元组（无需分词库）", () => {
    const t = tokenize("安装");
    expect(t).toContain("安");
    expect(t).toContain("装");
    expect(t).toContain("安装");
  });

  it("混合文本同时产出两种词", () => {
    const t = tokenize("快速开始 quickstart");
    expect(t).toContain("快速");
    expect(t).toContain("quickstart");
  });
});

describe("索引与检索（SRCH-001）", () => {
  it("中文查询命中正文包含词（二元组匹配）", () => {
    const index = buildIndex(DOCS);
    const results = search(index, "安装");
    expect(results.map((r) => r.path)).toContain("guide/quickstart.md");
  });

  it("标题命中权重高于正文命中（排序）", () => {
    const index = buildIndex(DOCS);
    const results = search(index, "参考");
    // "参考" 出现在 README headings 与 api/reference 标题
    expect(results[0]!.path).toBe("api/reference.md");
  });

  it("拉丁词检索忽略大小写", () => {
    const index = buildIndex(DOCS);
    const results = search(index, "QUICKSTART");
    expect(results.map((r) => r.path)).toContain("guide/quickstart.md");
  });

  it("结果含路径、得分与摘要", () => {
    const index = buildIndex(DOCS);
    const results = search(index, "安装");
    expect(results[0]).toMatchObject({ path: expect.any(String), title: expect.any(String), score: expect.any(Number) });
    expect(typeof results[0]!.snippet).toBe("string");
  });

  it("空查询 / 无命中词返回空数组", () => {
    const index = buildIndex(DOCS);
    expect(search(index, "")).toEqual([]);
    expect(search(index, "不存在的词xyz")).toEqual([]);
  });

  it("limit 截断结果数", () => {
    const index = buildIndex(DOCS);
    expect(search(index, "安装", 1).length).toBeLessThanOrEqual(1);
  });
});

describe("结果高亮（SRCH-001）", () => {
  it("命中词包 <mark>，HTML 转义", () => {
    const h = highlight("安装说明 <b>", ["安装"]);
    expect(h).toContain("<mark>安装</mark>");
    expect(h).not.toContain("<b>");
  });

  it("无命中词时仅转义", () => {
    expect(highlight("a < b", [])).toBe("a &lt; b");
  });

  it("拉丁词大小写不敏感高亮", () => {
    const h = highlight("Quick Start Guide", ["quick"]);
    expect(h).toContain("<mark>Quick</mark>");
  });
});

describe("搜索索引持久化（SRCH-001，03 §3.8.5：localStorage + 版本校验）", () => {
  it("searchCacheKey 按版本隔离", () => {
    expect(searchCacheKey("abc")).toBe("doclight-search-idx-abc");
    expect(searchCacheKey("abc")).not.toBe(searchCacheKey("abd"));
  });

  it("readSearchCache：版本缺失 / 无缓存 / 内容损坏均返回 null", () => {
    const storage = mockStorage();
    expect(readSearchCache(storage, undefined)).toBeNull();
    expect(readSearchCache(storage, "v1")).toBeNull();
    storage.setItem("doclight-search-idx-v1", "not-json");
    expect(readSearchCache(storage, "v1")).toBeNull();
    storage.setItem("doclight-search-idx-v1", JSON.stringify({ docs: "not-array" }));
    expect(readSearchCache(storage, "v1")).toBeNull();
  });

  it("write→read 往返，且版本变化后旧缓存不误用", () => {
    const storage = mockStorage();
    const docs: SearchDoc[] = [{ path: "a.md", title: "A", headings: [], text: "内容" }];
    writeSearchCache(storage, "v1", docs);
    expect(readSearchCache(storage, "v1")).toEqual(docs);
    expect(readSearchCache(storage, "v2")).toBeNull(); // 版本变化 → 失配重建
  });
});
