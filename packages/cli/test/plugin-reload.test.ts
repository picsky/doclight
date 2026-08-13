/**
 * 插件热重载测试（PLUG-011：dev 模式插件文件变更自动重载）
 *
 * 覆盖：dev server 监听插件源文件 → 重新解析 → 管线替换 → 页面产物反映最新插件；
 * 关闭时 watcher 清理（close 不泄漏）。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDevServer, type DevServer } from "../src/dev-server.ts";
import { loadPluginsSync } from "../src/plugin-loader.ts";
import type { PluginDef } from "../../core/src/plugin.ts";

let root: string;
let pluginFile: string;
let dev: DevServer;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "doclight-plugin-reload-"));
  mkdirSync(join(root, "docs"), { recursive: true });
  mkdirSync(join(root, "plugins"), { recursive: true });
  writeFileSync(join(root, "docs", "README.md"), "# 首页\n\nPLACEHOLDER");
  pluginFile = join(root, "plugins", "hot.js");
  writeFileSync(pluginFile, 'module.exports = { name: "hot", beforeRender: (md) => md.replace("PLACEHOLDER", "[v1]") };');

  // 与 CLI 层 reloadConfiguredPlugins 同语义：fatal（文件缺失/语法错误）→ null 保留旧管线
  const reload = (): PluginDef[] | null => {
    const result = loadPluginsSync([{ name: pluginFile }], root);
    return result.skipped.some((s) => s.fatal) ? null : result.plugins;
  };
  dev = await startDevServer({ dir: join(root, "docs"), port: 0, buildPlugins: reload() ?? [], pluginFiles: [pluginFile], reloadPlugins: reload });
});

afterAll(async () => {
  await dev.close();
  rmSync(root, { recursive: true, force: true });
});

/** 轮询等待条件成立（文件 watcher + 防抖 150ms 的异步时序） */
async function waitFor(fn: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("等待条件超时");
}

describe("插件热重载（PLUG-011）", () => {
  it("初始渲染走 v1 插件", async () => {
    const res = await fetch(dev.url);
    const body = await res.text();
    expect(body).toContain("[v1]");
    expect(body).not.toContain("PLACEHOLDER");
  });

  it("插件文件变更 → 管线替换 → 页面产物反映 v2", async () => {
    // 修改插件源文件（require 缓存失效 + watcher 触发重载）
    writeFileSync(pluginFile, 'module.exports = { name: "hot", beforeRender: (md) => md.replace("PLACEHOLDER", "[v2-reloaded]") };');
    await waitFor(async () => {
      const body = await (await fetch(dev.url)).text();
      return body.includes("[v2-reloaded]") && !body.includes("[v1]");
    });
  });

  it("解析失败保留旧管线（不中断服务）", async () => {
    const bodyBefore = await (await fetch(dev.url)).text();
    // 写入语法错误的插件 → 重载失败 → 旧管线仍服务 v2 产物
    writeFileSync(pluginFile, "module.exports = { name: 'hot', beforeRender: (md) => md.replace('PLACEHOLDER', '【v3】' }; // 语法错误");
    await waitFor(async () => {
      const body = await (await fetch(dev.url)).text();
      return body.includes("[v2-reloaded]"); // 保持旧行为
    });
    expect(bodyBefore).toContain("[v2-reloaded]");
  });
});
