// test check（10 §2.1：Vitest 全绿）
// 用 vitest 的 JSON reporter 产出机器可读结果（反馈层）
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mkResult } from "../lib/report.mjs";

const require = createRequire(import.meta.url);
const vitestPath = require.resolve("vitest/vitest.mjs");
const outFile = join(process.cwd(), "artifacts", "reports", "test-vitest.json");

export function run() {
  mkdirSync(join(process.cwd(), "artifacts", "reports"), { recursive: true });
  const r = spawnSync(process.execPath, [vitestPath, "run", "--reporter=json", `--outputFile=${outFile}`], {
    encoding: "utf8",
    timeout: 120_000,
  });

  if (!existsSync(outFile)) {
    return mkResult("test", "Vitest 全绿", 1, [
      { id: "vitest", message: "未生成 JSON 报告", evidence: (r.stderr || r.stdout).slice(0, 500) },
    ]);
  }

  const report = JSON.parse(readFileSync(outFile, "utf8"));
  const failures = [];
  for (const suite of report.testResults ?? []) {
    for (const t of suite.assertionResults ?? []) {
      if (t.status !== "passed") {
        failures.push({
          id: `${suite.name}::${t.fullName}`,
          message: `测试失败：${t.status}`,
          evidence: (t.failureMessages ?? []).join("\n").slice(0, 500),
        });
      }
    }
  }
  // status 非 0 说明有测试文件崩溃/超时
  if (r.status !== 0 && failures.length === 0) {
    failures.push({ id: "vitest", message: `vitest 异常退出（${r.status}）`, evidence: (r.stderr || r.stdout).slice(0, 500) });
  }
  return mkResult("test", "Vitest 全绿", report.numTotalTests ?? 0, failures);
}
