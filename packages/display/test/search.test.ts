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

  it("双字词 AND 约束：缺任一单字的文档被排除（2026-08-14 准确性修复）", () => {
    const docs: SearchDoc[] = [
      { path: "a.md", title: "含连续词", headings: [], text: "包含安装这个词。" },
      { path: "b.md", title: "只含单字", headings: [], text: "装置与装备。" }, // 有"装"无"安"
    ];
    const index = buildIndex(docs);
    const results = search(index, "安装");
    const paths = results.map((r) => r.path);
    expect(paths).toContain("a.md");
    expect(paths).not.toContain("b.md"); // AND：缺"安"被排除
  });

  it("连续词（bigram）加权 ×4：连续命中显著优先于单字散布（2026-08-14 排序修复）", () => {
    const docs: SearchDoc[] = [
      { path: "a.md", title: "连续", headings: [], text: "包含安装这个词。" }, // 连续"安装"
      { path: "c.md", title: "散布", headings: [], text: "安与装分离出现。" }, // "安""装"都有但不连续
    ];
    const index = buildIndex(docs);
    const results = search(index, "安装");
    expect(results[0]!.path).toBe("a.md");
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score); // bigram ×4 拉开差距
  });

  it("拉丁词前缀匹配：搜 eng 命中含 engine 的文档（2026-08-14 前缀修复）", () => {
    const docs: SearchDoc[] = [
      { path: "engine.md", title: "Engine Guide", headings: [], text: "The engine powers rendering." },
      { path: "other.md", title: "Other", headings: [], text: "Nothing about engines here." }, // 无 eng 前缀词
    ];
    const index = buildIndex(docs);
    const results = search(index, "eng");
    expect(results.map((r) => r.path)).toContain("engine.md");
  });

  it("前缀匹配排序：完整词命中仍优先于前缀命中", () => {
    const docs: SearchDoc[] = [
      { path: "engine.md", title: "Engine Guide", headings: [], text: "The engine is fast." },
      { path: "engineering.md", title: "Engineering", headings: [], text: "Engineering practices." },
    ];
    const index = buildIndex(docs);
    const results = search(index, "engine");
    expect(results[0]!.path).toBe("engine.md"); // 精确完整词 ×4 > 前缀 ×2
  });

  // 2026-08 性能审计后：前缀展开缓存（同一 term 多次展开只扫词表一次）
  it("buildIndex 初始化 prefixCache；重复查询复用缓存", () => {
    const docs: SearchDoc[] = [
      { path: "engine.md", title: "Engine Guide", headings: [], text: "The engine powers rendering." },
    ];
    const index = buildIndex(docs);
    expect(index.prefixCache).toBeInstanceOf(Map);
    expect(index.prefixCache!.size).toBe(0); // 构建时缓存为空
    search(index, "eng");
    expect(index.prefixCache!.size).toBeGreaterThan(0); // 查询后缓存填充
    const sizeAfterFirst = index.prefixCache!.size;
    search(index, "eng"); // 第二次相同查询
    expect(index.prefixCache!.size).toBe(sizeAfterFirst); // 无新增条目（命中缓存）
  });

  // 2026-08 性能审计后：search 返回的 result 自带 section（避免 renderResults 反查 O(n)）
  it("search 结果自带 section（renderResults 无需再查 index.docs）", () => {
    const docs: SearchDoc[] = [{ path: "a.md", title: "A", headings: [], text: "hello", section: "组一" }];
    const index = buildIndex(docs);
    const r = search(index, "hello");
    expect(r[0]?.section).toBe("组一");
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

  // 2026-08 性能审计后：预算超限时跳过写盘（避免 setItem QuotaExceededError）
  it("writeSearchCache 超 4MB 预算 → 跳过写盘并返回 false", () => {
    const storage = mockStorage();
    // 构造一个大文档使 JSON 序列化超过 4MB
    const bigDocs: SearchDoc[] = [{ path: "big.md", title: "big", headings: [], text: "x".repeat(4.5 * 1024 * 1024) }];
    const ok = writeSearchCache(storage, "v1", bigDocs);
    expect(ok).toBe(false);
    expect(storage.getItem("doclight-search-idx-v1")).toBeNull();
  });

  it("writeSearchCache 在预算内 → 正常写入并返回 true", () => {
    const storage = mockStorage();
    const docs: SearchDoc[] = [{ path: "a.md", title: "A", headings: [], text: "内容" }];
    const ok = writeSearchCache(storage, "v1", docs);
    expect(ok).toBe(true);
    expect(readSearchCache(storage, "v1")).toEqual(docs);
  });
});
