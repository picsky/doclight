/**
 * MCP 协议层（MCP-002，JSON-RPC 2.0 + stdio 传输）
 *
 * 零依赖实现 MCP 2025-06-18 协议子集（决策：spec 化 MCP，不引 @modelcontextprotocol/sdk，
 * 遵循 mcp-server README「只加不改」契约）：
 * - initialize / notifications/initialized / tools/list / tools/call / ping
 * - stdio：逐行 JSON（Claude Desktop 等客户端标准传输）
 *
 * 响应结构与 MCP spec 一致：tools/call 返回 { content: [{type:"text", text}], isError }；
 * 工具结果序列化为 JSON 文本（结构化数据给 Agent 解析）。
 */

import type { SiteData } from "./site.ts";
import { findTool, McpError, toolDescriptors } from "./tools.ts";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SERVER_NAME = "doclight-mcp";
export const MCP_SERVER_VERSION = "0.1.0";

export interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class McpServer {
  private site: SiteData;
  constructor(site: SiteData) {
    this.site = site;
  }

  /**
   * 处理一条 JSON-RPC 消息。notification（无 id）返回 null（按协议不发响应）。
   * 错误码：应用/参数错误 -32000（McpError 自带 code）；协议错误 -32601（Method Not Found）；
   * 其余内部错误 -32603。
   */
  handle(message: JsonRpcMessage): JsonRpcMessage | null {
    if (message.id === undefined) return null; // notification：notifications/initialized 等
    const id = message.id;
    try {
      const result = this.dispatch(message.method ?? "", message.params);
      return { jsonrpc: "2.0", id, result };
    } catch (err) {
      const e = err as Error & { code?: number };
      const code = e instanceof McpError ? -32000 : e.code ?? -32603;
      return { jsonrpc: "2.0", id, error: { code, message: e.message } };
    }
  }

  private dispatch(method: string, params: unknown): unknown {
    switch (method) {
      case "initialize":
        return {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
        };
      case "ping":
        return {};
      case "tools/list":
        return { tools: toolDescriptors() };
      case "tools/call": {
        // 工具级失败按 MCP spec 语义返回 isError:true 的 result，而非 JSON-RPC error
        const p = (params ?? {}) as { name?: unknown; arguments?: unknown };
        const tool = findTool(typeof p.name === "string" ? p.name : "");
        if (!tool) return { content: [{ type: "text", text: `未知工具：${String(p.name)}` }], isError: true };
        try {
          const result = tool.handler(this.site, (p.arguments ?? {}) as Record<string, unknown>);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: false };
        } catch (err) {
          return { content: [{ type: "text", text: (err as Error).message }], isError: true };
        }
      }
      default: {
        // 方法级错误：JSON-RPC -32601 Method Not Found
        const err = new Error(`Method not found: ${method}`) as Error & { code?: number };
        err.code = -32601;
        throw err;
      }
    }
  }
}
