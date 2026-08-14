/**
 * 视觉回归（VIS-001，11-default-themes §6.1：4 模板 × 亮暗 × 3 断点共 24 组截图）
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
const THEMES = ["minimal", "serif", "modern", "warm"];
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
        test.skip(!existsSync(join(GALLERY, "index.html")), "画廊产物缺失：先运行 npm run verify（visual check 构建）");
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}${theme}/${mode}/index.html`, { waitUntil: "networkidle" });
        // 面板内无异步渲染（KaTeX/Mermaid 为静态降级源），直接整页截图
        await expect(page).toHaveScreenshot(`gallery-${theme}-${mode}-${vp.name}.png`, {
          maxDiffPixelRatio: 0.01,
          animations: "disabled",
        });
      });
    }
  }
}
