import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";
import { loadSite } from "../src/site.ts";
import { McpServer, MCP_PROTOCOL_VERSION, MCP_SERVER_NAME, MCP_SERVER_VERSION } from "../src/protocol.ts";
import { makeFixtureSite } from "./helpers.ts";

let server: McpServer;
let siteDir: string;

beforeAll(() => {
  siteDir = makeFixtureSite();
  server = new McpServer(loadSite(siteDir));
});

afterAll(() => {
  rmSync(siteDir, { recursive: true, force: true });
});

describe("MCP 协议（MCP-002 JSON-RPC）", () => {
  it("initialize → 协议版本 + tools 能力 + serverInfo", () => {
    const res = server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } })!;
    expect(res.id).toBe(1);
    const result = res.result as { protocolVersion: string; capabilities: { tools: { listChanged: boolean } }; serverInfo: { name: string; version: string } };
    expect(result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(result.capabilities.tools).toEqual({ listChanged: false });
    expect(result.serverInfo.name).toBe(MCP_SERVER_NAME);
    expect(result.serverInfo.version).toBe(MCP_SERVER_VERSION);
  });

  it("notifications/initialized（无 id）→ 返回 null（不发响应）", () => {
    expect(server.handle({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
  });

  it("tools/list → 七工具（name/description/inputSchema；CAP-001 get_capabilities 置首）", () => {
    const res = server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" })!;
    const tools = (res.result as { tools: Array<{ name: string; description: string; inputSchema: { type: string } }> }).tools;
    expect(tools.length).toBe(7);
    expect(tools.map((t) => t.name)[0]).toBe("get_capabilities");
    expect(tools.map((t) => t.name)).toContain("search_docs");
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.inputSchema.type).toBe("object");
    }
  });

  it("tools/call search_docs → content 为结构化 JSON 文本，isError=false", () => {
    const res = server.handle({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "search_docs", arguments: { query: "doclight" } },
    })!;
    expect((res.result as { isError: boolean }).isError).toBe(false);
    const content = (res.result as { content: Array<{ type: string; text: string }> }).content;
    expect(content[0]!.type).toBe("text");
    const parsed = JSON.parse(content[0]!.text) as { results: unknown[]; total: number };
    expect(parsed.total).toBe(1);
  });

  it("tools/call 未知工具 → isError=true，消息可读", () => {
    const res = server.handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "nope" } })!;
    const result = res.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("未知工具");
  });

  it("read_doc 未找到文档 → isError=true 且消息可读（无堆栈泄露）", () => {
    const res = server.handle({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "read_doc", arguments: { path: "missing.md" } },
    })!;
    const result = res.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("未找到文档");
  });

  it("未知方法 → JSON-RPC 协议错误（-32601 Method Not Found）", () => {
    const res = server.handle({ jsonrpc: "2.0", id: 6, method: "no/such" })!;
    expect(res.error!.code).toBe(-32601);
  });
});
