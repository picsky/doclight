/**
 * 视觉回归（VIS-001，11-default-themes §6.1；DP-001 单主题收敛：1 模板 × 亮暗 × 3 断点共 6 组截图）
 *
 * 独立于 verify 的像素级门禁（verify 的 visual check 只做静态设计合规 + 画廊产物）：
 * - 基线缺失时：npm run verify:visual:update 生成基线（首次由人确认后锁定——11 §6.2）
 * - 之后每次 npm run verify:visual 与基线 diff（maxDiffPixelRatio 0.01）
 *
 * 只跑 chromium：跨浏览器字体/渲染差异会污染基线；三形态同构已由 SNAP-001 覆盖。
 * 画廊产物由 visual check（verify）构建到 artifacts/visual/gallery/；缺失时跳过并提示。
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const GALLERY = join(process.cwd(), "artifacts", "visual", "gallery");
/** DEMO-001：演示产物（visual check 构建；自包含单文件，file:// 直开） */
const SLIDES_DEMO = join(process.cwd(), "artifacts", "visual", "slides-demo.html");
const THEMES = ["minimal"];
const MODES = ["light", "dark"] as const;
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
];

test.describe.configure({ retries: 0 });
test.skip(({ browserName }) => browserName !== "chromium", "视觉回归只跑 chromium（字体渲染确定性）");

let server: ReturnType<typeof createServer> | null = null;
let baseUrl = "";

test.beforeAll(async () => {
  // 门禁加固（P1-2）：产物缺失必须显式失败（beforeAll throw → 全部用例失败），
  // 不允许 test.skip 静默跳过——0 像素被比较 = 假绿
  if (!existsSync(join(GALLERY, "index.html"))) {
    throw new Error(
      "画廊产物缺失（artifacts/visual/gallery/）：请先运行 npm run verify（visual check 会构建画廊），或直接运行 npm run verify:visual（已内置前置构建）"
    );
  }
  if (!existsSync(SLIDES_DEMO)) {
    throw new Error(
      "演示产物缺失（artifacts/visual/slides-demo.html）：请先运行 npm run verify（visual check 会构建演示）"
    );
  }
  server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? "/").split("?")[0]!.replace(/^\/+/, ""));
    const file = join(GALLERY, rel === "" ? "index.html" : rel);
    try {
      const stat = statSync(file);
      if (!stat.isFile()) throw new Error("not a file");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
    }
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

for (const theme of THEMES) {
  for (const mode of MODES) {
    for (const vp of VIEWPORTS) {
      test(`画廊 ${theme} ${mode} ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}${theme}/${mode}/index.html`, { waitUntil: "networkidle" });
        // 2026-08-16 设计对齐：默认模板加载 Google Fonts（Inter 等）——字体交换完成前截图
        // 会捕获到 reflow 中间态（两次运行字体加载时机不同 → 基线抖动）。等待字体就绪再拍。
        await page.evaluate(() => document.fonts?.ready);
        // 面板内无异步渲染（KaTeX/Mermaid 为静态降级源），直接整页截图
        await expect(page).toHaveScreenshot(`gallery-${theme}-${mode}-${vp.name}.png`, {
          maxDiffPixelRatio: 0.01,
          animations: "disabled",
        });
      });
    }
  }
}

/* DEMO-001：演示形态截图回归（自包含单文件，file:// 直开——正是分发形态） */
test("演示 dark 封面页", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`file://${SLIDES_DEMO.split("\\").join("/")}`, { waitUntil: "load" });
  await expect(page).toHaveScreenshot("slides-dark-cover.png", { maxDiffPixelRatio: 0.01, animations: "disabled" });
});

test("演示 dark 内容页（#3 直达）", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`file://${SLIDES_DEMO.split("\\").join("/")}#3`, { waitUntil: "load" });
  await expect(page).toHaveScreenshot("slides-dark-content.png", { maxDiffPixelRatio: 0.01, animations: "disabled" });
});
