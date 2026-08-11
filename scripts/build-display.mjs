// 展示层构建管线（02 §2.3.4：原生 Node.js，不引入 Vite/Rollup/esbuild）
// Phase 0 占位：tsc 转译 TS → ESM JS，单入口拼接 → dist/display.js，并做 gzip 度量
// Phase 1 演进：多模块合并、CSS 合并、主题内联、manifest 生成
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import ts from "typescript";

const DISPLAY_SRC = join(process.cwd(), "packages", "display", "src");
const DIST_DIR = join(process.cwd(), "dist");

function transpileToJs(filePath, source) {
  const out = ts.transpileModule(source, {
    fileName: filePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      sourceMap: false,
    },
  });
  return out.outputText;
}

/** 构建展示层，返回体积度量 */
export function buildDisplay() {
  const files = readdirSync(DISPLAY_SRC).filter((f) => f.endsWith(".ts")).sort();
  if (files.length === 0) {
    throw new Error(`展示层源码目录为空：${DISPLAY_SRC}`);
  }

  // Phase 0 占位：单入口直接拼接转译结果（Phase 1 实现多模块与依赖解析）
  const bundle = files.map((f) => transpileToJs(join(DISPLAY_SRC, f), readFileSync(join(DISPLAY_SRC, f), "utf8"))).join("\n");

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
