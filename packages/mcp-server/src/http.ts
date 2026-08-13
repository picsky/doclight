/**
 * MCP HTTP 传输（MCP-003 + MCP-004 SSE 流式 + MCP-005 可挂载 handler）。
 *
 * 独立服务模式（--port）与嵌入模式（dev server --mcp）共用同一 handler：
 * - POST /mcp          → JSON-RPC 请求/响应（Accept 含 text/event-stream 时以 SSE 帧响应，否则 JSON）
 * - GET  /mcp          → SSE 长连接流（MCP Streamable HTTP：服务端→客户端消息通道；
 *                       只读服务无主动通知，保持心跳注释帧存活）
 * - GET  /.well-known/mcp → 发现端点：能力描述 + 工具列表 + endpoint
 * - GET  / 与 /health  → 人类/Agent 可读的能力页（capabilitiesAtRoot=false 时跳过 /，供 dev server 挂载）
 * 零依赖（node:http）；CORS 放开便于浏览器端 MCP 客户端与 Electron/WebDriver 验收走查。
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION, type JsonRpcMessage, type McpServer } from "./protocol.ts";
import { toolDescriptors } from "./tools.ts";
import type { SiteData } from "./site.ts";

export interface HttpServerHandle {
  url: string;
  port: number;
  close(): Promise<void>;
}

function json(res: ServerResponse, code: number, obj: unknown): void {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

/** 能力页文本（GET / 与 /health）：双读友好（人 + Agent 都能消费） */
function capabilitiesText(site: SiteData): string {
  return [
    `doclight-mcp v${MCP_SERVER_VERSION} — DocLight MCP Server（只读产物站点）`,
    ``,
    `站点：${site.title}${site.description ? `（${site.description}）` : ""}`,
    `文档数：${site.docs.length}`,
    ``,
    `使用：向 POST /mcp 发送 MCP JSON-RPC 消息（initialize → tools/list → tools/call）。`,
    `发现：/.well-known/mcp 返回机器可读能力描述。`,
    `流式：Accept: text/event-stream 时 POST 响应走 SSE；GET /mcp 为长连接流（心跳保活）。`,
    ``,
    `工具：${toolDescriptors().map((t) => t.name).join(" / ")}`,
    ``,
  ].join("\n");
}

/**
 * MCP HTTP 请求处理器（可挂载：dev server 插件模式复用，MCP-005）。
 * 返回 true = 请求已处理；false = 不属于 MCP 路径，交给宿主继续处理。
 *
 * 路径（basePath 为空时）：
 *   GET  /.well-known/mcp · POST /mcp · GET /mcp（SSE 流）· GET /health
 *   GET  /（仅 capabilitiesAtRoot=true，独立服务默认；dev 挂载传 false 避免抢占站点首页）
 */
export function mcpHttpHandler(
  site: SiteData,
  server: McpServer,
  options: { capabilitiesAtRoot?: boolean } = {}
): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  const capabilitiesAtRoot = options.capabilitiesAtRoot !== false;
  return async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return true;
    }
    const path = (req.url ?? "/").split("?")[0]!.split("#")[0]!;
    const accept = req.headers.accept ?? "";
    const wantsSse = /text\/event-stream/.test(accept);

    // 发现端点
    if (req.method === "GET" && path === "/.well-known/mcp") {
      json(res, 200, {
        name: MCP_SERVER_NAME,
        version: MCP_SERVER_VERSION,
        description: "DocLight MCP Server（只读产物站点：搜索/阅读/大纲/示例）",
        protocolVersion: "2025-06-18",
        transports: ["streamable-http"],
        endpoint: "/mcp",
        siteTitle: site.title,
        totalDocs: site.docs.length,
        tools: toolDescriptors(),
      });
      return true;
    }

    // 能力页（独立服务默认含根路径；dev 挂载关闭根路径避免抢占站点首页）
    if (req.method === "GET" && (path === "/health" || (path === "/" && capabilitiesAtRoot))) {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(capabilitiesText(site));
      return true;
    }

    // JSON-RPC 请求（POST）
    if (req.method === "POST" && path === "/mcp") {
      await handlePost(req, res, server, wantsSse);
      return true;
    }

    // SSE 长连接流（GET /mcp）：服务端→客户端消息通道（只读服务无主动通知，心跳保活）
    if (req.method === "GET" && path === "/mcp") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 15000);
      req.on("close", () => clearInterval(keepAlive));
      return true;
    }

    return false;
  };
}

/** 处理 POST JSON-RPC：客户端 Accept 支持 SSE 时以 SSE 帧返回，否则 JSON 单响应 */
async function handlePost(req: IncomingMessage, res: ServerResponse, server: McpServer, wantsSse: boolean): Promise<void> {
  let body = "";
  for await (const chunk of req) body += chunk.toString("utf8");
  let msg: JsonRpcMessage;
  try {
    msg = JSON.parse(body) as JsonRpcMessage;
  } catch {
    json(res, 400, { error: { code: -32700, message: "Invalid JSON" } });
    return;
  }
  const out = server.handle(msg);
  if (!out) {
    res.writeHead(202); // notification 已接收，无响应体
    res.end();
    return;
  }
  if (wantsSse) {
    // MCP Streamable HTTP：单响应帧后关闭（只读服务无后续流内容）
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    res.write(`event: message\ndata: ${JSON.stringify(out)}\n\n`);
    res.end();
    return;
  }
  json(res, 200, out);
}

/** 启动 HTTP MCP 服务（独立模式，MCP-003）。port 缺省 0（系统分配，便于测试）；返回后即可请求。 */
export function startHttpServer(site: SiteData, server: McpServer, options: { port?: number; host?: string } = {}): Promise<HttpServerHandle> {
  const host = options.host ?? "127.0.0.1";
  const handler = mcpHttpHandler(site, server);
  const srv: Server = createServer((req, res) => {
    void (async () => {
      if (!(await handler(req, res))) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
      }
    })();
  });

  return new Promise((resolveListen) => {
    srv.listen(options.port ?? 0, host, () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : (options.port ?? 0);
      resolveListen({
        url: `http://${host}:${port}/`,
        port,
        close: () => new Promise<void>((done) => srv.close(() => done())),
      });
    });
  });
}
