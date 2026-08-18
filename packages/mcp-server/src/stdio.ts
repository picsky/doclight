/**
 * MCP stdio 传输（MCP-002）：逐行 JSON-RPC over stdin/stdout。
 * Claude Desktop 等 MCP 客户端默认走 stdio：启动 `doclight-mcp --site <dist>`。
 * 无 port 参数时即本模式（MCP 客户端标准接入方式）。
 *
 * 2026-08 review P0-7：input/output/onExit 可注入（默认 process.stdin/stdout/exit(0)），
 * 行为零变化——仅为单测可测性（此前零测试）。
 */
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { JsonRpcMessage, McpServer } from "./protocol.ts";

export function runStdio(
  server: McpServer,
  io: { input?: Readable; output?: Writable; onExit?: () => void } = {}
): void {
  const input = io.input ?? process.stdin;
  const output = io.output ?? process.stdout;
  const onExit = io.onExit ?? (() => process.exit(0));
  const rl = createInterface({ input, crlfDelay: Infinity });
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
    if (res) output.write(`${JSON.stringify(res)}\n`);
  });
  rl.on("close", () => onExit());
}
