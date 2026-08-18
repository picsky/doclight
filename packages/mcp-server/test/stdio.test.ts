/**
 * stdio 传输测试（2026-08 review P0-7：此前零测试零引用——Claude Desktop 默认接入路径）。
 * 用 PassThrough 流注入替代 process.stdin/stdout，验证：
 * - 逐行 JSON-RPC 请求 → 按行响应
 * - 非 JSON 行 / 空行 → 忽略不响应、不崩溃
 * - notification（无 id）→ 无响应
 * - 流关闭 → onExit 触发（默认 process.exit(0)，测试注入捕获）
 */
import { PassThrough } from "node:stream";
import { beforeAll, describe, expect, it } from "vitest";
import { loadSite, type SiteData } from "../src/site.ts";
import { McpServer } from "../src/protocol.ts";
import { runStdio } from "../src/stdio.ts";
import { makeFixtureSite } from "./helpers.ts";

let site: SiteData;
let siteDir: string;

beforeAll(() => {
  siteDir = makeFixtureSite();
  site = loadSite(siteDir);
});

/** 跑一次 stdio 会话：写入若干行 → 等 onExit（rl close）→ 收集输出行 */
async function session(lines: string[]): Promise<{ out: string[]; exited: boolean }> {
  const server = new McpServer(site);
  const input = new PassThrough();
  const output = new PassThrough();
  let exited = false;
  const exitedPromise = new Promise<void>((resolve) => {
    runStdio(server, { input, output, onExit: () => { exited = true; resolve(); } });
  });
  const chunks: Buffer[] = [];
  output.on("data", (c: Buffer) => chunks.push(c));
  for (const line of lines) input.write(`${line}\n`);
  input.end(); // 触发 rl close → onExit
  await exitedPromise;
  await new Promise<void>((done) => output.end(() => done()));
  return { out: Buffer.concat(chunks).toString("utf8").split("\n").filter(Boolean), exited };
}

describe("MCP stdio 传输（MCP-002）", () => {
  it("逐行 JSON-RPC 请求 → 按行响应（tools/list）", async () => {
    const { out } = await session([JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })]);
    expect(out).toHaveLength(1);
    const res = JSON.parse(out[0]!) as { id: number; result?: { tools?: Array<{ name: string }> } };
    expect(res.id).toBe(1);
    expect(res.result?.tools?.map((t) => t.name)).toContain("search_docs");
  });

  it("请求 → 响应成对（initialize + tools/call 只读工具）", async () => {
    const { out } = await session([
      JSON.stringify({ jsonrpc: "2.0", id: 7, method: "initialize", params: {} }),
      JSON.stringify({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "list_docs", arguments: {} } }),
    ]);
    expect(out).toHaveLength(2);
    const listRes = JSON.parse(out[1]!) as { id: number; result: { content: Array<{ text: string }> } };
    expect(listRes.id).toBe(8);
    const payload = JSON.parse(listRes.result.content[0]!.text) as { docs?: unknown[] };
    expect(Array.isArray(payload.docs)).toBe(true);
  });

  it("非 JSON 行与空行 → 忽略（不响应不崩溃），后续请求仍正常", async () => {
    const { out } = await session([
      "this is not json",
      "",
      JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    ]);
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0]!).id).toBe(2);
  });

  it("notification（无 id）→ 无响应", async () => {
    const { out } = await session([JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })]);
    expect(out).toHaveLength(0);
  });

  it("流关闭 → onExit 触发（默认路径为 process.exit(0)）", async () => {
    const { exited } = await session([]);
    expect(exited).toBe(true);
  });
});
