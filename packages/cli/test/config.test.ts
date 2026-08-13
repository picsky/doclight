/**
 * doclight.json 契约扩展（A，2026-08-13 批准）：
 * 契约 schema（contracts/doclight.schema.json）与宽松读取（config.ts）对齐——
 * base / siteUrl / outputDir / build.llmsTxt 已入契约，不破坏既有键（只加不改，12 §6.2）。
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, loadLlmsTxtConfig } from "../src/config.ts";
import schema from "../../../contracts/doclight.schema.json" with { type: "json" };

const CONTRACT_KEYS = ["title", "description", "docsDir", "theme", "base", "siteUrl", "outputDir", "build"] as const;

describe("doclight.json 契约扩展（A）", () => {
  it("契约 schema 收录 Phase 3/4 键（只加不改）", () => {
    const props = (schema as { properties: Record<string, unknown> }).properties;
    for (const key of CONTRACT_KEYS) {
      expect(props[key], `schema 缺 ${key}`).toBeDefined();
    }
    const build = props["build"] as { properties: { llmsTxt: { properties: { priority: unknown; exclude: unknown } } } };
    expect(build.properties.llmsTxt.properties.priority).toBeDefined();
    expect(build.properties.llmsTxt.properties.exclude).toBeDefined();
    // 既有键不被移除（向后兼容）
    expect(props["title"]).toBeDefined();
    expect(props["theme"]).toBeDefined();
  });

  it("config.ts 宽松读取与 schema 对齐（base/siteUrl/outputDir）", () => {
    const dir = mkdtempSync(join(tmpdir(), "doclight-cfg-"));
    try {
      writeFileSync(
        join(dir, "doclight.json"),
        JSON.stringify({ title: "T", base: "/docs", siteUrl: "https://docs.example.com", outputDir: "out" })
      );
      const cfg = loadConfig([join(dir, "doclight.json")]);
      expect(cfg.title).toBe("T");
      expect(cfg.base).toBe("/docs");
      expect(cfg.siteUrl).toBe("https://docs.example.com");
      expect(cfg.outputDir).toBe("out");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("build.llmsTxt.priority/exclude 宽松读取（LLMS-001）", () => {
    const dir = mkdtempSync(join(tmpdir(), "doclight-cfg-llms-"));
    try {
      writeFileSync(
        join(dir, "doclight.json"),
        JSON.stringify({
          build: { llmsTxt: { priority: { high: ["README.md"], low: ["api/"] }, exclude: ["internal/"] } },
        })
      );
      const cfg = loadLlmsTxtConfig([join(dir, "doclight.json")]);
      expect(cfg.priority?.high).toEqual(["README.md"]);
      expect(cfg.priority?.low).toEqual(["api/"]);
      expect(cfg.exclude).toEqual(["internal/"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
