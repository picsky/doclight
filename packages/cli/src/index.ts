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
import { publishSite, type PublishResult } from "./publish.ts";
import { spaceInit, spaceStatus, spaceSwitch } from "./space.ts";
import { embedSite } from "./embed.ts";

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
  /** dev --mcp：MCP 插件模式（嵌入 dev server，MCP-005） */
  mcp?: boolean;
  /** bundle --qr <url>：生成下载二维码（C2，13 §3.2 分发四触点④） */
  qrUrl?: string;
  /** bundle --inline-vendor：内联扩展库（C3，file:// 下扩展可用，体积增大） */
  inlineVendor?: boolean;
}

/** 解析命令行参数（支持 --key value 与 --key=value）。无值 flag（如 --json）记为 "true"。 */
export function parseArgs(argv: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    const key = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    const next = argv[i + 1];
    // 布尔 flag：后接 token 若以 -- 开头或无 token → 视为 true（不吞掉下一个 flag）
    const value = eq >= 0 ? arg.slice(eq + 1) : next !== undefined && !next.startsWith("--") ? next : "true";
    options[key] = value;
    if (eq < 0 && value !== "true" && next !== undefined && !next.startsWith("--")) i++; // 消费值 token
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
  publish   发布到内容空间（local / git / space，14 §4.3）
  space     内容空间管理（init / switch / status，14 §3.4）
  embed     生成嵌入代码（snippet.js + iframe 片段，13 §3.1）

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
  --remote <url>  deploy / publish 覆盖 git 远程地址检测
  --to <provider> publish 目标空间类型（local / git / space，缺省 active 空间）
  --space <name>  publish 指定已注册的空间名
  --endpoint <u>  publish --to space 的 API 端点
  --root <path>   publish / space 的项目根目录（缺省当前目录）
  --json          publish / space 输出纯 JSON（Agent 直接解析）
  --mcp           dev 模式启用 MCP 插件（同端口 /mcp + /.well-known/mcp）
  --qr <url>      bundle 生成下载二维码（bundle-qr.png，13 §3.2）
  --inline-vendor bundle 内联扩展库（Prism/Mermaid/KaTeX，file:// 下可用；体积增大）
  --help, -h      显示帮助`);
}

/** 启动 dev server（供命令与测试复用） */
export async function runDev(options: Partial<CliOptions> = {}): Promise<{ url: string; port: number; close(): Promise<void> }> {
  const merged: CliOptions = { port: options.port ?? 3000, dir: options.dir ?? "docs", title: options.title, mcp: options.mcp };
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
  return bundleSite({
    dir: options.dir,
    outDir: options.outDir,
    title: options.title,
    qrUrl: options.qrUrl,
    inlineVendor: options.inlineVendor,
  });
}

/** 执行嵌入分发（供命令与测试复用） */
export function runEmbed(options: Partial<CliOptions> = {}): ReturnType<typeof embedSite> {
  return embedSite({ dir: options.dir, outDir: options.outDir, title: options.title, siteUrl: options.siteUrl });
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
        mcp: opts["mcp"] === "true",
      });
      console.log(`\n  DocLight dev server 已启动\n`);
      console.log(`  本地预览:  ${dev.url}`);
      console.log(`  文档目录:  ${opts["dir"] ?? "docs"}`);
      if (opts["mcp"] === "true") {
        console.log(`  MCP 插件:  ${dev.url}mcp（POST JSON-RPC）+ ${dev.url}.well-known/mcp`);
      }
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
      const result = await runBundle({
        dir: opts["dir"],
        outDir: opts["out-dir"],
        title: opts["title"],
        qrUrl: opts["qr"],
        inlineVendor: opts["inline-vendor"] === "true",
      });
      console.log(`\n  DocLight 便携包构建完成 ✓\n`);
      console.log(`  页面: ${result.pages} 篇`);
      console.log(`  产物: ${result.file}（${(result.bytes / 1024).toFixed(1)} KB，${result.ms}ms）`);
      if (result.qrFile) console.log(`  二维码: ${result.qrFile}（手机扫码打开/下载，13 §3.2）`);
      if (opts["inline-vendor"] === "true") console.log(`  扩展: 已内联 Prism/Mermaid/KaTeX（file:// 离线可用）`);
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
    } else if (command === "publish") {
      const result: PublishResult = await publishSite({
        root: opts["root"],
        dir: opts["dir"],
        to: opts["to"] as "local" | "git" | "space" | undefined,
        spaceName: opts["space"],
        outDir: opts["out-dir"],
        title: opts["title"],
        remoteUrl: opts["remote"],
        endpoint: opts["endpoint"],
      });
      if (opts["json"] === "true") {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.ok) {
        console.log(`\n  DocLight 发布完成 ✓\n`);
        console.log(`  空间: ${result.spaceName}（${result.provider}）`);
        if (result.file) console.log(`  产物: ${result.file}`);
        console.log(`  URL:  ${result.url}`);
      } else {
        console.log(`\n  DocLight 发布未能自动完成\n`);
        console.log(`  空间: ${result.spaceName}（${result.provider}）`);
        if (result.error) console.log(`  原因: ${result.error}`);
        for (const s of result.steps) console.log(`  ${s}`);
        process.exitCode = 1;
      }
    } else if (command === "space") {
      const sub = rest[0] ?? "";
      const root = opts["root"];
      if (sub === "init") {
        const result = spaceInit({
          root,
          provider: opts["provider"] as "local" | "git" | "space" | undefined,
          name: opts["name"],
          label: opts["label"],
          outputDir: opts["out-dir"],
          remoteUrl: opts["remote"],
          branch: opts["branch"],
          endpoint: opts["endpoint"],
        });
        if (opts["json"] === "true") {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`\n  DocLight 空间已初始化 ✓（${result.created ? "新建" : "已有"}）\n`);
          console.log(`  空间: ${result.space}（${result.config.spaces[result.space]?.provider ?? ""}）`);
          if (result.url) console.log(`  URL:  ${result.url}`);
          for (const s of result.steps) console.log(`  ${s}`);
          console.log(`\n  发布: doclight publish   |   状态: doclight space status\n`);
        }
      } else if (sub === "switch") {
        const name = rest[1] ?? opts["name"];
        if (!name) {
          console.error(`✗ space switch 需要空间名（用法: doclight space switch <name>）`);
          process.exit(1);
        }
        const result = spaceSwitch(root ?? ".", name);
        if (opts["json"] === "true") {
          console.log(JSON.stringify(result, null, 2));
        } else if (result.ok) {
          console.log(`\n  已切换到空间: ${result.active}\n`);
        } else {
          console.error(`✗ ${result.error}`);
          process.exitCode = 1;
        }
      } else if (sub === "status") {
        const result = spaceStatus(root ?? ".");
        if (opts["json"] === "true") {
          console.log(JSON.stringify(result, null, 2));
        } else if (!result.initialized) {
          console.log(`\n  尚未初始化空间（运行 doclight space init 创建默认 local 空间）\n`);
        } else {
          console.log(`\n  DocLight 内容空间状态\n`);
          console.log(`  激活: ${result.label ?? result.active}（${result.provider}）`);
          if (result.url) console.log(`  URL:  ${result.url}`);
          for (const s of result.spaces.filter((x) => x.active).flatMap((x) => x.steps)) console.log(`  ${s}`);
          console.log(`\n  全部空间:`);
          for (const s of result.spaces) console.log(`   ${s.active ? "*" : " "} ${s.name}（${s.provider}）${s.url ? " → " + s.url : ""}`);
        }
      } else {
        console.error(`未知 space 子命令：${sub || "(空)"}（支持 init / switch / status）`);
        process.exit(1);
      }
    } else if (command === "embed") {
      const result = runEmbed({
        dir: opts["dir"],
        outDir: opts["out-dir"],
        title: opts["title"],
        siteUrl: opts["site-url"],
      });
      console.log(`\n  DocLight 嵌入代码已生成 ✓\n`);
      console.log(`  脚本: ${result.snippetFile}（与站点同目录部署，宿主页加一行 <script src="snippet.js">）`);
      console.log(`\n  或复制以下 <iframe> 代码（嵌入语雀/飞书/博客/官网）：\n`);
      for (const line of result.iframeHtml.split("\n")) console.log(`  ${line}`);
      console.log(`\n  示例 URL: ${result.url}\n`);
    } else {
      console.error(`未知命令：${command ?? "(空)"}（支持 dev / build / preview / init / bundle / deploy / migrate-docsify / publish / space / embed）`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`✗ ${command}: ${(err as Error).message}`);
    process.exit(1);
  }
}
