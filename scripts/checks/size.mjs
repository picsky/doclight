// size check（00-README 关键数字 + 10 §2.4 性能预算，硬门禁）
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { mkResult } from "../lib/report.mjs";

const BUDGETS = [
  { id: "display", file: "dist/display.js", budget: 25 * 1024, title: "展示层 < 25KB gzip" },
  // Node 渲染内核 < 20KB：Phase 1 产出真实内核产物后启用
  // { id: "renderer", file: "dist/renderer.js", budget: 20 * 1024, title: "Node 内核 < 20KB gzip" },
];

export function run() {
  const failures = [];
  for (const b of BUDGETS) {
    let gz;
    try {
      gz = gzipSync(readFileSync(b.file)).byteLength;
    } catch (err) {
      failures.push({ id: b.id, message: `无法读取 ${b.file}（先运行 npm run build）：${err.message}` });
      continue;
    }
    if (gz >= b.budget) {
      failures.push({ id: b.id, message: `${b.file} gzip ${gz}B 超出预算 ${b.budget}B`, evidence: b.title });
    }
  }
  return mkResult("size", "体积预算门禁", BUDGETS.length, failures);
}
