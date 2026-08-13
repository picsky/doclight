/**
 * AGENTS.md 生成（08-roadmap Phase 6 P0，CAP-001）
 *
 * AGENTS.md 是 Agent 的内容写作入口（同 README.md 是人的入口——Addy Osmani AEO 实践，
 * research/product-vision-validation.md §二）：写内容前先读，明确「这个站支持什么语法、
 * 遵循什么约定、怎么构建发布」。
 *
 * 单一事实来源：buildAgentsMd 由 buildCapabilityManifest 生成的 manifest 推导——
 * capabilities.json（机器读）与 AGENTS.md（人/Agent 读）同源，不会两处漂移。
 * doclight init 生成；仓库自身 dogfood（根 AGENTS.md）。
 */
import type { CapabilityManifest } from "./capabilities.ts";

/** 构建与发布链命令（CLI-001/003/005 统一入口；Agent 按此执行） */
const WORKFLOW = [
  { cmd: "doclight dev", desc: "本地实时预览（写入先进预览态，不自动发布）" },
  { cmd: "doclight build", desc: "SSG 静态导出（产物含 llms.txt / docs.json / capabilities.json）" },
  { cmd: "doclight preview", desc: "预览构建产物" },
  { cmd: "doclight publish", desc: "发布（local / git gh-pages / space；人确认后执行）" },
] as const;

/**
 * 由能力清单生成 AGENTS.md 全文（纯函数，可测）。
 * 结构：站点简介 → 支持语法（扩展 + 插件能力）→ frontmatter 约定 → 构建发布链 → Agent 接口。
 */
export function buildAgentsMd(manifest: CapabilityManifest): string {
  const { site, markdown, plugins } = manifest;
  const lines: string[] = [];
  lines.push(`# AGENTS.md — ${site.title}`);
  lines.push("");
  lines.push(`> 本文件是内容写作 Agent 的入口（DocLight CAP-001 自动生成）：写内容前先读，`);
  lines.push(`> 明确本站支持的渲染能力与约定。机器可读形态：/capabilities.json。`);
  lines.push("");
  if (site.description) {
    lines.push(`本站：${site.description}`);
    lines.push("");
  }

  lines.push(`## 支持的 Markdown 语法`);
  lines.push("");
  lines.push(`- 标准 Markdown + GFM（标题 / 列表 / 表格 / 任务列表 / 删除线 / 代码围栏）`);
  for (const ext of markdown.extensions) {
    lines.push(`- ${ext.title}${ext.degradation ? `（${ext.degradation}）` : ""}`);
  }
  const pluginCaps = plugins
    .map((p) => (p.capabilities?.length ? `${p.name}：${p.capabilities.join(" / ")}` : null))
    .filter((x): x is string => !!x);
  if (pluginCaps.length) {
    lines.push(`- 插件能力：${pluginCaps.join("；")}`);
  }
  lines.push("");

  lines.push(`## frontmatter 约定`);
  lines.push("");
  lines.push(`每篇文档开头用 \`---\` 声明元数据，支持键：${markdown.frontmatter.join(" / ")}`);
  lines.push(`（\`priority\`: high/medium/low 影响 llms.txt 分级；\`tags\`/\`category\` 用于检索过滤；`);
  lines.push(`\`summary\` 缺省自动提取首段；\`date\` 影响 sitemap 与 JSON-LD）。`);
  lines.push("");

  lines.push(`## 构建与发布链`);
  lines.push("");
  lines.push(`写入永远先进预览态，发布前必须经人确认：`);
  for (const w of WORKFLOW) lines.push(`- \`${w.cmd}\` — ${w.desc}`);
  lines.push("");

  lines.push(`## Agent 接口（构建产物）`);
  lines.push("");
  for (const out of manifest.outputs) lines.push(`- /${out}`);
  lines.push(`- /mcp — MCP Server（工具：${manifest.mcp.tools.join(" / ")}）；独立服务或 \`doclight dev --mcp\``);
  lines.push("");
  lines.push(`## 写作流程（推荐）`);
  lines.push("");
  lines.push(`1. 读 /capabilities.json 确认支持的语法（不要用本站不支持的语法）`);
  lines.push(`2. 在 docs/ 下写 .md（frontmatter 按上表；正文用支持语法）`);
  lines.push(`3. \`doclight dev\` 预览 → 人确认 → \`doclight build\` → \`doclight publish\``);
  lines.push("");
  return lines.join("\n");
}
