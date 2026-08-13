---
name: doclight-mcp-constraints
description: DocLight MCP 设计约束——只服务产物站点、零依赖 spec 化协议、llms-full.txt 分节契约
metadata:
  type: project
---

DocLight MCP Server 的几条硬约束（决策，勿推翻）：

1. **MCP 只服务产物站点（dist-site，`doclight build` 产物）**，不服务源码 docs/——MCP 面向「已发布内容」消费。数据源 = docs.json / search-index.json / llms-full.txt。
2. **零依赖实现协议**：不引 @modelcontextprotocol/sdk，Node 原生 JSON-RPC 2025-06-18 子集（initialize/tools/list/tools/call/ping），守「加依赖是最高危操作」红线。
3. **llms-full.txt 分节契约**：`## 路径：<path>` 为节头，MCP read_doc 靠它提取单篇纯 markdown 原稿（REND-004 双读友好）。改此格式会破坏 read_doc。
4. 工具名/参数 Schema/返回结构**只加不改**（契约层）。
5. Node strip-only TS 模式不支持构造器参数属性——McpServer 用显式字段赋值（可擦除语法）。

**Why**: 这些约束影响任何后续 MCP/llms 改动，换会话容易踩坑（如误把 MCP 指向 docs/ 或引入 SDK 破坏零依赖）。
**How to apply**: 改 MCP 或 llms.txt 生成前先读 packages/mcp-server/README.md；相关 [[phase4-readside-done]]
