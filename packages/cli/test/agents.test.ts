/**
 * AGENTS.md 生成测试（CAP-001：doclight init 写入内容写作入口，幂等不覆盖）
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initProject } from "../src/init.ts";

describe("doclight init 生成 AGENTS.md（CAP-001）", () => {
  it("init 写入 AGENTS.md：入口声明 + 语法 + 约定 + 发布链 + Agent 端点", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-agents-"));
    try {
      const result = initProject({ dir: root, title: "示例站", description: "示例描述" });
      expect(result.created).toContain("AGENTS.md");
      const md = readFileSync(join(root, "AGENTS.md"), "utf8");
      expect(md).toContain("# AGENTS.md — 示例站");
      expect(md).toContain("本站：示例描述");
      expect(md).toContain("支持的 Markdown 语法");
      expect(md).toContain("frontmatter 约定");
      expect(md).toContain("构建与发布链");
      expect(md).toContain("Agent 接口");
      expect(md).toContain("/capabilities.json");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("幂等：二次 init 不覆盖已有 AGENTS.md（用户可自定义）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-agents-idem-"));
    try {
      initProject({ dir: root, title: "示例站" });
      const custom = "# 自定义内容\n";
      writeFileSync(join(root, "AGENTS.md"), custom);
      const second = initProject({ dir: root, title: "示例站" });
      expect(second.skipped).toContain("AGENTS.md");
      expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toBe(custom);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("--force 覆盖已有 AGENTS.md", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-agents-force-"));
    try {
      initProject({ dir: root, title: "示例站" });
      writeFileSync(join(root, "AGENTS.md"), "# 旧内容\n");
      const forced = initProject({ dir: root, title: "示例站", force: true });
      expect(forced.created).toContain("AGENTS.md");
      expect(existsSync(join(root, "AGENTS.md"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
