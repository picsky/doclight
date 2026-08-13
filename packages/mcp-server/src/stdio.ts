/**
 * MCP stdio 传输（MCP-002）：逐行 JSON-RPC over stdin/stdout。
 * Claude Desktop 等 MCP 客户端默认走 stdio：启动 `doclight-mcp --site <dist>`。
 * 无 port 参数时即本模式（MCP 客户端标准接入方式）。
 */
import { createInterface } from "node:readline";
import type { JsonRpcMessage, McpServer } from "./protocol.ts";

export function runStdio(server: McpServer): void {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: JsonRpcMessage;
    try {
      msg = JSON.parse(trimmed) as JsonRpcMessage;
    } catch {
      return; // 非 JSON 行忽略（日志噪声等）
    }
    const res = server.handle(msg);
    if (res) process.stdout.write(`${JSON.stringify(res)}\n`);
  });
  rl.on("close", () => process.exit(0));
}
