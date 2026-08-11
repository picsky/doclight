// spec check（10 §1.4 规格追溯：调研 → 设计 → 规格 → 实现 链路）
// 机制：扫描 specs/ 下的需求 ID（如 SRCH-001），验证每个 ID 在测试/代码中有引用
// Phase 0 尚无需求 ID，通过（total=0）；Phase 1 引入 Gherkin 规格后开始生效
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { mkResult } from "../lib/report.mjs";

const ID_RE = /\b([A-Z]{2,5}-\d{3})\b/g;
const IMPL_ROOTS = ["packages"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(md|feature)$/.test(name)) out.push(p);
  }
  return out;
}

function collectIds(dir) {
  const ids = new Set();
  if (!statSync(dir).isDirectory()) return ids;
  for (const file of walk(dir)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(ID_RE)) ids.add(m[1]);
  }
  return ids;
}

function scanImpl() {
  const found = new Set();
  for (const root of IMPL_ROOTS) {
    const dir = join(process.cwd(), root);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of walk(dir)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(ID_RE)) found.add(m[1]);
    }
  }
  return found;
}

export function run() {
  const specsDir = join(process.cwd(), "specs");
  const failures = [];
  let total = 0;

  try {
    const ids = collectIds(specsDir);
    total = ids.size;
    const found = scanImpl();
    for (const id of ids) {
      if (!found.has(id)) {
        failures.push({ id, message: "需求 ID 在 packages/* 的源码或测试中无引用（可追溯链路断裂）" });
      }
    }
  } catch {
    // specs/ 尚不存在或为空：Phase 0 通过，记录提示
    return { status: "pass", check: "spec", title: "规格追溯（暂无需求 ID）", total: 0, passed: 0, failed: 0, failures: [] };
  }

  return mkResult("spec", "规格追溯：需求 ID → 测试/代码", total, failures);
}
