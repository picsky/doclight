/**
 * MCP HTTP 传输（MCP-003 + MCP-004 SSE 流式 + MCP-005 可挂载 handler）。
 *
 * 独立服务模式（--port）与嵌入模式（dev server --mcp）共用同一 handler：
 * - POST /mcp          → JSON-RPC 请求/响应（Accept 含 text/event-stream 时以 SSE 帧响应，否则 JSON）
 * - GET  /mcp          → SSE 长连接流（MCP Streamable HTTP：服务端→客户端消息通道；
 *                       只读服务无主动通知，保持心跳注释帧存活）
 * - GET  /.well-known/mcp → 发现端点：能力描述 + 工具列表 + endpoint
 * - GET  / 与 /health  → 人类/Agent 可读的能力页（capabilitiesAtRoot=false 时跳过 /，供 dev server 挂载）
 * 零依赖（node:http）。
 *
 * 安全（2026-08 审计后）：
 * - CORS 收紧：ACAO 仅回显 allowedOrigins 白名单内的 Origin（未配置时拒绝所有带 Origin 的请求；
 *   无 Origin 的非浏览器客户端按 allowWithoutOrigin 放行，默认 true 以兼容 stdio 桥接）。
 * - 写工具（write_doc/update_doc/delete_doc）强制 Bearer token 鉴权（authToken 配置时生效）；
 *   只读工具不受影响。配合 dev --mcp 启动自动生成并打印 token，本机进程无法被跨站网页滥用。
 * - 2026-08 review P0 加固：token 恒时比较（SHA-256 摘要 + timingSafeEqual）；
 *   POST 请求体 2MB 上限（超限 413）；loopback 监听时 Host 头白名单校验（DNS rebinding 防御）。
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION, type JsonRpcMessage, type McpServer } from "./protocol.ts";
import { toolDescriptors } from "./tools.ts";
import type { SiteData } from "./site.ts";

export interface HttpServerHandle {
  url: string;
  port: number;
  close(): Promise<void>;
}

/** MCP HTTP handler 安全选项（2026-08 审计后） */
export interface McpHttpAuthOptions {
  /** 写入工具所需的 Bearer token（未配置 → 写工具拒绝调用，避免默认开放写接口）。
   *  只读工具不受 token 限制——MCP 客户端 initialize/list/search 无需鉴权。 */
  authToken?: string;
  /** CORS Origin 白名单（含协议与端口；如 `http://127.0.0.1:3000`）。
   *  - 未配置（空数组/undefined）→ 仅放行无 Origin 的请求（本地 stdio 桥接、curl），
   *    带 Origin 的浏览器请求会被 ACAO 头缺失阻止跨站。
   *  - 配置后 → 请求 Origin 命中白名单才回显 ACAO。 */
  allowedOrigins?: string[];
  /** 允许无 Origin 的浏览器请求（默认 true，便于 curl/本地客户端）。
   *  设为 false 强制所有浏览器端 POST 必须带白名单内的 Origin。 */
  allowWithoutOrigin?: boolean;
}

/** MCP-006 写工具名集合（鉴权作用域精确限定：只读工具不受 token 限制） */
const WRITE_TOOLS = new Set(["write_doc", "update_doc", "delete_doc"]);

/** POST /mcp 请求体上限（2026-08 review P0-2：防无上限累积导致内存耗尽；
 *  2MB 覆盖 write_doc 单篇最大文档场景，超限返回 413） */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** loopback 监听主机名（Host 头校验白名单的判定基准） */
const LOOPBACK_LISTEN_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
/** Host 头允许的主机名（DNS rebinding 防御：rebind 域名解析到 127.0.0.1 后
 *  请求 Host 为攻击者域名 → 拒绝；本机浏览器/客户端 Host 始终命中白名单） */
const ALLOWED_HOST_HEADER_NAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** 监听地址是否 loopback（loopback 时启用 Host 头校验；显式 --host 非 loopback 跳过） */
export function isLoopbackListenHost(host: string): boolean {
  return LOOPBACK_LISTEN_HOSTS.has(host);
}

/** 提取 Host 头主机名（去端口；[::1]:3000 → [::1]、127.0.0.1:3000 → 127.0.0.1） */
function hostnameOfHostHeader(host: string): string {
  if (host.startsWith("[")) return host.slice(0, host.indexOf("]") + 1);
  if ((host.match(/:/g) ?? []).length > 1) return host; // 裸 IPv6（如 ::1）
  return host.split(":")[0]!.toLowerCase();
}

/** loopback 监听下的 Host 头校验（DNS rebinding 防御，2026-08 review P0-3）。
 *  无 Host 头的非浏览器客户端（部分 HTTP 库）放行——写工具仍需 Bearer token。 */
export function hostHeaderAllowed(req: IncomingMessage): boolean {
  const host = req.headers.host;
  if (host === undefined || host === "") return true;
  return ALLOWED_HOST_HEADER_NAMES.has(hostnameOfHostHeader(host));
}

/** 恒时 token 比较（2026-08 review P0-1）：SHA-256 摘要等长化后 timingSafeEqual，
 *  规避逐字节短路比较的时序侧信道与长度泄露。 */
function tokenEquals(provided: string | undefined, expected: string | undefined): boolean {
  if (typeof provided !== "string" || typeof expected !== "string" || !provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** 判断一条 JSON-RPC 消息是否在调用写工具（解析前就拦截） */
function isWriteToolCall(msg: JsonRpcMessage): boolean {
  if (msg.method !== "tools/call") return false;
  const p = (msg.params ?? {}) as { name?: unknown };
  return typeof p.name === "string" && WRITE_TOOLS.has(p.name);
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
 *
 * 安全（2026-08 审计后）：
 * - CORS 严格：ACAO 仅回显命中 allowedOrigins 的 Origin；OPTIONS 同规则。
 * - 写工具（tools/call 且 name ∈ {write_doc, update_doc, delete_doc}）强制
 *   Authorization: Bearer <authToken>；token 不匹配 → 返回 JSON-RPC -32000 错误。
 */
export function mcpHttpHandler(
  site: SiteData,
  server: McpServer,
  options: { capabilitiesAtRoot?: boolean } & McpHttpAuthOptions = {}
): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  const capabilitiesAtRoot = options.capabilitiesAtRoot !== false;
  const allowWithoutOrigin = options.allowWithoutOrigin !== false;
  const allowedOrigins = options.allowedOrigins ?? [];
  const authToken = options.authToken;

  /** 设置 CORS：仅当请求 Origin 命中白名单时才回显 ACAO（阻止跨站网页滥用）。
   *  未带 Origin 的客户端（stdio 桥接/curl/本地 Node）按 allowWithoutOrigin 放行。 */
  function setCors(req: IncomingMessage, res: ServerResponse): boolean {
    const origin = req.headers.origin;
    if (typeof origin === "string" && origin) {
      if (!allowedOrigins.includes(origin)) return false; // Origin 不在白名单 → 不回显 ACAO（浏览器会阻止响应）
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    } else if (!allowWithoutOrigin) {
      return false;
    }
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    return true;
  }

  return async (req, res) => {
    if (!setCors(req, res)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden (Origin not allowed)");
      return true;
    }
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
        // CAP-001：能力协议——渲染能力清单端点（Agent 写内容前先读）
        capabilitiesEndpoint: "/capabilities.json",
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

    // JSON-RPC 请求（POST）：写工具强制 token 鉴权
    if (req.method === "POST" && path === "/mcp") {
      await handlePost(req, res, server, wantsSse, { authToken });
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

/** 解析 Authorization 头中的 Bearer token（无 token / 格式错误 → undefined）。
 *  scheme 大小写不敏感（RFC 9110：bearer 与 Bearer 等价）。 */
function bearerToken(req: IncomingMessage): string | undefined {
  const h = req.headers.authorization;
  if (typeof h !== "string") return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : undefined;
}

/** 读取请求体（上限字节；超限 resolve(null) 并排水剩余数据——不 destroy 请求流，
 *  保证 413 响应能完整送达客户端）。连接错误同样 resolve(null)（错误响应交给调用方）。 */
function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    req.on("data", (c: Buffer) => {
      if (settled) return;
      size += c.length;
      if (size > limit) {
        settled = true;
        chunks.length = 0;
        resolve(null);
        return; // 后续 data 事件仅丢弃（连接保持，响应可送达）
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks).toString("utf8"));
      }
    });
    req.on("error", () => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    });
  });
}

/** 处理 POST JSON-RPC：客户端 Accept 支持 SSE 时以 SSE 帧返回，否则 JSON 单响应。
 *  写工具（write_doc/update_doc/delete_doc）强制 Bearer token 鉴权。 */
async function handlePost(
  req: IncomingMessage,
  res: ServerResponse,
  server: McpServer,
  wantsSse: boolean,
  auth: { authToken?: string }
): Promise<void> {
  const body = await readBody(req, MAX_BODY_BYTES);
  if (body === null) {
    json(res, 413, { error: { code: -32000, message: `请求体超过上限（${MAX_BODY_BYTES / 1024 / 1024}MB，防内存耗尽）` } });
    return;
  }
  let msg: JsonRpcMessage;
  try {
    msg = JSON.parse(body) as JsonRpcMessage;
  } catch {
    json(res, 400, { error: { code: -32700, message: "Invalid JSON" } });
    return;
  }
  // 写工具鉴权：未配置 authToken 时默认拒绝写（避免默认开放写接口）
  if (isWriteToolCall(msg)) {
    if (!auth.authToken || !tokenEquals(bearerToken(req), auth.authToken)) {
      const id = msg.id;
      const out: JsonRpcMessage = {
        jsonrpc: "2.0",
        ...(id !== undefined ? { id } : {}),
        error: {
          code: -32000,
          message: "写工具需要 Bearer token 鉴权：启动时通过 Authorization: Bearer <token> 携带（MCP-006 写入端鉴权）",
        },
      };
      json(res, 401, out);
      return;
    }
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
export function startHttpServer(
  site: SiteData,
  server: McpServer,
  options: { port?: number; host?: string } & McpHttpAuthOptions = {}
): Promise<HttpServerHandle> {
  const host = options.host ?? "127.0.0.1";
  const enforceHost = isLoopbackListenHost(host); // loopback 监听启用 Host 校验（P0-3）
  const handler = mcpHttpHandler(site, server, {
    authToken: options.authToken,
    allowedOrigins: options.allowedOrigins,
    allowWithoutOrigin: options.allowWithoutOrigin,
  });
  const srv: Server = createServer((req, res) => {
    if (enforceHost && !hostHeaderAllowed(req)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden (Host not allowed)");
      return;
    }
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
