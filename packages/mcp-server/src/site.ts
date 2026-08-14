/**
 * 站点数据加载（MCP-001：MCP 只服务产物站点 dist-site，而非源码 docs/）
 *
 * 读取 build 产物（LLMS-001 + docs.json 增强产出）：
 * - docs.json           → 站点元信息 + 每篇文档结构化元数据（语义 frontmatter）
 * - search-index.json   → 检索数据（自建倒排索引）
 * - llms-full.txt       → 每篇文档 markdown 全文（read_doc / find_examples 数据源，
 *                         保持纯 markdown 原稿——REND-004 双读友好）
 *
 * 产物缺省时优雅降级：docs.json/search-index.json 缺失 → 空数据（工具返回空结果），
 * 仅 llms-full.txt 缺失时 read_doc 报错提示「先运行 doclight build」。
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildIndex, type SearchDoc, type SearchIndex } from "./search.ts";

export interface SiteDocMeta {
  path: string;
  url: string;
  title: string;
  summary: string;
  tags?: string[];
  category?: string;
  priority: "high" | "medium" | "low";
  difficulty?: string;
  readingTime: number;
  wordCount: number;
  hasCode: boolean;
  headings: Array<{ level: number; id: string; text: string }>;
  updatedAt?: string;
  author?: string;
  prerequisites?: string[];
  next?: string;
}

export interface SiteData {
  /** 产物目录（dist-site） */
  siteDir: string;
  title: string;
  description?: string;
  siteUrl?: string;
  docs: SiteDocMeta[];
  /** 自建倒排索引（search-index.json 提供文档数据） */
  search: SearchIndex;
  /** llms-full.txt：markdown 路径 → 全文原稿 */
  fullByPath: Map<string, string>;
  /** CAP-001：capabilities.json（渲染能力清单：扩展语法/插件/frontmatter 约定/Agent 端点）。
   *  产物缺失时为 null——get_capabilities 工具据此诚实降级（不伪造）。 */
  capabilities: Record<string, unknown> | null;
  /** MCP-006：内容源写入目录（write_doc/update_doc/delete_doc 的目标；null = 写入端未启用，
   *  写工具返回可读错误——不伪造写能力） */
  writeDir: string | null;
}

/** loadSite 选项（MCP-006：--write-dir 启用写入端） */
export interface LoadSiteOptions {
  /** 内容源目录（docs/），写入工具的目标；缺省 null（只读模式） */
  writeDir?: string;
}

function readJson<T>(dir: string, file: string): T | null {
  const p = join(dir, file);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * 解析 llms-full.txt：按节头 `## 路径：<path>` 切分，返回 路径 → 全文原稿。
 * 纯函数（可测）：文本结构固定（LLMS-001 契约），read_doc 依赖此结构。
 */
export function parseLlmsFull(content: string): Map<string, string> {
  const map = new Map<string, string>();
  let current: string | null = null;
  const buf: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const m = /^## 路径：(.+)$/.exec(line);
    if (m) {
      if (current !== null) map.set(current, buf.join("\n").trim());
      current = m[1]!.trim();
      buf.length = 0;
    } else if (current !== null) {
      buf.push(line);
    }
  }
  if (current !== null) map.set(current, buf.join("\n").trim());
  return map;
}

/** 加载产物站点数据（缺文件时优雅降级，不抛错）。options.writeDir 启用 MCP-006 写入端。 */
export function loadSite(siteDir: string, options: LoadSiteOptions = {}): SiteData {
  // 键名遵循 06 §6.2.2 docs.json 契约：siteTitle / siteDescription / siteUrl
  const docsJson = readJson<{
    siteTitle?: string;
    siteDescription?: string | null;
    siteUrl?: string | null;
    docs?: SiteDocMeta[];
  }>(siteDir, "docs.json");
  const searchJson = readJson<{ docs?: SearchDoc[] }>(siteDir, "search-index.json");
  // CAP-001：能力协议——capabilities.json（宽松读取；缺失/损坏 → null，get_capabilities 诚实降级）
  const capabilities = readJson<Record<string, unknown>>(siteDir, "capabilities.json");
  const docs = docsJson?.docs ?? [];
  const fullByPath = new Map<string, string>();
  const fullPath = join(siteDir, "llms-full.txt");
  if (existsSync(fullPath)) {
    try {
      for (const [p, c] of parseLlmsFull(readFileSync(fullPath, "utf8"))) fullByPath.set(p, c);
    } catch {
      /* llms-full.txt 损坏：read_doc 会提示重建 */
    }
  }
  return {
    siteDir,
    title: docsJson?.siteTitle ?? "DocLight",
    description: docsJson?.siteDescription ?? undefined,
    siteUrl: docsJson?.siteUrl ?? undefined,
    docs,
    search: buildIndex(searchJson?.docs ?? []),
    fullByPath,
    capabilities,
    writeDir: options.writeDir ? resolve(options.writeDir) : null,
  };
}
