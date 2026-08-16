// 评审门禁（10 §3.2）：聚合 artifacts/reports/ 下 8 个 check 的结构化结果，
// 任一 fail / 报告缺失 / 报告损坏 → review fail。Blocker 不消不合并（CI 自动阻塞）。
//
// 2026-08 review 阶段1：从「永远 pass 的 Phase 0 占位」变为真门禁——独立二次聚合
// （不读 verify.json，直接读各 check 报告，避免自引用）。
// findings 契约保留（severity: blocker|warning|nit），当前 findings 由各 check 的
// failures 映射而来（blocker = check 失败项）；未来接入评审 Agent 模型后可追加
// 代码级 findings（读 diff + 规格 → 对抗性验证），契约不变。
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ARTIFACTS_DIR, mkResult } from "../lib/report.mjs";

/** review 聚合的 check 清单（与 verify.mjs CHECKS 一致；review 自身在链尾追加） */
export const EXPECTED_CHECKS = ["lint", "typecheck", "test", "size", "contract", "visual", "e2e", "smoke"];

export function run() {
  const failures = [];
  const findings = [];
  for (const id of EXPECTED_CHECKS) {
    const file = join(ARTIFACTS_DIR, `${id}.json`);
    if (!existsSync(file)) {
      failures.push({ id, message: "报告缺失（先运行 npm run verify 生成全套报告）", evidence: file });
      continue;
    }
    let payload;
    try {
      payload = JSON.parse(readFileSync(file, "utf8"));
    } catch (err) {
      failures.push({ id, message: `报告损坏：${err.message}`, evidence: file });
      continue;
    }
    if (payload.status !== "pass") {
      const items = payload.failures ?? [{ id, message: payload.title ?? "check 失败" }];
      for (const f of items) {
        findings.push({
          severity: "blocker",
          check: id,
          id: f.id,
          title: f.message ?? "",
          evidence: String(f.evidence ?? "").slice(0, 300),
        });
      }
      failures.push({ id, message: `${id} check 未通过（${payload.failed ?? items.length} 项失败，见 reports/${id}.json）` });
    }
  }
  return {
    ...mkResult("review", "评审门禁（聚合 8 check 报告——Blocker 不消不合并）", EXPECTED_CHECKS.length, failures),
    findings,
    contract: "findings: { severity: blocker|warning|nit, check, id, title, evidence }",
  };
}
