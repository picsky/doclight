// 构建入口（Phase 0 占位）：编排各产物构建
// Phase 1 演进：dev / SSG / bundle 三形态构建（02 §2.2）
import { buildDisplay } from "./build-display.mjs";

export function runBuild() {
  const display = buildDisplay();
  const manifest = { display, builtAt: "Phase0-placeholder" };
  return manifest;
}

// 直接运行：node scripts/build.mjs
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const manifest = runBuild();
    console.log(`✓ build — ${manifest.display.file} (gzip ${manifest.display.gzipBytes}B)`);
  } catch (err) {
    console.error(`✗ build — ${err.message}`);
    process.exit(1);
  }
}
