# DocLight 项目指南（Claude Code）

## 项目一句话

**DocLight 是一款服务于人阅读、同时 AI 原生友好的零构建开源文档站引擎。** 一个 `index.html` + `docs/` 文件夹 = 文档站；可选 SSG 静态导出修复 SEO；自带 llms.txt + MCP。

## 当前状态（2026-08-12，晚间）

- **阶段**：Phase 1 ✅ 完整收官 + Phase 2 搜索 ✅ 主体完成（`npm run verify` 6/6 全绿，含 e2e 门禁 33/33 × 三浏览器）；**下一步 = Phase 2 剩余体验项（代码高亮/复制/自定义容器等）或进 Phase 3（SSG），见 08-roadmap 与 PHASE-2 交接**
- **已完成（Phase 0 + Phase 1 全部 + Phase 2 搜索）**：自迭代环境（verify 命令族/契约层/CI）+ **REND-001 渲染内核**（marked v18 + DOMPurify+jsdom sanitize + frontmatter，安全测试集全过）+ **NAV-001 导航树**（docs.json）+ **DEV-001 dev server**（`doclight dev` 启动：首屏直出 + SSE 热重载 + 路径穿越防护）+ **展示层**（主题/SPA 路由+路由钩子 PLUG-002/移动端侧边栏）+ **TOC-001 本页目录**（桌面导轨/移动端面板/滚动高亮）+ **THEME-001 完整主题令牌**（03 §3.6 全量设计令牌）+ **PLUG-001 事件总线** + **SRCH-001 内置搜索**（Cmd/Ctrl+K + 中文 bigram 检索 + 索引懒加载 + 最近搜索）+ **verify:e2e 门禁**（Playwright 三浏览器端到端纳入 `npm run verify`）
- **体积门禁（ADR-0002 修订）**：展示层 < 25KB gzip（实测 **9.8KB**）/ Node 内核 < 30KB（实测 27.9KB）
- **决策记录**：搜索未引真实 MiniSearch（零依赖构建约束），以同形状 API 自研落地，Phase 3 可一处替换（见 PHASE-2 交接 §决策记录）
- **遗留**：Phase 2 剩余体验项（代码高亮/复制按钮/自定义容器/专注模式/字号调节/打印样式）；搜索索引持久化（localStorage+版本校验，SSG 预构建待 Phase 3）；doclight.json 配置系统（02 §2.5）；视觉回归/同构快照（Phase 0 遗留）；npm 包名注册与域名（待用户决策）
- **交接详情**：`docs/agent-handoffs/PHASE-2-search-complete.md`（换会话先读它；Phase 1 见 PHASE-1-complete.md、Phase 0 见 PHASE-0-complete.md）
- **开工前**：先跑 `npm run verify` 确认从全绿基线出发（现含 e2e，需本机/CI 已装 Playwright 浏览器）

## 最高原则（决定一切决策）

**原则零：Agent-First。** 本项目主要由 Code Agent 自主开发，几乎没有人手搓代码。任何设计决策先问「Agent 能否理解、使用、修改它」，再问「人是否方便」。覆盖两个维度：使用端（消费文档站的 Agent）+ 开发端（开发本项目的 Agent）。

## 文档地图（tech-design/）

| 文档 | 内容 |
|---|---|
| 00-README | 方案总览、设计哲学、关键数字 |
| 01-product-positioning | 定位、原则零 Agent-First、默认模板策略 |
| 02-architecture | 双层架构（运行时 + CLI）、技术选型、体积预算 |
| 03-runtime-engine | 路由 / Markdown / 导航 / 搜索 / 主题 |
| 04-reading-experience | 中文排版系统、视觉语言、无障碍 |
| 05-ssg-build | SSG 静态导出、SEO、CLI |
| 06-ai-native | 双五层模型（使用端 + 开发端）、MCP |
| 07-plugin-system | 钩子 / 插槽 / 主题系统 |
| 08-roadmap | Phase 0-5 里程碑（Phase 0 = Agent 自迭代环境） |
| 09-appendix | 竞品对比、调研依据、术语表 |
| **10-agent-dev-environment** | 目标/验证/反馈/闭环/契约 五层自迭代环境规格 |
| **11-default-themes** | 4 套默认模板设计规格 |
| **12-development-standards** | 开发规范总纲（代码/流程/PR/开源协作/Agent 专属） |
| **13-deployment-distribution** | 部署与分发（使用场景、一键部署、分发四触点、传播机制） |
| **14-agent-content-space** | **核心应用场景**：Agent 内容空间（一句话接入、Agent 自动发布、Space 可插拔） |
| **15-development-process** | 任务驱动开发流程（目标声明、对齐点 A/B/C、拆解、沉淀） |

## 工作约定

- **中文写作**：文档、注释、PR 描述用中文；代码标识符用英文
- **追溯**：任务引用需求 ID（如 `SRCH-001`），提交引用设计文档，保持 调研→设计→实现 链路
- **先验证后设计**：涉及技术可行性（如 `file://` 读取、浏览器限制）必须先做 spike 验证，再写进方案
- **双读友好**：任何规范/文档/错误输出，Agent 和人要都能消费（结构化 + 可读）
- **不发明术语**：遵循 `09-appendix` 术语表；新增术语须登记
- **改动先看文档**：动手前先读相关 design 文档，遵循既有设计，不另起炉灶
- **阶段完成必交接**：完成一个阶段/里程碑后，**必须**同步更新本文档与 AGENT.md 的「当前状态」（阶段/已完成/下一步），并在 `docs/agent-handoffs/` 写交接文档（格式见该目录）；不交接 = 任务未完成（15 文档 §6.2，contract 门禁校验）

## 常用命令

```bash
npm run verify          # 一条命令跑全部验证（build→lint→typecheck→test→size→contract）
npm run verify:lint     # ESLint 零 error
npm run verify:test     # Vitest 单测
npm run verify:size     # 体积预算门禁（展示层 < 25KB gzip）
npm run verify:contract # 契约校验
npm run review          # 评审 Agent（契约占位）
npm run spec:check      # 需求 ID 可追溯检查
```

所有 check 双格式输出：终端摘要 + `artifacts/reports/<check>.json`（机器可读，Agent 据此自修）。

## 风险提示（务必牢记）

- **file:// 死穴已解决**：三形态架构（渲染收敛 Node + bundle 内嵌）已在 Chromium/Firefox/WebKit 实测通过；不再依赖浏览器动态读取本地文件
- 展示层 < 25KB gzip / Node 内核 < 30KB（ADR-0002 修订）是硬门禁：**加依赖是最高危操作**（见 12 文档 1.4）
- XSS 必须 DOMPurify sanitize（marked 默认不消毒，已实测）
- 视觉质量靠机器化保障（视觉回归 + 设计合规），不靠主观判断
