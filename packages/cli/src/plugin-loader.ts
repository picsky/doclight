/**
 * 插件加载器（PLUG-007/008/009/013 接线，07 §7.5 插件解析）
 *
 * 将 doclight.json 的 plugins 数组（PluginConfig[]）解析为可执行的 PluginDef[]。
 * 解析顺序（首个命中胜出）：
 * 1. 内置官方插件注册表（plugins-official/index.ts，短名与 @doclight/plugin-* 包名）
 * 2. 项目 node_modules 中的 JS/ESM 插件包（createRequire 同步加载，包导出
 *    { default: PluginDef } / { plugin: PluginDef } / PluginDef 自身）
 * 3. 相对路径 JS/TS 插件文件（./plugins/my-plugin.{js,ts} → 同上导出形态）
 *
 * 诚实原则（决策⑪/⑬同源）：无法解析的插件**不伪造成功**——收集进 skipped
 * （含原因），供 CLI 层警告输出；损坏的插件不中断其余。
 *
 * PLUG-013 加载能力矩阵（Node 原生，零额外依赖）：
 * - Node ≥ 23.6（默认）：require(esm) 加载 ESM-only 包 ✓ + type stripping 加载
 *   .ts 插件文件 ✓（.ts 仅限项目内相对路径，node_modules 内 .ts 被 Node 拒绝）
 * - Node 22.x：需 --experimental-require-module + --experimental-strip-types
 *   （.nvmrc=22 与本机 26 之间存在版本差，低版本下 ESM/TS 加载失败会诚实跳过并提示）
 * - 顶层 await（TLA）的 ESM 插件：require 同步限制无法加载（Node 报错）——
 *   诚实跳过 + 专属提示；保持加载器同步契约（构建管线同步），不为边缘场景异步化
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
      // PLUG-013：加载失败（ESM 顶层 await / 低版本 Node / 语法错误等）——诚实跳过，
      // 不中断其余插件；fatal 标记（热重载保留旧管线）。TLA 场景给专属提示。
      const msg = err instanceof Error ? (err.message.split("\n")[0] ?? err.message) : String(err);
      const hint = /top-level await/i.test(msg)
        ? "（ESM 插件含顶层 await，加载器同步契约无法加载——去掉顶层 await 或改用无 TLA 的导出）"
        : /strip/i.test(msg) && /node_modules/i.test(msg)
          ? "（Node 不处理 node_modules 内的 .ts 文件——插件包请发布编译后的 JS）"
          : "";
      skipped.push({ name: entry.name, reason: `加载失败：${msg}${hint}`, fatal: true });
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
 * PLUG-013 模块形态判定：ESM/TS 走 import（query 绕过缓存）vs CJS 走 require（缓存清除）。
 * - .mjs/.mts/.ts → ESM 路径（Node type stripping / require(esm) 语义）
 * - .cjs/.cts → CJS 路径
 * - 包：读 package.json type === "module" → ESM
 */
function isEsmLikeTarget(abs: string, cwd: string): boolean {
  if (/\.mjs$/i.test(abs) || /\.mts$/i.test(abs) || /\.ts$/i.test(abs)) return true;
  if (/\.cjs$/i.test(abs) || /\.cts$/i.test(abs)) return false;
  try {
    const require = createRequire(join(cwd, "package.json"));
    const pkgJson = require.resolve(join(abs, "package.json"));
    const pkg = JSON.parse(readFileSync(pkgJson, "utf8")) as { type?: string };
    return pkg.type === "module";
  } catch {
    return false;
  }
}

/**
 * 异步加载外部插件模块（PLUG-013/011 热重载路径）：
 * - ESM/TS：import() + file URL 时间戳 query——绕过 Node 模块 registry 缓存
 *   （require(esm) 的缓存不在 require.cache，delete 无效，spike 实测）
 * - CJS：require + delete require.cache（现有语义）
 */
async function loadExternalPluginAsync(entryName: string, cwd: string): Promise<unknown> {
  const isPath = /^\.{1,2}[/\\]/.test(entryName) || isAbsolute(entryName);
  const require = createRequire(join(cwd, "package.json"));
  let abs: string;
  if (isPath) {
    abs = resolve(cwd, entryName);
    if (!existsSync(abs)) throw new Error("文件不存在");
  } else {
    abs = require.resolve(entryName); // 包名解析（解析失败抛错，走调用方 catch）
  }
  if (isEsmLikeTarget(abs, cwd)) {
    const url = pathToFileURL(abs);
    url.searchParams.set("t", String(Date.now()));
    // @vite-ignore：vitest/vite-node 下跳过模块转换与缓存，走原生 import（插件文件是外部代码）
    return await import(/* @vite-ignore */ url.href);
  }
  try {
    delete require.cache[require.resolve(abs)];
  } catch {
    /* 解析失败走下方 require 报错分支 */
  }
  return require(abs);
}

/**
 * 异步加载插件（热重载专用，PLUG-013）：与 loadPluginsSync 同解析顺序与诚实语义，
 * 但外部插件走 loadExternalPluginAsync——ESM/TS 插件变更后取最新（import + query 绕过缓存）。
 */
export async function loadPluginsAsync(configs: PluginConfig[] | undefined, cwd = process.cwd()): Promise<PluginLoadResult> {
  const plugins: PluginDef[] = [];
  const skipped: PluginLoadResult["skipped"] = [];

  for (const entry of configs ?? []) {
    if (entry.enabled === false) {
      skipped.push({ name: entry.name, reason: "已禁用（enabled:false）" });
      continue;
    }
    try {
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
      const mod = await loadExternalPluginAsync(entry.name, cwd);
      const def = resolvePluginExport(mod, entry.config);
      if (def) {
        plugins.push(entry.config ? { ...def, config: entry.config } : def);
      } else {
        skipped.push({ name: entry.name, reason: "包导出不含 PluginDef（支持直接导出 / default / plugin / 工厂函数四种形态）" });
      }
    } catch (err) {
      const msg = err instanceof Error ? (err.message.split("\n")[0] ?? err.message) : String(err);
      const hint = /top-level await/i.test(msg)
        ? "（ESM 插件含顶层 await，加载器同步契约无法加载——去掉顶层 await 或改用无 TLA 的导出）"
        : /strip/i.test(msg) && /node_modules/i.test(msg)
          ? "（Node 不处理 node_modules 内的 .ts 文件——插件包请发布编译后的 JS）"
          : "";
      skipped.push({ name: entry.name, reason: `加载失败：${msg}${hint}`, fatal: true });
    }
  }
  return { plugins, skipped };
}

/**
 * 热重载专用解析（PLUG-011/013）：任一插件加载期错误（fatal：文件缺失/语法错误）
 * 返回 null——dev server 保留旧管线继续服务（迭代中的半成品代码不打断浏览）。
 * 非致命跳过（禁用/配置无效）不影响重载。
 * 异步版：ESM/TS 插件经 import + query 绕过 Node 模块缓存，变更后取最新（PLUG-013）。
 */
export async function reloadConfiguredPluginsAsync(dir: string, cwd = process.cwd()): Promise<PluginDef[] | null> {
  const cfg = loadConfig([join(cwd, "doclight.json"), join(resolve(dir), "doclight.json")]);
  const result = await loadPluginsAsync(cfg.plugins, cwd);
  for (const s of result.skipped) {
    console.warn(`[doclight] 插件「${s.name}」未加载：${s.reason}`);
  }
  return result.skipped.some((s) => s.fatal) ? null : result.plugins;
}

/**
 * 热重载专用解析（PLUG-011）：任一插件加载期错误（fatal：文件缺失/语法错误）
 * 返回 null——dev server 保留旧管线继续服务（迭代中的半成品代码不打断浏览）。
 * 非致命跳过（禁用/配置无效）不影响重载。
 * 同步版（CJS 插件）：ESM/TS 插件热重载请用 reloadConfiguredPluginsAsync（PLUG-013）。
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
