# DocLight Agent 工作指南

> 面向任何在此仓库工作的 Code Agent（Claude、及其他通用代码 Agent）。开始任务前请先读本文件。

## 你在这里做什么

DocLight 是一款**主要由 Agent 自主开发**的开源文档站引擎。你不是辅助人类写代码——你就是主要开发者之一。你的产出质量 = 产品质量。因此，自迭代、可验证、可追溯是硬要求。

## 当前状态（2026-08-12，晚间：Phase 1 完整收官 + Phase 2 搜索完成）

- **Phase 1 ✅ 完整收官**：REND-001 渲染内核（marked+DOMPurify+frontmatter）、NAV-001 导航树、DEV-001 dev server、展示层（主题/SPA 路由+钩子 PLUG-002/移动端侧边栏）+ **TOC-001 本页目录** + **THEME-001 完整主题令牌** + **PLUG-001 事件总线**
- **Phase 2 搜索 ✅ 主体**：**SRCH-001** 内置搜索（Cmd/Ctrl+K、中文 bigram 检索、索引懒加载、最近搜索）；**未引真实 MiniSearch**（零依赖构建约束），同形状 API 自研，Phase 3 可一处替换
- **verify:e2e 门禁 ✅**：`npm run verify` 6/6 全绿（含 Playwright 三浏览器端到端 33/33）；**下一步 = Phase 2 扩展语法渲染（REND-002 扩展语法注册表 / REND-003 Mermaid 容错 / 代码高亮+复制 / 自定义容器 / KaTeX / REND-004 双读验证）**，与 Phase 3（SSG）并行小步推进，交接见 `docs/agent-handoffs/PHASE-2-search-complete.md`
- **调研结论（2026-08-13，两版并排）**：`research-report-agent-content-opportunity.md`（机会 7.5/10，零构建+扩展语法渲染+双读 三位一体空白，文档站优先）+ `research-report-agent-content-demand-validation.md`（批判 3/10，否决独立「展示层」产品、保留 AI 原生消费半边）→ 扩展渲染是**引擎增量功能**而非新独立产品，见 08-roadmap Phase 2 优先级
- **monorepo 结构**：`packages/{renderer,display,core,cli,mcp-server}`（renderer 受保护 `src/core/`——markdown/sanitize/frontmatter/link）
- **契约文件**：`contracts/`（doclight.schema.json）、`specs/features/{render,nav,dev,toc,theme,plugin,search}.feature`（需求 ID 溯源）、`docs/agent-handoffs/`
- **决策记录**：`adr/`（ADR-0001 包命名 renderer、ADR-0002 内核预算 30KB）；搜索自研决策见 PHASE-2 交接
- **体积门禁**：展示层 < 25KB（实测 9.8KB）/ Node 内核 < 30KB（ADR-0002）
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
