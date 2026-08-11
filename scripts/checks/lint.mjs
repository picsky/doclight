// lint check（12 §1.1：零 error 才可提交）
import { ESLint } from "eslint";
import { mkResult } from "../lib/report.mjs";

export async function run() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(["packages", "scripts", "eslint.config.js"]);
  const failures = [];
  for (const r of results) {
    if (r.errorCount === 0) continue;
    for (const m of r.messages) {
      if (m.severity !== 2) continue;
      failures.push({
        id: `${r.filePath}:${m.line}:${m.column}`,
        message: `${m.message}（${m.ruleId ?? "syntax"}）`,
      });
    }
  }
  return mkResult("lint", "ESLint 零 error", results.length, failures);
}
