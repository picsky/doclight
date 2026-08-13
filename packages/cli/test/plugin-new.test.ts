/**
 * 插件脚手架测试（PLUG-007 开发体验：doclight plugin new）
 *
 * 覆盖：模板生成（3 文件）/ 内容骨架 / 非法名报错 / 已存在跳过 / 官方插件清单。
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pluginList, pluginNew } from "../src/plugin-new.ts";

describe("pluginNew（PLUG-007 插件脚手架）", () => {
  it("生成 3 个模板文件（plugin.js / README.md / plugin.test.js）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-plugin-new-"));
    try {
      const result = pluginNew("my-chart", { dir: root });
      expect(result.created.sort()).toEqual(["README.md", "plugin.js", "plugin.test.js"].sort());
      expect(result.skipped).toEqual([]);

      const js = readFileSync(join(root, "my-chart", "plugin.js"), "utf8");
      expect(js).toContain("module.exports = function createPlugin");
      expect(js).toContain('name: "my-chart"');
      // 钩子骨架全部列出（删注释即启用，渐进式复杂度）
      for (const hook of ["beforeRender", "afterRender", "extendMarked", "addSearchFields", "onBuild", "init", "onMount", "onRouteChange", "destroy"]) {
        expect(js).toContain(hook);
      }
      expect(js).toContain("slotContent");

      const readme = readFileSync(join(root, "my-chart", "README.md"), "utf8");
      expect(readme).toContain('./plugins/my-chart/plugin.js');

      const test = readFileSync(join(root, "my-chart", "plugin.test.js"), "utf8");
      expect(test).toContain('require("./plugin.js")');

      // 下一步指引含 doclight.json 配置片段
      expect(result.nextSteps.join("\n")).toContain('"name": "./plugins/my-chart/plugin.js"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("非法插件名报错（大小写/特殊字符）", () => {
    expect(() => pluginNew("MyChart")).toThrow();
    expect(() => pluginNew("../escape")).toThrow();
    expect(() => pluginNew("中文名")).toThrow();
  });

  it("已存在文件跳过不覆盖", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-plugin-new-"));
    try {
      pluginNew("dup", { dir: root });
      const existing = readFileSync(join(root, "dup", "README.md"), "utf8");
      writeFileSync(join(root, "dup", "README.md"), "自定义内容");
      const second = pluginNew("dup", { dir: root });
      expect(second.created).not.toContain("README.md");
      expect(second.skipped).toContain("README.md");
      expect(readFileSync(join(root, "dup", "README.md"), "utf8")).toBe("自定义内容");
      expect(existsSync(existing ? join(root, "dup", "README.md") : "")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("pluginList（PLUG-007 官方插件清单）", () => {
  it("含 5 个官方插件及简介", () => {
    const list = pluginList();
    expect(list.map((p) => p.name)).toEqual(["giscus", "plausible", "rss", "pwa", "ai-chat"]);
    for (const p of list) expect(p.description).toBeTruthy();
  });
});
