// 展示层构建（02 §2.3.4）
// esbuild 真实打包 src/index.ts → 单文件 dist/display.js，并做 gzip 度量。
//
// 2026-08 review P0-5 重写：原「逐文件转译 + 剥离相对 import + 拼接 + minify」在
// display 引入跨包纯函数（core/src/utils escapeHtml）后剥离即断链（search 高亮
// ReferenceError → e2e 搜索 0 结果）；与 build-renderer 同因同修——esbuild bundler
// 解析模块依赖与跨包源码，拼接范式的求值顺序/export-from 缺陷一并消除。
// 展示层零外部运行时依赖（gzip < 25KB 硬门禁不变，ADR-0002）。
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { build as esbuild } from "esbuild";
import { pathToFileURL } from "node:url";

const DISPLAY_SRC = join(process.cwd(), "packages", "display", "src");
const DIST_DIR = join(process.cwd(), "dist");

/** 构建展示层，返回体积度量 */
export async function buildDisplay() {
  const result = await esbuild({
    entryPoints: [join(DISPLAY_SRC, "index.ts")],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    minify: true,
    legalComments: "none",
    logLevel: "silent",
    write: false,
    metafile: false,
  });
  const minified = result.outputFiles[0].text;

  mkdirSync(DIST_DIR, { recursive: true });
  writeFileSync(join(DIST_DIR, "display.js"), minified, "utf8");

  const gz = gzipSync(Buffer.from(minified, "utf8"));
  return {
    file: "dist/display.js",
    rawBytes: Buffer.byteLength(minified, "utf8"),
    gzipBytes: gz.byteLength,
    sourceFiles: 1, // esbuild bundler：入口单文件
  };
}

// 直接运行：node scripts/build-display.mjs
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const m = await buildDisplay();
    console.log(`✓ build-display — ${m.file} (raw ${m.rawBytes}B / gzip ${m.gzipBytes}B)`);
  } catch (err) {
    console.error(`✗ build-display — ${err.message}`);
    process.exit(1);
  }
}
