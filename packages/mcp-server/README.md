# packages/mcp-server — MCP Server（读取端）

> 状态：Phase 0 占位（功能实现见 Phase 4）
> 对应设计：[06-ai-native](../../docs/tech-design/06-ai-native.md)、[14-agent-content-space](../../docs/tech-design/14-agent-content-space.md)

## 为什么存在（意图文档，12 §4.1）

让 AI Agent 像操作工具一样消费文档站：`search_docs` / `read_doc` / `list_docs` / `get_site_summary` / `get_outline` / `find_examples`。这是「使用端 AI 原生」的核心通道，也是 Agent 内容空间（Phase 4）的读取端。

**为什么独立成包**：MCP 协议实现与渲染内核解耦；同时支持独立 HTTP 服务与插件模式（嵌入 dev server）两种形态。

## 边界

- 读取端：只读文档站数据，不做内容写入（写入走 publish CLI，见 14）
- 工具名 / 参数 Schema / 返回结构**只加不改**（契约层，12 §5.1）
