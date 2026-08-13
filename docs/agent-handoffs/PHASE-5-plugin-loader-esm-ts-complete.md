# TASK: PLUG-013 —— ESM-only 插件包与 TS 插件文件加载（2026-08-13）

> 状态：✅ 完成（`npm run verify` 全绿 6/6 + spec:check **43/43** + 单测 **371 passed / 1 skipped**）
> 上游：PHASE-5-remaining-complete（遗留②：ESM-only 插件包与 TS 插件文件加载）+ 07 §7.5 插件解析
> 背景：加载器原为同步 require——遗留标注「待异步 import 升级」；实测 Node 26 原生能力已覆盖大半，本任务完成能力确认 + 异步热重载升级 + 诚实降级文档化

---

## 关键调研结论（.spike/ 保留证据）

Node v26.1.0（本机）实测（`loader-capabilities-spike.mjs` / `esm-cache-spike.mjs` / `import-query-spike.mjs`）：

| 能力 | 结果 | 说明 |
|---|---|---|
| require(ESM-only 包) | ✅ 原生 | `require(esm)` 默认启用（Node ≥ 22.12 实验 / ≥ 23 默认）；导出含 `{ __esModule, default }` |
| require(.ts 文件) | ✅ 原生 | type stripping 默认（Node ≥ 23.6）；仅限**项目内相对路径**——node_modules 内 .ts 被 Node 拒绝 |
| require(ESM 顶层 await) | ❌ | 同步限制：`require() cannot be used on an ESM graph with top-level await` |
| require(esm) 缓存 | ⚠️ | 缓存**不在 require.cache**——`delete require.cache[id]` 无效（深层 module registry） |
| import() + URL 时间戳 query | ✅ | 绕过 registry 缓存（ESM/TS 有效；CJS 无效——CJS 走 require 缓存） |

## 交付清单（需求 ID 可追溯）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **PLUG-013** | 加载能力确认：ESM-only 包 / .ts 插件文件在 Node ≥ 23.6 原生可加载（resolvePluginExport 已兼容 default 形态）；TLA / node_modules 内 .ts / 低版本 Node 诚实跳过 + 专属提示 | `packages/cli/src/plugin-loader.ts`（头注释能力矩阵 + catch 提示分流） | plugin-loader.test.ts 17 例（ESM 包 / .ts 文件 / TLA 跳过 / node_modules 内 .ts 提示） |
| **PLUG-013** | 异步加载路径 `loadPluginsAsync` + `reloadConfiguredPluginsAsync`：ESM/TS 走 import() + file URL 时间戳 query（绕过 module registry 缓存）；CJS 保持 require + cache 清除（spike 实测分流依据） | `packages/cli/src/plugin-loader.ts`（isEsmLikeTarget / loadExternalPluginAsync） | 真实 Node 子进程测试 2 例（.ts / ESM 包 v1→v2 热重载）+ fatal 文件缺失 1 例 |
| **PLUG-013** | dev server reloadPlugins 回调支持 async（await 兼容同步返回值）；runDev 切换到 `reloadConfiguredPluginsAsync` | `packages/cli/src/dev-server.ts` + `packages/cli/src/index.ts` | plugin-reload.test.ts（CJS 热重载照常；TS 集成测试 vitest 环境跳过——vite-node 拦截动态 import，绕过逻辑由子进程测试覆盖） |
| **PLUG-013** | specs：plugin.feature §PLUG-013（ESM/TS 加载 + 热重载 + TLA 诚实跳过 + 低版本降级） | `specs/features/plugin.feature` | spec:check 43/43 |
| **PLUG-013** | 文档：plugin-guide.md §2 加载能力矩阵（Node 版本 × 插件形态） | `docs/plugin-guide.md` | dogfood 站点 |

## 关键设计决策

1. **同步契约保持，热重载异步化**：构建管线（buildSite/dev server 渲染）同步是架构约束，
   不为 TLA 边缘场景整体异步化。同步 `loadPluginsSync`（首次加载/SSG）与异步
   `loadPluginsAsync`（dev 热重载）并存，职责分离。
2. **缓存绕过按模块形态分流**：CJS → `require` + `delete require.cache`（既有机制）；
   ESM/TS → `import()` + file URL 时间戳 query（spike 实测唯一有效方式）。vitest 的
   vite-node 会拦截动态 import（缓存语义与原生不同）——绕过逻辑用**真实 Node 子进程
   测试**验证（生产语义），dev server TS 集成测试标记 vitest 环境跳过。
3. **诚实降级**：TLA ESM（提示去掉顶层 await）/ node_modules 内 .ts（提示发布编译 JS）/
   低版本 Node（无 require(esm)/strip 能力）→ skipped 含专属原因 + fatal 标记，不伪造成功。
4. **Node 版本矩阵文档化**：.nvmrc=22 与本机 26 存在能力差——plugin-guide §2 明示
   （Node ≥ 23.6 全能力；22.x 需 flags；TLA 恒不支持）。

## 验证状态

```
npm run verify          # 6/6 全绿（lint / typecheck / test 371+1skip / size / contract / e2e）
npm run spec:check      # 43/43（PLUG-013 追溯）
packages/cli/test/plugin-loader.test.ts  # 17 例（含真实 Node 子进程热重载 2 例）
```

## 遗留（v1.0 收尾）

- **插件运行时配置自动注册**：doclight.json 插件浏览器端 init/onMount 自动接线（任务③；
  mermaid 已用 slotContent 自注册先行，任务③统一后幂等兼容）
- **云端 DocLight Space 托管**：用户已明确不做
- **npm 包名注册与域名**：待用户决策

## 验证命令

```bash
npm run verify          # 全绿
npm run spec:check      # 43/43
# 手动验证 ESM/TS 插件：
# node_modules 装一个 type:module 插件包，或写 ./plugins/my-plugin.ts（export default）
# doclight.json plugins 配置后 doclight dev——修改 .ts 插件 → 热重载即时生效（PLUG-013）
```
