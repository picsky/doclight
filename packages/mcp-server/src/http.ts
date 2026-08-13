/**
 * MCP HTTP 传输（MCP-003）：独立服务模式 + well-known 发现。
 *
 * 部署后的文档站可通过 HTTP 被远程 Agent 连接：
 * - POST /mcp          → JSON-RPC 请求/响应（单请求单响应子集，工具调用即此模式）
 * - GET /.well-known/mcp → 发现端点：能力描述 + 工具列表 + endpoint
 * - GET / (或 /health)  → 人类/Agent 可读的能力页
 * 零依赖（node:http）；CORS 放开便于浏览器端 MCP 客户端与 Electron/WebDriver 验收走查。
 */
import { createServer, type Server } from "node:http";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION, type JsonRpcMessage, type McpServer } from "./protocol.ts";
import { toolDescriptors } from "./tools.ts";
import type { SiteData } from "./site.ts";

export interface HttpServerHandle {
  url: string;
  port: number;
  close(): Promise<void>;
}

function json(res: import("node:http").ServerResponse, code: number, obj: unknown): void {
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
    ``,
    `工具：${toolDescriptors().map((t) => t.name).join(" / ")}`,
    ``,
  ].join("\n");
}

/** 启动 HTTP MCP 服务。port 缺省 0（系统分配，便于测试）；返回后即可请求。 */
export function startHttpServer(site: SiteData, server: McpServer, options: { port?: number; host?: string } = {}): Promise<HttpServerHandle> {
  const host = options.host ?? "127.0.0.1";
  const srv: Server = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const path = (req.url ?? "/").split("?")[0]!.split("#")[0]!;

    if (req.method === "GET" && path === "/.well-known/mcp") {
      json(res, 200, {
        name: MCP_SERVER_NAME,
        version: MCP_SERVER_VERSION,
        description: "DocLight MCP Server（只读产物站点：搜索/阅读/大纲/示例）",
        protocolVersion: "2025-06-18",
        endpoint: "/mcp",
        siteTitle: site.title,
        totalDocs: site.docs.length,
        tools: toolDescriptors(),
      });
      return;
    }
    if (req.method === "GET" && (path === "/" || path === "/health")) {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(capabilitiesText(site));
      return;
    }
    if (req.method === "POST" && (path === "/mcp" || path === "/")) {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString("utf8");
      });
      req.on("end", () => {
        let msg: JsonRpcMessage;
        try {
          msg = JSON.parse(body) as JsonRpcMessage;
        } catch {
          json(res, 400, { error: { code: -32700, message: "Invalid JSON" } });
          return;
        }
        const out = server.handle(msg);
        if (out) json(res, 200, out);
        else {
          res.writeHead(202); // notification 已接收，无响应体
          res.end();
        }
      });
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
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
