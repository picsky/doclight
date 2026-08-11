// size check（00-README 关键数字 + 10 §2.4 性能预算，硬门禁）
// renderer 条目通过 deps 把运行依赖（marked/dompurify）的 gzip 计入内核足迹，
// 得到真实内核体积（ADR-0002：< 30KB）。jsdom 为纯服务端依赖，不计入。
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { mkResult } from "../lib/report.mjs";

const BUDGETS = [
  { id: "display", file: "dist/display.js", budget: 25 * 1024, title: "展示层 < 25KB gzip" },
  {
    id: "renderer",
    file: "packages/renderer/dist/renderer.js",
    deps: [
      "packages/renderer/node_modules/marked/lib/marked.esm.js",
      "packages/renderer/node_modules/dompurify/dist/purify.min.js",
    ],
    budget: 30 * 1024,
    title: "Node 内核 < 30KB gzip（含 marked + dompurify）",
  },
];

export function run() {
  const failures = [];
  for (const b of BUDGETS) {
    const files = [b.file, ...(b.deps ?? [])];
    let total = 0;
    let ok = true;
    for (const f of files) {
      let gz;
      try {
        gz = gzipSync(readFileSync(f)).byteLength;
      } catch (err) {
        failures.push({ id: b.id, message: `无法读取 ${f}（先运行 npm run build）：${err.message}` });
        ok = false;
        break;
      }
      total += gz;
    }
    if (!ok) continue;
    if (total >= b.budget) {
      failures.push({
        id: b.id,
        message: `${b.title} 实测 gzip 合计 ${total}B 超出预算 ${b.budget}B`,
        evidence: files.join("\n"),
      });
    }
  }
  return mkResult("size", "体积预算门禁", BUDGETS.length, failures);
}
