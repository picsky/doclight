// contract check（12 §5.1 + 10 §5.1：外部承诺的 API 与 Schema 稳定性）
// 2026-08 review 阶段1：从 Phase 0 骨架（文件存在性）升级为实契约——
//   1) 必需契约文件存在 + doclight.schema.json 结构合法
//   2) 配置键闭环：schema 顶层 properties ↔ config.ts KNOWN_TOP_LEVEL_KEYS 双向一致
//      （防「契约说支持、代码不读」或「代码读取、契约未收录」两类漂移）
//   3) MCP 工具契约：toolDescriptors() 每工具 inputSchema 形状合法（type=object、
//      required ⊆ properties、名字唯一）——/mcp 对外承诺的机器可校验
//   4) Agent 指南指针：AGENT.md / CLAUDE.md 为指向 AGENTS.md 的指针文件（权威唯一）
//   5) 交接机制：docs/agent-handoffs/ 至少一份交接文档（15 §6.2）
import { accessSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mkResult } from "../lib/report.mjs";

const REQUIRED_FILES = ["contracts/doclight.schema.json", "specs/README.md", "docs/agent-handoffs/README.md", "AGENTS.md"];

export async function run() {
  const failures = [];
  let total = 0;

  // 1) 必需契约/规范文件存在 + schema 基本结构
  for (const f of REQUIRED_FILES) {
    total++;
    try {
      accessSync(join(process.cwd(), f));
    } catch {
      failures.push({ id: f, message: "必需文件缺失（契约层）" });
    }
  }
  total++;
  let schemaKeys = null;
  try {
    const schema = JSON.parse(readFileSync(join(process.cwd(), "contracts", "doclight.schema.json"), "utf8"));
    if (typeof schema !== "object" || schema === null || !schema.$schema || !schema.type) {
      failures.push({ id: "doclight.schema.json", message: "Schema 缺 $schema 或根 type" });
    }
    schemaKeys = Object.keys(schema.properties ?? {}).sort();
  } catch (err) {
    failures.push({ id: "doclight.schema.json", message: `解析失败：${err.message}` });
  }

  // 2) 配置键闭环：schema properties ↔ config.ts KNOWN_TOP_LEVEL_KEYS 双向一致
  total++;
  try {
    const { KNOWN_TOP_LEVEL_KEYS } = await import("../../packages/cli/src/config.ts");
    const codeKeys = [...KNOWN_TOP_LEVEL_KEYS].sort();
    if (schemaKeys === null) {
      failures.push({ id: "config-keys", message: "schema 未解析，无法比对" });
    } else {
      const inSchemaOnly = schemaKeys.filter((k) => !codeKeys.includes(k));
      const inCodeOnly = codeKeys.filter((k) => !schemaKeys.includes(k));
      if (inSchemaOnly.length) {
        failures.push({ id: "config-keys", message: `契约收录但代码不读取（静默失效风险）：${inSchemaOnly.join(", ")}` });
      }
      if (inCodeOnly.length) {
        failures.push({ id: "config-keys", message: `代码读取但契约未收录（契约漂移）：${inCodeOnly.join(", ")}` });
      }
    }
  } catch (err) {
    failures.push({ id: "config-keys", message: `读取 config.ts 失败：${err.message}` });
  }

  // 3) MCP 工具契约形状（tools/call 对外承诺的 inputSchema 机器可校验）
  total++;
  try {
    const { toolDescriptors } = await import("../../packages/mcp-server/src/tools.ts");
    const tools = toolDescriptors();
    const names = new Set();
    if (tools.length === 0) failures.push({ id: "mcp-tools", message: "工具清单为空" });
    for (const t of tools) {
      const label = `mcp-tools:${t.name}`;
      if (names.has(t.name)) failures.push({ id: label, message: "工具名重复" });
      names.add(t.name);
      if (typeof t.description !== "string" || !t.description) {
        failures.push({ id: label, message: "缺 description" });
      }
      const s = t.inputSchema;
      if (!s || typeof s !== "object" || s.type !== "object") {
        failures.push({ id: label, message: "inputSchema 缺 type=object" });
        continue;
      }
      const props = Object.keys(s.properties ?? {});
      for (const r of s.required ?? []) {
        if (!props.includes(r)) failures.push({ id: label, message: `required "${r}" 不在 properties 中` });
      }
    }
  } catch (err) {
    failures.push({ id: "mcp-tools", message: `读取 tools.ts 失败：${err.message}` });
  }

  // 4) Agent 指南指针：AGENT.md / CLAUDE.md 指向 AGENTS.md（权威唯一，防三份漂移）
  for (const f of ["AGENT.md", "CLAUDE.md"]) {
    total++;
    try {
      const text = readFileSync(join(process.cwd(), f), "utf8");
      if (!text.includes("AGENTS.md")) {
        failures.push({ id: f, message: "未指向 AGENTS.md（权威入口唯一：AGENTS.md）" });
      }
    } catch {
      failures.push({ id: f, message: "读取失败（指针文件应存在并指向 AGENTS.md）" });
    }
  }

  // 5) 交接机制：docs/agent-handoffs/ 至少一份交接文档（阶段完成必写）
  total++;
  try {
    const handoffDocs = readdirSync(join(process.cwd(), "docs", "agent-handoffs")).filter(
      (f) => f.endsWith(".md") && f !== "README.md"
    );
    if (handoffDocs.length === 0) {
      failures.push({ id: "docs/agent-handoffs", message: "无交接文档（阶段完成必写，15 §6.2）" });
    }
  } catch {
    failures.push({ id: "docs/agent-handoffs", message: "目录缺失（阶段完成必写交接文档）" });
  }

  return mkResult("contract", "实契约：Schema↔配置键闭环 + MCP 工具形状 + 指南指针 + 交接机制", total, failures);
}
