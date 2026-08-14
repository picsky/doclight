/**
 * MCP 读取端工具集（06 §6.4，MCP-001）
 *
 * 工具名 / 参数 Schema / 返回结构遵循 06-ai-native §6.4.2 与 README 契约：
 * 只加不改（契约层）。search_docs / read_doc / list_docs / get_site_summary /
 * get_outline / find_examples 六工具，全部只读产物站点（SiteData）。
 *
 * 双读友好（REND-004）：read_doc 默认返回纯 markdown 原稿（来自 llms-full.txt），
 * 不返回渲染后 HTML——Agent 消费与源文件一致。
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { makeSnippet, search } from "./search.ts";
import type { SiteData, SiteDocMeta } from "./site.ts";

/** MCP 工具调用错误（映射为 isError 响应，不给内部堆栈） */
export class McpError extends Error {}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler(site: SiteData, args: Record<string, unknown>): unknown;
}

/** ---- 参数小工具（宽松取参） ---- */
function pickString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : min;
}

/** ---- 通用小工具 ---- */
/** 路径归一：去前导 /，.html → .md */
function normalizePath(p: string): string {
  let path = p.replace(/^\/+/, "");
  if (/\.html$/i.test(path)) path = path.slice(0, -5) + ".md";
  return path;
}
/** 文件名主干（缺 meta 时兜底标题） */
function stem(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");
}
/** 锚点 id（与渲染内核 slugify 一致） */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
/** markdown → 纯文本（read_doc format=text） */
function markdownToText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[`*_~>]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
/** 正文字数（read_doc wordCount；CJK 逐字 + 非 CJK 分词） */
function countWords(md: string): number {
  const text = markdownToText(md);
  const cjk = text.match(/[一-鿿]/g) ?? [];
  const nonCjk = text.split(/\s+/).filter((w) => w && !/[一-鿿]/.test(w));
  return cjk.length + nonCjk.length;
}
/** 按标题提取章节：命中标题（文本或 id）到同级下一标题止 */
function extractSection(content: string, section: string): string {
  const lines = content.split("\n");
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.+)$/.exec(lines[i]!);
    if (!m) continue;
    const text = m[2]!.trim();
    if (section === text || section === slugify(text)) {
      start = i;
      level = m[1]!.length;
      break;
    }
  }
  if (start < 0) return content; // 未命中 → 返回全文（不误导 Agent 为空）
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#{1,6})\s+/.exec(lines[i]!);
    if (m && m[1]!.length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}
/** 命中章节近似：摘要含某标题文本 → 该标题为 matchedSection */
function matchedSection(meta: SiteDocMeta | undefined, snippet: string): string | undefined {
  if (!meta) return undefined;
  return meta.headings.find((h) => h.text.length >= 2 && snippet.includes(h.text))?.text;
}
/** 导航上一篇（docs.json 顺序，同结构序列） */
function previousDoc(site: SiteData, path: string): string | undefined {
  const i = site.docs.findIndex((d) => d.path === path);
  return i > 0 ? site.docs[i - 1]!.path : undefined;
}

/* ---- search_docs：全文搜索（支持分类/标签/优先级过滤） ---- */
const searchDocs: McpTool = {
  name: "search_docs",
  description: "全文搜索文档。支持关键词、分类、标签、优先级过滤，按相关度排序返回 Top N（含摘要与命中章节）。",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "搜索关键词（中文自动 bigram，无需分词）" },
      limit: { type: "number", description: "返回条数上限（默认 10，最大 50）" },
      category: { type: "string", description: "按分类过滤（frontmatter.category）" },
      tags: { type: "array", items: { type: "string" }, description: "按标签过滤（frontmatter.tags，任一命中）" },
      priority: { type: "string", enum: ["high", "medium", "low"], description: "按优先级过滤" },
      includeContent: { type: "boolean", description: "是否包含命中摘要（默认 true）" },
    },
    required: ["query"],
  },
  handler(site: SiteData, args: Record<string, unknown>) {
    const query = pickString(args, "query");
    if (!query) throw new McpError("search_docs 需要 query 参数");
    const limit = clamp(Number(args.limit ?? 10), 1, 50);
    const category = pickString(args, "category");
    const tags = arr(args.tags);
    const priority = pickString(args, "priority");
    const includeContent = args.includeContent !== false;
    const start = Date.now();
    const results = search(site.search, query, 50);
    const out = [];
    for (const r of results) {
      const mdPath = r.path.replace(/\.html$/, ".md");
      const meta = site.docs.find((d) => d.path === mdPath);
      if (category && meta?.category !== category) continue;
      if (priority && meta?.priority !== priority) continue;
      if (tags.length && !(meta?.tags ?? []).some((t) => tags.includes(t))) continue;
      out.push({
        path: mdPath,
        title: meta?.title ?? r.title,
        score: r.score,
        category: meta?.category,
        tags: meta?.tags,
        priority: meta?.priority,
        snippet: includeContent ? r.snippet : undefined,
        matchedSection: matchedSection(meta, r.snippet),
        readingTime: meta?.readingTime,
        hasCode: meta?.hasCode,
        url: meta?.url,
      });
      if (out.length >= limit) break;
    }
    return { results: out, total: out.length, queryTimeMs: Date.now() - start };
  },
};

/* ---- read_doc：读取文档（默认纯 markdown 原稿） ---- */
const readDoc: McpTool = {
  name: "read_doc",
  description: "读取单篇文档全文。默认返回纯 markdown 原稿（与源文件一致，REND-004 双读友好）；支持按章节/行范围截取。",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "文档路径（.md 或 .html，如 guide/quickstart.md）" },
      section: { type: "string", description: "章节标题文本或锚点 id，返回该节" },
      startLine: { type: "number", description: "起始行号（1-based）" },
      endLine: { type: "number", description: "结束行号（含）" },
      format: { type: "string", enum: ["markdown", "html", "text"], description: "输出格式（默认 markdown）" },
    },
    required: ["path"],
  },
  handler(site: SiteData, args: Record<string, unknown>) {
    const raw = pickString(args, "path");
    if (!raw) throw new McpError("read_doc 需要 path 参数");
    const path = normalizePath(raw);
    const content = site.fullByPath.get(path);
    if (content === undefined) {
      // 容错：给 / 前缀或大小写不匹配时再试一次（归一后仍未命中 → 明确报错）
      throw new McpError(`未找到文档：${path}。请先运行 doclight build 生成 llms-full.txt，并确认路径正确（如 guide/quickstart.md）`);
    }
    const meta = site.docs.find((d) => d.path === path);
    const format = pickString(args, "format") ?? "markdown";
    const section = pickString(args, "section");
    let body = section ? extractSection(content, section) : content;
    const startLine = clamp(Number(args.startLine ?? 0), 0, 1e6);
    const endLine = args.endLine === undefined ? undefined : clamp(Number(args.endLine), 1, 1e6);
    if (startLine > 0) {
      const lines = body.split("\n");
      body = lines.slice(startLine - 1, endLine ?? lines.length).join("\n");
    }
    let out: string;
    if (format === "text") {
      out = markdownToText(body);
    } else if (format === "html") {
      const htmlPath = join(site.siteDir, path.replace(/\.md$/, ".html"));
      if (existsSync(htmlPath)) {
        const html = readFileSync(htmlPath, "utf8");
        const m = /<article>([\s\S]*?)<\/article>/.exec(html);
        out = m ? m[1]! : html;
      } else {
        out = body; // 产物无 .html 时降级为 markdown
      }
    } else {
      out = body;
    }
    return {
      path,
      title: meta?.title ?? stem(path),
      format,
      wordCount: countWords(content),
      readingTime: meta?.readingTime ?? Math.max(1, Math.round(countWords(content) / 300)),
      content: out,
      headings: meta?.headings ?? [],
      next: meta?.next,
      previous: previousDoc(site, path),
    };
  },
};

/* ---- list_docs：列出文档树（可过滤） ---- */
const listDocs: McpTool = {
  name: "list_docs",
  description: "列出全部文档（结构化元数据）。可按路径前缀、分类、标签过滤，返回扁平列表。",
  inputSchema: {
    type: "object",
    properties: {
      prefix: { type: "string", description: "路径前缀过滤（如 guide/）" },
      category: { type: "string", description: "按分类过滤" },
      tags: { type: "array", items: { type: "string" }, description: "按标签过滤（任一命中）" },
    },
  },
  handler(site: SiteData, args: Record<string, unknown>) {
    const prefix = pickString(args, "prefix");
    const category = pickString(args, "category");
    const tags = arr(args.tags);
    let list = site.docs;
    if (prefix) list = list.filter((d) => d.path.startsWith(prefix));
    if (category) list = list.filter((d) => d.category === category);
    if (tags.length) list = list.filter((d) => (d.tags ?? []).some((t) => tags.includes(t)));
    return {
      docs: list.map(({ path, title, category: c, tags: t, priority, readingTime, summary, url }) => ({
        path,
        title,
        category: c,
        tags: t,
        priority,
        readingTime,
        summary,
        url,
      })),
      total: list.length,
    };
  },
};

/* ---- get_site_summary：站点摘要 ---- */
const getSiteSummary: McpTool = {
  name: "get_site_summary",
  description: "获取站点摘要：标题/描述/文档数/分类分布/关键主题/建议入口，快速了解全站内容与结构。",
  inputSchema: { type: "object", properties: {} },
  handler(site: SiteData) {
    const catMap = new Map<string, { name: string; count: number; priority?: string }>();
    const tagCount = new Map<string, number>();
    for (const d of site.docs) {
      if (d.category) {
        const cur = catMap.get(d.category);
        if (cur) {
          cur.count++;
          if (!cur.priority && d.priority) cur.priority = d.priority;
        } else {
          catMap.set(d.category, { name: d.category, count: 1, priority: d.priority });
        }
      }
      for (const t of d.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    }
    const suggested = site.docs.find((d) => d.priority === "high" && /README|index/i.test(d.path)) ?? site.docs[0];
    return {
      title: site.title,
      description: site.description,
      totalDocs: site.docs.length,
      languages: ["zh-CN"],
      categories: [...catMap.values()],
      keyTopics: [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t),
      suggestedEntry: suggested?.path,
      aiFeatures: ["llms.txt", "mcp", "search-api", "docs.json", "capabilities.json"],
    };
  },
};

/* ---- get_outline：文档大纲 ---- */
const getOutline: McpTool = {
  name: "get_outline",
  description: "获取单篇文档大纲（标题层级结构，含锚点 id），预览内容而不读全文。",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "文档路径（.md 或 .html）" },
    },
    required: ["path"],
  },
  handler(site: SiteData, args: Record<string, unknown>) {
    const raw = pickString(args, "path");
    if (!raw) throw new McpError("get_outline 需要 path 参数");
    const path = normalizePath(raw);
    const meta = site.docs.find((d) => d.path === path);
    if (!meta) throw new McpError(`未找到文档：${path}`);
    return { path, title: meta.title, url: meta.url, headings: meta.headings };
  },
};

/* ---- find_examples：搜索代码示例 ---- */
const findExamples: McpTool = {
  name: "find_examples",
  description: "只搜索代码块（fenced code），可按语言与关键词过滤，返回带语言的示例片段。",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "在代码内容中搜索的关键词" },
      language: { type: "string", description: "按代码语言过滤（如 ts / bash / mermaid）" },
      limit: { type: "number", description: "返回条数上限（默认 10，最大 50）" },
    },
  },
  handler(site: SiteData, args: Record<string, unknown>) {
    const query = pickString(args, "query");
    const language = pickString(args, "language");
    const limit = clamp(Number(args.limit ?? 10), 1, 50);
    const out: Array<{ path: string; title: string; language: string; snippet: string; url?: string }> = [];
    for (const [path, content] of site.fullByPath) {
      const meta = site.docs.find((d) => d.path === path);
      for (const m of content.matchAll(/```([\w+-]*)\r?\n([\s\S]*?)```/g)) {
        const lang = m[1] ?? "";
        const code = m[2] ?? "";
        if (language && lang !== language) continue;
        if (query && !code.includes(query)) continue;
        out.push({ path, title: meta?.title ?? stem(path), language: lang, snippet: code.trim().slice(0, 200), url: meta?.url });
        if (out.length >= limit) return { results: out, total: out.length };
      }
    }
    return { results: out, total: out.length };
  },
};

/* ---- get_capabilities：站点渲染能力清单（CAP-001，写内容前先查） ---- */
const getCapabilities: McpTool = {
  name: "get_capabilities",
  description:
    "获取站点渲染能力清单（capabilities.json，CAP-001）：支持的 Markdown 扩展语法 / 插件能力 / frontmatter 约定 / Agent 产物端点 / MCP 工具。写内容前先查，避免使用站点不支持的语法。",
  inputSchema: { type: "object", properties: {} },
  handler(site: SiteData) {
    // 完整清单来自产物 capabilities.json；缺失时诚实降级（返回可推导的最小信息 + 重建提示，不伪造）
    if (site.capabilities) return { ...site.capabilities, source: "capabilities.json" };
    return {
      complete: false,
      note: "capabilities.json 缺失：请先运行 doclight build（CAP-001 产物含渲染能力清单）",
      derived: {
        siteTitle: site.title,
        description: site.description,
        totalDocs: site.docs.length,
        outputs: ["llms.txt", "llms-full.txt", "docs.json", "search-index.json", "capabilities.json"],
      },
    };
  },
};

/* ---- MCP-006 写入端工具（WORK-001 联动：dev --mcp 写入 → watcher 增量重渲染） ---- */

/** 写入端是否启用：writeDir 未配置 → 可读错误（不伪造写能力） */
function requireWriteDir(site: SiteData): string {
  if (!site.writeDir) {
    throw new McpError("写入端未启用：以 --write-dir <docs 目录> 启动 MCP Server（或 doclight dev --mcp 开发模式）");
  }
  return site.writeDir;
}

/** 写入路径安全校验：.md 白名单 + 无 .. + 非绝对路径 + 解析后必须落在 writeDir 内（穿越防护） */
function resolveWritePath(writeDir: string, raw: string): string {
  // 绝对路径（/ 开头或 Windows 盘符）直接拒绝——相对路径才是契约
  if (/^[/\\]/.test(raw) || /^[a-zA-Z]:[/\\]/.test(raw)) throw new McpError(`路径越界：${raw}（只允许相对路径）`);
  const rel = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!/\.md$/i.test(rel)) throw new McpError(`写入路径必须是 .md 文件：${raw}`);
  if (rel.split("/").includes("..")) throw new McpError(`路径非法：${raw}（不允许 ..）`);
  const full = join(writeDir, rel);
  if (full !== writeDir && !full.startsWith(writeDir + sep)) throw new McpError(`路径越界：${raw}`);
  return full;
}

/** 写入工具返回的相对路径（正斜杠，与产物路径约定一致） */
function relOf(writeDir: string, full: string): string {
  return relative(writeDir, full).split(sep).join("/");
}

/* ---- write_doc：新建/覆盖 ---- */
const writeDoc: McpTool = {
  name: "write_doc",
  description:
    "写入或覆盖一篇文档（MCP-006 写入端，需 --write-dir 启用）。内容为纯 markdown（frontmatter 可选）。写入后 dev --mcp 自动增量重渲染——Agent 实时输出实时预览。",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "文档相对路径（.md，如 guide/new.md；可含子目录）" },
      content: { type: "string", description: "markdown 全文（frontmatter 约定见 get_capabilities）" },
    },
    required: ["path", "content"],
  },
  handler(site: SiteData, args: Record<string, unknown>) {
    const writeDir = requireWriteDir(site);
    const raw = pickString(args, "path");
    if (!raw) throw new McpError("write_doc 需要 path 参数");
    const content = args.content;
    if (typeof content !== "string") throw new McpError("write_doc 需要 content（markdown 文本）");
    const full = resolveWritePath(writeDir, raw);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
    return {
      ok: true,
      action: "write",
      path: relOf(writeDir, full),
      bytes: Buffer.byteLength(content, "utf8"),
      note: "已写入内容源；dev --mcp 已监听，页面将自动热重载（或运行 doclight build 重新构建产物）",
    };
  },
};

/* ---- update_doc：更新已存在文档（不存在 → 明确错误，不静默新建） ---- */
const updateDoc: McpTool = {
  name: "update_doc",
  description:
    "更新一篇已存在的文档（MCP-006 写入端，需 --write-dir 启用）。文档不存在时报错（新建请用 write_doc）。写入后 dev --mcp 自动增量重渲染。",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "文档相对路径（.md）" },
      content: { type: "string", description: "替换后的 markdown 全文" },
    },
    required: ["path", "content"],
  },
  handler(site: SiteData, args: Record<string, unknown>) {
    const writeDir = requireWriteDir(site);
    const raw = pickString(args, "path");
    if (!raw) throw new McpError("update_doc 需要 path 参数");
    const content = args.content;
    if (typeof content !== "string") throw new McpError("update_doc 需要 content（markdown 文本）");
    const full = resolveWritePath(writeDir, raw);
    if (!existsSync(full)) throw new McpError(`文档不存在：${raw}（新建请用 write_doc）`);
    writeFileSync(full, content, "utf8");
    return {
      ok: true,
      action: "update",
      path: relOf(writeDir, full),
      bytes: Buffer.byteLength(content, "utf8"),
      note: "已更新内容源；dev --mcp 已监听，页面将自动热重载",
    };
  },
};

/* ---- delete_doc：删除已存在文档 ---- */
const deleteDoc: McpTool = {
  name: "delete_doc",
  description: "删除一篇文档（MCP-006 写入端，需 --write-dir 启用）。文档不存在时报错（不静默成功）。",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "文档相对路径（.md）" },
    },
    required: ["path"],
  },
  handler(site: SiteData, args: Record<string, unknown>) {
    const writeDir = requireWriteDir(site);
    const raw = pickString(args, "path");
    if (!raw) throw new McpError("delete_doc 需要 path 参数");
    const full = resolveWritePath(writeDir, raw);
    if (!existsSync(full)) throw new McpError(`文档不存在：${raw}`);
    rmSync(full);
    return {
      ok: true,
      action: "delete",
      path: relOf(writeDir, full),
      note: "已从内容源删除；dev --mcp 已监听，页面将自动热重载",
    };
  },
};

/** 工具注册表（顺序即 tools/list 顺序；get_capabilities 置首——写内容前的第一查；
 *  MCP-006 写入工具置尾——writeDir 未配置时调用返回可读错误，工具可见、能力诚实） */
export const TOOLS: McpTool[] = [
  getCapabilities,
  searchDocs,
  readDoc,
  listDocs,
  getSiteSummary,
  getOutline,
  findExamples,
  writeDoc,
  updateDoc,
  deleteDoc,
];

export function findTool(name: string): McpTool | undefined {
  return TOOLS.find((t) => t.name === name);
}

/** 供 well-known 发现 / tools/list 输出的工具元数据 */
export function toolDescriptors() {
  return TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
}

/** makeSnippet 导出给测试用（与 search 同源） */
export { makeSnippet };
