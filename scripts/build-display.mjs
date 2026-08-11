// 展示层构建（02 §2.3.4：原生 Node.js，不引入 Vite/Rollup/esbuild）
// 递归转译 src/**/*.ts → 单文件 dist/display.js，并做 gzip 度量。
//
// 与 build-renderer 同策略：内部相对 import 剥离后单文件拼接（模块并入同一
// 作用域，顶层导出名直接可见）；展示层零外部依赖，无裸包名需解析。
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import ts from "typescript";

const DISPLAY_SRC = join(process.cwd(), "packages", "display", "src");
const DIST_DIR = join(process.cwd(), "dist");

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

/** 剥离内部相对 import（./ 或 ../）；展示层无外部包 import */
function stripInternalImports(js) {
  return js
    .split("\n")
    .filter((line) => !/^\s*import\s.*from\s+["'](?:\.\.?\/)/.test(line))
    .join("\n");
}

/** 构建展示层，返回体积度量 */
export function buildDisplay() {
  const files = walkTs(DISPLAY_SRC).sort();
  if (files.length === 0) {
    throw new Error(`展示层源码目录为空：${DISPLAY_SRC}`);
  }

  const bundle = files.map((f) => stripInternalImports(transpileToJs(f, readFileSync(f, "utf8")))).join("\n");

  mkdirSync(DIST_DIR, { recursive: true });
  writeFileSync(join(DIST_DIR, "display.js"), bundle, "utf8");

  const gz = gzipSync(Buffer.from(bundle, "utf8"));
  return {
    file: "dist/display.js",
    rawBytes: Buffer.byteLength(bundle, "utf8"),
    gzipBytes: gz.byteLength,
    sourceFiles: files.length,
  };
}

// 直接运行：node scripts/build-display.mjs
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const m = buildDisplay();
    console.log(`✓ build-display — ${m.file} (raw ${m.rawBytes}B / gzip ${m.gzipBytes}B, ${m.sourceFiles} 个源文件)`);
  } catch (err) {
    console.error(`✗ build-display — ${err.message}`);
    process.exit(1);
  }
}
