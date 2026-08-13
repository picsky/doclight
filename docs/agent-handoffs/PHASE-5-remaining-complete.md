# TASK: Phase 5 剩余——插件生态全量完成（2026-08-13）

> 状态：✅ 完成（`npm run verify` 全绿 6/6 + spec:check **41/41** + e2e 54/54）
> 上游：PHASE-5-plugin-core-complete（插件系统核心）+ 08-roadmap Phase 5
> **本文件是新会话第一入口**（与 PHASE-5-plugin-core-complete 共同覆盖 Phase 5 全貌）

---

## 本次完成清单（需求 ID 可追溯）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **PLUG-006 接线修复** | extendMarked 钩子打通：collectMarkedExtensions（MarkedExtender 收集器，兼容 use()/返回数组两种形态）→ dev/build/bundle 三形态传 extraMarkedExtensions 进渲染内核 | `core/src/plugin.ts` + `cli/src/plugins.ts` + `cli/src/{dev-server,build,bundle}.ts` | plugins.test.ts 6 例（三形态收集/插件边界/异常隔离/**端到端自定义语法经 sanitize 全管线**）+ e2e/plugins.spec.ts |
| **PLUG-007** | 官方插件 5 个：giscus（评论）/ plausible（统计）/ rss（订阅）/ pwa（manifest+sw）/ ai-chat（BYO-LLM 问答）；插件加载器（内置注册表 + 外部 JS 包同步 require + 相对路径 + 诚实跳过报告）；插件脚手架 `doclight plugin new`（9 钩子骨架模板 + 测试模板 + README）+ `doclight plugin list` | `cli/src/plugins-official/*.ts` + `cli/src/plugin-loader.ts` + `cli/src/plugin-new.ts` | plugin-loader.test.ts 10 例 + plugins-official.test.ts 13 例 + plugin-new.test.ts 4 例 + e2e/plugins.spec.ts 4 例（全链路：doclight.json → 加载器 → SSG 产物） |
| **PLUG-010** | onBuild 构建期文件产出钩子（rss.xml / manifest.json / sw.js 等站点级产物；路径穿越防护） | `core/src/plugin.ts`（BuildContext/BuildFile）+ `cli/src/plugins.ts`（runOnBuild）+ `cli/src/build.ts` | plugins.test.ts 4 例 + plugins-official.test.ts（rss/pwa 产物断言）+ e2e |
| **THEME-002** | 主题包：CSS 变量覆盖层规范 + 2 内置主题（minimal 极简黑白 / warm 暖纸衬线）+ 自定义 CSS 文件 + `data-doclight-theme` 注入 | `cli/src/themes.ts` + `cli/src/site.ts`（renderPage themeCss）+ dev/build/bundle 三形态 | themes.test.ts 8 例 |
| **MIG-001 / MIG-002** | `doclight migrate-mkdocs`（mkdocs.yml 解析 + admonition→容器转换）/ `doclight migrate-gitbook`（SUMMARY.md 解析 + hint/code 块转换）；迁移指南 2 篇 | `cli/src/migrate.ts` + `docs/migration-from-{mkdocs,gitbook}.md` | migrate.test.ts 8 新例（转换映射/解析/端到端/幂等） |
| **PLUG-011** | 插件热重载：dev 监听插件源文件 + doclight.json → require 缓存失效重载 → setPlugins 整体替换 → SSE reload；加载期错误（fatal）保留旧管线 | `cli/src/plugin-loader.ts`（fatal 标记 + reloadConfiguredPlugins + configuredPluginWatchFiles）+ `cli/src/dev-server.ts` + `cli/src/plugins.ts`（setPlugins） | plugin-reload.test.ts 3 例（v1→v2 热重载/语法错误保留旧管线）+ plugins.test.ts 2 例 |
| **PLUG-009 补齐** | 插件配置全命令接线：runDev/runBuild/runBundle/deploy/publish 全部走 loadConfiguredPlugins（决策⑪单一事实来源）；bundle 形态补管线（beforeRender/afterRender/extendMarked/插槽） | `cli/src/index.ts` + `cli/src/{bundle,deploy,publish}.ts` | e2e/plugins.spec.ts + 全量回归 |
| **文档** | 插件开发指南（快速开始/API 参考/官方插件/常见模式/安全基线/测试模板）+ 主题生态页 | `docs/plugin-guide.md` + `docs/themes.md` | dogfood 站点内容 |

## 关键设计决策

1. **MarkedExtender 收集器**（PLUG-006 修复）：渲染内核每次新建 Marked 实例，插件无法原地扩展 → extendMarked 收到收集器（use() 与 marked.use 同形状），管线收集后经 extraMarkedExtensions 统一挂载。向后兼容四种注册形态。
2. **插件加载器诚实原则**：无法解析/配置无效/加载失败 → skipped 含原因 + 警告，不伪造成功；fatal 标记区分「加载期错误」与「非致命跳过」，热重载据此保留旧管线。
3. **官方插件 = 构建时插槽注入为主**：giscus/plausible/ai-chat 零运行时钩子（第三方脚本自引导 / 内联脚本 textContent 注入）；rss/pwa 走 onBuild。密钥不进页面（ai-chat 用代理端点模式）。
4. **主题 = CSS 变量覆盖层**：THEME-001 令牌即主题接口；default 零注入（无回归），minimal/warm 内置，自定义 CSS 文件即主题包。
5. **bundle 形态边界**：插件静态插槽注入壳层单实例（路由切换不重渲染），文档化于 plugin-guide §8。
6. **热重载 = 构建侧 setPlugins 替换 + 浏览器整页刷新全清理**（PluginManager 全新实例；07 §7 设计语义）。

## 体积门禁（无变化）

| 产物 | 门禁 | 实测 |
|---|---|---|
| 展示层 gzip | < 25KB | **10.4KB**（本次零改动） |
| Node 内核 | < 30KB | **27.8KB**（插件类型仅类型空间） |

**无新增运行时依赖**（官方插件纯逻辑；rss/pwa 输出原生文本文件）。

## 端到端实测

```
npm run verify          # 6/6 全绿（lint 112 / typecheck / test 3xx / size / contract / e2e 54）
npm run spec:check      # 41/41（PLUG-007/010/011 + MIG-001/002 + THEME-002 全部追溯）
e2e/plugins.spec.ts     # 4 例：extendMarked 自定义语法（接线修复回归防线）/ 官方插件全链路 / onBuild 落盘 / dev server 形态
```

## 遗留（v1.0 收尾）

> **更新（2026-08-13 同日）**：以下遗留三项已全部完成——①plugin-mermaid 迁移 → **PLUG-012**（`PHASE-5-mermaid-plugin-complete.md`）；②ESM-only/TS 插件加载 → **PLUG-013**（`PHASE-5-plugin-loader-esm-ts-complete.md`）；③插件运行时配置自动注册 → **PLUG-014**（`PHASE-5-plugin-runtime-autoregister-complete.md`）。云端托管用户已排除。

- ~~**plugin-mermaid 迁移**（从内置迁出）~~：涉及渲染内核/注册表/展示层/vendor 按需策略——已随 PLUG-012 完成
- ~~**ESM-only 插件包与 TS 插件文件加载**~~：加载器同步 require 升级——Node ≥ 23.6 原生 + 异步热重载（PLUG-013）
- ~~**插件运行时配置接线**~~：doclight.json 插件在浏览器端的 init/onMount 自动注册——已随 PLUG-014 完成
- **主题市场（多主题站展示）**：docs/themes.md 文档化展示；在线画廊待定
- ~~云端 DocLight Space 托管~~：**用户已排除，不做**
- npm 包名注册与域名：待用户决策（v1.0 发布前置）

## 验证命令

```bash
npm run verify          # 全绿（含 e2e）
npm run spec:check      # 41/41 追溯
# 手动验证插件：
doclight plugin new my-chart   # 生成脚手架
doclight plugin list           # 5 个官方插件
# doclight.json 配置 plugins 数组（见 docs/plugin-guide.md §4）→ doclight dev / build
```
