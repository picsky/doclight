# TASK: PLUG-012 —— plugin-mermaid 从内置迁移为官方插件（2026-08-13）

> 状态：✅ 完成（`npm run verify` 全绿 6/6 + spec:check **42/42** + 单测 **364/364**）
> 上游：PHASE-5-remaining-complete（遗留①：plugin-mermaid 迁移）+ 08-roadmap Phase 5
> 范围：渲染内核 / 注册表 / 展示层 / vendor 按需策略 四链路全量迁移

---

## 为什么迁移

Mermaid 是**重 vendor 依赖扩展**（mermaid.min.js ≈ 2.4MB），此前作为内置默认扩展：
- 任何站点（哪怕不用图表）产物都拷贝 mermaid.min.js（SSG dist-site/vendor）
- 展示层 bundle 内置 mermaid 增强逻辑（虽懒加载，语义上仍内置）

迁移为官方插件后：**按需启用**——doclight.json 配置 `plugins: ["mermaid"]` 才提供
围栏渲染 + vendor + 运行时增强；未配置时 ` ```mermaid ` 按普通代码块渲染（源码
可见可复制），产物零 mermaid 痕迹。与 KaTeX/容器（轻依赖内置）形成分级：
轻/零依赖扩展内置默认，重依赖扩展插件按需。

## 交付清单（需求 ID 可追溯）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **PLUG-012** | PluginDef 新增 `vendor` / `styles` 声明（构建期资源：vendor 按需服务/拷贝/内联；styles 注入 `<style data-doclight-plugin-css>`） | `packages/core/src/plugin.ts`（PluginVendorFile） | plugins.test.ts 4 例（合并去重/非法过滤/空表/顺序拼接） |
| **PLUG-012** | mermaid 官方插件：extendMarked 围栏 fallback（```mermaid → .doclight-mermaid + 源码子元素）+ vendor 声明 + styles + slotContent 运行时脚本（doclight.use 注册 init/onMount：懒加载 mermaid.min.js → 渲染 SVG → 错误降级提示，100% 不白屏） | `packages/cli/src/plugins-official/mermaid.ts`（自包含，零 marked 依赖——本地最小扩展类型） | plugins-official.test.ts 6 例 + mermaid-build.test.ts 端到端（启用/默认降级双向断言） |
| **PLUG-012** | 渲染内核移除内置 mermaid：注册表 DEFAULT_EXTENSIONS 4→3、renderCodeBlock 删 mermaid 分流、types enhance 删 "mermaid" | `packages/renderer/src/extensions/{registry,code,types}.ts` + `core/{markdown,sanitize}.ts` 注释 | extension.test.ts 更新（白名单 3 个；未启用时 mermaid 围栏 = 普通代码块） |
| **PLUG-012** | 展示层移除内置 renderMermaid（VENDOR_SCRIPT_GLOBALS/渲染循环/错误提示逻辑） | `packages/display/src/extensions.ts` + `index.ts` 注释 | extensions.test.ts 不变（纯函数）；e2e/extensions.spec.ts 以插件形式验证 |
| **PLUG-012** | 三形态 vendor 按需接线：`site.ts` VENDOR_FILES 删 mermaid + copyVendor(outDir, extra?)；`dev-server.ts` resolveVendorFiles（内置 + 启用插件，未启用 404）；`bundle.ts` inlineVendorHtml(extra?)（--inline-vendor 按需内联）；`build.ts` copyVendor/pluginCss 传参；`renderPage` pluginCss 注入 | `packages/cli/src/{site,dev-server,bundle,build}.ts` | build.test.ts（默认不含 mermaid.min.js）+ bundle.test.ts（默认不内联 mermaid）+ dev-server 端到端（e2e/extensions.spec.ts） |
| **PLUG-012** | 官方插件注册表 5→6：短名 + @doclight/plugin-mermaid 均可解析；plugin list 含 mermaid | `packages/cli/src/plugins-official/index.ts` + `plugin-new.ts` | plugins-official.test.ts + plugin-new.test.ts 更新 |
| **PLUG-012** | specs：plugin.feature §PLUG-012（vendor/styles 声明 + 迁移语义 + 三形态按需）+ render-ext.feature 更新（默认 3 扩展；REND-003 由插件提供） | `specs/features/{plugin,render-ext}.feature` | spec:check 42/42 |
| **PLUG-012** | 文档：plugin-guide.md §3.4 资源声明 + §4 官方插件表（mermaid 行 + 迁移说明） | `docs/plugin-guide.md` | dogfood 站点 |

## 关键设计决策

1. **迁移语义 = 默认降级，启用即等值**：不配置 → mermaid 围栏按普通代码块（可读
   可复制）；配置 `plugins: ["mermaid"]` → 行为与内置时期一致（fallback 结构 +
   运行时容错渲染 + 主题跟随 data-theme）。零配置站点体积变小（省 mermaid.min.js）。
2. **插件自包含**：mermaid.ts 内联 escapeHtml / 运行时脚本 / marked 扩展最小类型
   （CLI 零 marked 依赖，类型本地定义）；样式从 site.ts 迁入插件 styles 声明。
3. **运行时脚本经 slotContent + doclight.use 自注册**：脚本同步注入（content:after），
   轮询等待 window.doclight 就绪（module script 延迟执行）；use 注册 init（首屏）+
   onMount（路由切换）——与 PluginManager 生命周期无缝衔接，**不依赖任务③的
   自动注册机制**（后续任务③可加 window.DOCLIGHT_PLUGINS 注册表，两者幂等）。
4. **vendor 按需 = 诚实降级**：未启用插件时 dev 端点 404 / SSG 不拷贝 / bundle 不
   内联；启用后三形态按需提供。collectVendorFiles 按文件名去重（首个命中胜出）。
5. **样式归属插件**：mermaid CSS（.doclight-mermaid 等）随插件 styles 注入
   `<style data-doclight-plugin-css>`（主样式之后），仍可引用 THEME-001 令牌变量。

## 体积门禁（无变化）

| 产物 | 门禁 | 实测 |
|---|---|---|
| 展示层 gzip | < 25KB | **9.8KB**（移除 renderMermaid 后从 10.4KB 进一步下降） |
| Node 内核 | < 30KB | **27.8KB**（类型仅类型空间） |

**无新增运行时依赖**（mermaid 插件消费既有 mermaid 依赖；插件化不改依赖清单）。

## 端到端实测

```
npm run verify          # 6/6 全绿（lint / typecheck / test 364 / size / contract / e2e）
npm run spec:check      # 42/42（PLUG-012 全量追溯）
e2e/extensions.spec.ts  # Mermaid 正常渲染 SVG + 错误语法容错（dev server 启用插件形态）
packages/cli/test/mermaid-build.test.ts  # 启用→fallback+vendor+脚本+CSS；默认→普通代码块+无 vendor
```

## 遗留（与本任务无关，仍待 v1.0 收尾）

- **ESM-only 插件包与 TS 插件文件加载**：加载器同步 require，待异步 import 升级（任务②）
- **插件运行时配置自动注册**：doclight.json 插件浏览器端 init/onMount 自动接线（任务③；
  mermaid 已用 slotContent 自注册先行，任务③统一后幂等兼容）
- **云端 DocLight Space 托管**：用户已明确不做
- **npm 包名注册与域名**：待用户决策

## 验证命令

```bash
npm run verify          # 全绿（含 e2e）
npm run spec:check      # 42/42
# 手动验证 mermaid 插件：
doclight init demo && cd demo
# docs/README.md 写 ```mermaid\ngraph TD\n  A-->B\n```
# doclight.json 加 "plugins": [{ "name": "mermaid" }]
doclight dev            # 页面图表渲染 SVG；错误语法 → 源码 + 提示（不白屏）
doclight build          # dist-site/vendor/mermaid.min.js 存在；不配置则不存在
```
