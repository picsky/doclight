/**
 * 插件加载器测试（PLUG-007/008/011 接线）
 *
 * 覆盖：内置官方插件解析（短名/包名）/ 配置透传 / 未知插件跳过（含原因）/
 * 禁用跳过 / 配置无效跳过 / 工厂异常隔离 / 热重载 require 缓存失效。
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configuredPluginWatchFiles, loadPluginsSync } from "../src/plugin-loader.ts";

describe("loadPluginsSync（PLUG-007 官方插件加载）", () => {
  it("内置插件短名解析（giscus，配置透传）", () => {
    const result = loadPluginsSync([{ name: "giscus", config: { repo: "owner/repo" } }]);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]!.name).toBe("giscus");
    expect(result.plugins[0]!.config).toEqual({ repo: "owner/repo" });
    expect(result.skipped).toEqual([]);
  });

  it("包名 @doclight/plugin-* 别名同样解析", () => {
    const result = loadPluginsSync([{ name: "@doclight/plugin-plausible", config: { domain: "x.example.com" } }]);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]!.name).toBe("plausible");
  });

  it("未知插件跳过且不中断其余（含原因）", () => {
    const result = loadPluginsSync([
      { name: "nonexistent" },
      { name: "plausible", config: { domain: "x.example.com" } },
    ]);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]!.name).toBe("plausible");
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.name).toBe("nonexistent");
    expect(result.skipped[0]!.reason).toBeTruthy();
  });

  it("enabled:false 跳过（含原因）", () => {
    const result = loadPluginsSync([{ name: "giscus", config: { repo: "a/b" }, enabled: false }]);
    expect(result.plugins).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.reason).toContain("禁用");
  });

  it("配置缺必填项跳过（giscus 无 repo）", () => {
    const result = loadPluginsSync([{ name: "giscus", config: {} }]);
    expect(result.plugins).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.reason).toContain("配置无效");
  });

  it("config 缺省时返回 null 的插件跳过（plausible 无 domain）", () => {
    const result = loadPluginsSync([{ name: "plausible" }]);
    expect(result.plugins).toEqual([]);
    expect(result.skipped).toHaveLength(1);
  });

  it("多插件按配置顺序解析", () => {
    const result = loadPluginsSync([
      { name: "rss" },
      { name: "giscus", config: { repo: "a/b" } },
      { name: "pwa" },
    ]);
    expect(result.plugins.map((p) => p.name)).toEqual(["rss", "giscus", "pwa"]);
  });

  it("空配置返回空结果", () => {
    expect(loadPluginsSync(undefined)).toEqual({ plugins: [], skipped: [] });
    expect(loadPluginsSync([])).toEqual({ plugins: [], skipped: [] });
  });

  it("PLUG-011 热重载：require 缓存失效——文件变更后取最新内容", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-plugin-reload-"));
    try {
      const file = join(root, "plugin.js");
      writeFileSync(file, 'module.exports = { name: "v1" };');
      const first = loadPluginsSync([{ name: file }], root);
      expect(first.plugins).toHaveLength(1);
      expect(first.plugins[0]!.name).toBe("v1");

      // 修改文件内容后重新加载：缓存已失效，取到 v2
      writeFileSync(file, 'module.exports = { name: "v2" };');
      const second = loadPluginsSync([{ name: file }], root);
      expect(second.plugins).toHaveLength(1);
      expect(second.plugins[0]!.name).toBe("v2");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("PLUG-011 watch 文件清单：doclight.json + 路径形态插件源文件", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-plugin-watch-"));
    try {
      const pluginFile = join(root, "plugins", "my", "plugin.js");
      mkdirSync(join(root, "plugins", "my"), { recursive: true });
      writeFileSync(pluginFile, "module.exports = {};");
      writeFileSync(
        join(root, "doclight.json"),
        JSON.stringify({
          plugins: [
            { name: "./plugins/my/plugin.js" },
            { name: "giscus", config: { repo: "a/b" } }, // 内置插件无源文件，不进清单
          ],
        })
      );
      const files = configuredPluginWatchFiles(join(root, "docs"), root);
      expect(files).toContain(join(root, "doclight.json"));
      expect(files).toContain(pluginFile);
      expect(files).toHaveLength(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
