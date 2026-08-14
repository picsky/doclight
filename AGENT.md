# DocLight Agent 工作指南

> 面向任何在此仓库工作的 Code Agent（Claude、及其他通用代码 Agent）。开始任务前请先读本文件。

## 你在这里做什么

DocLight 是一款**主要由 Agent 自主开发**的开源文档站引擎。你不是辅助人类写代码——你就是主要开发者之一。你的产出质量 = 产品质量。因此，自迭代、可验证、可追溯是硬要求。

## 当前状态（2026-08-13，Phase 5 插件生态全量完成）

- **Phase 1 ✅ 完整收官**：REND-001 渲染内核（marked+DOMPurify+frontmatter）、NAV-001 导航树、DEV-001 dev server、展示层（主题/SPA 路由+钩子 PLUG-002/移动端侧边栏）+ **TOC-001 本页目录** + **THEME-001 完整主题令牌** + **PLUG-001 事件总线**
- **Phase 2 搜索 ✅ 主体**：**SRCH-001** 内置搜索（Cmd/Ctrl+K、中文 bigram 检索、索引懒加载、最近搜索、**localStorage 持久化 + 内容哈希版本**）；**未引真实 MiniSearch**（零依赖构建约束），同形状 API 自研，可一处替换
- **Phase 2 扩展语法渲染 ✅**：**REND-002 扩展语法注册表**（`packages/renderer/src/extensions/`）+ **REND-003 Mermaid 容错** + **代码高亮（Prism 懒加载）+ 复制按钮** + **自定义容器** + **KaTeX（懒加载）** + **REND-004 双读验证**；展示层增强在 `packages/display/src/extensions.ts`，dev server `/__doclight/vendor/*` 端点
- **Phase 3 ✅ 全部完成（2026-08-13）**：**SSG-001 `doclight build`** + **SSG-002 vendor 基址决策**（拷贝 dist/vendor 自包含）+ **PREVIEW-001 `doclight preview`**（均为 PHASE-3-ssg 交接）+ **SEO-001 页面级 SEO**（canonical/OG/Twitter/JSON-LD/面包屑）+ **SEO-002 站点级 SEO**（sitemap/robots/OG 卡 og/*.svg）+ **`--base` 子路径部署** + **CLI-001 `doclight init`** + **CLI-002 `doclight bundle`**（单文件 hash 路由 + 内嵌数据 + file:// 三引擎）+ **CLI-003 `doclight deploy`**（gh-pages 推送 + CF/Netlify 指引）+ **CLI-004 `doclight migrate-docsify`** + 迁移指南 `docs/migration-from-docsify.md`；交接见 `docs/agent-handoffs/PHASE-3-complete.md`
- **Phase 4 ✅ 读取端（AI 就绪核心，2026-08-13）**：**LLMS-001 llms.txt**（build 自动生成：智能分级 + 语义 frontmatter 条目 + Agent 端点 + llms-full.txt 全文按 `## 路径：` 分节）+ **FRONT-001 语义 frontmatter**（`packages/renderer/src/analyze.ts`：summary/wordCount/readingTime/headings/hasCode）+ **docs.json 增强**（每篇结构化元数据）+ **MCP-001 六读取工具**（search_docs/read_doc/list_docs/get_site_summary/get_outline/find_examples）+ **MCP-002 stdio** + **MCP-003 HTTP+well-known**（`packages/mcp-server/`，零依赖 spec 化 2025-06-18，**只服务产物站点 dist-site**）；交接见 `docs/agent-handoffs/PHASE-4-complete.md`
- **Phase 4 ✅ 内容空间写入端（2026-08-13）**：**CLI-005 `doclight publish`**（local bundle→file:// / git gh-pages→公网 URL / space 站点清单 POST→端点 URL；`--json` 结构化输出、无伪造成功，`packages/cli/src/publish.ts`）+ **CLI-006 `doclight space`**（init/switch/status，`.doclight/space.json` 可插拔 provider，`packages/cli/src/space.ts`）+ **`doclight-publish` Skill**（`.claude/skills/doclight-publish/SKILL.md`，默认入口）+ **`/publish` 命令**（`.claude/commands/publish.md`，用户触发）+ **Agent 接入指南**（`docs/agent-guide.md` 含魔法咒语，DocLight 自身构建=dogfood）；spec 见 `specs/features/space.feature`，交接见 `docs/agent-handoffs/PHASE-4-content-space-complete.md`
- **Phase 4 ✅ 遗留补强（2026-08-13）**：**MCP-004 HTTP SSE 流式**（POST /mcp Accept: text/event-stream + GET /mcp 长连接流心跳，`packages/mcp-server/src/http.ts`）+ **MCP-005 插件模式**（`doclight dev --mcp` 同端口 /mcp + /.well-known/mcp，懒构建快照、文件变更置脏重建）+ **CLI-007 `doclight embed`**（snippet.js 自推导基址 + 响应式 iframe + iframe 片段，13 §3.1 分发四触点③，`packages/cli/src/embed.ts`）+ **SNAP-001 同构快照**（dev/SSG/bundle 三形态内容一致，`packages/cli/test/isomorphic.test.ts`）；cli 引入 workspace 依赖 `@doclight/mcp-server`（零外部依赖）；交接见 `docs/agent-handoffs/PHASE-4-leftovers-complete.md`
- **Phase 4 ✅ 用户决策批次（2026-08-13）**：**CONTRACT-001 doclight.json 契约扩展**（base/siteUrl/outputDir/build.llmsTxt 入 schema，`contracts/doclight.schema.json`）+ **SEO-003 OG 卡片 PNG 栅格化**（@resvg/resvg-js 渲染 og/*.png，og:image 指向 PNG，`packages/cli/src/build.ts`）+ **CLI-008 bundle 下载二维码**（`--qr <url>` 生成 bundle-qr.png，`packages/cli/src/bundle.ts` + `packages/cli/src/qrcode.d.ts`）+ **CLI-009 bundle vendor 内联**（`--inline-vendor` opt-in，Prism/Mermaid/KaTeX 内联进单文件，`packages/cli/src/bundle.ts` + `packages/display/src/extensions.ts` 懒加载跳过已内联全局）+ **UX-001 体验细节**（专注模式 + 字号调节 + 打印样式 + Powered by 标记，`packages/display/src/ux.ts` + `packages/cli/src/site.ts` CSS/按钮/footer）；引入 2 个构建期依赖（@resvg/resvg-js + qrcode，不影响运行时体积）；交接见 `docs/agent-handoffs/PHASE-4-user-decisions-complete.md`
- **verify 门禁 ✅**：`npm run verify` 全绿（lint / typecheck / test **374/374 + 1 环境跳过** / size / contract / spec **44/44** / e2e 浏览器矩阵）；**Phase 5 全部完成 + PLUG-012/013/014（插件三件套）完成**；v1.0 收尾遗留清零——剩余仅外部决策项（npm 包名与域名；云端 Space 托管用户已排除）
- **Phase 5 ✅ 插件系统核心（2026-08-13）**：**PLUG-003 插件类型**（`packages/core/src/plugin.ts`：PluginDef/RenderContext/SearchDoc/AppApi/PluginConfig/SLOT_NAMES 11 个）+ **PLUG-004 展示层插件管理器**（`packages/display/src/plugin-manager.ts`：use/remove/initApp/notifyMount/notifyRouteChange/subscribeRouteChange/destroy/pluginSlotApi，与事件总线/路由钩子/插槽系统集成）+ **PLUG-005 插槽系统**（`packages/display/src/slots.ts`：SlotManager 11 个命名插槽，支持字符串/DOM 元素/函数三种内容，data-doclight-slot DOM 标记；`packages/cli/src/site.ts` renderPage 模板含 11 个 data-doclight-slot 标记）+ **PLUG-006 构建管线钩子**（`packages/cli/src/plugins.ts`：BuildPluginPipeline，beforeRender 正向链 + afterRender 反向链 + extendMarked + addSearchFields + slotContent；renderer 透传 extraMarkedExtensions）+ **PLUG-008 配置与契约**（`contracts/doclight.schema.json` plugins 数组 + `packages/cli/src/config.ts` 宽松读取）+ **PLUG-009 CLI 集成**（`packages/cli/src/dev-server.ts` + `packages/cli/src/build.ts` 走 beforeRender → render → afterRender 管线）；展示层从 8.1KB → **10.4KB gzip**（仍远低于 25KB 门禁）；交接见 `docs/agent-handoffs/PHASE-5-plugin-core-complete.md`
- **Phase 5 ✅ 插件生态全量（2026-08-13）**：**PLUG-006 接线修复**（extendMarked 打通：MarkedExtender 收集器 → collectMarkedExtensions → dev/build/bundle 三形态传 extraMarkedExtensions）+ **PLUG-007 官方插件 6 个**（`packages/cli/src/plugins-official/`：giscus/plausible/rss/pwa/ai-chat/**mermaid** + `plugin-loader.ts` 加载器 + `plugin-new.ts` 脚手架 `doclight plugin new/list`）+ **PLUG-010 onBuild 构建期文件产出钩子**（rss.xml/manifest.json/sw.js，穿越防护）+ **THEME-002 主题包**（`themes.ts`：CSS 变量覆盖层 + minimal/warm 内置主题 + 自定义 CSS 文件，`data-doclight-theme` 注入三形态）+ **MIG-001/002 migrate-mkdocs/migrate-gitbook**（mkdocs.yml/SUMMARY.md 解析 + admonition/hint/code 块转换，`docs/migration-from-*.md`）+ **PLUG-011 插件热重载**（dev watch 插件文件 + require 缓存失效 + setPlugins 替换 + fatal 保留旧管线）+ **PLUG-009 补齐**（deploy/publish/bundle 全命令插件接线）；文档：`docs/plugin-guide.md`（API 参考+教程+安全基线）+ `docs/themes.md`；交接见 `docs/agent-handoffs/PHASE-5-remaining-complete.md`
- **PLUG-012 ✅ Mermaid 迁移为官方插件（2026-08-13）**：Mermaid 从内置默认扩展迁出——`packages/renderer/src/extensions/` 移除 mermaid（注册表/code.ts 分流），`packages/display/src/extensions.ts` 移除 renderMermaid；新建 `packages/cli/src/plugins-official/mermaid.ts`（extendMarked 围栏 fallback + vendor/styles 声明 + slotContent 运行时脚本：doclight.use 注册 init/onMount 懒加载容错渲染）；**PluginDef 新增 vendor/styles 声明**（`packages/core/src/plugin.ts` + `plugins.ts` collectVendorFiles/collectPluginStyles）；三形态按需接线（`site.ts` copyVendor 参数化 + `dev-server.ts` 端点按需 + `bundle.ts` inlineVendorHtml 参数化 + `renderPage` pluginCss）；默认降级：未启用时 mermaid 围栏按普通代码块渲染、产物不含 mermaid.min.js；spec `specs/features/plugin.feature §PLUG-012`；交接见 `docs/agent-handoffs/PHASE-5-mermaid-plugin-complete.md`
- **PLUG-013 ✅ ESM/TS 插件加载（2026-08-13）**：Node ≥ 23.6 原生 require(esm) + type stripping 确认（ESM-only 包 / .ts 插件文件可加载，spike 证据在 `.spike/`）；**异步热重载路径** `loadPluginsAsync` + `reloadConfiguredPluginsAsync`（`packages/cli/src/plugin-loader.ts`）：ESM/TS 走 import() + file URL 时间戳 query 绕过 module registry 缓存（spike 实测 require(esm) 缓存不在 require.cache），CJS 保持 require + cache 清除；dev server reloadPlugins 支持 async；TLA ESM / node_modules 内 .ts / 低版本 Node 诚实跳过 + 专属提示；spec `specs/features/plugin.feature §PLUG-013`；交接见 `docs/agent-handoffs/PHASE-5-plugin-loader-esm-ts-complete.md`
- **PLUG-014 ✅ 插件运行时配置自动注册（2026-08-13）**：doclight.json 插件 → 浏览器端 init/onMount 自动接线——构建时三形态注入 `window.DOCLIGHT_PLUGIN_CONFIGS`（`packages/cli/src/site.ts` pluginConfigsScript），插件页面脚本挂 `window.DOCLIGHT_PLUGINS` 定义表（mermaid 脚本双路径幂等：挂表 + 自注册兜底），展示层 `registerConfiguredPlugins`（`packages/display/src/plugin-manager.ts`）mount 时自动 use（显式 config 覆盖/disabled 跳过/外部包静默跳过）；spec `specs/features/plugin.feature §PLUG-014`；交接见 `docs/agent-handoffs/PHASE-5-plugin-runtime-autoregister-complete.md`
- **Phase 6 ✅ P0 能力协议 + 发布产物 Agent 友好（2026-08-13）**：**CAP-001 能力协议**（`packages/cli/src/capabilities.ts`：capabilities.json 声明扩展语法/插件能力（PluginDef 新增 `capabilities?: string[]`，官方插件 6 个已声明）/frontmatter 约定/Agent 端点，单一事实来源；三形态一致——SSG 产物根 + dev `/capabilities.json` + bundle 产物目录；MCP 新增 `get_capabilities` 工具置首，产物缺失诚实降级；`packages/cli/src/agents.ts`：AGENTS.md 由 manifest 同源生成，`doclight init` 写入 + 本仓库根 AGENTS.md dogfood）+ **AEO-001 发布产物 Agent 友好**（build 拷贝每页 .md 源文件进产物 + 每页 `<link rel="alternate" type="text/markdown">` + `<link rel="describedby" href=".../llms.txt">` + `<meta name="doclight:tokens">`；`packages/cli/src/tokens.ts` 启发式 token 估算，docs.json 每篇 tokens/totalTokens + llms.txt 条目与头部计数；sitemap 不含 .md 不重复收录）；spec `specs/features/{capabilities,aeo}.feature`；交接见 `docs/agent-handoffs/PHASE-6-p0-capabilities-aeo-complete.md`
- **Phase 6 ✅ P1·1 VIS-001 表现层设计系统化（2026-08-13）**：4 套设计语言兑现（`packages/cli/src/themes/{minimal,serif,modern,warm}.css`——minimal 与默认一致 / serif 学术衬线 / modern 暗色优先 + 玻璃拟态 / warm 温暖大圆角，各含亮暗令牌 + 组件级特征）+ 主题包模型（`themes.ts`：ThemePackage css+defaultTheme，modern 首次进入即暗色；renderPage 防闪烁脚本支持 defaultTheme/fixedTheme）+ 主题画廊（`gallery.ts`：build/preview `--themes` 产物 4×2 面板 + 内置示例文档，fixedTheme 钉死对比纯净）+ 设计合规门禁（`design-compliance.ts` 纯函数 + `scripts/checks/visual.mjs` 进 verify：WCAG AA 对比度 / 8pt 网格 / 1.25 字号节奏，直读 CSS 断言）+ 像素级视觉回归（`scripts/visual-regression.spec.ts` + `playwright.visual.config.ts`：`npm run verify:visual` 24 组截图基线 diff，`verify:visual:update` 生成基线人工锁定）+ 前端打磨（默认主题字号 1.25 模块化缩放 + muted 加深达标）；组件库文档 `docs/component-gallery.md`（定制三入口：CSS 覆盖 / extendMarked / 插件插槽）；spec `specs/features/visual.feature`；交接见 `docs/agent-handoffs/PHASE-6-p1-vis-complete.md`
- **Phase 6 ✅ P1·2 WORK-001 预览-确认-发布 + MCP-006 写入端（2026-08-13）**：**WORK-001**（`packages/cli/src/snapshot.ts`：publish 前自动快照 `.doclight/snapshots/`（内容哈希幂等去重，`--no-snapshot` 关闭，快照失败发布中止）+ `doclight rollback <id>/--list` 一键回滚（ID 安全校验 + 清空恢复）+ `doclight publish --preview` 预览态（构建+预览服务不发布）+ TTY y/N 确认门（`--yes` 跳过；非 TTY 直行，自动化先确认由 Skill 保证）+ dev 增量渲染缓存（mtime+字节数 键，插件热重载同步失效））+ **MCP-006**（write_doc/update_doc/delete_doc：`--write-dir` 启停，`.md` 白名单 + `..`/绝对路径防护，未启用可读报错不伪造写能力；dev --mcp 写入 → watcher 置脏 → 下次 MCP 请求增量重建，写入触发增量重渲染联动；工具注册表十件套）；Skill 升级四步流程（预览-确认-发布）；spec `specs/features/{work,ai}.feature`；交接见 `docs/agent-handoffs/PHASE-6-p1-workflow-complete.md`
- **Phase 6 ✅ P2 DEMO-001 演示形态（2026-08-13）**：`packages/cli/src/slides.ts`——`doclight slides <file.md>`：markdown `---` 分页 + frontmatter 元数据 + 布局指令 `<!-- layout: cover|section|content|end -->`（首页自动 cover）+ 演讲者备注 `<!-- notes: -->`；输出**自包含单文件**（内嵌演示设计系统 CSS + 壳层 JS：键盘/触摸导航、URL #N 直达、进度/页码、F 全屏、S 演讲者备注视图、打印、reduced-motion；file:// 可开，与 bundle 同哲学）；演示设计系统 3 主题（dark 默认深色 / light 亮色 / warm 暖色 + 自定义 CSS `--slide-*` 令牌覆盖）；内容经渲染内核 sanitize（XSS 不注入）；代码/KaTeX/Mermaid 诚实降级可读源码（单文件零 vendor）；doclight-slides Skill（`.claude/skills/doclight-slides/`：编排流程 + 同源不同形原则 + 失败处理）+ `docs/slides.md` 指南；视觉回归门禁（visual check 演示产物校验 ≤100KB + 2 组截图基线）；spec `specs/features/slides.feature`；交接见 `docs/agent-handoffs/PHASE-6-p2-slides-complete.md`
- **Phase 6 ✅ OSS-001 开源化（2026-08-13）**：**LICENSE（MIT，用户确认）** + **README 重写**（v3 定位「把 Markdown 变成作品」+ 快速开始 + 功能总览 + 架构速览）+ **npm 命名落地**（用户决策：主包 `doclight`（CLI）+ `@doclight/{renderer,core,display,mcp-server}`——全仓引用/pnpm lockfile 刷新，各包 license:MIT + publishConfig 就绪）+ CONTRIBUTING 更新（verify 7 check + 视觉门禁）；交接见 `docs/agent-handoffs/PHASE-6-oss-complete.md`；**剩余（外部决策项）**：npm 包名注册与首次发布（需用户 npm 账号；前置：JS 构建管线——spike 已验证 Node 不在 node_modules 剥离 TS（ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING），需 esbuild bundle → dist + bin）；域名（站点/文档站用）
- **Phase 6 ✅ VIS-002 设计系统（2026-08-14）**：表现层系统化设计（用户确认：克制为底+精致细节 / 系统字体+字体插件 / Minimal 打样→4 套全量 / 克制动效）——令牌三级体系（--space-5/10、--tracking-*、--ease-*、--shadow-lg/xl、--ring-color，`packages/cli/src/site.ts` DEFAULT_THEME_CSS）+ 中文排版专项（tabular-nums/optimizeLegibility）+ 组件层（搜索面板毛玻璃+进场动画、代码块语言标签 JS 注入 `display/src/extensions.ts`、提示容器 CSS 图标 ✓/ℹ/!/✕ 纯 class 承载、阅读进度条、回到顶部、SPA 页面进场淡入，`display/src/ux.ts`）+ 4 套主题适配新组件（`themes/{serif,modern,warm}.css` 纸感/玻璃/卡片特征）+ 无障碍（skip-link WCAG 2.4.1、抽屉 aria-expanded 同步 + Esc 关闭 `sidebar.ts`、触摸反馈、safe-area）+ slides 容器图标（`slides.ts`）；规格 `docs/tech-design/16-design-system.md`；**顺带修复展示层两个潜伏致命 bug**（winGlobal 重复声明 + PluginManager TDZ——单文件拼接产物顶层冲突/初始化时序，展示层 JS 此前从未在浏览器执行：`display/src/{extensions,index}.ts`）+ **发现 e2e 门禁假绿**（`scripts/checks/e2e.mjs` 不查退出码只读残留报告；本机 Node 26 移除 --experimental-transform-types 致 Playwright 转译 TS 依赖链失败——修复依赖 OSS-001 JS 构建管线）；交接见 `docs/agent-handoffs/PHASE-6-vis002-design-system-complete.md`
- **调研结论（2026-08-13，两版并排）**：`research-report-agent-content-opportunity.md`（机会 7.5/10，零构建+扩展语法渲染+双读 三位一体空白）+ `research-report-agent-content-demand-validation.md`（批判 3/10，否决独立「展示层」产品、保留 AI 原生消费半边）→ 扩展渲染是**引擎增量功能**，已随 Phase 2 落地闭环
- **monorepo 结构**：`packages/{renderer,display,core,cli,mcp-server}`（renderer 受保护 `src/core/`；`src/extensions/` 扩展注册表；`src/analyze.ts` FRONT-001 语义分析；cli 新增 `src/{site,build,preview,bundle,init,deploy,migrate,config,llms,space,publish,embed,ux,plugins,plugin-loader,plugin-new,themes}.ts` + `src/plugins-official/` + `src/qrcode.d.ts`；display 新增 `src/{ux,plugin-manager,slots}.ts`；core 新增 `src/plugin.ts`；mcp-server `src/{site,search,tools,protocol,stdio,http}.ts`）
- **契约文件**：`contracts/`（doclight.schema.json）、`specs/features/{render,render-ext,nav,dev,toc,theme,plugin,search,ssg,seo,cli,space,ai,isomorphic}.feature`（需求 ID 溯源，43/43）、`docs/agent-handoffs/`
- **决策记录**：`adr/`（ADR-0001 包命名 renderer、ADR-0002 内核预算 30KB、ADR-0003 publish/space 无伪造成功、**ADR-0004 v3 表现层定位「把 Markdown 变成作品」**）；搜索自研见 PHASE-2-search 交接；**扩展承载铁律**（不依赖 data-*）与 vendor 懒加载见 PHASE-2-extensions 交接；**SSG vendor 基址（拷贝自包含）见 PHASE-3-ssg 交接；SEO/base/bundle/deploy 决策见 PHASE-3-complete 交接；插件双上下文架构见 PHASE-5-plugin-core-complete 交接；**插件生态决策（MarkedExtender 收集器/诚实跳过/onBuild/主题=令牌覆盖/热重载语义）见 PHASE-5-remaining-complete 交接；v3 定位与 Phase 6 表现层主线见 `research/product-vision-validation.md` + 08-roadmap Phase 6****
- **体积门禁**：展示层 < 25KB（实测 **10.4KB**，removeComments 后）/ Node 内核 < 30KB（合计 27.8KB）
- **远程仓库**：`github.com/picsky/doclight`（私有，完备后转公开）

## 开始工作的流程（每次必走）

```
1. 读 CLAUDE.md / 本文件 → 了解项目状态与约定
2. 读相关设计文档（docs/tech-design/）→ 遵循既有设计，不另起炉灶
3. 读相关规格 → 定位需求 ID 与 DoD
4. 跑基线验证（npm run verify）→ 确认从全绿起点出发
5. 实现 → 写测试 → 自验证 → 提交
6. 读反馈（CI 失败 / 评审 findings）→ 修复 → 直至全绿
```

## 必须遵守的规范（详见 docs/tech-design/12-development-standards.md）

### 硬性红线（违反即 blocker，不可合入）
- **不加依赖，除非走审批**：任何新依赖必须说明用途 / 体积 / 许可证 / 替代方案；展示层 < 25KB gzip / Node 内核 < 30KB（ADR-0002 修订）是硬门禁
- **不碰受保护文件**：`packages/runtime/core/`、`contracts/`、视觉基线、`doclight.json` Schema 需显式批准
- **无测试 = 不完成**：每个功能必须有对应测试（Gherkin + 单测）
- **Review 是强制环节**：无 review 不得合入
- **一个 PR 一件事**：混合不相关改动 = blocker
- **阶段完成必交接**：完成阶段/里程碑后必须同步 CLAUDE.md 与 AGENT.md 的「当前状态」（阶段/已完成/下一步）并写交接文档（`docs/agent-handoffs/<phase>-complete.md`），与代码一并提交；未交接 = 未完成（15 文档 §6.2）

### 提交规范
- Conventional Commits：`<type>(<scope>): <subject>` + 需求 ID（如 `feat(SRCH-001): ...`）
- 破坏性变更显式标注 `BREAKING CHANGE:`
- 涉及视觉的改动**必须附截图**，涉及性能的**必须附基准数据**（这是你的验收证据）

### 文档义务
- 新模块必须写**意图文档**（为什么存在，不只是怎么用）
- 注释解释 **why**，不解释 **what**；用中文写注释
- 关键设计决策写 **ADR**（`adr/NNNN-title.md`）——防止换个会话就推翻重来

## 失败处理（不要默默卡住）

| 情况 | 处理 |
|---|---|
| CI 失败 | 读结构化反馈（JSON + 截图），定位后修复；修复不了就回滚到全绿基线 |
| 任务卡住 / 反复失败 | 熔断：停止尝试，输出当前状态与卡点，上报人类维护者 |
| 发现既有设计缺陷 | 不擅自改设计，写 ADR 提案或 issue，说明证据 |
| 需求不明确 | 先读规格文档；仍不明确则列出待决策点，不要假设 |

## 交接格式（换 Agent / 换会话时必须遵守）

```
任务 ID / 需求 ID：
当前状态：done / in-progress / blocked
已完成：做了什么（文件 + 测试）
遗留问题：什么没做、为什么
验证状态：哪条命令跑到什么结果
上下文链接：相关规格、示例、评审 findings
下一步建议：明确的后续动作
```

交接内容放 `docs/agent-handoffs/` 或 PR 描述，保证换会话不丢上下文。

## 你与人的关系

- Agent 全自动执行常规任务（实现 / 测试 / 自验证 / 修复）
- 以下必须**人批准**：新增依赖、破坏性变更、核心文件修改、视觉基线锁定、发布
- 你负责提供完整证据与方案，人负责最终决策

## 一句话总结

> 你不是在写代码，你是在为「另一个 Agent 也能长期维护的产品」打地基。每一条决策都要可追溯、可验证、可交接。
