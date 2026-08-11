// contract check（12 §5.1 + 10 §5.1：外部承诺的 API 与 Schema 稳定性）
// Phase 0 骨架：必需契约文件存在性 + doclight.schema.json 合法性 + 状态文档与交接机制
// 插件 API / CLI / MCP 契约测试在各自 Phase 充实（只加不改）
import { accessSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mkResult } from "../lib/report.mjs";

const REQUIRED_FILES = ["contracts/doclight.schema.json", "specs/README.md", "docs/agent-handoffs/README.md"];

export function run() {
  const failures = [];
  let total = 0;

  // 1) 必需契约/规范文件存在
  for (const f of REQUIRED_FILES) {
    total++;
    try {
      accessSync(join(process.cwd(), f));
    } catch {
      failures.push({ id: f, message: "必需文件缺失（契约层）" });
    }
  }

  // 2) doclight.schema.json 是合法 JSON 且具备 JSON Schema 基本结构
  total++;
  try {
    const schema = JSON.parse(readFileSync(join(process.cwd(), "contracts", "doclight.schema.json"), "utf8"));
    if (typeof schema !== "object" || schema === null || !schema.$schema || !schema.type) {
      failures.push({ id: "doclight.schema.json", message: "Schema 缺 $schema 或根 type" });
    }
  } catch (err) {
    failures.push({ id: "doclight.schema.json", message: `解析失败：${err.message}` });
  }

  // 3) 状态文档与交接机制（15 §6.2：阶段完成必更新/必交接，防换会话状态过期误导）
  // 3a) CLAUDE.md「当前状态」区块存在且含「下一步」指引
  total++;
  try {
    const claude = readFileSync(join(process.cwd(), "CLAUDE.md"), "utf8");
    const section = claude.match(/## 当前状态[\s\S]*?(?=\n## )/);
    if (!section) {
      failures.push({ id: "CLAUDE.md", message: "缺少「当前状态」区块" });
    } else if (!/下一步/.test(section[0])) {
      failures.push({ id: "CLAUDE.md", message: "「当前状态」缺少「下一步」指引" });
    }
  } catch (err) {
    failures.push({ id: "CLAUDE.md", message: `读取失败：${err.message}` });
  }

  // 3b) AGENT.md「当前状态」区块存在
  total++;
  try {
    const agent = readFileSync(join(process.cwd(), "AGENT.md"), "utf8");
    if (!/## 当前状态/.test(agent)) {
      failures.push({ id: "AGENT.md", message: "缺少「当前状态」区块" });
    }
  } catch (err) {
    failures.push({ id: "AGENT.md", message: `读取失败：${err.message}` });
  }

  // 3c) docs/agent-handoffs/ 至少一份交接文档（阶段完成必写）
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

  return mkResult("contract", "契约文件 / Schema / 状态交接机制", total, failures);
}
