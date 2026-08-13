/**
 * doclight plugin —— 插件脚手架（PLUG-007 开发体验，07 §7.5 插件包约定）
 *
 * 子命令：
 * - plugin new <name> [--dir <path>]  生成插件模板（plugin.js + README.md + plugin.test.js）
 * - plugin list                        列出内置官方插件
 *
 * 模板形态（Agent 也能写，07 §7.1）：
 * - CommonJS 工厂函数（module.exports = (config) => PluginDef），零构建、零依赖，
 *   同步 require 加载（插件加载器四种导出形态之一）
 * - 全部钩子以注释骨架列出——删注释即启用（渐进式复杂度）
 * - plugin.test.js 可直接 `npx vitest run`（断言钩子行为的测试模板）
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { OFFICIAL_PLUGIN_NAMES } from "./plugins-official/index.ts";

export interface PluginNewResult {
  /** 插件目录 */
  dir: string;
  /** 创建的文件（相对 cwd） */
  created: string[];
  /** 已在、跳过的文件 */
  skipped: string[];
  /** 下一步指引（含 doclight.json 配置片段，双读友好） */
  nextSteps: string[];
}

/** 插件名校验：小写字母/数字/连字符（npm 包名风格，无作用域） */
function validName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(name);
}

/** 生成插件模板（已存在则跳过，不覆盖） */
export function pluginNew(name: string, options: { dir?: string } = {}): PluginNewResult {
  if (!validName(name)) {
    throw new Error(`插件名不合法：${name}（仅小写字母/数字/连字符，如 my-chart）`);
  }
  const base = resolve(options.dir ?? "plugins");
  const pluginDir = join(base, name);
  const created: string[] = [];
  const skipped: string[] = [];

  const write = (rel: string, content: string): void => {
    const file = join(pluginDir, rel);
    if (existsSync(file)) {
      skipped.push(rel);
      return;
    }
    mkdirSync(join(pluginDir, rel.split("/").slice(0, -1).join("/")), { recursive: true });
    writeFileSync(file, content);
    created.push(rel);
  };

  write(
    "plugin.js",
    pluginJsTemplate(name)
  );
  write("README.md", readmeTemplate(name));
  write("plugin.test.js", testTemplate(name));

  const configPath = `./plugins/${name}/plugin.js`;
  return {
    dir: pluginDir,
    created,
    skipped,
    nextSteps: [
      `1. 编辑 plugins/${name}/plugin.js（删除需要钩子的注释即可启用）`,
      `2. doclight.json 增加插件声明：`,
      `   { "plugins": [ { "name": "${configPath}" } ] }`,
      `3. 单测：npx vitest run plugins/${name}/plugin.test.js`,
      `4. 验证：doclight dev / doclight build`,
    ],
  };
}

/** 列出内置官方插件（名称 + 一句简介，Agent/人双读） */
export function pluginList(): Array<{ name: string; description: string }> {
  const desc: Record<string, string> = {
    giscus: "Giscus 评论（GitHub Discussions，config.repo 必填）",
    plausible: "Plausible 站点统计（隐私友好，config.domain 必填）",
    rss: "RSS 订阅源（rss.xml，需 doclight.json siteUrl）",
    pwa: "PWA 支持（manifest.json + sw.js，可安装离线可读）",
    "ai-chat": "BYO-LLM 文档问答（config.endpoint 代理端点，密钥不进页面）",
    mermaid: "Mermaid 图表（容错渲染，```mermaid 围栏 + 运行时懒加载，按需 vendor）",
  };
  return OFFICIAL_PLUGIN_NAMES.map((name) => ({ name, description: desc[name] ?? "" }));
}

/* ================= 模板（Agent/人双读，中文注释） ================= */

function pluginJsTemplate(name: string): string {
  return `/**
 * doclight 插件：${name}（脚手架生成，PLUG-007）
 *
 * 形态：CommonJS 工厂函数（零构建、零依赖；加载器同步 require 支持）。
 * 删掉钩子的注释即启用该钩子。全部钩子列表见 docs/plugin-guide.md。
 *
 * @param {Record<string, unknown>} [config] doclight.json 中的 config
 * @returns {import("doclight-core").PluginDef | null} 返回 null 表示配置无效（加载器跳过）
 */
module.exports = function createPlugin(config = {}) {
  return {
    name: "${name}",
    version: "0.1.0",
    config,

    /* ===== 构建时钩子（Node 端，影响 dev / SSG / bundle 产物） ===== */

    // Markdown 渲染前变换（正向链：A → B → marked）
    // beforeRender(md, ctx) {
    //   return md.replace("TODO", "DONE");
    // },

    // HTML 渲染后变换（反向链：marked → B → A）
    // afterRender(html, ctx) {
    //   return html;
    // },

    // 扩展 marked 语法（自定义围栏/容器等，与内置 KaTeX/容器同机制）
    // extendMarked(marked) {
    //   marked.use({ extensions: [{ name: "${name}Ext", level: "block", start: (s) => s.indexOf(":"), tokenizer() {}, renderer() {} }] });
    // },

    // 扩展搜索索引字段（每篇文档调用一次）
    // addSearchFields(doc) {
    //   return { extra: String(doc.frontmatter.extra ?? "") };
    // },

    // 构建完成后产出站点级文件（rss.xml / manifest.json / sw.js 等）
    // onBuild(ctx) {
    //   return [{ path: "hello.txt", content: "hello " + ctx.siteTitle }];
    // },

    /* ===== 运行时钩子（浏览器端） ===== */

    // 初始化（app 实例就绪后调用一次）
    // init(app) {
    //   app.on("doclight:routechange", () => {});
    // },

    // 页面挂载后（每次路由切换内容注入完成）
    // onMount(app) {
    //   const path = app.currentPath();
    // },

    // 路由变化（返回 false 取消导航 / 返回字符串重定向）
    // onRouteChange(path, app) {},

    // 卸载清理（释放资源、移除事件）
    // destroy() {},

    /* ===== 插槽（构建时静态 HTML / 运行时 DOM 双上下文） ===== */

    // 11 个插槽：head:start / head:end / sidebar:before / sidebar:after /
    // topbar:before / topbar:after / content:before / content:after /
    // toc:before / toc:after / footer
    slotContent: {
      // "content:after": '<div class="${name}"></div>',
    },
  };
};
`;
}

function readmeTemplate(name: string): string {
  return `# ${name}

（脚手架生成）doclight 插件——补一段简介：它解决什么问题？

## 配置

\`\`\`json
{ "plugins": [ { "name": "./plugins/${name}/plugin.js" } ] }
\`\`\`

| 配置项 | 类型 | 必填 | 说明 |
|---|---|---|---|
| （示例）endpoint | string | 是 | 代理端点地址 |

## 降级策略

补一句：配置缺失/加载失败时站点如何表现（应零影响）。

## 测试

\`\`\`bash
npx vitest run plugins/${name}/plugin.test.js
\`\`\`
`;
}

function testTemplate(name: string): string {
  return `/**
 * ${name} 插件测试（脚手架生成）
 * 运行：npx vitest run plugins/${name}/plugin.test.js
 */
const { describe, expect, it } = require("vitest");
const createPlugin = require("./plugin.js");

describe("${name}", () => {
  it("工厂返回合法 PluginDef", () => {
    const plugin = createPlugin();
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe("${name}");
  });

  // 按需补：钩子行为断言（参考 packages/cli/test/plugins.test.ts）
});
`;
}
