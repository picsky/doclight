import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";
import { loadSite } from "../src/site.ts";
import { McpServer } from "../src/protocol.ts";
import { request } from "node:http";
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

/* ---- 安全（2026-08 审计后）：CORS + 写工具鉴权 ---- */
describe("MCP HTTP 安全（CORS + Bearer token 写鉴权）", () => {
  let authHandle: HttpServerHandle;
  const TOKEN = "test-secret-token-xyz";
  const ORIGIN = "http://127.0.0.1:9999";

  beforeAll(async () => {
    authHandle = await startHttpServer(
      loadSite(siteDir, { writeDir: siteDir }),
      new McpServer(loadSite(siteDir, { writeDir: siteDir })),
      { port: 0, authToken: TOKEN, allowedOrigins: [ORIGIN] }
    );
  });
  afterAll(async () => {
    await authHandle.close();
  });

  it("写工具无 token → 401（write_doc）", async () => {
    const res = await fetch(`${authHandle.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "write_doc", arguments: { path: "x.md", content: "# hi" } } }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: number; message: string } };
    expect(body.error.code).toBe(-32000);
    expect(body.error.message).toContain("Bearer token");
  });

  it("写工具错误 token → 401", async () => {
    const res = await fetch(`${authHandle.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN, Authorization: "Bearer wrong" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "delete_doc", arguments: { path: "x.md" } } }),
    });
    expect(res.status).toBe(401);
  });

  it("写工具正确 token → 200（write_doc 真正写入 fixture 临时目录）", async () => {
    const res = await fetch(`${authHandle.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "write_doc", arguments: { path: "auth-test.md", content: "# test" } } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { content: Array<{ text: string }> } };
    const parsed = JSON.parse(body.result.content[0]!.text) as { ok: boolean };
    expect(parsed.ok).toBe(true);
  });

  it("只读工具无需 token（search_docs 正常返回）", async () => {
    const res = await fetch(`${authHandle.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "search_docs", arguments: { query: "doclight" } } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { content: Array<{ text: string }> } };
    const parsed = JSON.parse(body.result.content[0]!.text) as { results: unknown[] };
    expect(Array.isArray(parsed.results)).toBe(true);
  });

  it("CORS：Origin 不在白名单 → 403", async () => {
    const res = await fetch(`${authHandle.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example.com" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "initialize" }),
    });
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("CORS：Origin 在白名单 → ACAO 回显 + Vary: Origin", async () => {
    const res = await fetch(`${authHandle.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ jsonrpc: "2.0", id: 6, method: "tools/list" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("vary")).toContain("Origin");
  });

  it("CORS：无 Origin 的本地客户端放行（allowWithoutOrigin 默认 true）", async () => {
    const res = await fetch(`${authHandle.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/list" }),
    });
    expect(res.status).toBe(200);
  });

  it("Bearer scheme 大小写不敏感（bearer <token> 放行写工具）", async () => {
    const res = await fetch(`${authHandle.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN, Authorization: `bearer ${TOKEN}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "write_doc", arguments: { path: "case-test.md", content: "# ok" } } }),
    });
    expect(res.status).toBe(200);
  });
});

/* ---- 安全（2026-08 review P0）：Host 白名单（DNS rebinding 防御）+ 请求体上限 ---- */
describe("MCP HTTP 安全 P0（Host 校验 + body 上限）", () => {
  let p0Handle: HttpServerHandle;

  // fetch 禁止设置 Host 头（forbidden header），用 node:http 原生请求
  function rawRequest(opts: { host?: string; method: string; path: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; text: string }> {
    return new Promise((resolve, reject) => {
      const req = request(
        {
          host: "127.0.0.1",
          port: p0Handle.port,
          method: opts.method,
          path: opts.path,
          headers: { ...(opts.headers ?? {}), ...(opts.host !== undefined ? { Host: opts.host } : {}) },
        },
        (res) => {
          let text = "";
          res.on("data", (c: Buffer) => (text += c.toString("utf8")));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
        },
      );
      req.on("error", reject);
      if (opts.body !== undefined) req.write(opts.body);
      req.end();
    });
  }

  beforeAll(async () => {
    p0Handle = await startHttpServer(
      loadSite(siteDir, { writeDir: siteDir }),
      new McpServer(loadSite(siteDir, { writeDir: siteDir })),
      { port: 0 },
    );
  });
  afterAll(async () => {
    await p0Handle.close();
  });

  it("loopback 监听：Host 为外部域名（DNS rebinding 形态）→ 403", async () => {
    const res = await rawRequest({ host: "evil.example.com", method: "GET", path: "/health" });
    expect(res.status).toBe(403);
    expect(res.text).toContain("Host not allowed");
  });

  it("loopback 监听：Host 为 127.0.0.1:<port> → 放行", async () => {
    const res = await rawRequest({ host: `127.0.0.1:${p0Handle.port}`, method: "GET", path: "/health" });
    expect(res.status).toBe(200);
  });

  it("loopback 监听：Host 为 localhost:<port> / [::1]:<port> → 放行", async () => {
    expect((await rawRequest({ host: `localhost:${p0Handle.port}`, method: "GET", path: "/health" })).status).toBe(200);
    expect((await rawRequest({ host: `[::1]:${p0Handle.port}`, method: "GET", path: "/health" })).status).toBe(200);
  });

  it("POST /mcp 请求体超 2MB → 413（响应完整送达）", async () => {
    const big = "x".repeat(3 * 1024 * 1024); // 3MB，超上限
    const res = await rawRequest({
      method: "POST",
      path: "/mcp",
      headers: { "Content-Type": "application/json", "Content-Length": String(big.length) },
      body: big,
    });
    expect(res.status).toBe(413);
    const body = JSON.parse(res.text) as { error: { code: number } };
    expect(body.error.code).toBe(-32000);
  });

  it("POST /mcp 正常体积请求不受影响（2MB 上限下 tools/list）", async () => {
    const res = await rawRequest({
      method: "POST",
      path: "/mcp",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(200);
  });
});
