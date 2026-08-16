# AGENTS.md — DocLight

> 本文件是内容写作 Agent 的入口（DocLight CAP-001 自动生成）：写内容前先读，
> 明确本站支持的渲染能力与约定。机器可读形态：/capabilities.json。

本站：把 Markdown 变成作品——零构建、AI 原生友好的开源文档站引擎

## 支持的 Markdown 语法

- 标准 Markdown + GFM（标题 / 列表 / 表格 / 任务列表 / 删除线 / 代码围栏）
- 代码高亮 + 复制按钮（无 Prism 时保留纯代码块（可读 + 可复制））
- 自定义容器（:::tip / :::warning / :::danger / :::info）（纯 CSS 标记（dev server 样式），无 JS 依赖，降级为普通 div）
- Tabs 容器（:::tabs / :::tab，跨组联动）（纯 CSS 标记：首面板直出可见，无 JS 时其余面板隐藏）
- 步骤容器（:::steps，编号 + 连线）（纯 CSS 标记（计数器 + 连线），无 JS 依赖，降级为有序列表）
- KaTeX 公式（$...$ / $$...$$）（未加载 KaTeX → TeX 源码可见（降级为可读文本））

## frontmatter 约定

每篇文档开头用 `---` 声明元数据，支持键：title / description / summary / date / updated / priority / tags / category / difficulty / author / prerequisites / next / provenance
（`priority`: high/medium/low 影响 llms.txt 分级；`tags`/`category` 用于检索过滤；
`summary` 缺省自动提取首段；`date` 影响 sitemap 与 JSON-LD）。

## 构建与发布链

写入永远先进预览态，发布前必须经人确认：
- `doclight dev` — 本地实时预览（写入先进预览态，不自动发布）
- `doclight build` — SSG 静态导出（产物含 llms.txt / docs.json / capabilities.json）
- `doclight preview` — 预览构建产物
- `doclight publish` — 发布（local / git gh-pages / space；人确认后执行）

> **隐私注意**：`/llms-full.txt` 是 docs/ 下**全站 Markdown 明文导出**——草稿、私有内容、未脱敏笔记会被同步发布。
> 请用 `build.llmsTxt.exclude`（doclight.json）排除，或把敏感内容移出 docs/ 目录。

> **MCP 写入端鉴权**：`doclight dev --mcp` 启动时自动生成 Bearer token（打印到终端，写入 `.doclight/mcp-token`）。
> Agent 调用 `write_doc` / `update_doc` / `delete_doc` 需携带 `Authorization: Bearer <token>`；未携带会被 401 拒绝。

## Agent 接口（构建产物）

- /llms.txt
- /llms-full.txt
- /docs.json
- /search-index.json
- /capabilities.json
- /.well-known/mcp
- /mcp — MCP Server（工具：get_capabilities / search_docs / read_doc / list_docs / get_site_summary / get_outline / find_examples / write_doc / update_doc / delete_doc）；独立服务或 `doclight dev --mcp`

## 写作流程（推荐）

1. 读 /capabilities.json 确认支持的语法（不要用本站不支持的语法）
2. 在 docs/ 下写 .md（frontmatter 按上表；正文用支持语法）
3. `doclight dev` 预览 → 人确认 → `doclight build` → `doclight publish`
