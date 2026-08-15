// 反馈层通用工具（10 §3.1：错误信息是 API）
// 所有 check 统一双格式输出：终端人类可读摘要 + artifacts/reports/<check>.json 机器可读
// 每个 check 有稳定 ID，Agent 可 grep / 缓存 / 重试
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ARTIFACTS_DIR = join(process.cwd(), "artifacts", "reports");

export function ensureArtifactsDir() {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

/** 写结构化报告，返回文件路径 */
export function writeReport(check, payload) {
  ensureArtifactsDir();
  const file = join(ARTIFACTS_DIR, `${check}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return file;
}

/**
 * 组装标准 payload（对齐 10 §3.1 的 visual-regression 示例结构）
 * 门禁加固（2026-08 前端审查 P1-1）：total === 0 视为 fail——0 用例 = 未验证，
 * 杜绝「残留空报告 + 0 失败」的结构性假绿。
 * @param {string} check  稳定 check ID
 * @param {string} title  人类可读标题
 * @param {number} total  本 check 共检查的用例数
 * @param {Array<{id:string,message:string,evidence?:string}>} failures 失败列表
 */
export function mkResult(check, title, total, failures) {
  const noTests = total === 0;
  if (noTests) {
    failures = [
      ...failures,
      { id: "no-tests", message: "0 个用例被收集——检查工具可能未真正执行（残留报告 / 转译失败 / 配置错误）" },
    ];
  }
  const failed = failures.length;
  return {
    status: failed === 0 ? "pass" : "fail",
    check,
    title,
    total,
    passed: noTests ? 0 : total - failed,
    failed,
    failures,
  };
}

/** 打印人类可读摘要 */
export function printSummary(payload) {
  const { check, title, status, total = 0, passed = 0, failures = [] } = payload;
  const mark = status === "pass" ? "✓" : "✗";
  console.log(`${mark} ${check}${title ? ` — ${title}` : ""}`);
  if (total > 0) console.log(`   通过 ${passed}/${total}，失败 ${failures.length}`);
  for (const f of failures) {
    console.log(`   - ${f.id ?? ""}: ${f.message}`);
    if (f.evidence) console.log(`     ${f.evidence}`);
  }
}

/** 写入报告 + 打印摘要 + 设置退出码 */
export function settle(payload) {
  writeReport(payload.check, payload);
  printSummary(payload);
  if (payload.status !== "pass") process.exitCode = 1;
}

/** 作为 CLI 运行某个 check 模块（run-check.mjs 使用） */
export async function main(checkFn) {
  const payload = await checkFn();
  settle(payload);
  if (process.argv.includes("--json")) console.log(JSON.stringify(payload, null, 2));
}
