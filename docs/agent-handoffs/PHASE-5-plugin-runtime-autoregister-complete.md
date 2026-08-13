# TASK: PLUG-014 —— 插件运行时配置自动注册（2026-08-13）

> 状态：✅ 完成（`npm run verify` 全绿 6/6 + spec:check **44/44** + 单测 **374 passed / 1 环境跳过**）
> 上游：PHASE-5-remaining-complete（遗留③：插件运行时配置自动注册）+ 07 §7.5 插件解析
> 目标：doclight.json 插件 → 浏览器端 init/onMount 自动接线（此前运行时钩子需手写脚本调 doclight.use）

---

## 机制（双全局接线）

```
doclight.json plugins
   │ buildSite / dev server / bundleSite（CLI 层 loadConfig 同源注入）
   ▼
renderPage 注入 window.DOCLIGHT_PLUGIN_CONFIGS = [{name, config, enabled}]
   │
   ▼
插件页面脚本（如 @doclight/plugin-mermaid 的 slotContent）挂 window.DOCLIGHT_PLUGINS["mermaid"] = { init, onMount }
   │
   ▼
展示层 mount() → registerConfiguredPlugins(configs, defs, use)
   │ 显式 config 覆盖插件默认；enabled:false 跳过；无运行时定义的外部包静默跳过
   ▼
pluginMgr.use() → initApp → notifyMount（生命周期完整，与手写 doclight.use 等价）
```

## 交付清单（需求 ID 可追溯）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **PLUG-014** | 展示层 `registerConfiguredPlugins` 纯函数 + mount 接线（读 DOCLIGHT_PLUGIN_CONFIGS/DOCLIGHT_PLUGINS 自动注册） | `packages/display/src/plugin-manager.ts` + `packages/display/src/index.ts` | plugin-manager.test.ts 3 例（配置命中/显式 config 覆盖/禁用与无定义跳过/空输入） |
| **PLUG-014** | 构建侧注入：`renderPage` pluginConfigs 参数 + `pluginConfigsScript`（safeJson 序列化）；build/dev-server/bundle 三形态传参（CLI 层 loadConfig 同源）；BuildOptions/BundleOptions/DevServerOptions 扩展 | `packages/cli/src/site.ts` + `{build,bundle,dev-server,index}.ts` | mermaid-build.test.ts 断言产物含 DOCLIGHT_PLUGIN_CONFIGS + DOCLIGHT_PLUGINS；e2e 浏览器矩阵 |
| **PLUG-014** | mermaid 插件脚本改挂 DOCLIGHT_PLUGINS 注册表 + 保留自注册轮询兜底（双路径按 name 幂等——旧产物/无配置注入形态兼容） | `packages/cli/src/plugins-official/mermaid.ts` | plugins-official.test.ts（脚本含 DOCLIGHT_PLUGINS/window.doclight.use） |
| **PLUG-014** | specs：plugin.feature §PLUG-014（注入/定义表/自动注册/兼容兜底 4 场景） | `specs/features/plugin.feature` | spec:check 44/44 |
| **PLUG-014** | 文档：plugin-guide.md §5.4 自动注册说明（机制 + 外部包边界：运行时定义仅官方/内联插件） | `docs/plugin-guide.md` | dogfood 站点 |

## 关键设计决策

1. **配置与定义分离**：构建时只注入**配置**（DOCLIGHT_PLUGIN_CONFIGS——doclight.json 原始
   意图），插件**运行时代码**由页面脚本挂定义表（DOCLIGHT_PLUGINS）——浏览器无需加载
   Node 插件包；外部 npm 插件包以构建时钩子为主（文档化边界）。
2. **双路径幂等**：mermaid 脚本挂表（自动注册）+ 轮询 doclight.use 兜底（旧产物兼容）；
   PluginManager.use 按 name 防重复——双路径并行安全。
3. **CLI 单一事实来源**：pluginConfigs 与 buildPlugins 同源（loadConfig），三形态显式传参
   （buildSite 内部 loadConfig 只覆盖标准配置位置，temp/自定义 dir 需显式传）。
4. **纯函数可测**：registerConfiguredPlugins 无 DOM 依赖，display 单测直接断言（遵守
   展示层 <25KB gzip 门禁——纯逻辑零开销）。

## 体积门禁（无变化）

| 产物 | 门禁 | 实测 |
|---|---|---|
| 展示层 gzip | < 25KB | **9.8KB**（registerConfiguredPlugins 纯函数增量极小） |
| Node 内核 | < 30KB | **27.8KB** |

## 验证状态

```
npm run verify          # 6/6 全绿
npm run spec:check      # 44/44（PLUG-014 追溯）
单测 374 passed + 1 环境跳过（vitest 拦截动态 import 的 TS 热重载集成测试）
```

## 遗留（v1.0 收尾）

- ~~plugin-mermaid 迁移~~（PLUG-012 ✅）/ ~~ESM/TS 加载~~（PLUG-013 ✅）/
  ~~运行时配置自动注册~~（PLUG-014 ✅）——遗留三件套全部完成
- **云端 DocLight Space 托管**：用户已明确不做
- **npm 包名注册与域名**：待用户决策

## 验证命令

```bash
npm run verify          # 全绿
npm run spec:check      # 44/44
# 手动验证自动注册：doclight.json plugins:[mermaid] → doclight dev
# 页面 HTML 含 DOCLIGHT_PLUGIN_CONFIGS；mermaid 图表正常渲染（init/onMount 自动接线）
```
