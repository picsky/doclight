/**
 * llms.txt 生成（08-roadmap Phase 4 llms.txt，LLMS-001）
 *
 * 遵循 06-ai-native §6.2.1：智能分层 + 摘要 + Agent 端点 + 术语表；纯函数可测。
 * 两个产物：
 * - llms.txt：给 AI Agent 看的站点地图（站点摘要 + 按优先级分级的文档清单）。
 *   每个条目携带语义 frontmatter（summary / tags / readingTime）——「llms.txt generation
 *   includes semantic frontmatter」是 Phase 4 合同验收项。
 * - llms-full.txt：全站 markdown 全文（供大上下文模型整站读取），按文档分节，
 *   节头固定为 `## 路径：<path>`——MCP read_doc 依赖此结构提取单篇原稿（REND-004 双读友好）。
 *
 * 智能分级规则（06 §6.2.1 表格，优先级从高到低）：
 * 1. frontmatter.priority 显式声明（high/medium/low）
 * 2. 用户自定义 doclight.json build.llmsTxt.priority（精确路径或目录前缀）
 * 3. 默认规则：根级 README/index/quickstart → high；guide|tutorial|how-to → medium；
 *    api|reference|changelog|faq → low；其余 → medium
 * 排除：doclight.json build.llmsTxt.exclude 同时从 llms.txt 与 llms-full.txt 剔除
 * （用户明确不想让 Agent 看到的内容，不进入任一产物）。
 */

export type LlmsPriority = "high" | "medium" | "low";

export interface LlmsDoc {
  /** 源文档相对路径，如 "guide/quickstart.md" */
  path: string;
  /** SSG 产物 URL（相对站点根，含 .html；首页 "/"） */
  url: string;
  title: string;
  /** 语义 frontmatter：summary（显式或自动提取） */
  summary: string;
  tags?: string[];
  category?: string;
  difficulty?: string;
  /** 语义 frontmatter：readingTime（自动计算） */
  readingTime: number;
  priority: LlmsPriority;
}

/** 用户自定义分级配置（doclight.json build.llmsTxt，宽松读取） */
export interface LlmsTxtConfig {
  priority?: Partial<Record<LlmsPriority, string[]>>;
  exclude?: string[];
}

export interface LlmsOptions {
  siteTitle: string;
  siteDescription?: string;
  /** 站点绝对 URL（Agent 端点说明用；缺省不输出仓库行） */
  siteUrl?: string;
  docs: LlmsDoc[];
  /** 生成时间（可注入，可测） */
  generatedAt: string;
  /** 用户自定义分级/排除（宽松读取，缺省空） */
  llmsTxt?: LlmsTxtConfig;
}

/** 目录优先级默认规则表（06 §6.2.1）：路径前缀/关键词 → 优先级 */
const DEFAULT_RULES: Array<{ match: (path: string) => boolean; priority: LlmsPriority }> = [
  { match: (p) => /^(README|index)\.md$/i.test(p) || /quickstart|getting-started/i.test(p), priority: "high" },
  { match: (p) => /^(guide|tutorial|how-to)\//.test(p), priority: "medium" },
  { match: (p) => /^(api|reference)\//.test(p) || /(changelog|faq|glossary)/i.test(p), priority: "low" },
];

/** 是否命中用户自定义列表（精确路径或目录前缀，如 "guide/" 或 "README.md"） */
function matchUserList(path: string, list: string[] | undefined): boolean {
  return (
    list?.some((item) => item === path || (item.endsWith("/") && path.startsWith(item))) ?? false
  );
}

/** 智能分级（纯函数，可测）：frontmatter > 用户配置 > 默认规则 > 默认 medium */
export function classifyPriority(
  path: string,
  fmPriority: unknown,
  userConfig?: LlmsTxtConfig
): LlmsPriority {
  if (fmPriority === "high" || fmPriority === "medium" || fmPriority === "low") return fmPriority;
  const lists = userConfig?.priority;
  if (lists) {
    if (matchUserList(path, lists.high)) return "high";
    if (matchUserList(path, lists.medium)) return "medium";
    if (matchUserList(path, lists.low)) return "low";
  }
  return DEFAULT_RULES.find((r) => r.match(path))?.priority ?? "medium";
}

/** 是否被用户排除（llms.txt 与 llms-full.txt 均剔除） */
export function isExcluded(path: string, userConfig?: LlmsTxtConfig): boolean {
  return matchUserList(path, userConfig?.exclude);
}

/** 优先级分组标题（06 §6.2.1） */
const PRIORITY_LABEL: Record<LlmsPriority, string> = {
  high: "核心文档 ★★★",
  medium: "使用指南 ★★☆",
  low: "参考资料 ★☆☆",
};

/** 单个条目行：标题 + 摘要 + 语义字段（60 合同：llms.txt 含语义 frontmatter） */
function entryLine(doc: LlmsDoc): string {
  const parts: string[] = [doc.summary];
  if (doc.tags?.length) parts.push(`标签: ${doc.tags.join(" / ")}`);
  if (doc.category) parts.push(`分类: ${doc.category}`);
  parts.push(`${doc.readingTime} 分钟`);
  const extra = parts.filter(Boolean).join("；");
  return `- [${doc.title}](${doc.url}) — ${extra}`;
}

/** 生成 llms.txt（纯函数）：站点摘要 + 分级文档清单 + Agent 端点 + 术语表 */
export function buildLlmsTxt(options: LlmsOptions): string {
  const { siteTitle, siteDescription, siteUrl, docs, generatedAt, llmsTxt } = options;
  const included = docs.filter((d) => !isExcluded(d.path, llmsTxt));
  const groups: Record<LlmsPriority, LlmsDoc[]> = { high: [], medium: [], low: [] };
  for (const d of included) groups[d.priority].push(d);

  const lines: string[] = [];
  lines.push(`# ${siteTitle}`);
  lines.push("");
  lines.push(`> llms.txt — 给 AI Agent 看的站点内容索引（LLMS-001，DocLight 自动生成）`);
  lines.push(`> 最后更新：${generatedAt.slice(0, 10)}`);
  lines.push(`> 文档总数：${included.length}`);
  lines.push(`> 站点语言：zh-CN`);
  lines.push("");
  lines.push(`## 站点摘要`);
  lines.push("");
  lines.push(siteDescription ?? `DocLight 生成的文档站「${siteTitle}」。`);
  if (siteUrl) {
    lines.push("");
    lines.push(`站点：${siteUrl}`);
  }
  lines.push("");
  for (const p of ["high", "medium", "low"] as LlmsPriority[]) {
    const group = groups[p]!;
    if (group.length === 0) continue;
    lines.push(`## ${PRIORITY_LABEL[p]}`);
    lines.push("");
    for (const d of group) lines.push(entryLine(d));
    lines.push("");
  }
  lines.push(`## Agent 专用端点`);
  lines.push("");
  lines.push(`- /mcp — MCP Server（搜索 / 阅读 / 大纲 / 站点摘要，MCP 协议）`);
  lines.push(`- /.well-known/mcp — MCP 发现端点（能力描述 + 工具列表）`);
  lines.push(`- /search-index.json — 预构建搜索索引（JSON）`);
  lines.push(`- /docs.json — 文档结构清单（结构化元数据，JSON）`);
  lines.push(`- /llms-full.txt — 全站 markdown 全文（大上下文模型用）`);
  lines.push("");
  lines.push(`## 术语表`);
  lines.push("");
  lines.push(`形态 — dev 预览 / SSG 发布 / bundle 便携包三种产物形态，共享同一渲染内核`);
  lines.push(`SSG — Static Site Generation，构建时预渲染为静态 HTML`);
  lines.push(`bundle — 单文件便携包，内嵌全部内容与 AI 数据`);
  lines.push(`MCP — Model Context Protocol，AI 代理与外部工具通信的协议`);
  lines.push(`llms.txt — 给大语言模型看的站点内容索引文件`);
  lines.push("");
  return lines.join("\n");
}

/** 生成 llms-full.txt（纯函数）：全站 markdown 全文，按文档分节（MCP read_doc 依赖节头） */
export function buildLlmsFullTxt(options: {
  siteTitle: string;
  docs: Array<{ path: string; content: string }>;
  generatedAt: string;
  llmsTxt?: LlmsTxtConfig;
}): string {
  const { siteTitle, docs, generatedAt, llmsTxt } = options;
  const included = docs.filter((d) => !isExcluded(d.path, llmsTxt));
  const lines: string[] = [];
  lines.push(`# ${siteTitle} — 全站文档全文（llms-full.txt）`);
  lines.push("");
  lines.push(`> 由 DocLight 自动生成（LLMS-001），供大上下文 AI 模型整站读取；按文档分节。`);
  lines.push(`> 最后更新：${generatedAt.slice(0, 10)}`);
  lines.push(`> 文档总数：${included.length}`);
  lines.push("");
  for (const d of included) {
    lines.push(`## 路径：${d.path}`);
    lines.push("");
    lines.push(d.content.trimEnd());
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
