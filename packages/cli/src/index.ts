/**
 * doclight-cli 入口（DEV-001）
 *
 * 命令：doclight dev [--port <n>] [--dir <path>] [--title <名>]
 * 启动本地文档站（首屏直出 + SSE 热重载）。其余命令（init/build/bundle/...）Phase 3。
 */
import { startDevServer } from "./dev-server.ts";

export const cliVersion = "0.1.0";

export interface CliOptions {
  port: number;
  dir: string;
  title?: string;
}

/** 解析命令行参数（支持 --key value 与 --key=value） */
export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { port: 3000, dir: "docs" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--port") options.port = Number(argv[++i]);
    else if (arg === "--dir") options.dir = argv[++i]!;
    else if (arg === "--title") options.title = argv[++i];
    else if (arg.startsWith("--port=")) options.port = Number(arg.slice("--port=".length));
    else if (arg.startsWith("--dir=")) options.dir = arg.slice("--dir=".length);
    else if (arg.startsWith("--title=")) options.title = arg.slice("--title=".length);
    else if (arg === "--help" || arg === "-h") {
      console.log(`doclight ${cliVersion} — dev 命令

用法: doclight dev [选项]

选项:
  --port <n>     监听端口（默认 3000）
  --dir <path>   文档根目录（默认 ./docs）
  --title <名>   站点标题（默认 DocLight）
  --help, -h     显示帮助`);
      process.exit(0);
    }
  }
  return options;
}

/** 启动 dev server（供命令与测试复用） */
export async function runDev(options: Partial<CliOptions> = {}): Promise<{ url: string; port: number; close(): Promise<void> }> {
  const merged: CliOptions = { port: options.port ?? 3000, dir: options.dir ?? "docs", title: options.title };
  return startDevServer(merged);
}

// 直接运行：node packages/cli/src/index.ts dev [选项]
// 注：Node 22.6+ 需 --experimental-strip-types；Node 23.6+ 默认支持 TS 类型剥离
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== "dev") {
    console.error(`未知命令：${command ?? "(空)"}（Phase 1 仅支持 dev，其余 Phase 3）`);
    process.exit(1);
  }
  const opts = parseArgs(rest);
  const dev = await runDev(opts);
  console.log(`\n  DocLight dev server 已启动\n`);
  console.log(`  本地预览:  ${dev.url}`);
  console.log(`  文档目录:  ${opts.dir}`);
  console.log(`  按 Ctrl+C 停止\n`);
}
