---
title: 插件开发指南
summary: DocLight 插件从零到发布：快速开始、API 参考（9 钩子 + 11 插槽）、官方插件清单、常见模式与安全基线。
tags: [插件, 开发, 教程]
difficulty: 入门
---

# 插件开发指南（PLUG-007）

> 设计哲学（07-plugin-system §7.1）：**小内核，大生态**；插件 API 的第一个用户是 AI Agent，第二个才是人。
> 一个插件 = 一个声明对象（PluginDef），**无基类、无注册回调、零构建**。

---

## 1. 快速开始（2 分钟）

```bash
# ① 生成脚手架
doclight plugin new my-chart

# ② doclight.json 启用
# { "plugins": [ { "name": "./plugins/my-chart/plugin.js" } ] }

# ③ 跑测试（模板自带）
npx vitest run plugins/my-chart/plugin.test.js

# ④ 验证
doclight dev
```

生成的 `plugin.js` 是 CommonJS 工厂函数（零构建、零依赖），**全部钩子以注释骨架列出，删注释即启用**：

```javascript
module.exports = function createPlugin(config = {}) {
  return {
    name: "my-chart",
    version: "0.1.0",
    config,
    // beforeRender(md, ctx) { return md; },   ← 删掉注释即启用
    slotContent: {},
  };
};
```

---

## 2. 插件解析

`doclight.json` 的 `plugins` 数组项 `{ name, config, enabled }`，`name` 按以下顺序解析（首个命中胜出）：

| 形态 | 示例 | 说明 |
|---|---|---|
| 内置官方插件 | `"giscus"` / `"@doclight/plugin-mermaid"` | 随 CLI 内置，直接按名使用 |
| 项目内相对路径 | `"./plugins/my-chart/plugin.js"` / `"./plugins/my-chart/plugin.ts"` | 脚手架默认形态，同步加载 |
| npm 包 | `"doclight-plugin-xxx"` | 需已安装到项目 node_modules（JS / ESM-only 均可，PLUG-013） |

**导出形态**（四种均可）：直接导出 PluginDef 对象 / `{ default: ... }` / `{ plugin: ... }` / **工厂函数 `(config) => PluginDef | null`**（脚手架模板形态，返回 null 表示配置无效）。

**加载能力矩阵（PLUG-013，Node 原生、零额外依赖）**：

| 插件形态 | Node ≥ 23.6 | Node 22.x | 说明 |
|---|---|---|---|
| CommonJS 包 / .js 文件 | ✅ | ✅ | 任意版本 |
| ESM-only 包（type:module） | ✅ 默认 | ⚠️ 需 `--experimental-require-module` | require(esm) 同步加载，`{ default }` 形态解析 |
| .ts 插件文件（项目内） | ✅ 默认 | ⚠️ 需 `--experimental-strip-types` | type stripping；node_modules 内 .ts 不被 Node 处理（发布 JS） |
| ESM 含顶层 await（TLA） | ❌ | ❌ | require 同步限制，诚实跳过 + 专属提示（加载器保持同步契约，不为边缘场景异步化） |

**诚实原则**：无法解析的插件跳过并输出警告（含原因），不伪造成功、不中断其余插件。

---

## 3. API 参考

### 3.1 双上下文架构

插件钩子分两类上下文运行，**同一 PluginDef 声明两套钩子**：

| 上下文 | 运行环境 | 影响产物 | 钩子 |
|---|---|---|---|
| 构建时 | Node（CLI） | dev / SSG / bundle 三形态 | beforeRender / afterRender / extendMarked / addSearchFields / onBuild |
| 运行时 | 浏览器（展示层） | 页面交互 | init / onMount / onRouteChange / destroy |
| 插槽 | 双上下文共享 | 页面布局 | slotContent（构建时）+ app.insertSlot（运行时） |

### 3.2 九个钩子

| 钩子 | 签名 | 时机 | 常见场景 |
|---|---|---|---|
| `beforeRender` | `(md, ctx) => string` | Markdown 渲染前（正向链 A → B） | 变量替换、自定义语法预处理 |
| `afterRender` | `(html, ctx) => string` | HTML 渲染后（反向链） | 包裹元素、注入属性 |
| `extendMarked` | `(marked) => void \| unknown[]` | 初始化 marked 实例 | **自定义语法（图表/图表/容器）** |
| `addSearchFields` | `(doc) => Record<string, string>` | 构建索引时每篇一次 | 扩展搜索字段 |
| `onBuild` | `(ctx) => void \| BuildFile[]` | 所有文档渲染完成后 | rss.xml / manifest.json / sw.js 站点级产物 |
| `init` | `(app) => void` | app 就绪后一次 | 注册事件、初始化状态 |
| `onMount` | `(app) => void` | 每次页面挂载后 | 绑定事件、懒加载库 |
| `onRouteChange` | `(path, app) => false \| string \| void` | 路由变化 | 埋点；false 取消导航 / string 重定向 |
| `destroy` | `() => void` | 卸载 | 清理事件、释放资源 |

**RenderContext**（构建时钩子参数）：

```javascript
{
  path: "guide/quickstart.md",   // 文档相对路径
  title: "快速开始",              // 文档标题
  frontmatter: { /* ... */ },    // frontmatter 数据
  headings: [ { level, id, text } ],
  isFirstRender: true,
  base: "/docs",                 // 子路径基址（SSG；dev 为空）
  siteUrl: "https://…",          // 站点绝对 URL（可能为空）
}
```

**BuildContext**（onBuild 参数）：`{ outDir, siteTitle, base, siteUrl, docs: [{ path, title, summary, updatedAt, wordCount }] }`

**AppApi**（运行时钩子参数）：`insertSlot / removeSlot / navigate / currentPath / currentFrontmatter / on / emit`

### 3.4 资源声明（vendor / styles，PLUG-012）

重 vendor 依赖（如 mermaid.min.js ≈ 2.4MB）**不进默认产物**——插件在 PluginDef 上声明构建期资源，CLI 三形态按需接线（dev 端点按需服务 / SSG 按需拷贝 / bundle `--inline-vendor` 按需内联）：

```javascript
{
  name: "mermaid",
  vendor: [{ file: "mermaid.min.js", pkg: "mermaid", rel: "dist/mermaid.min.js" }],
  styles: ".doclight-mermaid { text-align: center; }",  // 注入 <style data-doclight-plugin-css>
}
```

- `vendor`：`Array<{ file, pkg, rel }>`——file 为 vendor 端点路径尾段（`/__doclight/vendor/<file>`），pkg/rel 从 node_modules 定位；构建管线 `collectVendorFiles()` 合并去重（同名首个命中胜出）。
- `styles`：插件 CSS 字符串，注入页面主样式之后（`<style data-doclight-plugin-css>`），可引用 THEME-001 设计令牌变量（`var(--color-error)` 等）。
- `capabilities`（CAP-001，可选）：插件提供的渲染能力声明（如 `["mermaid"]`），写入站点产物 `capabilities.json`——Agent 写内容前据此知道该插件启用了哪些语法/能力。不声明则不出现在能力清单。
- 未启用插件时其 vendor 不服务/不拷贝/不内联（诚实降级，不伪造资源）。

### 3.3 十一个插槽

| 插槽 | 位置 |
|---|---|
| `head:start` / `head:end` | `<head>` 起止 |
| `sidebar:before` / `sidebar:after` | 导航栏上下 |
| `topbar:before` / `topbar:after` | 顶栏上下 |
| `content:before` / `content:after` | 正文上下 |
| `toc:before` / `toc:after` | TOC 面板上下 |
| `footer` | 页面底部 |

`slotContent` 值为 HTML 字符串或函数（`(ctx) => string`，每次渲染重新执行——需 base 拼接时用函数）。

---

## 4. 官方插件（开箱即用）

`doclight plugin list` 查看。按名启用：

```json
{
  "title": "我的文档站",
  "siteUrl": "https://docs.example.com",
  "plugins": [
    { "name": "giscus", "config": { "repo": "owner/repo" } },
    { "name": "plausible", "config": { "domain": "docs.example.com" } },
    { "name": "rss", "config": { "limit": 20 } },
    { "name": "pwa", "config": { "name": "我的文档" } },
    { "name": "ai-chat", "config": { "endpoint": "https://proxy.example.com/ask" } },
    { "name": "mermaid" }
  ]
}
```

| 插件 | 能力 | 必填配置 | 降级 |
|---|---|---|---|
| giscus | GitHub Discussions 评论 | `repo` | 缺配置 → 禁用 |
| plausible | 隐私友好统计 | `domain` | 缺配置 → 禁用 |
| rss | rss.xml 订阅源 | siteUrl（顶层） | 无 siteUrl → 跳过并提示 |
| pwa | 可安装 + 离线可读 | 无 | — |
| ai-chat | BYO-LLM 文档问答 | `endpoint`（代理端点） | 缺配置 → 禁用 |
| **mermaid** | Mermaid 图表（容错渲染，PLUG-012 迁移） | 无 | 未启用 → 围栏按普通代码块；启用后渲染失败 → 保留源码 + 提示（不白屏） |

> **Mermaid 迁移说明（PLUG-012）**：Mermaid 原为内置默认扩展，已迁移为官方插件——重 vendor 依赖按需启用。启用后行为与内置时期一致（` ```mermaid ` 围栏 → `.doclight-mermaid` fallback + 运行时懒加载渲染 + 错误降级）；不配置即按普通代码块渲染，产物不含 mermaid.min.js。

---

## 5. 常见模式

### 5.1 自定义 Markdown 语法（extendMarked）

给 Markdown 加一种新语法，与内置 KaTeX / `:::tip` 同机制（marked `TokenizerAndRendererExtension`）：

```javascript
// 例：```chart 围栏 → JSON 配置渲染图表（加载器/内置库由运行时钩子接管）
extendMarked(marked) {
  marked.use({
    extensions: [{
      name: "doclightChart",
      level: "block",
      start(src) { return src.indexOf("```chart"); },
      tokenizer(src) {
        const m = /^```chart\n([\s\S]*?)\n?```/.exec(src);
        return m ? { type: "doclightChart", raw: m[0], spec: m[1] } : undefined;
      },
      renderer(token) {
        return `<div class="doclight-chart">${token.spec}</div>`;
      },
    }],
  });
},
```

**内容承载铁律（REND-002）**：渲染产物用「class 标记 + 子元素/文本承载」，**不依赖 `data-*` 属性**（DOMPurify 对 data-* 放行不稳定）；降级时源码可见、不白屏。

**双读友好（REND-004）**：扩展只在渲染产物层做标记，`.md` 原稿不动——llms.txt / MCP 的 Agent 仍读到纯 Markdown。

### 5.2 插槽注入（slotContent）

```javascript
slotContent: {
  "head:end": '<script defer data-domain="example.com" src="https://plausible.io/js/script.js"></script>',
  "content:after": (ctx) => `<div class="footer-note">当前页：${ctx.path}</div>`,
},
```

### 5.3 站点级产物（onBuild）

```javascript
onBuild(ctx) {
  return [{ path: "robots-extra.txt", content: `站点：${ctx.siteTitle}（${ctx.docs.length} 篇）` }];
},
```

产物相对 `outDir` 写入；**路径穿越防护**：越界路径被构建跳过并警告。

### 5.4 运行时交互（init / onMount）

```javascript
init(app) {
  app.on("doclight:routechange", (payload) => { /* 埋点 */ });
},
onMount(app) {
  const path = app.currentPath();
},
```

**PLUG-014 自动注册**：运行时钩子（init/onMount）随 doclight.json 配置自动接线，无需手写注册脚本：

- 构建时（dev/build/bundle 三形态）把 doclight.json `plugins` 序列化注入 `window.DOCLIGHT_PLUGIN_CONFIGS`；
- 插件页面脚本把运行时定义挂 `window.DOCLIGHT_PLUGINS["<name>"] = { init, onMount, ... }`（示例见 `@doclight/plugin-mermaid` 的 slotContent 脚本——挂表 + 自注册兜底双路径，按 name 幂等）；
- 展示层 mount 时 `registerConfiguredPlugins` 自动 `use`——显式 `config` 覆盖插件默认，`enabled:false` 跳过，无运行时定义的外部包插件静默跳过（其构建时钩子已生效）。

> 运行时定义仅官方插件/页面内联插件可提供（浏览器无法加载 Node 插件包）；外部 npm 插件包以构建时钩子（beforeRender/afterRender/onBuild 等）为主。

---

## 6. 安全基线（必读）

1. **密钥永不进页面**：API Key 等敏感配置放在自部署代理（如 ai-chat 的 endpoint 模式）；静态产物会被爬虫收录。
2. **LLM/用户输入用 textContent 注入**，不走 innerHTML——与「扩展内容承载铁律」同一基线。
3. **配置值进属性先转义**（`&` `<` `"`），防引号破坏。
4. 插槽注入的 HTML 是**插件作者的受信代码**（不经 DOMPurify）；Markdown 渲染产物全部过 DOMPurify。
5. **单插件异常隔离**：任何钩子抛异常只跳过该插件，不中断管线。

---

## 7. 测试模板

脚手架自带 `plugin.test.js`（vitest），断言钩子行为：

```javascript
const createPlugin = require("./plugin.js");
const { describe, expect, it } = require("vitest");

describe("my-chart", () => {
  it("自定义语法渲染为 class 标记", () => {
    // 参考 packages/cli/test/plugins.test.ts 的端到端模式：
    // BuildPluginPipeline 收集扩展 → @doclight/renderer render() 全管线断言
  });
});
```

内置插件测试参考：`packages/cli/test/plugins-official.test.ts`；端到端参考：`e2e/plugins.spec.ts`。

---

## 8. 三形态行为边界

| 形态 | 构建时钩子 | 插槽静态内容 | onBuild | 运行时钩子 |
|---|---|---|---|---|
| dev | ✅ | ✅（每页） | 不适用 | ✅（doclight.use） |
| SSG | ✅ | ✅（每页） | ✅ | ✅（doclight.use） |
| bundle | ✅ | ✅（壳层单实例，路由切换不重渲染） | 不适用（单文件） | ✅（doclight.use） |

**遗留**：ESM-only 插件包与 TS 插件文件加载（需异步 import，加载器当前同步）；插件热重载（dev 变更自动重载）；Mermaid 从内置迁移为官方插件（vendor 按需策略）。

**设计文档**：07-plugin-system（完整规格）；**源码入口**：`packages/core/src/plugin.ts`（类型）/ `packages/cli/src/plugin-loader.ts`（加载）/ `packages/cli/src/plugins-official/`（官方插件）。
