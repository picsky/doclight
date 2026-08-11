// Node 渲染内核构建（02 §2.3.4：原生 Node.js，不引入 Vite/Rollup/esbuild）
// 递归转译 src/**/*.ts → 单文件 packages/renderer/dist/renderer.js，并做 gzip 度量。
//
// 说明：
// - 运行依赖（marked / dompurify / jsdom）**不打包进产物**，保留裸包名 import，
//   运行时经 renderer 包级 node_modules 解析（jsdom 是纯服务端依赖，绝不该进 bundle）。
//   体积门禁在 size.mjs 中单独度量 marked + dompurify，得到真实内核足迹。
// - 产物放包内 dist/ 而非根 dist/：裸包名依赖在包内才能解析（根 node_modules 无这些包）。
// - 内部相对 import（./core/xxx.js）在拼接时剥离——各模块并入同一文件后，
//   顶层导出名在同一模块作用域内直接可见。
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import ts from "typescript";

const RENDERER_SRC = join(process.cwd(), "packages", "renderer", "src");
const DIST_DIR = join(process.cwd(), "packages", "renderer", "dist");

/** 递归收集 .ts 文件（含子目录） */
function walkTs(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkTs(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

function transpileToJs(filePath, source) {
  return ts.transpileModule(source, {
    fileName: filePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      sourceMap: false,
      isolatedModules: true,
    },
  }).outputText;
}

/** 剥离内部相对 import（./ 或 ../），保留外部包 import（marked/dompurify/jsdom） */
function stripInternalImports(js) {
  return js
    .split("\n")
    .filter((line) => !/^\s*import\s.*from\s+["'](?:\.\.?\/)/.test(line))
    .join("\n");
}

/** 构建渲染内核，返回体积度量 */
export function buildRenderer() {
  const files = walkTs(RENDERER_SRC).sort();
  if (files.length === 0) {
    throw new Error(`渲染内核源码目录为空：${RENDERER_SRC}`);
  }

  const bundle = files.map((f) => stripInternalImports(transpileToJs(f, readFileSync(f, "utf8")))).join("\n");

  mkdirSync(DIST_DIR, { recursive: true });
  writeFileSync(join(DIST_DIR, "renderer.js"), bundle, "utf8");

  const gz = gzipSync(Buffer.from(bundle, "utf8"));
  return {
    file: "packages/renderer/dist/renderer.js",
    rawBytes: Buffer.byteLength(bundle, "utf8"),
    gzipBytes: gz.byteLength,
    sourceFiles: files.length,
  };
}

// 直接运行：node scripts/build-renderer.mjs
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const m = buildRenderer();
    console.log(`✓ build-renderer — ${m.file} (raw ${m.rawBytes}B / gzip ${m.gzipBytes}B, ${m.sourceFiles} 个源文件)`);
  } catch (err) {
    console.error(`✗ build-renderer — ${err.message}`);
    process.exit(1);
  }
}
