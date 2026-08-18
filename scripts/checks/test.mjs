// test check（10 §2.1：Vitest 全绿 + 覆盖率门禁）
// 用 vitest 的 JSON reporter 产出机器可读结果（反馈层）；
// 2026-08 review 阶段1：带 --coverage 运行——vitest.config.ts 的 thresholds
// 超限时 vitest 以非零退出（本 check 捕获并给出覆盖率专属提示），摘要落 reports。
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mkResult } from "../lib/report.mjs";

const require = createRequire(import.meta.url);
const vitestPath = require.resolve("vitest/vitest.mjs");
const outFile = join(process.cwd(), "artifacts", "reports", "test-vitest.json");
const covSummary = join(process.cwd(), "coverage", "coverage-summary.json");

export function run() {
  mkdirSync(join(process.cwd(), "artifacts", "reports"), { recursive: true });
  const r = spawnSync(process.execPath, [vitestPath, "run", "--coverage", "--reporter=json", `--outputFile=${outFile}`], {
    encoding: "utf8",
    timeout: 300_000,
  });

  if (!existsSync(outFile)) {
    return mkResult("test", "Vitest 全绿", 1, [
      { id: "vitest", message: "未生成 JSON 报告", evidence: `${r.stderr ?? ""}${r.stdout ?? ""}`.slice(0, 500) },
    ]);
  }

  const report = JSON.parse(readFileSync(outFile, "utf8"));
  const failures = [];
  for (const suite of report.testResults ?? []) {
    for (const t of suite.assertionResults ?? []) {
      // skipped = 环境条件跳过（如 vitest 拦截动态 import 的 TS 集成测试）——不视为失败
      if (t.status !== "passed" && t.status !== "skipped") {
        failures.push({
          id: `${suite.name}::${t.fullName}`,
          message: `测试失败：${t.status}`,
          evidence: (t.failureMessages ?? []).join("\n").slice(0, 500),
        });
      }
    }
  }
  // status 非 0 说明有测试文件崩溃/超时，或覆盖率 thresholds 未达标
  if (r.status !== 0 && failures.length === 0) {
    const covBreached = /ERROR: (?:Coverage|coverage).*threshold/s.test(`${r.stdout ?? ""}${r.stderr ?? ""}`);
    failures.push({
      id: covBreached ? "coverage" : "vitest",
      message: covBreached
        ? "覆盖率低于 thresholds（vitest.config.ts；摘要见 artifacts/reports/coverage-summary.json）"
        : `vitest 异常退出（${r.status}）`,
      evidence: `${r.stderr ?? ""}${r.stdout ?? ""}`.slice(0, 800),
    });
  }
  // 覆盖率摘要随报告归档（人工可读 + Agent 可消费）
  if (existsSync(covSummary)) {
    try {
      copyFileSync(covSummary, join(process.cwd(), "artifacts", "reports", "coverage-summary.json"));
    } catch {
      /* 摘要归档失败不影响门禁 */
    }
  }
  return mkResult("test", "Vitest 全绿", report.numTotalTests ?? 0, failures);
}
