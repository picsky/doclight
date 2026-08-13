/**
 * 插件加载器（PLUG-007/008/009 接线，07 §7.5 插件解析）
 *
 * 将 doclight.json 的 plugins 数组（PluginConfig[]）解析为可执行的 PluginDef[]。
 * 解析顺序（首个命中胜出）：
 * 1. 内置官方插件注册表（plugins-official/index.ts，短名与 @doclight/plugin-* 包名）
 * 2. 项目 node_modules 中的 JS 插件包（createRequire 同步加载，包导出
 *    { default: PluginDef } / { plugin: PluginDef } / PluginDef 自身）
 * 3. 相对路径 JS 文件（./plugins/my-plugin.js → 同上导出形态）
 *
 * 诚实原则（决策⑪/⑬同源）：无法解析的插件**不伪造成功**——收集进 skipped
 * （含原因），供 CLI 层警告输出；损坏的插件不中断其余。
 *
 * 遗留：ESM-only 插件包（require 失败）与 TS 插件文件需异步 import——
 * 加载器 API 为同步（buildSite 同步契约），待脚手架任务一并升级。
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { PluginConfig, PluginDef } from "../../core/src/plugin.ts";
import { loadConfig } from "./config.ts";
import { OFFICIAL_PLUGINS } from "./plugins-official/index.ts";

/** 加载结果：可用插件 + 跳过项（含原因，双读友好） */
export interface PluginLoadResult {
  /** 解析成功的 PluginDef（按配置顺序） */
  plugins: PluginDef[];
  /** 跳过项（enabled:false / 未知名 / 加载失败 / 配置无效），不伪造成功；
   *  fatal=true 表示加载期错误（文件缺失/语法错误）——热重载据此保留旧管线（PLUG-011） */
  skipped: Array<{ name: string; reason: string; fatal?: boolean }>;
}

/**
 * 从插件包模块导出中解析 PluginDef。
 * 支持四种导出形态（07 §7.5 插件包约定）：
 * - 直接导出 PluginDef 对象
 * - { default: ... } / { plugin: ... } 包裹
 * - 工厂函数（脚手架模板形态）：(config) => PluginDef | null——null 表示配置无效
 */
function resolvePluginExport(mod: unknown, config?: Record<string, unknown>): PluginDef | null {
  if (!mod || typeof mod !== "object") return null;
  const m = mod as Record<string, unknown>;
  const candidate = (m.default ?? m.plugin ?? mod) as unknown;
  if (typeof candidate === "function") {
    const def = candidate(config) as PluginDef | null | undefined;
    return def && typeof def === "object" && typeof def.name === "string" ? def : null;
  }
  return candidate && typeof candidate === "object" && typeof (candidate as PluginDef).name === "string"
    ? (candidate as PluginDef)
    : null;
}

/**
 * 同步加载插件（内置 → node_modules 包 → 相对路径文件）。
 * cwd 为项目根（node_modules 与相对路径解析基准）。
 */
export function loadPluginsSync(configs: PluginConfig[] | undefined, cwd = process.cwd()): PluginLoadResult {
  const plugins: PluginDef[] = [];
  const skipped: PluginLoadResult["skipped"] = [];

  for (const entry of configs ?? []) {
    if (entry.enabled === false) {
      skipped.push({ name: entry.name, reason: "已禁用（enabled:false）" });
      continue;
    }
    try {
      // 1. 内置官方插件
      const builtin = OFFICIAL_PLUGINS[entry.name];
      if (builtin) {
        const def = builtin(entry.config);
        if (def) {
          plugins.push(def);
        } else {
          skipped.push({ name: entry.name, reason: "配置无效（缺必填项），已跳过" });
        }
        continue;
      }
      // 2/3. 外部插件：node_modules 包或相对/绝对路径文件（JS，同步 require）
      const target = /^\.{1,2}[/\\]/.test(entry.name) || isAbsolute(entry.name)
        ? resolve(cwd, entry.name)
        : entry.name;
      let specifier = target;
      if (/^\.{1,2}[/\\]/.test(entry.name) || isAbsolute(entry.name)) {
        if (!existsSync(target)) {
          skipped.push({ name: entry.name, reason: "文件不存在", fatal: true });
          continue;
        }
        specifier = target;
      }
      const require = createRequire(join(cwd, "package.json"));
      // PLUG-011 热重载：清除 require 缓存——同一路径重新加载取最新内容（dev 插件迭代闭环）。
      // 插件子依赖仍走缓存（可接受，见 plugin-guide §8 遗留）
      try {
        const resolvedId = require.resolve(specifier);
        delete require.cache[resolvedId];
      } catch {
        /* 解析失败走下方 require 报错分支 */
      }
      const mod = require(specifier) as unknown;
      const def = resolvePluginExport(mod, entry.config);
      if (def) {
        // 配置优先级：doclight.json 显式 config > 插件自带的默认 config
        plugins.push(entry.config ? { ...def, config: entry.config } : def);
      } else {
        skipped.push({ name: entry.name, reason: "包导出不含 PluginDef（支持直接导出 / default / plugin / 工厂函数四种形态）" });
      }
    } catch (err) {
      // ESM-only 包 / 解析失败：诚实跳过，不中断其余插件；fatal 标记（热重载保留旧管线）
      const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
      skipped.push({ name: entry.name, reason: `加载失败：${msg}`, fatal: true });
    }
  }
  return { plugins, skipped };
}

/**
 * 一站解析站点配置中的插件（PLUG-008/009 接线，07 §7.5）：
 * loadConfig（项目根 + 文档目录两处 doclight.json）→ loadPluginsSync。
 * 跳过项输出警告（诚实原则：不伪造成功，13 §4.1 同源）。
 * 供 runDev / runBuild / runBundle / deploy / publish 等所有构建入口复用（决策⑪单一事实来源）。
 */
export function loadConfiguredPlugins(dir: string, cwd = process.cwd()): PluginDef[] {
  const cfg = loadConfig([join(cwd, "doclight.json"), join(resolve(dir), "doclight.json")]);
  const result = loadPluginsSync(cfg.plugins, cwd);
  for (const s of result.skipped) {
    console.warn(`[doclight] 插件「${s.name}」未加载：${s.reason}`);
  }
  return result.plugins;
}

/**
 * 热重载专用解析（PLUG-011）：任一插件加载期错误（fatal：文件缺失/语法错误）
 * 返回 null——dev server 保留旧管线继续服务（迭代中的半成品代码不打断浏览）。
 * 非致命跳过（禁用/配置无效）不影响重载。
 */
export function reloadConfiguredPlugins(dir: string, cwd = process.cwd()): PluginDef[] | null {
  const cfg = loadConfig([join(cwd, "doclight.json"), join(resolve(dir), "doclight.json")]);
  const result = loadPluginsSync(cfg.plugins, cwd);
  for (const s of result.skipped) {
    console.warn(`[doclight] 插件「${s.name}」未加载：${s.reason}`);
  }
  return result.skipped.some((s) => s.fatal) ? null : result.plugins;
}

/**
 * 插件热重载 watch 文件清单（PLUG-011）：
 * doclight.json（项目根 + 文档目录两处，插件列表变更即时生效）+
 * 配置中路径形态的插件源文件（相对/绝对路径项）。dev server 据此监听变更。
 */
export function configuredPluginWatchFiles(dir: string, cwd = process.cwd()): string[] {
  const configFiles = [join(cwd, "doclight.json"), join(resolve(dir), "doclight.json")];
  const cfg = loadConfig(configFiles);
  const files = configFiles.filter((f) => existsSync(f));
  for (const entry of cfg.plugins ?? []) {
    if (/^\.{1,2}[/\\]/.test(entry.name) || isAbsolute(entry.name)) {
      const abs = isAbsolute(entry.name) ? entry.name : resolve(cwd, entry.name);
      if (existsSync(abs)) files.push(abs);
    }
  }
  return files;
}
