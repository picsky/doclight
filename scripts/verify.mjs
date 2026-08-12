// 闭环层（10 §4.1）：一条命令跑全部验证
//   node scripts/verify.mjs [--json]
// 全部通过输出：VERIFIED ✓（含摘要）
import { writeReport, printSummary } from "./lib/report.mjs";
import { runBuild } from "./build.mjs";

const CHECKS = ["lint", "typecheck", "test", "size", "contract", "e2e"];
// Phase 1 启用：visual / isomorphic / perf（见 10 §2.1 验证矩阵）；e2e = 展示层真实浏览器门禁

export async function verify() {
  // 1) 先构建（体积门禁与产物验证的前提）
  runBuild();

  // 2) 依次运行各 check（每个 check 落盘独立 JSON，供 Agent 定位细节）
  const results = [];
  for (const id of CHECKS) {
    const mod = await import(`./checks/${id}.mjs`);
    const payload = await mod.run();
    writeReport(id, payload);
    results.push(payload);
  }

  // 3) 聚合报告
  const failed = results.filter((r) => r.status !== "pass");
  return {
    status: failed.length === 0 ? "pass" : "fail",
    check: "verify",
    title: "全量验证（lint / typecheck / test / size / contract / e2e）",
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failures: failed.map((r) => ({ id: r.check, message: r.title, evidence: `${r.failed} 项失败` })),
    checks: results.map((r) => ({ check: r.check, status: r.status })),
  };
}

const aggregate = await verify();
writeReport("verify", aggregate);
printSummary(aggregate);
if (aggregate.status === "pass") {
  console.log("\nVERIFIED ✓");
} else {
  console.log("\nVERIFY FAILED ✗ — 修复后重跑。失败详情见 artifacts/reports/verify.json");
  process.exit(1);
}
if (process.argv.includes("--json")) console.log(JSON.stringify(aggregate, null, 2));
