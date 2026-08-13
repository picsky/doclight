/**
 * doclight-cli 入口（DEV-001 + SSG-001 + Phase 3 剩余）
 *
 * 命令：
 *   doclight dev [--port <n>] [--dir <path>] [--title <名>]    本地文档站（首屏直出 + SSE 热重载）
 *   doclight build [--dir] [--out-dir] [--title] [--base] [--site-url]  SSG 静态导出 + SEO（05 §5.3/§5.4）
 *   doclight preview [--dir <path>] [--port <n>] [--base]      预览构建产物
 *   doclight init [--dir <path>] [--title]                     初始化新项目（doclight.json + 示例 docs/）
 *   doclight bundle [--dir] [--out-dir] [--title]              单文件便携包（05 §5.3.4，形态③）
 *   doclight deploy [--dir] [--title]                          一键部署（GitHub Pages 等，05 §5.5）
 */
import { startDevServer } from "./dev-server.ts";
import { buildSite } from "./build.ts";
import { bundleSite } from "./bundle.ts";
import { deploySite } from "./deploy.ts";
import { initProject } from "./init.ts";
import { migrateDocsify } from "./migrate.ts";
import { startPreviewServer } from "./preview.ts";

export const cliVersion = "0.1.0";

export interface CliOptions {
  port: number;
  dir: string;
  title?: string;
  outDir?: string;
  base?: string;
  siteUrl?: string;
  description?: string;
  author?: string;
  platform?: "gh-pages" | "cloudflare-pages" | "netlify";
  remoteUrl?: string;
}

/** 解析命令行参数（支持 --key value 与 --key=value），返回字面字符串映射 */
export function parseArgs(argv: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    const key = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    const value = eq >= 0 ? arg.slice(eq + 1) : argv[i + 1] ?? "true";
    options[key] = value;
    if (eq < 0 && !argv[i + 1]?.startsWith("--")) i++; // 消费值 token
  }
  return options;
}

/** 读取数字选项（缺省 fallback） */
function numOption(opts: Record<string, string>, key: string, fallback: number): number {
  const v = opts[key];
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function printHelp(): void {
  console.log(`doclight ${cliVersion} — 零构建文档站引擎

用法: doclight <命令> [选项]

命令:
  dev       启动本地文档站（首屏直出 + SSE 热重载）
  build     构建静态站点（SSG + SEO 全套，输出到 --out-dir）
  preview   预览构建产物（静态服务器）
  init      初始化新项目（doclight.json + 示例 docs/ + index.html）
  bundle    构建单文件便携包（离线分发，05 §5.3.4）
  deploy    一键部署（GitHub Pages / Cloudflare / Netlify 检测）
  migrate-docsify  从 docsify 站点迁移内容到 DocLight 约定

选项:
  --port <n>      监听端口（默认 3000）
  --dir <path>    文档根目录（dev/build 默认 ./docs；preview 默认 ./dist-site）
  --out-dir <p>   构建输出目录（build 默认 ./dist-site）
  --title <名>    站点标题（默认 DocLight）
  --base <path>   子路径基址（GitHub Pages 项目页等，如 /docs）
  --site-url <u>  站点绝对 URL（生成 canonical/sitemap/robots/OG，如 https://x.example.com）
  --description   站点描述（缺省页面 description 优先）
  --author <名>   全局作者（JSON-LD author，缺省 frontmatter.author）
  --platform <p>  deploy 平台（gh-pages / cloudflare-pages / netlify，默认自动检测）
  --remote <url>  deploy 覆盖 git 远程地址检测
  --help, -h      显示帮助`);
}

/** 启动 dev server（供命令与测试复用） */
export async function runDev(options: Partial<CliOptions> = {}): Promise<{ url: string; port: number; close(): Promise<void> }> {
  const merged: CliOptions = { port: options.port ?? 3000, dir: options.dir ?? "docs", title: options.title };
  return startDevServer(merged);
}

/** 执行 SSG 构建（供命令与测试复用） */
export function runBuild(options: Partial<CliOptions> = {}): ReturnType<typeof buildSite> {
  return buildSite({
    dir: options.dir,
    outDir: options.outDir,
    title: options.title,
    base: options.base,
    siteUrl: options.siteUrl,
    description: options.description,
    author: options.author,
  });
}

/** 启动 preview 服务器（供命令与测试复用） */
export async function runPreview(
  options: Partial<CliOptions> = {}
): Promise<{ url: string; port: number; close(): Promise<void> }> {
  return startPreviewServer({ dir: options.dir ?? "dist-site", port: options.port ?? 3000, base: options.base });
}

/** 执行 bundle 构建（供命令与测试复用） */
export function runBundle(options: Partial<CliOptions> = {}): ReturnType<typeof bundleSite> {
  return bundleSite({ dir: options.dir, outDir: options.outDir, title: options.title });
}

/** 执行部署（供命令与测试复用） */
export function runDeploy(options: Partial<CliOptions> = {}): ReturnType<typeof deploySite> {
  return deploySite({
    dir: options.dir,
    outDir: options.outDir,
    title: options.title,
    platform: options.platform,
    remoteUrl: options.remoteUrl,
  });
}

// 直接运行：node packages/cli/src/index.ts <命令> [选项]
// 注：Node 22.6+ 需 --experimental-strip-types；Node 23.6+ 默认支持 TS 类型剥离
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [command, ...rest] = process.argv.slice(2);
  const opts = parseArgs(rest);

  if (opts["help"] === "true" || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  try {
    if (command === "dev") {
      const dev = await runDev({
        port: numOption(opts, "port", 3000),
        dir: opts["dir"] ?? "docs",
        title: opts["title"],
      });
      console.log(`\n  DocLight dev server 已启动\n`);
      console.log(`  本地预览:  ${dev.url}`);
      console.log(`  文档目录:  ${opts["dir"] ?? "docs"}`);
      console.log(`  按 Ctrl+C 停止\n`);
    } else if (command === "build") {
      const result = runBuild({
        dir: opts["dir"],
        outDir: opts["out-dir"],
        title: opts["title"],
        base: opts["base"],
        siteUrl: opts["site-url"],
        description: opts["description"],
        author: opts["author"],
      });
      console.log(`\n  DocLight 静态构建完成 ✓\n`);
      console.log(`  页面: ${result.pages} 篇 + ${result.assets} 个静态资源`);
      console.log(`  输出: ${result.outDir}（${(result.bytes / 1024).toFixed(1)} KB，${result.ms}ms）`);
      if (opts["site-url"]) console.log(`  SEO: sitemap.xml + robots.txt + OG 卡片 + canonical 已生成`);
      console.log(`  预览: doclight preview${opts["base"] ? ` --base ${opts["base"]}` : ""}\n`);
    } else if (command === "preview") {
      const preview = await runPreview({
        port: numOption(opts, "port", 3000),
        dir: opts["dir"],
        base: opts["base"],
      });
      console.log(`\n  DocLight preview 已启动\n`);
      console.log(`  本地预览:  ${preview.url}`);
      console.log(`  产物目录:  ${opts["dir"] ?? "dist-site"}`);
      console.log(`  按 Ctrl+C 停止\n`);
    } else if (command === "init") {
      const result = initProject({ dir: opts["dir"], title: opts["title"], description: opts["description"] });
      console.log(`\n  DocLight 项目已初始化 ✓\n`);
      for (const f of result.created) console.log(`  创建  ${f}`);
      for (const f of result.skipped) console.log(`  跳过  ${f}（已存在，--force 覆盖）`);
      console.log(`\n  开始: doclight dev --dir ${result.root}\\docs\n`);
    } else if (command === "bundle") {
      const result = runBundle({ dir: opts["dir"], outDir: opts["out-dir"], title: opts["title"] });
      console.log(`\n  DocLight 便携包构建完成 ✓\n`);
      console.log(`  页面: ${result.pages} 篇`);
      console.log(`  产物: ${result.file}（${(result.bytes / 1024).toFixed(1)} KB，${result.ms}ms）`);
      console.log(`  分发: 双击文件或传给任何人，file:// 离线可用\n`);
    } else if (command === "migrate-docsify") {
      const result = migrateDocsify({ sourceDir: opts["dir"] ?? "docsify-site", destDir: process.cwd() });
      console.log(`\n  docsify → DocLight 迁移完成 ✓\n`);
      console.log(`  复制: ${result.copied.length} 篇 Markdown → ${result.destDocs}`);
      if (result.sidebar.length) console.log(`  _sidebar 导航: ${result.sidebar.length} 项（DocLight 自动导航替代）`);
      if (result.skipped.length) console.log(`  跳过（docsify 专属）: ${result.skipped.join(", ")}`);
      console.log(`\n  下一步: doclight dev / doclight build\n`);
    } else if (command === "deploy") {
      const result = runDeploy({
        dir: opts["dir"],
        outDir: opts["out-dir"],
        title: opts["title"],
        platform: opts["platform"] as "gh-pages" | "cloudflare-pages" | "netlify" | undefined,
        remoteUrl: opts["remote"],
      });
      if (result.url) {
        console.log(`\n  DocLight 部署完成 ✓\n`);
        console.log(`  平台: ${result.platform}`);
        console.log(`  URL:  ${result.url}`);
      } else {
        console.log(`\n  DocLight 部署需要人工步骤\n`);
        for (const s of result.steps) console.log(`  ${s}`);
      }
    } else {
      console.error(`未知命令：${command ?? "(空)"}（支持 dev / build / preview / init / bundle / deploy / migrate-docsify）`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`✗ ${command}: ${(err as Error).message}`);
    process.exit(1);
  }
}
