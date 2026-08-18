# 当前状态（活文档）

> 本文件是项目状态的**唯一权威**（原 AGENT.md / CLAUDE.md「当前状态」区块合并于此，
> 2026-08 review 阶段1 文档整合）。每完成一个阶段/里程碑必须更新本文件（15 §6.2，
> contract 门禁校验交接机制）。逐阶段的不可变交接见本目录各 `*-complete.md`。

## 快照（2026-08-16）

- **工程优化阶段 0+1 ✅（2026-08-16）**：全面 code review（六维度）后落地——
  MCP 安全加固（token 恒时比较 / POST 2MB 上限 413 / loopback Host 白名单防 DNS rebinding）；
  dev --mcp 惰性构建（普通请求不再触发快照 buildSite/loadSite）；escapeHtml 从 8 处分叉
  收敛到 `packages/core/src/utils.ts` 单一权威；display/renderer 构建从「TS 转译拼接」
  迁移 esbuild bundler（修复 export-from 断链 / 拼接 TDZ / 跨包引用三类隐性缺陷——
  renderer.js standalone 加载在 main 上即崩，此前无 check 真正执行产物）；renderer.js
  gzip 6865→5432B / display.js 12339→11735B；CI 双平台矩阵（linux 全量 + windows
  lint/typecheck/test/size/contract/chromium-e2e/smoke）；覆盖率门禁落地（thresholds
  lines 70 / branches 75 / functions 75，基线 75.05/82.49/83.71，随 verify 跑 --coverage）；
  review.mjs 从永远 pass 的占位变为真聚合门禁（Blocker 不消不合并）；contract.mjs 实契约
  （schema↔config 键闭环 + MCP 工具形状 + 指南指针）；config 未知键告警；flaky 显式化；
  AGENT.md/CLAUDE.md 收敛为指针（权威：AGENTS.md 入口 + CONTRIBUTING.md 规范 + 本文件状态）。
- **Phase 7 ✅ 全量完成 + 用户微调（DESIGN-POLISH，2026-08-16）**：单主题收敛（DP-001，
  serif/modern/warm 退役，画廊/门禁/视觉基线收敛 24→6 张）+ 品牌层（DP-002）+ 阅读状态感
  （DP-003）+ 内容纵深（DP-004）+ 导航智能（DP-005）+ 动效工艺（DP-006）+ AI 原生身份
  （DP-007）；用户三项微调已修（继续阅读静默恢复 / 后退转场晃动修复 / TOC 已读标记移除）。
  规格 `docs/tech-design/18-design-polish.md`，交接 `docs/agent-handoffs/PHASE-7-*.md`。
- **设计对齐（DESIGN-ALIGNMENT，2026-08-16）**：演示页 1:1 复刻为默认主题；DESIGN.md
  立为设计宪法；令牌体系全局替换；sanitize 放行安全 SVG 子集；三形态同构
  （articleBodyHtml 共享组装）。交接 `DESIGN-ALIGNMENT-COMPLETE.md`。

## 阶段总览（Phase 0-7 全部完成）

- **Phase 0-2**：自迭代环境（verify 命令族/契约层/CI）+ 渲染内核（REND-001 marked+DOMPurify
  +frontmatter）+ 导航树（NAV-001）+ dev server（DEV-001）+ 展示层（主题/SPA/TOC/事件总线）
  + 内置搜索（SRCH-001，中文 bigram，自研零依赖）+ 扩展语法注册表（REND-002/003/004：
  容器/Tabs/步骤/KaTeX/代码高亮复制）。
- **Phase 3**：SSG `doclight build`（SSG-001/002）+ `preview`（PREVIEW-001）+ SEO 全套
  （SEO-001/002：canonical/OG/Twitter/JSON-LD/sitemap/robots/OG 卡）+ `--base` 子路径 +
  `init`/`bundle`（file:// 三引擎）/`deploy`（gh-pages）/`migrate-docsify`。
- **Phase 4**：读取端（LLMS-001 llms.txt 智能分级 + FRONT-001 语义 frontmatter +
  MCP-001/002/003 六读取工具 stdio/HTTP+well-known）+ 内容空间写入端（CLI-005 publish
  local/git/space 无伪造成功 + CLI-006 space + doclight-publish Skill + /publish 命令）+
  遗留补强（MCP-004 SSE 流式 + MCP-005 dev --mcp 插件模式 + CLI-007 embed + SNAP-001
  同构快照）+ 用户决策批次（CONTRACT-001 契约扩展 + SEO-003 OG PNG + CLI-008 二维码 +
  CLI-009 vendor 内联 + UX-001 体验细节）。
- **Phase 5**：插件系统核心（PLUG-003 类型 / 004 展示层管理器 / 005 插槽 / 006 构建管线
  钩子 / 008 配置契约 / 009 CLI 集成）+ 插件生态（PLUG-007 官方插件 6 个 giscus/plausible/
  rss/pwa/ai-chat/mermaid + PLUG-010 onBuild + THEME-002 主题包 + MIG-001/002 MkDocs/
  GitBook 迁移 + PLUG-011 热重载 + PLUG-012 mermaid 迁移插件 + PLUG-013 ESM/TS 插件加载 +
  PLUG-014 运行时配置自动注册）。
- **Phase 6**：P0 能力协议（CAP-001 capabilities.json/AGENTS.md 同源生成 + AEO-001 发布产物
  Agent 友好）+ P1·1 设计系统化（VIS-001 四主题/画廊/合规门禁/像素回归）+ P1·2 预览-确认-发布
  （WORK-001 快照/rollback/确认门 + MCP-006 写入端三工具）+ P2 演示形态（DEMO-001 slides
  自包含单文件）+ OSS-001 开源化（MIT/README/npm 命名 doclight + @doclight/*）+ VIS-002
  设计系统 + P3 前端全量审查修复（门禁加固/CLI 构建管线 esbuild/a11y/对比度收口）+
  TOC-002 章节擦洗条。

## 门禁与硬数字

- `npm run verify` 全绿（lint / typecheck / test（含覆盖率门禁）/ size / contract / visual /
  e2e / smoke / review 聚合门禁）；单测 570+；e2e 三浏览器矩阵；CI 双平台（ubuntu 全量 +
  windows 收敛范围）。
- 体积门禁（ADR-0002 修订）：展示层 < 25KB gzip（实测 ~11.7KB）/ Node 内核 < 30KB
  （renderer + marked + dompurify 合计 ~29.1KB，esbuild bundler minify 后）。
- 覆盖率基线（2026-08-16 实测，thresholds 已设 lines 70 / branches 75 / functions 75）：
  lines 75.05 / branches 82.49 / functions 83.71——只升不降，逐步逼近 12 §1.6 目标（80/90）。

## 结构速览

- **monorepo**：`packages/{renderer,display,core,cli,mcp-server}`（renderer `src/core/`
  受保护；cli 命令源在 `src/*.ts` + `plugins-official/`；core 共享类型 + 纯函数 utils）。
- **契约**：`contracts/doclight.schema.json`（顶层键与 `config.ts KNOWN_TOP_LEVEL_KEYS`
  双向锁定，contract check 校验）+ `specs/features/*.feature`（需求 ID 溯源）。
- **决策记录**：`adr/`（ADR-0001 包命名 / 0002 内核预算 / 0003 无伪造成功 / 0004 v3 定位）。
- **远程仓库**：`github.com/picsky/doclight`（私有，完备后转公开）。
- **调研结论（2026-08-13）**：`research/`（机会 7.5/10 + 批判 3/10 两版并排）——扩展渲染是
  引擎增量功能，已随 Phase 2 落地闭环。

## 下一步

- 外部决策项：npm 包名注册与首次发布（CLI 构建管线已就绪：`npm run build` → dist/cli.mjs
  + bin）；域名。云端 Space 托管用户已排除。
- 工程优化阶段 2+（规划中）：site.ts 拆分 / CLI 命令表驱动 / 搜索索引瘦身与分片 /
  build 增量渲染 / 视觉回归 Linux 基线 + 字体自托管。
