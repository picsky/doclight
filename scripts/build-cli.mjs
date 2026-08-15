// CLI 构建管线（OSS-001 遗留落地，2026-08 前端审查 P0-3）
// 问题：Node 26 strip-only 不支持 TS 参数属性等语法，packages/cli/src 无法直接被 Node 运行
// （各包 main 直指 ./src/index.ts）。本脚本用 esbuild 将 CLI 打成自包含 ESM 单文件
// packages/cli/dist/cli.mjs，并把主题 CSS 复制到产物旁（themes.ts 按 import.meta.url 相对读取）。
//
// 产物形态与约束：
// - 输出位置 packages/cli/dist/（包内）：运行时外部依赖（jsdom / @resvg/resvg-js / qrcode）
//   从 packages/cli/node_modules 解析；display.js 由 build.mjs 复制到同目录
//   （site.ts displayBundlePath 约定）。
// - external：jsdom（CJS 动态 require，打包进 ESM 会崩）、@resvg/resvg-js（原生 .node）、
//   qrcode（可选功能 --qr）。三者均为 packages/cli 直接依赖，运行时解析无虞。
// - bin：packages/cli/package.json bin 指向 dist/cli.mjs（npm i -g doclight 可用）。
import { build } from "esbuild";
import { chmodSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "packages", "cli", "dist");

/** 构建 CLI，返回体积度量（供 build.mjs 汇总） */
export async function buildCli() {
  mkdirSync(OUT_DIR, { recursive: true });

  const res = await build({
    entryPoints: [join(ROOT, "packages", "cli", "src", "index.ts")],
    outfile: join(OUT_DIR, "cli.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    external: ["jsdom", "@resvg/resvg-js", "qrcode"],
    // 注入 DOCLIGHT_CLI_BUNDLE 守卫：@doclight/mcp-server 的独立入口检查（index.ts 底部
    // `import.meta.url === new URL(process.argv[1])`）在打包进 cli.mjs 后误触发——运行时
    // import.meta.url 与 process.argv[1] 都指向 cli.mjs，导致 MCP server 也启动 HTTP 服务
    // 抢占 CLI 端口（EADDRINUSE）。define 短路该检查：打包形态永不执行 MCP 独立入口，
    // 独立运行 packages/mcp-server/src/index.ts 时不受影响。
    define: { "process.env.DOCLIGHT_CLI_BUNDLE": '"1"' },
    // 产物剥离注释（与 build-display/build-renderer 一致；双读注释保留在 .ts 源码）
    legalComments: "none",
    logLevel: "warning",
  });

  // 主题 CSS 运行时按 import.meta.url 相对读取（themes.ts:37）→ 复制到产物旁
  cpSync(join(ROOT, "packages", "cli", "src", "themes"), join(OUT_DIR, "themes"), { recursive: true });

  // 注入 shebang（bin 执行必需），但先检查是否已存在避免重复
  const cliPath = join(OUT_DIR, "cli.mjs");
  const existingContent = readFileSync(cliPath, "utf8");
  if (!existingContent.startsWith("#!")) {
    const cliContent = `#!/usr/bin/env node\n` + existingContent;
    writeFileSync(cliPath, cliContent);
    // 设置可执行权限（POSIX）
    try { chmodSync(cliPath, 0o755); } catch { /* Windows 忽略 */ }
  }

  return {
    file: "packages/cli/dist/cli.mjs",
    rawBytes: res.metafile ? 0 : 0, // esbuild 未开 metafile；体积由 size.mjs 门禁覆盖
    outputFiles: res.outputFiles?.length ?? 0,
  };
}

// 直接运行：node scripts/build-cli.mjs
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    await buildCli();
    console.log(`✓ build-cli — packages/cli/dist/cli.mjs (self-contained ESM)`);
  } catch (err) {
    console.error(`✗ build-cli — ${err.message}`);
    process.exit(1);
  }
}
