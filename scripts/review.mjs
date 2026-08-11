// 评审 Agent（10 §3.2）：独立视角审查，输出结构化 findings
//   node scripts/review.mjs [--base <commit>] [--json]
//
// findings 契约（12 §2.3）：
//   { severity: "blocker"|"warning"|"nit", file, line, title, evidence, suggestedFix }
//
// Phase 0 占位：定义契约与骨架。真实评审逻辑（读 diff + 规格 → 对抗性验证）
// 在接入评审 Agent 模型后充实；当前返回空 findings 并说明契约。
// Blocker 不消不合并（CI 自动阻塞）。

import { writeReport, printSummary } from "./lib/report.mjs";

export function run() {
  return {
    status: "pass",
    check: "review",
    title: "评审 Agent（Phase 0 占位：契约就位，逻辑待接入）",
    total: 0,
    passed: 0,
    failed: 0,
    failures: [],
    findings: [],
    contract: "findings: { severity: blocker|warning|nit, file, line, title, evidence, suggestedFix }",
  };
}

const payload = run();
writeReport("review", payload);
printSummary(payload);
if (process.argv.includes("--json")) console.log(JSON.stringify(payload, null, 2));
