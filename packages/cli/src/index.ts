#!/usr/bin/env node
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
import { join, resolve } from "node:path";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { startDevServer } from "./dev-server.ts";
import { buildSite } from "./build.ts";
import { bundleSite } from "./bundle.ts";
import { deploySite } from "./deploy.ts";
import { initProject } from "./init.ts";
import { migrateDocsify, migrateGitBook, migrateMkDocs } from "./migrate.ts";
import { startPreviewServer } from "./preview.ts";
import { publishSite, type PublishResult } from "./publish.ts";
import { listSnapshots, rollbackSnapshot } from "./snapshot.ts";
import { spaceInit, spaceStatus, spaceSwitch } from "./space.ts";
import { embedSite } from "./embed.ts";
import { loadConfig } from "./config.ts";
import { configuredPluginWatchFiles, loadConfiguredPlugins, reloadConfiguredPluginsAsync } from "./plugin-loader.ts";
import { pluginList, pluginNew } from "./plugin-new.ts";
import { loadConfiguredTheme } from "./themes.ts";
import { buildSlidesHtml, parseSlides } from "./slides.ts";

export const cliVersion = "0.1.0";

/** WORK-001 确认门：TTY 交互提示（Agent/CI 非 TTY 场景不调用） */
function readLine(prompt: string): Promise<string> {
  return new Promise((resolvePrompt) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolvePrompt(answer);
    });
  });
}

/** 正式发布执行（publish 命令主体：publishSite + 结果输出；WORK-001 快照在 publishSite 内部） */
async function doPublish(opts: Record<string, string>): Promise<void> {
  const result: PublishResult = await publishSite({
    root: opts["root"],
    dir: opts["dir"],
    to: opts["to"] as "local" | "git" | "space" | undefined,
    spaceName: opts["space"],
    outDir: opts["out-dir"],
    title: opts["title"],
    remoteUrl: opts["remote"],
    endpoint: opts["endpoint"],
    snapshot: opts["no-snapshot"] === "true" ? false : undefined,
  });
  if (opts["json"] === "true") {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(`\n  DocLight 发布完成 ✓\n`);
    console.log(`  空间: ${result.spaceName}（${result.provider}）`);
    if (result.file) console.log(`  产物: ${result.file}`);
    console.log(`  URL:  ${result.url}`);
    if (result.snapshot) console.log(`  快照: ${result.snapshot.id}（${result.snapshot.files} 文件；回滚: doclight rollback ${result.snapshot.id}）`);
  } else {
    console.log(`\n  DocLight 发布未能自动完成\n`);
    console.log(`  空间: ${result.spaceName}（${result.provider}）`);
    if (result.error) console.log(`  原因: ${result.error}`);
    for (const s of result.steps) console.log(`  ${s}`);
    process.exitCode = 1;
  }
}

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
  /** build/preview --themes：构建主题画廊（VIS-001，4 套设计语言 × 亮暗对比页） */
  themes?: boolean;
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
  migrate-mkdocs   从 MkDocs 站点迁移（含 admonition 转换）
  migrate-gitbook  从 GitBook 站点迁移（含 hint/code 块转换）
  publish   发布到内容空间（local / git / space，14 §4.3；发布前自动快照）
  rollback  回滚内容到发布前快照（WORK-001：rollback <id> / rollback --list）
  space     内容空间管理（init / switch / status，14 §3.4）
  embed     生成嵌入代码（snippet.js + iframe 片段，13 §3.1）
  slides    生成演示（markdown --- 分页 → 自包含单页 HTML，01 §原则二，DEMO-001）
  plugin    插件开发（new 生成脚手架 / list 列出官方插件）

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
  --inline-vendor bundle 内联扩展库（Prism/KaTeX + 启用插件 vendor，file:// 下可用；体积增大）
  --themes        build/preview 构建主题画廊（4 套设计语言 × 亮暗对比页，产物 gallery/）
  --preview       publish 预览态（构建 + 预览服务，不发布——人确认后再正式发布，WORK-001）
  --yes           publish 跳过交互确认（TTY 模式下默认 y/N 确认门）
  --no-snapshot   publish 关闭发布前自动快照（默认开启，可 rollback 回滚）
  --theme <名>    slides 演示主题（dark / light / warm 或 CSS 文件；缺省 dark）
  --author <名>   slides 封面署名（作者 · 日期）
  --help, -h      显示帮助`);
}

/** 启动 dev server（供命令与测试复用） */
export async function runDev(options: Partial<CliOptions> = {}): Promise<{ url: string; port: number; close(): Promise<void> }> {
  const merged: CliOptions = { port: options.port ?? 3000, dir: options.dir ?? "docs", title: options.title, mcp: options.mcp };
  // PLUG-009 接线：doclight.json plugins → 构建管线；THEME-002 主题同步；PLUG-011 插件热重载
  // PLUG-014：doclight.json 插件配置注入页面（展示层自动注册 init/onMount）
  const cfg = loadConfig([join(process.cwd(), "doclight.json"), join(resolve(merged.dir), "doclight.json")]);
  const theme = loadConfiguredTheme(merged.dir);
  // 设计对齐（2026-08-16）：站点镀铬（顶栏版本/GitHub、footer 链接与状态）
  const chrome = cfg.version || cfg.github || cfg.footer
    ? { version: cfg.version, github: cfg.github, footerLinks: cfg.footer?.links, statusText: cfg.footer?.status }
    : undefined;
  return startDevServer({
    ...merged,
    buildPlugins: loadConfiguredPlugins(merged.dir),
    // THEME-002 + VIS-001：主题包（css + defaultTheme 默认模式）
    themeCss: theme.css,
    defaultTheme: theme.defaultTheme,
    pluginFiles: configuredPluginWatchFiles(merged.dir),
    reloadPlugins: () => reloadConfiguredPluginsAsync(merged.dir),
    pluginConfigs: cfg.plugins,
    chrome,
  });
}

/** 执行 SSG 构建（供命令与测试复用） */
export function runBuild(options: Partial<CliOptions> = {}): ReturnType<typeof buildSite> {
  const dir = options.dir ?? "docs";
  // PLUG-014：doclight.json 插件配置注入页面（与 buildPlugins 同源 loadConfig）
  const cfg = loadConfig([join(process.cwd(), "doclight.json"), join(resolve(dir), "doclight.json")]);
  return buildSite({
    dir: options.dir,
    outDir: options.outDir,
    title: options.title,
    base: options.base,
    siteUrl: options.siteUrl,
    description: options.description,
    author: options.author,
    // PLUG-009 接线：doclight.json plugins → 构建管线
    buildPlugins: loadConfiguredPlugins(dir),
    pluginConfigs: cfg.plugins,
    // 设计对齐（2026-08-16）：站点镀铬（顶栏版本/GitHub、footer 链接与状态）
    chrome: cfg.version || cfg.github || cfg.footer
      ? { version: cfg.version, github: cfg.github, footerLinks: cfg.footer?.links, statusText: cfg.footer?.status }
      : undefined,
    // VIS-001：--themes 构建主题画廊（产物 gallery/）
    themes: options.themes,
  });
}

/** 启动 preview 服务器（供命令与测试复用）。--themes：先构建主题画廊再预览（11 §4）。 */
export async function runPreview(
  options: Partial<CliOptions> = {}
): Promise<{ url: string; port: number; close(): Promise<void> }> {
  if (options.themes) {
    // 画廊预览 = 构建（含 gallery/）→ 静态服务产物（与 build --themes 同一产物）
    runBuild({ ...options, outDir: options.outDir ?? "dist-site" });
  }
  return startPreviewServer({ dir: options.dir ?? "dist-site", port: options.port ?? 3000, base: options.base });
}

/** 执行 bundle 构建（供命令与测试复用） */
export function runBundle(options: Partial<CliOptions> = {}): ReturnType<typeof bundleSite> {
  const dir = options.dir ?? "docs";
  // PLUG-014：bundle 形态同样注入插件运行时配置
  const cfg = loadConfig([join(process.cwd(), "doclight.json"), join(resolve(dir), "doclight.json")]);
  return bundleSite({
    dir: options.dir,
    outDir: options.outDir,
    title: options.title,
    qrUrl: options.qrUrl,
    inlineVendor: options.inlineVendor,
    // PLUG-009 接线：doclight.json plugins → 构建管线（bundle 形态补齐）
    buildPlugins: loadConfiguredPlugins(dir),
    pluginConfigs: cfg.plugins,
    // 设计对齐（2026-08-16）：站点镀铬（顶栏版本/GitHub、footer 链接与状态）
    chrome: cfg.version || cfg.github || cfg.footer
      ? { version: cfg.version, github: cfg.github, footerLinks: cfg.footer?.links, statusText: cfg.footer?.status }
      : undefined,
  });
}

/** 执行嵌入分发（供命令与测试复用） */
export function runEmbed(options: Partial<CliOptions> = {}): ReturnType<typeof embedSite> {
  return embedSite({ dir: options.dir, outDir: options.outDir, title: options.title, siteUrl: options.siteUrl });
}

/** 执行演示构建（DEMO-001）：markdown `---` 分页 → 自包含单页 HTML（与 bundle 同哲学） */
export function runSlides(options: { file: string; outDir?: string; title?: string; theme?: string; author?: string }): {
  file: string;
  bytes: number;
  pages: number;
} {
  const source = readFileSync(resolve(options.file), "utf8");
  const deck = parseSlides(source, options.title);
  const html = buildSlidesHtml(source, { title: options.title, theme: options.theme, author: options.author });
  const name = options.file.replace(/\\/g, "/").split("/").pop()!.replace(/\.md$/i, "") || "slides";
  const outDir = resolve(options.outDir ?? "dist-slides");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${name}.html`);
  writeFileSync(out, html, "utf8");
  return { file: out, bytes: Buffer.byteLength(html, "utf8"), pages: deck.pages.length };
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
// 入口判定（2026-08 修复）：npm link / pnpm link 全局安装后，process.argv[1] 是
// 全局 bin 目录里的符号链接/Junction 路径，而 import.meta.url 是 ESM realpath 解析
// 后的真实路径——两者不相等导致 CLI 静默退出（无输出、exit 0）。用 realpathSync
// 规范化 argv[1] 后再比较，链接安装与直接运行都能命中入口。
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
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
      // 保持进程存活（HTTP 服务器监听但 ESM 模块结束后事件循环可能提前退出）
      await new Promise(() => {});
    } else if (command === "build") {
      const result = runBuild({
        dir: opts["dir"],
        outDir: opts["out-dir"],
        title: opts["title"],
        base: opts["base"],
        siteUrl: opts["site-url"],
        description: opts["description"],
        author: opts["author"],
        themes: opts["themes"] === "true",
      });
      console.log(`\n  DocLight 静态构建完成 ✓\n`);
      console.log(`  页面: ${result.pages} 篇 + ${result.assets} 个静态资源`);
      console.log(`  输出: ${result.outDir}（${(result.bytes / 1024).toFixed(1)} KB，${result.ms}ms）`);
      if (opts["site-url"]) console.log(`  SEO: sitemap.xml + robots.txt + OG 卡片 + canonical 已生成`);
      if (opts["themes"] === "true") console.log(`  画廊: ${result.outDir}/gallery/（4 套设计语言 × 亮暗，11 §4）`);
      console.log(`  预览: doclight preview${opts["base"] ? ` --base ${opts["base"]}` : ""}\n`);
    } else if (command === "preview") {
      const preview = await runPreview({
        port: numOption(opts, "port", 3000),
        dir: opts["dir"],
        base: opts["base"],
        themes: opts["themes"] === "true",
      });
      console.log(`\n  DocLight preview 已启动\n`);
      console.log(`  本地预览:  ${preview.url}`);
      console.log(`  产物目录:  ${opts["dir"] ?? "dist-site"}`);
      if (opts["themes"] === "true") console.log(`  主题画廊:  ${preview.url}gallery/（11 §4）`);
      console.log(`  按 Ctrl+C 停止\n`);
      // 2026-08 修复：保持进程存活（HTTP 服务器监听但 ESM 模块结束后事件循环可能提前退出）
      await new Promise(() => {});
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
      if (opts["inline-vendor"] === "true") console.log(`  扩展: 已内联 Prism/KaTeX + 启用插件 vendor（file:// 离线可用）`);
      console.log(`  分发: 双击文件或传给任何人，file:// 离线可用\n`);
    } else if (command === "migrate-docsify") {
      const result = migrateDocsify({ sourceDir: opts["dir"] ?? "docsify-site", destDir: process.cwd() });
      console.log(`\n  docsify → DocLight 迁移完成 ✓\n`);
      console.log(`  复制: ${result.copied.length} 篇 Markdown → ${result.destDocs}`);
      if (result.sidebar.length) console.log(`  _sidebar 导航: ${result.sidebar.length} 项（DocLight 自动导航替代）`);
      if (result.skipped.length) console.log(`  跳过（docsify 专属）: ${result.skipped.join(", ")}`);
      console.log(`\n  下一步: doclight dev / doclight build\n`);
    } else if (command === "migrate-mkdocs" || command === "migrate-gitbook") {
      const sourceDir = opts["dir"] ?? (command === "migrate-mkdocs" ? "mkdocs-site" : "gitbook-site");
      const result = command === "migrate-mkdocs" ? migrateMkDocs({ sourceDir, destDir: process.cwd() }) : migrateGitBook({ sourceDir, destDir: process.cwd() });
      const from = command === "migrate-mkdocs" ? "MkDocs" : "GitBook";
      console.log(`\n  ${from} → DocLight 迁移完成 ✓\n`);
      console.log(`  复制: ${result.copied.length} 篇 Markdown → ${result.destDocs}`);
      if (result.sidebar.length) console.log(`  ${command === "migrate-mkdocs" ? "mkdocs.yml nav" : "SUMMARY.md"} 导航: ${result.sidebar.length} 项（DocLight 自动导航替代）`);
      if (result.skipped.length) console.log(`  跳过: ${result.skipped.join(", ")}`);
      for (const n of result.notes) console.log(`  备注: ${n}`);
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
      // WORK-001 确认门：TTY 交互模式发布前 y/N 确认（--yes 跳过）；非 TTY（Agent/CI 自动化）直行——
      // 自动化场景的「先确认」由 doclight-publish Skill 流程保证（对外动作先问人）
      const interactive = opts["yes"] !== "true" && !opts["json"] && process.stdin.isTTY;
      if (interactive) {
        const target = opts["to"] ?? "默认空间";
        const answer = await readLine(`确认发布到 ${target}？（y/N）`);
        if (!/^y(es)?$/i.test(answer.trim())) {
          console.log(`\n  已取消发布（预览：doclight publish --preview）\n`);
        } else {
          await doPublish(opts);
        }
      } else if (opts["preview"] === "true") {
        // WORK-001 预览态：--preview = 构建 + 预览服务，不发布（Agent 写入先进预览态，人确认后再正式发布）
        const outDir = opts["out-dir"] ?? "dist-site";
        runBuild({ dir: opts["dir"], outDir, title: opts["title"] });
        const preview = await startPreviewServer({ dir: outDir, port: numOption(opts, "port", 3000), base: opts["base"] });
        const payload = { ok: true, mode: "preview", url: preview.url, gallery: opts["themes"] === "true" ? `${preview.url}gallery/` : undefined, steps: ["预览态（未发布）：确认无误后运行 doclight publish 正式发布；发布前将自动快照"] };
        if (opts["json"] === "true") {
          console.log(JSON.stringify(payload, null, 2));
        } else {
          console.log(`\n  DocLight 预览态已启动（未发布）\n`);
          console.log(`  预览:  ${preview.url}`);
          if (payload.gallery) console.log(`  画廊:  ${payload.gallery}`);
          console.log(`  正式发布: doclight publish${opts["to"] ? ` --to ${opts["to"]}` : ""}\n`);
        }
      } else {
        await doPublish(opts);
      }
    } else if (command === "rollback") {
      // WORK-001：版本回滚（publish 前自动快照 → 此处恢复内容源）
      const id = rest[0] ?? opts["id"];
      const root = opts["root"] ?? ".";
      if (opts["list"] === "true" || !id) {
        const snaps = listSnapshots(root);
        if (opts["json"] === "true") {
          console.log(JSON.stringify({ snapshots: snaps }, null, 2));
        } else if (snaps.length === 0) {
          console.log(`\n  暂无快照（publish 前自动产生，见 .doclight/snapshots/）\n`);
        } else {
          console.log(`\n  DocLight 内容快照（新 → 旧）\n`);
          for (const s of snaps) console.log(`   ${s.id}  ${s.createdAt.slice(0, 19).replace("T", " ")}  ${s.files} 文件  ${(s.bytes / 1024).toFixed(1)} KB  [${s.root}]`);
          console.log(`\n  回滚: doclight rollback <id>\n`);
        }
      } else {
        const result = rollbackSnapshot(root, id, opts["dir"] ?? "docs");
        if (opts["json"] === "true") {
          console.log(JSON.stringify(result, null, 2));
        } else if (result.ok) {
          console.log(`\n  DocLight 已回滚到快照 ${id} ✓\n`);
          console.log(`  恢复: ${result.restored.length} 个文件`);
          console.log(`  预览: doclight dev / doclight publish --preview\n`);
        } else {
          console.error(`✗ ${result.error}`);
          process.exitCode = 1;
        }
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
    } else if (command === "slides") {
      // DEMO-001：markdown `---` 分页 → 自包含单页 HTML 演示（与文档同源不同形）
      const file = rest[0] ?? opts["file"];
      if (!file) {
        console.error(`✗ slides 需要演示源文件（用法: doclight slides <file.md> [--theme dark|light|warm] [--out-dir <p>]）`);
        process.exit(1);
      }
      const result = runSlides({ file, outDir: opts["out-dir"], title: opts["title"], theme: opts["theme"], author: opts["author"] });
      console.log(`\n  DocLight 演示已生成 ✓（${result.pages} 页）\n`);
      console.log(`  产物: ${result.file}（${(result.bytes / 1024).toFixed(1)} KB，自包含单文件）`);
      console.log(`  打开: 双击文件（file:// 离线可用）或 doclight preview --dir dist-slides`);
      console.log(`  导航: ← → 翻页 · F 全屏 · S 演讲者备注 · #N 直达第 N 页\n`);
    } else if (command === "plugin") {
      const sub = rest[0] ?? "";
      if (sub === "new") {
        const name = rest[1];
        if (!name) {
          console.error(`✗ plugin new 需要插件名（用法: doclight plugin new <name> [--dir <path>]）`);
          process.exit(1);
        }
        const result = pluginNew(name, { dir: opts["dir"] });
        console.log(`\n  DocLight 插件已生成 ✓（${result.dir}）\n`);
        for (const f of result.created) console.log(`  创建  ${f}`);
        for (const f of result.skipped) console.log(`  跳过  ${f}（已存在）`);
        console.log(`\n  下一步:`);
        for (const s of result.nextSteps) console.log(`  ${s}`);
        console.log("");
      } else if (sub === "list") {
        console.log(`\n  内置官方插件（doclight.json plugins 数组直接按名使用）:\n`);
        for (const p of pluginList()) console.log(`  ${p.name.padEnd(12)}${p.description}`);
        console.log(`\n  自研插件: doclight plugin new <name> 生成脚手架\n`);
      } else {
        console.error(`未知 plugin 子命令：${sub || "(空)"}（支持 new / list）`);
        process.exit(1);
      }
    } else {
      console.error(`未知命令：${command ?? "(空)"}（支持 dev / build / preview / init / bundle / deploy / migrate-docsify / migrate-mkdocs / migrate-gitbook / publish / rollback / space / embed / slides / plugin）`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`✗ ${command}: ${(err as Error).message}`);
    process.exit(1);
  }
}
