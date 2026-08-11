// 构建入口：编排各产物构建
// Phase 1 已产出：展示层（display）+ Node 渲染内核（renderer）
// 后续演进：dev / SSG / bundle 三形态构建（02 §2.2）
import { buildDisplay } from "./build-display.mjs";
import { buildRenderer } from "./build-renderer.mjs";

export function runBuild() {
  const display = buildDisplay();
  const renderer = buildRenderer();
  const manifest = { display, renderer };
  return manifest;
}

// 直接运行：node scripts/build.mjs
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const manifest = runBuild();
    console.log(
      `✓ build — ${manifest.display.file} (gzip ${manifest.display.gzipBytes}B) + ${manifest.renderer.file} (gzip ${manifest.renderer.gzipBytes}B)`
    );
  } catch (err) {
    console.error(`✗ build — ${err.message}`);
    process.exit(1);
  }
}
