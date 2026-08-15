// 构建入口：编排各产物构建
// Phase 1 已产出：展示层（display）+ Node 渲染内核（renderer）
// CLI 自带展示层 bundle（packages/cli/dist/display.js）：任意 cwd 的 doclight build/bundle/dev 可用
// OSS-001 遗留落地（2026-08 前端审查 P0-3）：CLI 自包含单文件 packages/cli/dist/cli.mjs（esbuild）
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildDisplay } from "./build-display.mjs";
import { buildRenderer } from "./build-renderer.mjs";
import { buildCli } from "./build-cli.mjs";

export async function runBuild() {
  const display = buildDisplay();
  const renderer = buildRenderer();
  // 拷贝展示层 bundle 进 cli 包（site.ts displayBundlePath 优先于此定位）
  const cliDist = join(process.cwd(), "packages", "cli", "dist");
  mkdirSync(cliDist, { recursive: true });
  copyFileSync(join(process.cwd(), "dist", "display.js"), join(cliDist, "display.js"));
  // CLI 自包含产物（Node ≥20 可直接 node packages/cli/dist/cli.mjs）
  await buildCli();
  const manifest = { display, renderer, cliBundle: "packages/cli/dist/cli.mjs" };
  return manifest;
}

// 直接运行：node scripts/build.mjs
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const manifest = await runBuild();
    console.log(
      `✓ build — ${manifest.display.file} (gzip ${manifest.display.gzipBytes}B) + ${manifest.renderer.file} (gzip ${manifest.renderer.gzipBytes}B) + ${manifest.cliBundle}`
    );
  } catch (err) {
    console.error(`✗ build — ${err.message}`);
    process.exit(1);
  }
}
