// typecheck check（12 §1.6：类型零 error）
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkResult } from "../lib/report.mjs";

const require = createRequire(import.meta.url);
const tscPath = require.resolve("typescript/bin/tsc");

export function run() {
  const r = spawnSync(process.execPath, [tscPath, "-p", "tsconfig.json", "--noEmit"], {
    encoding: "utf8",
    timeout: 120_000,
  });
  const failures = [];
  if (r.status !== 0) {
    const lines = `${r.stdout ?? ""}${r.stderr ?? ""}`.split(/\r?\n/).filter(Boolean);
    failures.push({
      id: "tsc",
      message: `TypeScript 检查失败（${lines.length} 行输出）`,
      evidence: lines.slice(0, 20).join("\n"),
    });
  }
  return mkResult("typecheck", "TypeScript 严格模式零 error", 1, failures);
}
