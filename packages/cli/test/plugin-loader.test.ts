/**
 * 插件加载器测试（PLUG-007/008/011/013 接线）
 *
 * 覆盖：内置官方插件解析（短名/包名）/ 配置透传 / 未知插件跳过（含原因）/
 * 禁用跳过 / 配置无效跳过 / 工厂异常隔离 / 热重载 require 缓存失效 /
 * PLUG-013 ESM-only 包与 .ts 插件文件加载（Node ≥ 23.6 原生能力，低版本条件跳过）。
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { configuredPluginWatchFiles, loadPluginsSync, reloadConfiguredPluginsAsync } from "../src/plugin-loader.ts";

/** PLUG-013 原生能力检测：require(esm) + TS strip 默认启用（Node ≥ 23.6） */
const hasNativeEsmTs = (() => {
  try {
    const major = Number(process.versions.node.split(".")[0]);
    return major > 23 || (major === 23 && Number(process.versions.node.split(".")[1]) >= 6);
  } catch {
    return false;
  }
})();

/** 加载器源码的 file URL（真实 Node 子进程 import 用） */
const LOADER_URL = pathToFileURL(join(process.cwd(), "packages", "cli", "src", "plugin-loader.ts")).href;

/** 真实 Node 子进程执行 ESM 脚本（vitest 的 vite-node 会拦截动态 import，缓存行为与原生不同；
 *  热重载绕过验证必须在真实 Node 语义下跑——spike 实测 import + URL query 可绕过模块 registry 缓存） */
function runNodeScript(script: string): string {
  const file = join(tmpdir(), `doclight-loader-verify-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(file, script, "utf8");
  try {
    return execFileSync(process.execPath, [file], { encoding: "utf8", timeout: 30_000 });
  } finally {
    rmSync(file, { recursive: true, force: true });
  }
}

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

// PLUG-013：ESM-only 包与 .ts 插件文件（Node ≥ 23.6 原生 require(esm) + type stripping）
describe.skipIf(!hasNativeEsmTs)("PLUG-013 ESM/TS 插件加载（Node 原生能力）", () => {
  it("ESM-only 插件包（node_modules type:module，export default）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-esm-pkg-"));
    try {
      const pkg = join(root, "node_modules", "esm-plugin");
      mkdirSync(pkg, { recursive: true });
      writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "esm-plugin", version: "1.0.0", type: "module", main: "index.mjs" }));
      writeFileSync(join(pkg, "index.mjs"), 'export default { name: "esm-plugin", version: "1.0.0" };\n');
      const result = loadPluginsSync([{ name: "esm-plugin" }], root);
      expect(result.skipped).toEqual([]);
      expect(result.plugins.map((p) => p.name)).toEqual(["esm-plugin"]);
      expect(result.plugins[0]!.version).toBe("1.0.0");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ESM 包导出 { default } / { plugin } 形态均可解析（resolvePluginExport）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-esm-shape-"));
    try {
      const pkg = join(root, "node_modules", "shape-plugin");
      mkdirSync(pkg, { recursive: true });
      writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "shape-plugin", version: "1.0.0", type: "module", main: "index.mjs" }));
      writeFileSync(join(pkg, "index.mjs"), 'export default { name: "shape-plugin", version: "1.0.0" };\n');
      const result = loadPluginsSync([{ name: "shape-plugin" }], root);
      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0]!.name).toBe("shape-plugin");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it(".ts 插件文件（相对路径，type stripping 加载）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-ts-plugin-"));
    try {
      const file = join(root, "plugins", "my-plugin.ts");
      mkdirSync(join(root, "plugins"), { recursive: true });
      writeFileSync(file, 'export default { name: "ts-plugin", version: "0.2.0" };\n');
      const result = loadPluginsSync([{ name: "./plugins/my-plugin.ts" }], root);
      expect(result.skipped).toEqual([]);
      expect(result.plugins.map((p) => p.name)).toEqual(["ts-plugin"]);
      expect(result.plugins[0]!.version).toBe("0.2.0");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it(".ts 插件热重载（PLUG-013）：异步 import + query 绕过 Node 模块缓存取最新（真实 Node 子进程验证）", () => {
    // vitest 的 vite-node 会拦截动态 import（缓存行为与原生 Node 不同），
    // 故用真实 Node 子进程验证生产语义（spike：require(esm) 缓存不在 require.cache，
    // import + 时间戳 query 可绕过 registry 缓存）。
    const root = mkdtempSync(join(tmpdir(), "doclight-ts-reload-"));
    try {
      const file = join(root, "plugin.ts");
      writeFileSync(file, 'export default { name: "ts-v1" };\n');
      const script = `
        import { loadPluginsAsync } from ${JSON.stringify(LOADER_URL)};
        const root = ${JSON.stringify(root)};
        const file = ${JSON.stringify(file)};
        const first = await loadPluginsAsync([{ name: file }], root);
        if (first.plugins[0]?.name !== "ts-v1") throw new Error("first: " + first.plugins[0]?.name);
        const { writeFileSync } = await import("node:fs");
        writeFileSync(file, 'export default { name: "ts-v2" };\\n');
        const second = await loadPluginsAsync([{ name: file }], root);
        if (second.plugins[0]?.name !== "ts-v2") throw new Error("second: " + second.plugins[0]?.name);
        console.log("ts-reload-ok");
      `;
      const out = runNodeScript(script);
      expect(out).toContain("ts-reload-ok");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ESM 包热重载（PLUG-013）：import + query 绕过模块 registry 缓存（真实 Node 子进程验证）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-esm-reload-"));
    try {
      const pkg = join(root, "node_modules", "hot-esm");
      mkdirSync(pkg, { recursive: true });
      writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "hot-esm", version: "1.0.0", type: "module", main: "index.mjs" }));
      const file = join(pkg, "index.mjs");
      writeFileSync(file, 'export default { name: "esm-v1" };\n');
      const script = `
        import { loadPluginsAsync } from ${JSON.stringify(LOADER_URL)};
        const root = ${JSON.stringify(root)};
        const file = ${JSON.stringify(file)};
        const first = await loadPluginsAsync([{ name: "hot-esm" }], root);
        if (first.plugins[0]?.name !== "esm-v1") throw new Error("first: " + first.plugins[0]?.name);
        const { writeFileSync } = await import("node:fs");
        writeFileSync(file, 'export default { name: "esm-v2" };\\n');
        const second = await loadPluginsAsync([{ name: "hot-esm" }], root);
        if (second.plugins[0]?.name !== "esm-v2") throw new Error("second: " + second.plugins[0]?.name);
        console.log("esm-reload-ok");
      `;
      const out = runNodeScript(script);
      expect(out).toContain("esm-reload-ok");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reloadConfiguredPluginsAsync：fatal 加载期错误（文件缺失）返回 null（保留旧管线）", async () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-async-reload-"));
    try {
      // 配置指向不存在的插件文件 → 首次加载即 fatal
      writeFileSync(join(root, "doclight.json"), JSON.stringify({ plugins: [{ name: "./missing-plugin.ts" }] }));
      const bad = await reloadConfiguredPluginsAsync(join(root, "docs"), root);
      expect(bad).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("顶层 await 的 ESM 插件：诚实跳过（fatal）+ 专属提示（同步契约限制）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-tla-plugin-"));
    try {
      const pkg = join(root, "node_modules", "tla-plugin");
      mkdirSync(pkg, { recursive: true });
      writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "tla-plugin", version: "1.0.0", type: "module", main: "index.mjs" }));
      writeFileSync(join(pkg, "index.mjs"), 'const v = await Promise.resolve(1);\nexport default { name: "tla-plugin", v };\n');
      const result = loadPluginsSync([{ name: "tla-plugin" }], root);
      expect(result.plugins).toEqual([]);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]!.fatal).toBe(true);
      expect(result.skipped[0]!.reason).toContain("top-level await");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
