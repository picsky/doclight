import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";
import { loadSite } from "../src/site.ts";
import { McpServer } from "../src/protocol.ts";
import { startHttpServer, type HttpServerHandle } from "../src/http.ts";
import { makeFixtureSite } from "./helpers.ts";

let handle: HttpServerHandle;
let siteDir: string;

beforeAll(async () => {
  siteDir = makeFixtureSite();
  handle = await startHttpServer(loadSite(siteDir), new McpServer(loadSite(siteDir)), { port: 0 });
});

afterAll(async () => {
  await handle.close();
  rmSync(siteDir, { recursive: true, force: true });
});

describe("MCP HTTP 传输（MCP-003 + MCP-004 SSE 流式）", () => {
  it("GET /.well-known/mcp → 发现端点（工具列表 + endpoint + 传输能力）", async () => {
    const res = await fetch(`${handle.url}.well-known/mcp`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; endpoint: string; tools: Array<{ name: string }>; transports: string[]; totalDocs: number };
    expect(body.name).toBe("doclight-mcp");
    expect(body.endpoint).toBe("/mcp");
    expect(body.transports).toContain("streamable-http");
    expect(body.tools.map((t) => t.name)).toContain("search_docs");
    expect(body.totalDocs).toBe(2);
  });

  it("GET / → 双读能力页（人 + Agent 可读文本）", async () => {
    const res = await fetch(handle.url);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("doclight-mcp");
    expect(text).toContain("search_docs");
  });

  it("POST /mcp initialize → MCP 握手响应", async () => {
    const res = await fetch(`${handle.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { serverInfo: { name: string } } };
    expect(body.result.serverInfo.name).toBe("doclight-mcp");
  });

  it("POST /mcp tools/call search_docs → 结构化结果", async () => {
    const res = await fetch(`${handle.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search_docs", arguments: { query: "doclight" } } }),
    });
    const body = (await res.json()) as { result: { content: Array<{ text: string }> } };
    const parsed = JSON.parse(body.result.content[0]!.text) as { results: unknown[] };
    expect(parsed.results.length).toBe(1);
  });

  it("POST /mcp 非法 JSON → 400", async () => {
    const res = await fetch(`${handle.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    expect(res.status).toBe(400);
  });

  it("POST /mcp Accept: text/event-stream → SSE 帧（event: message + data）", async () => {
    const res = await fetch(`${handle.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/list" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: message");
    const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
    expect(dataLine).toBeTruthy();
    const payload = JSON.parse(dataLine!.slice(6)) as { result: { tools: unknown[] } };
    expect(payload.result.tools.length).toBeGreaterThanOrEqual(6);
  });

  it("GET /mcp Accept: text/event-stream → SSE 长连接流（心跳帧 + 保持打开）", async () => {
    const ac = new AbortController();
    const res = await fetch(`${handle.url}mcp`, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      signal: ac.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    // 读取首块：connected 注释帧
    const reader = res.body!.getReader();
    const first = await reader.read();
    const text = new TextDecoder().decode(first.value);
    expect(text).toContain(": connected");
    ac.abort(); // 关闭长连接
    reader.cancel().catch(() => {});
  });

  it("未知路径 → 404", async () => {
    expect((await fetch(`${handle.url}nope`)).status).toBe(404);
  });
});
