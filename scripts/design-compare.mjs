/**
 * 1:1 对照截图（DESIGN-ALIGNMENT 验证）：
 * 1. 用 CLI 构建一个复刻演示页结构的临时站点（tabs/steps/代码文件名头/提示块/表格/目录）
 * 2. 截图：演示页 index.html（亮/暗）+ DocLight 渲染页（亮/暗）+ 移动端
 * 产物写入 artifacts/design-compare/*.png，供人工像素核对。
 */
/* global localStorage */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const OUT = join(process.cwd(), "artifacts", "design-compare");
mkdirSync(OUT, { recursive: true });

const DEMO_HTML = join(process.cwd(), "docs", "design-new", "index.html");
const CLI = join(process.cwd(), "packages", "cli", "dist", "cli.mjs");
if (!existsSync(CLI)) {
  console.error("缺少 packages/cli/dist/cli.mjs——先运行 npm run build");
  process.exit(1);
}

// —— 复刻演示页结构的临时站点 ——
const docsDir = mkdtempSync(join(tmpdir(), "doclight-design-"));
mkdirSync(join(docsDir, "guide"), { recursive: true });
mkdirSync(join(docsDir, "core"), { recursive: true });
mkdirSync(join(docsDir, "api"), { recursive: true });
mkdirSync(join(docsDir, "examples"), { recursive: true });

writeFileSync(
  join(docsDir, "README.md"),
  [
    "---",
    "title: 快速开始",
    "description: Aster 是一个为长期运行而设计的分布式任务队列。本指南将带你在五分钟内完成安装、初始化客户端，并成功入队你的第一个后台任务。",
    "date: 2026-08-12",
    "---",
    "",
    "# 快速开始",
    "",
    "Aster 的设计哲学是**「基础设施应当隐形」**：你不需要管理 broker、不需要编写轮询逻辑，只需要定义任务、入队任务，剩下的交给运行时。它可以在三行代码内接入任何 Node.js 或边缘运行时项目。",
    "",
    ":::tip",
    "**自托管用户：** 如果你运行自己的 Aster 集群，请在初始化时将 `endpoint` 指向你的集群地址。云端用户可以跳过该项，SDK 会自动选择最近的区域。",
    ":::",
    "",
    "## 安装",
    "",
    "使用你偏好的包管理器安装 SDK。Aster 支持 Node.js 18+ 以及所有主流边缘运行时。",
    "",
    ":::tabs",
    ":::tab npm",
    "```bash",
    "npm install @aster/sdk",
    "```",
    ":::",
    ":::tab pnpm",
    "```bash",
    "pnpm add @aster/sdk",
    "```",
    ":::",
    ":::tab yarn",
    "```bash",
    "yarn add @aster/sdk",
    "```",
    ":::",
    ":::",
    "",
    "## 初始化客户端",
    "",
    "创建一个客户端实例。我们建议将其放在单独的模块中，以便在整个应用中复用同一个连接。令牌请通过环境变量注入，**切勿提交到代码仓库**。",
    "",
    "```ts title=\"lib/aster.ts\"",
    "import { Aster } from \"@aster/sdk\";",
    "",
    "export const aster = new Aster({",
    "  endpoint: \"https://api.aster.dev\",",
    "  token: process.env.ASTER_TOKEN,",
    "  timeout: 10_000,",
    "});",
    "```",
    "",
    "## 创建你的第一个任务",
    "",
    "一个任务的生命周期只有三步：定义处理函数、启动 Worker、入队。任务一旦入队，Aster 保证它**至少被执行一次**，并自动处理重试与失败上报。",
    "",
    ":::steps",
    "1. **定义任务处理函数**：处理函数是一个普通的异步函数，接收类型安全的载荷。",
    "2. **启动 Worker**：Worker 可以在你的应用进程内运行，也可以作为独立服务部署。",
    "3. **入队任务**：在业务代码中调用 `enqueue`。下面的例子会在五分钟后触发一封欢迎邮件，失败时最多重试三次。",
    ":::",
    "",
    "## 配置选项",
    "",
    "客户端的全部配置项如下。所有选项都有合理的默认值，大多数项目只需要提供 `token`。",
    "",
    "| 选项 | 类型 | 默认值 | 说明 |",
    "|---|---|---|---|",
    "| token | string | — | API 令牌，必填。建议使用环境变量注入。 |",
    "| endpoint | string | api.aster.dev | 集群地址，自托管时指向你的部署。 |",
    "| timeout | number | 10000 | 单次请求超时时间，单位毫秒。 |",
    "| maxRetries | number | 3 | 网络层失败时的自动重试次数。 |",
    "| region | string | auto | 首选区域，auto 表示按延迟自动选择。 |",
    "",
  ].join("\n")
);
writeFileSync(join(docsDir, "guide", "install.md"), "---\ntitle: 安装与配置\n---\n\n# 安装与配置\n\n安装与配置内容。");
writeFileSync(join(docsDir, "guide", "auth.md"), "---\ntitle: 身份验证\n---\n\n# 身份验证\n\n身份验证内容。");
writeFileSync(join(docsDir, "core", "tasks.md"), "---\ntitle: 任务与队列\n---\n\n# 任务与队列\n\n任务与队列内容。");
writeFileSync(join(docsDir, "api", "client.md"), "---\ntitle: 客户端\n---\n\n# 客户端\n\n客户端内容。");
writeFileSync(join(docsDir, "examples", "repo.md"), "---\ntitle: 示例仓库\n---\n\n# 示例仓库\n\n示例仓库内容。");

writeFileSync(
  join(docsDir, "doclight.json"),
  JSON.stringify({ title: "Aster", version: "2.4", github: "https://github.com/aster-labs/aster" }, null, 2)
);

const outDir = join(OUT, "site");
const r = spawnSync(process.execPath, [CLI, "build", "--dir", docsDir, "--out-dir", outDir, "--title", "Aster"], {
  encoding: "utf8",
  timeout: 120_000,
});
if (r.status !== 0) {
  console.error(`CLI 构建失败（退出码 ${r.status}）`, (r.stdout || r.stderr || "").slice(-800));
  process.exit(1);
}
console.log(`站点构建完成 → ${outDir}`);

// —— 截图 ——
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const SERVE = `file://${DEMO_HTML}`;
const SITE = `file://${join(outDir, "index.html")}`;

async function shot(url, name) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
}

// 亮色
await shot(SERVE, "demo-light");
await shot(SITE, "doclight-light");
// 暗色（localStorage 预设）
await page.evaluate(() => localStorage.setItem("doclight-theme", "dark"));
await shot(SITE, "doclight-dark");
await page.goto(SERVE, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("aster-theme", "dark"));
await shot(SERVE, "demo-dark");
// 移动端
const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mobile.goto(SITE, { waitUntil: "networkidle" });
await mobile.waitForTimeout(800);
await mobile.screenshot({ path: join(OUT, "doclight-mobile.png"), fullPage: true });
await mobile.close();

await browser.close();
console.log(`截图完成 → ${OUT}`);
rmSync(docsDir, { recursive: true, force: true });
