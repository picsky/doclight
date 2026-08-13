/**
 * 轻量检索内核（MCP-001 search_docs 的数据基础）
 *
 * 与展示层 packages/display/src/search.ts 同形状（SRCH-001 决策：零依赖自研倒排索引，
 * 构建工具链允许打包时一处替换为 MiniSearch）。展示层模块依赖浏览器 event-bus，
 * 此处独立复制纯函数部分（tokenize / buildIndex / search），保持可 Node 测试。
 */

export interface SearchDoc {
  path: string;
  title: string;
  headings: string[];
  text: string;
}

export interface SearchIndex {
  docs: SearchDoc[];
  /** 检索词 → 文档ID → 加权命中次数 */
  postings: Map<string, Map<number, number>>;
}

/** 纯函数：文本切词（拉丁按词；CJK 单字 + 二元组） */
export function tokenize(text: string): string[] {
  const tokens = new Set<string>();
  const lower = text.toLowerCase();
  for (const m of lower.matchAll(/[a-z0-9]+/g)) tokens.add(m[0]!);
  for (const run of lower.matchAll(/[㐀-鿿]+/g)) {
    const s = run[0]!;
    for (let i = 0; i < s.length; i++) {
      tokens.add(s[i]!);
      if (i + 1 < s.length) tokens.add(s.slice(i, i + 2));
    }
  }
  return [...tokens];
}

/** 字段权重：标题 > 大纲 > 路径/正文（与展示层一致） */
function fieldWeight(field: "title" | "headings" | "path" | "text"): number {
  return field === "title" ? 4 : field === "headings" ? 2 : 1;
}

/** 纯函数：构建倒排索引 */
export function buildIndex(docs: SearchDoc[]): SearchIndex {
  const postings = new Map<string, Map<number, number>>();
  docs.forEach((doc, docId) => {
    const fields: Array<["title" | "headings" | "path" | "text", string]> = [
      ["title", doc.title],
      ["headings", doc.headings.join(" ")],
      ["path", doc.path],
      ["text", doc.text],
    ];
    for (const [field, content] of fields) {
      for (const term of tokenize(content)) {
        let map = postings.get(term);
        if (!map) {
          map = new Map();
          postings.set(term, map);
        }
        map.set(docId, (map.get(docId) ?? 0) + fieldWeight(field));
      }
    }
  });
  return { docs, postings };
}

/** 生成命中摘要：取首个命中词附近窗口，无命中取开头 */
export function makeSnippet(doc: SearchDoc, terms: string[], width = 60): string {
  const text = doc.text.replace(/\s+/g, " ").trim();
  if (!text) return "";
  let idx = -1;
  for (const t of terms) {
    const i = text.indexOf(t);
    if (i !== -1) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return text.length > width ? text.slice(0, width) + "…" : text;
  const start = Math.max(0, idx - 10);
  const end = start + width;
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

/** 纯函数：查询 → 按得分 Top N 结果（含命中摘要） */
export function search(index: SearchIndex, query: string, limit = 10): SearchResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const scores = new Map<number, number>();
  const termHits = new Map<number, Set<string>>();
  for (const term of terms) {
    const postings = index.postings.get(term);
    if (!postings) continue;
    for (const [docId, w] of postings) {
      scores.set(docId, (scores.get(docId) ?? 0) + w);
      let set = termHits.get(docId);
      if (!set) {
        set = new Set();
        termHits.set(docId, set);
      }
      set.add(term);
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([docId, score]) => {
      const doc = index.docs[docId]!;
      const hits = [...(termHits.get(docId) ?? [])];
      return { path: doc.path, title: doc.title, score, snippet: makeSnippet(doc, hits) };
    });
}

export interface SearchResult {
  path: string;
  title: string;
  score: number;
  snippet: string;
}
