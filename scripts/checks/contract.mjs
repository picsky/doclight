// contract check（12 §5.1 + 10 §5.1：外部承诺的 API 与 Schema 稳定性）
// Phase 0 骨架：必需契约文件存在性 + doclight.schema.json 合法性
// 插件 API / CLI / MCP 契约测试在各自 Phase 充实（只加不改）
import { accessSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mkResult } from "../lib/report.mjs";

const REQUIRED_FILES = ["contracts/doclight.schema.json", "specs/README.md", "docs/agent-handoffs/README.md"];

export function run() {
  const failures = [];

  // 1) 必需契约/规范文件存在
  for (const f of REQUIRED_FILES) {
    try {
      accessSync(join(process.cwd(), f));
    } catch {
      failures.push({ id: f, message: "必需文件缺失（契约层）" });
    }
  }

  // 2) doclight.schema.json 是合法 JSON 且具备 JSON Schema 基本结构
  try {
    const schema = JSON.parse(readFileSync(join(process.cwd(), "contracts", "doclight.schema.json"), "utf8"));
    if (typeof schema !== "object" || schema === null || !schema.$schema || !schema.type) {
      failures.push({ id: "doclight.schema.json", message: "Schema 缺 $schema 或根 type" });
    }
  } catch (err) {
    failures.push({ id: "doclight.schema.json", message: `解析失败：${err.message}` });
  }

  return mkResult("contract", "契约文件与 Schema 校验", REQUIRED_FILES.length + 1, failures);
}
