# packages/mcp-server — MCP Server（读取端）

> 状态：Phase 4 已实现（MCP-001 工具集 / MCP-002 stdio / MCP-003 HTTP+发现）
> 对应设计：[06-ai-native](../../docs/tech-design/06-ai-native.md)、[14-agent-content-space](../../docs/tech-design/14-agent-content-space.md)

## 为什么存在（意图文档，12 §4.1）

让 AI Agent 像操作工具一样消费文档站：`search_docs` / `read_doc` / `list_docs` / `get_site_summary` / `get_outline` / `find_examples`。这是「使用端 AI 原生」的核心通道，也是 Agent 内容空间（Phase 4）的读取端。

**为什么独立成包**：MCP 协议实现与渲染内核解耦；同时支持独立 HTTP 服务与插件模式（嵌入 dev server）两种形态。

**为什么零依赖实现协议**：不引 `@modelcontextprotocol/sdk`，用 Node 原生实现 MCP 2025-06-18 协议子集（initialize / tools/list / tools/call / ping），符合项目「加依赖是最高危操作」红线。工具返回结构化 JSON 文本，Agent 直接解析。

## 边界

- 读取端：只读文档站数据，不做内容写入（写入走 publish CLI，见 14）
- **只服务产物站点（dist-site，`doclight build` 产出）**，不服务源码 docs/——MCP 面向「已发布内容」消费
- 数据源：`docs.json`（结构化元数据）/ `search-index.json`（检索）/ `llms-full.txt`（纯 markdown 全文，REND-004 双读友好）
- 工具名 / 参数 Schema / 返回结构**只加不改**（契约层，12 §5.1）

## 用法

```bash
# stdio 模式（Claude Desktop 等 MCP 客户端标准接入）
node packages/mcp-server/src/index.ts --site ./dist-site

# HTTP 独立服务（远程 Agent + well-known 发现）
node packages/mcp-server/src/index.ts --site ./dist-site --port 3100
#   POST /mcp             → MCP JSON-RPC
#   GET /.well-known/mcp  → 发现端点（能力 + 工具列表）
#   GET /                 → 双读能力页
```

先运行 `doclight build` 生成产物；产物缺失时工具优雅降级（空结果 / 明确提示先 build）。

## 协议握手示例（stdio）

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"my-agent","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"安装"}}}
```

## 工具清单（契约，只加不改）

| Tool | 功能 | 输入要点 |
|---|---|---|
| `search_docs` | 全文搜索 | query 必填；limit/category/tags/priority/includeContent |
| `read_doc` | 读取文档（纯 markdown 原稿） | path 必填；section/startLine/endLine/format(markdown\|html\|text) |
| `list_docs` | 列出文档（结构化元数据） | prefix/category/tags |
| `get_site_summary` | 站点摘要 | 无参 |
| `get_outline` | 文档大纲 | path 必填 |
| `find_examples` | 代码示例搜索 | query/language/limit |
