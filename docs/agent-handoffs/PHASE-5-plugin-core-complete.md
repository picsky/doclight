# TASK: Phase 5 插件系统核心（PLUG-003 ~ PLUG-009）（2026-08-13）

> 状态：✅ 完成（`npm run verify` 全绿 6/6，单测 **294/294** + spec:check 30/30）
> 上游：08-roadmap Phase 5 + 07-plugin-system 完整规格
> **下一步 = Phase 5 剩余**：官方插件样例（giscus/plausible/rss 等）+ 插件脚手架（`doclight plugin new`）+ 主题生态 + 迁移指南
> 本文件是新会话第一入口（与 PHASE-4-user-decisions-complete 同属 Phase 5 序列）

---

## 本次完成清单（需求 ID 可追溯，specs/features/plugin.feature）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **PLUG-003** | 插件类型与核心 API：PluginDef / RenderContext / SearchDoc / AppApi / SlotName / PluginConfig / SLOT_NAMES(11) | `packages/core/src/plugin.ts` + `packages/core/src/index.ts` 导出 + `packages/core/test/core.test.ts` | core.test.ts 2 例（SLOT_NAMES 11 个 + PluginDef 完整承载） |
| **PLUG-004** | 展示层插件管理器：use/remove/initApp/notifyMount/notifyRouteChange/subscribeRouteChange/destroy/pluginSlotApi，与事件总线/路由钩子/插槽系统集成 | `packages/display/src/plugin-manager.ts` + `packages/display/src/index.ts` mount() 集成 + `packages/display/test/plugin-manager.test.ts` | plugin-manager.test.ts 11 例（注册/防重/init 调用/延迟注册/mount/route 取消/重定向/异常隔离/destroy/具名插槽） |
| **PLUG-005** | 插槽系统：11 个命名插槽的增删查渲染，支持字符串/DOM 元素/函数三种内容类型，data-doclight-slot DOM 标记 | `packages/display/src/slots.ts` + `packages/cli/src/site.ts`（renderPage slotContent 选项 + 模板 slot() 标记注入）+ `packages/display/test/slots.test.ts` | slots.test.ts 8 例（拼接/幂等/remove/removeAll/函数重执行/非法容错/clear/11 全位） |
| **PLUG-006** | 构建管线钩子：beforeRender 正向链 / afterRender 反向链 / extendMarked / addSearchFields / slotContent | `packages/cli/src/plugins.ts` + `packages/renderer/src/core/markdown.ts`（extraMarkedExtensions）+ `packages/renderer/src/index.ts`（RenderOptions 透传）+ `packages/cli/test/plugins.test.ts` | plugins.test.ts 8 例（透传/正向/反向/异常隔离/搜索合并/插槽合并/size） |
| **PLUG-008** | doclight.json plugins 数组：schema 扩展 + config 宽松读取 | `contracts/doclight.schema.json` + `packages/cli/src/config.ts` + `packages/cli/test/config.test.ts` | config.test.ts 2 例（宽松读取含过滤非法项 + schema 登记） |
| **PLUG-009** | CLI 三形态集成：dev server / SSG build 走 beforeRender → render → afterRender 管线；renderPage 模板含 11 个 data-doclight-slot 标记 | `packages/cli/src/dev-server.ts`（BuildPluginPipeline 集成 + extractFrontmatter helper）+ `packages/cli/src/build.ts`（BuildPluginPipeline + title/finalTitle 分离）| verify 全绿（dev/build 渲染管线无回归） |

## 关键实现细节

### 双上下文插件架构
- **构建时钩子**（Node）：beforeRender / afterRender / extendMarked / addSearchFields —— 影响 SSG/dev/bundle 产物
- **运行时钩子**（浏览器）：init / onMount / onRouteChange / destroy —— 由展示层 PluginManager 在对应生命周期调用
- **插槽系统**：双上下文共享同一套 slot 名（11 个），构建时注入静态 HTML，运行时操作 DOM 追加动态内容
- **钩子链顺序**：beforeRender 正向（A → B → marked），afterRender 反向（marked → B → A），设计文档 07 §7.3.3

### 体积变化
- 展示层：8.1KB → **10.4KB gzip**（+2.3KB，仍远低于 25KB 硬门禁）
- Node 内核：27.8KB → 27.8KB（无变化，插件类型仅占类型空间）

### 模板插槽标记
`renderPage` 在 11 个位置插入 `<span data-doclight-slot="<name>">`：
- head:start / head.end（`<head>` 起止）
- sidebar:before / sidebar:after（导航栏上下）
- topbar:before / topbar:after（顶栏上下）
- content:before / content:after（正文上下）
- toc:before / toc:after（TOC 面板上下）
- footer（页面底部）
构建时通过 `slotContent` 选项注入静态 HTML（data-doclight-static 标记），运行时 SlotManager.renderToDom 追加动态内容（data-doclight-dynamic 标记）。

### 插件配置加载
`loadConfig` 宽松读取 `plugins` 数组：过滤非对象项 / 缺 name 项，默认 `enabled: true`，非法项静默跳过。

## 依赖变更
**无新增依赖**（纯逻辑扩展，守 ADR-0002 体积门禁）

## 端到端实测

```
npm run verify          # 6/6 全绿（lint/typecheck/test 294/294/size/contract/e2e）
npm run spec:check      # 30/30 追溯通过（PLUG-003 ~ PLUG-009 全部在 .feature + packages/*）
npm run build           # display.js 10.4KB gzip + renderer.js 4.7KB gzip

单测覆盖（30 个新增）：
  packages/core/test/core.test.ts          +2（SLOT_NAMES + PluginDef）
  packages/cli/test/plugins.test.ts        +8（BuildPluginPipeline 全钩子）
  packages/cli/test/config.test.ts         +2（plugins 读取 + schema）
  packages/display/test/slots.test.ts      +8（SlotManager 全操作）
  packages/display/test/plugin-manager.test.ts +11（PluginManager 全生命周期）
```

## 遗留问题（Phase 5 剩余）

- **官方插件样例**（6+ 个）：@doclight/plugin-giscus / plugin-plausible / plugin-pwa / plugin-ai-chat / plugin-rss / plugin-mermaid（从内置迁移）
- **插件脚手架**：`doclight plugin new <name>` 生成模板
- **插件开发文档**：完整的 API 参考 + 教程 + 测试模板
- **主题生态**：主题包规范 + 3+ 官方主题 + 主题市场
- **迁移工具**：MkDocs / GitBook → DocLight 迁移指南
- **插件热重载**：dev 模式下插件文件变更自动重载（设计文档 07 §7 提及，本次未实现）
- **插件卸载 + 清理**：runtime 的 unregister 已实现，热重载场景的完整清理待补

## 验证命令

```bash
npm run verify          # 全绿（含 e2e）
npm run spec:check      # 30/30 追溯
npm run build           # display.js 10.4KB / renderer.js 4.7KB

# 手动验证插件配置：
cat > doclight.json <<'EOF'
{
  "title": "Test Site",
  "plugins": [
    { "name": "giscus", "config": { "repo": "owner/repo" } },
    { "name": "plausible" }
  ]
}
EOF
node packages/cli/src/index.ts dev --dir docs    # dev 加载插件配置
node packages/cli/src/index.ts build --dir docs  # SSG 走构建管线
```

## 需求 ID 链路

```
07-plugin-system（设计文档）
  → PLUG-001 事件总线（Phase 1）
  → PLUG-002 路由钩子（Phase 1）
  → PLUG-003 插件类型（本次）
  → PLUG-004 展示层插件管理器（本次）
  → PLUG-005 插槽系统（本次）
  → PLUG-006 构建管线钩子（本次）
  → PLUG-008 配置与契约（本次）
  → PLUG-009 CLI 集成（本次）
  → PLUG-007 官方插件样例（遗留）
```

## 体积门禁

| 产物 | 门禁 | 实测 | 状态 |
|---|---|---|---|
| 展示层 gzip | < 25KB | **10.4KB** | ✅ |
| Node 内核 | < 30KB | **27.8KB** | ✅ |
