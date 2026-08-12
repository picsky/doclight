// e2e check（10 §2.1 浏览器矩阵 + PHASE-1-complete 建议 #1：锁展示层质量门禁）
// 用 @playwright/test 驱动真实浏览器跑 e2e/display.spec.ts（chromium/firefox/webkit），
// 解析 JSON 报告为标准 payload（反馈层双格式）。
// 前置：dist/display.js 已构建（verify.mjs 先跑 build）；浏览器需已安装（CI 用 playwright install）
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mkResult } from "../lib/report.mjs";

const require = createRequire(import.meta.url);
const pwCli = require.resolve("@playwright/test/cli");
const REPORT = join(process.cwd(), "artifacts", "e2e", "results.json");

/** 递归收集所有用例（Playwright JSON 报告：suite → specs → tests，可能嵌套） */
function collectTests(suites, out = []) {
  for (const s of suites) {
    for (const sp of s.specs ?? []) {
      for (const t of sp.tests ?? []) {
        // 用例标题在 spec 上，test 只有 projectName/status
        out.push({ ...t, title: `${sp.title}` });
      }
    }
    if (s.suites?.length) collectTests(s.suites, out);
  }
  return out;
}

export function run() {
  mkdirSync(join(process.cwd(), "artifacts", "e2e"), { recursive: true });
  const r = spawnSync(process.execPath, [pwCli, "test"], { encoding: "utf8", timeout: 300_000 });

  if (!existsSync(REPORT)) {
    return mkResult("e2e", "展示层端到端（真实浏览器）", 1, [
      {
        id: "playwright",
        message: "未生成 e2e 报告（浏览器未安装或启动失败？）",
        evidence: (r.stdout || r.stderr || "").slice(-800),
      },
    ]);
  }

  const report = JSON.parse(readFileSync(REPORT, "utf8"));
  const tests = collectTests(report.suites ?? []);
  const failures = [];
  for (const t of tests) {
    if (t.status === "expected" || t.status === "flaky" || t.status === "skipped") continue;
    failures.push({
      id: `${t.projectName} :: ${t.title}`,
      message: `e2e 失败（${t.status}）`,
      evidence: (t.results ?? [])
        .map((res) => res.error?.message ?? "")
        .filter(Boolean)
        .join("\n")
        .slice(0, 500),
    });
  }
  return mkResult("e2e", "展示层端到端（chromium/firefox/webkit）", tests.length, failures);
}
