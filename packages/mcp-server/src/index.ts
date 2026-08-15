/**
 * @doclight/mcp-server 入口（MCP-001/002/003 + MCP-006，Phase 4 + Phase 6 P1 实现）
 *
 * 读取端 MCP Server：只服务产物站点（dist-site，doclight build 产出），
 * 不服务源码 docs/（决策：MCP 面向已发布内容，见 README 边界）。
 * MCP-006 写入端（--write-dir）：write_doc/update_doc/delete_doc 写入内容源目录，
 * 与 dev --mcp 联动（写入 → watcher 增量重渲染，Agent 实时输出实时预览）。
 *
 * 两种运行方式：
 * - stdio（默认，无 --port）：Claude Desktop 等 MCP 客户端的标准接入
 * - HTTP（--port <n>）：独立服务 + /.well-known/mcp 发现，远程 Agent 连接
 *
 * 用法：
 *   node packages/mcp-server/src/index.ts --site ./dist-site            # stdio（只读）
 *   node packages/mcp-server/src/index.ts --site ./dist-site --write-dir ./docs  # + 写入端
 *   node packages/mcp-server/src/index.ts --site ./dist-site --port 3100  # HTTP
 */

import { loadSite, parseLlmsFull } from "./site.ts";
import type { SiteData, SiteDocMeta } from "./site.ts";
import { McpServer, MCP_PROTOCOL_VERSION, MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./protocol.ts";
import { runStdio } from "./stdio.ts";
import { startHttpServer, mcpHttpHandler } from "./http.ts";
import { TOOLS, findTool, McpError, toolDescriptors } from "./tools.ts";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const mcpServerVersion = MCP_SERVER_VERSION;

/** 组合入口：加载产物站点 → 返回 MCP 服务实例（程序化/插件模式用）。
 *  MCP-006：writeDir 提供时启用写入端工具。 */
export function createMcpServer(siteDir: string, options: { writeDir?: string } = {}): McpServer {
  return new McpServer(loadSite(siteDir, options));
}

export { loadSite, parseLlmsFull, McpServer, runStdio, startHttpServer, mcpHttpHandler, TOOLS, findTool, McpError, toolDescriptors };
export type { SiteData, SiteDocMeta };
export { MCP_PROTOCOL_VERSION, MCP_SERVER_NAME, MCP_SERVER_VERSION };

/** 解析命令行参数（--key value 或 --key=value） */
function parseArgs(argv: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    const key = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    const value = eq >= 0 ? arg.slice(eq + 1) : argv[i + 1] ?? "true";
    options[key] = value;
    if (eq < 0 && !argv[i + 1]?.startsWith("--")) i++;
  }
  return options;
}

// 直接运行：node packages/mcp-server/src/index.ts --site <dir> [--port <n>] [--write-dir <dir>]
// DOCLIGHT_CLI_BUNDLE 守卫：本文件被 esbuild 打包进 doclight CLI（build-cli.mjs）时，
// 入口检查会误触发（import.meta.url === process.argv[1] 都指向 cli.mjs）——CLI 构建
// 通过 define 注入 DOCLIGHT_CLI_BUNDLE="1"，此处短路，避免 MCP server 抢占 CLI 端口。
// realpathSync：npm link 全局安装后 argv[1] 是符号链接路径，需规范化后与真实路径比较。
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href && !process.env.DOCLIGHT_CLI_BUNDLE) {
  const opts = parseArgs(process.argv.slice(2));
  const siteDir = opts["site"] ?? "dist-site";
  const site = loadSite(siteDir, { writeDir: opts["write-dir"] });
  const server = new McpServer(site);
  const port = Number(opts["port"] ?? "0");

  if (port > 0) {
    startHttpServer(site, server, { port }).then((h) => {
      console.log(`doclight-mcp v${MCP_SERVER_VERSION} — HTTP 服务已启动`);
      console.log(`  端点:     ${h.url}mcp（POST JSON-RPC）`);
      console.log(`  发现:     ${h.url}.well-known/mcp`);
      console.log(`  产物站点: ${siteDir}（${site.docs.length} 篇文档）`);
      if (site.writeDir) console.log(`  写入端:   ${site.writeDir}（write_doc/update_doc/delete_doc，MCP-006）`);
      console.log(`  按 Ctrl+C 停止`);
    });
  } else {
    // stdio：与客户端握手不打印任何额外输出（污染协议会破坏握手）
    runStdio(server);
  }
}
