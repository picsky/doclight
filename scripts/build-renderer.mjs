// Node 渲染内核构建（02 §2.3.4）
// esbuild 真实打包 src/index.ts → 单文件 packages/renderer/dist/renderer.js，并做 gzip 度量。
//
// 2026-08 review P0-5 重写：原「TS 逐文件转译 + 剥离相对 import + 拼接」方案存在两类
// 无法在拼接范式内根治的缺陷（standalone 加载即崩，此前无 check 独立加载产物故未暴露）：
// 1. export-from 相对语句残留（index.ts re-export registry）→ 断链/重复导出
// 2. 拼接顺序 ≠ 模块依赖求值顺序（registry 引用 tabs 的顶层 const）→ TDZ
// esbuild bundler 一并解决，并与 build-cli（esbuild）同栈；display 亦经 esbuild minify。
//
// 说明：
// - 运行依赖（marked / dompurify / jsdom）**不打包进产物**（external，保留裸包名 import），
//   运行时经 renderer 包级 node_modules 解析（jsdom 是纯服务端依赖，绝不该进 bundle）。
//   体积门禁在 size.mjs 中单独度量 marked + dompurify，得到真实内核足迹。
// - 产物放包内 dist/ 而非根 dist/：裸包名依赖在包内才能解析（根 node_modules 无这些包）。
// - core 共享纯函数（escapeHtml，P0-5）经相对路径 import 一并打包（esbuild 解析跨包源码）。
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { build as esbuild } from "esbuild";
import { pathToFileURL } from "node:url";

const RENDERER_SRC = join(process.cwd(), "packages", "renderer", "src");
const DIST_DIR = join(process.cwd(), "packages", "renderer", "dist");
/** 运行时外部依赖（裸包名保留，不进 bundle） */
const EXTERNAL = ["marked", "dompurify", "jsdom"];

/** 构建渲染内核，返回体积度量 */
export async function buildRenderer() {
  const result = await esbuild({
    entryPoints: [join(RENDERER_SRC, "index.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "es2020",
    external: EXTERNAL,
    // 与 display（Phase 4.6）同策略：构建工具链压缩，运行时零依赖不变。
    // 30KB gzip 门禁覆盖 marked+dompurify+内核，minify 保证内核足迹诚实可控。
    minify: true,
    legalComments: "none",
    logLevel: "silent",
    write: false,
    metafile: false,
  });
  const bundle = result.outputFiles[0].text;

  mkdirSync(DIST_DIR, { recursive: true });
  writeFileSync(join(DIST_DIR, "renderer.js"), bundle, "utf8");

  const gz = gzipSync(Buffer.from(bundle, "utf8"));
  return {
    file: "packages/renderer/dist/renderer.js",
    rawBytes: Buffer.byteLength(bundle, "utf8"),
    gzipBytes: gz.byteLength,
    sourceFiles: 1, // esbuild bundler：入口单文件（内部模块数不再逐文件统计）
  };
}

// 直接运行：node scripts/build-renderer.mjs
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const m = await buildRenderer();
    console.log(`✓ build-renderer — ${m.file} (raw ${m.rawBytes}B / gzip ${m.gzipBytes}B)`);
  } catch (err) {
    console.error(`✗ build-renderer — ${err.message}`);
    process.exit(1);
  }
}
