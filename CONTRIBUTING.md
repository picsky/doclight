# Contributing to DocLight

> 本文件面向两类贡献者：**Code Agent**（本项目主要开发者）与**人类贡献者**（开源协作）。
> 规范总纲见 [tech-design/12-development-standards](./docs/tech-design/12-development-standards.md)，流程见 [15-development-process](./docs/tech-design/15-development-process.md)。

## 0. 一页纸：这个仓库怎么运转

- **原则零 Agent-First**：Agent 是主要开发者，人是审批者。决策先问「Agent 能否理解/使用/修改」。
- **流程**：目标声明（人确认）→ 拆解 → 实现+测试 → `npm run verify` 全绿 → 评审 Agent → 合入 → 沉淀（ADR）。
- **追溯**：调研 → 设计（docs/tech-design/）→ 规格（specs/）→ 实现（packages/），全程引用需求 ID。

## 1. 架构地图

```
packages/
├── renderer/     @doclight/renderer —— Node 渲染内核（单一事实来源：Markdown→HTML/sanitize/索引/模板）★ core/ 受保护
├── display/      @doclight/display —— 浏览器展示层（只渲染内核输出的 HTML，gzip < 25KB 硬门禁）
├── core/         @doclight/core —— 公共类型与常量（类型即契约）
├── cli/          doclight（CLI 主包，npm 发布名）：init/dev/build/preview/bundle/deploy/publish/rollback/space/embed/slides/plugin
└── mcp-server/   @doclight/mcp-server —— MCP Server（读：search/read/outline/capabilities；写：write/update/delete）
contracts/        doclight.schema.json 等外部承诺 API（只加不改）
specs/            行为规格（RFC 式 + Gherkin，需求 ID 溯源）
scripts/          构建与验证管线（原生 Node.js，无 Vite/Rollup）
adr/              决策记录（换会话不推翻重来）
docs/agent-handoffs/  Agent 交接文档
```

## 2. 验证命令（开工前先跑基线）

```bash
pnpm install        # 装依赖（pnpm 10；Node ≥ 22.18——仓库内直接消费 TS 源码，依赖 Node 原生类型剥离）
npm run verify      # 一条命令：build → lint → typecheck → test(+覆盖率门禁) → size → contract → visual → e2e → smoke → review
npm run verify:lint     # ESLint 零 error
npm run verify:test     # Vitest 全绿（含 coverage thresholds：lines 70 / branches 75 / functions 75，只升不降）
npm run verify:size     # 体积预算门禁（展示层 < 25KB gzip / Node 内核 < 30KB）
npm run verify:visual   # 像素级视觉回归（基线 diff；首次/改视觉用 verify:visual:update 生成基线后人工锁定）
npm run review          # 评审门禁（聚合 8 check 报告——Blocker 不消不合并；2026-08 阶段1 起为真门禁）
npm run spec:check      # 需求 ID 可追溯检查
doclight skill install  # Agent 技能自动安装（装到 ~/.claude/skills + commands，随 CLI 分发）
```

- 所有 check 双格式输出：终端摘要 + `artifacts/reports/<check>.json`（机器可读）
- **开工前必须跑 `npm run verify`，确认从全绿基线出发**（当前状态见 `docs/agent-handoffs/CURRENT-STATUS.md`）
- 涉及视觉的改动：**必须**过 `verify:visual`（基线 diff）并附截图证据（12 §3）

## 2.5 Agent 工作流（每次必走，原 AGENT.md 融入）

```
1. 读 AGENTS.md（入口）+ docs/agent-handoffs/CURRENT-STATUS.md（当前状态）
2. 读相关设计文档（docs/tech-design/，索引见 00-README）→ 遵循既有设计，不另起炉灶
3. 读相关规格（specs/）→ 定位需求 ID 与 DoD
4. 跑基线验证（npm run verify）→ 确认从全绿起点出发
5. 实现 → 写测试 → 自验证 → 提交
6. 读反馈（CI 失败 / review findings）→ 修复 → 直至全绿
```

- **人机边界**：Agent 全自动执行常规任务；以下必须**人批准**——新增依赖、破坏性变更、
  受保护文件修改（`packages/renderer/src/core/`、`contracts/`、视觉基线、schema）、
  视觉基线锁定、发布。Agent 提供完整证据与方案，人做最终决策。
- **阶段完成必交接**：更新 `docs/agent-handoffs/CURRENT-STATUS.md`（阶段/已完成/下一步）+
  写交接文档 `<phase>-complete.md`（模板：任务 ID / 当前状态 / 已完成（文件+测试）/
  遗留问题 / 验证状态 / 上下文链接 / 下一步建议），与代码一并提交；未交接 = 未完成（15 §6.2）。
- **失败熔断**：任务卡住/反复失败时停止尝试，输出当前状态与卡点上报人类维护者，
  不要默默卡住；发现既有设计缺陷不擅自改设计，写 ADR 提案或 issue 附证据。

## 3. 常见失败模式与处理

| 失败 | 定位 | 处理 |
|---|---|---|
| verify 红 | 读 `artifacts/reports/verify.json` 找 failed check | 修复该 check，重跑 |
| lint error | 输出含 `file:line:col` | 修对应文件；格式问题用 `prettier --write` |
| size 超限 | 读 size 报告中的 gzip 字节数 | 砍依赖 / 优化代码，加依赖走审批 |
| contract 缺文件 | 缺失项列出具体路径 | 补契约文件，勿绕过 |
| 卡住/反复失败 | — | 熔断：输出状态与卡点，上报人类维护者（AGENT.md） |

## 4. 提交流程（12 §3）

- 分支：`feat/<需求ID>-<slug>` / `fix/<需求ID>-<slug>` / `chore/<slug>`（Trunk-based，≤3 天）
- Commit：Conventional Commits + 需求 ID
  ```
  feat(SRCH-001): 内置搜索零配置可用
  ```
- PR 必含：目的 / 改动范围 / 验收证据（视觉必附截图、性能必附基准）/ 测试 / 关联
- **一个 PR 一件事**；CI 全绿 + 评审零 blocker 才可合入（Squash merge）

## 5. 硬性红线（违反 = blocker）

1. **不加依赖除非走审批**（用途/体积/许可证/替代方案）
2. **不碰受保护文件**：`packages/renderer/core/`、`contracts/`、视觉基线、`doclight.schema.json`（需显式批准）
3. **无测试 = 不完成**（Gherkin + 单测）
4. **Review 强制**；**一个 PR 一件事**
5. 新模块必须写**意图文档**（README 为什么存在）
6. 关键决策写 **ADR**（`adr/NNNN-title.md`）

## 6. 开源协作（对贡献者）

- 外部 PR 走更高护栏：CI 全量 + 评审 Agent 全量 + 人 100% 把关
- DCO：每个 commit 需 `Signed-off-by`（不强制 CLA）
- 新贡献者从小 PR 起步（文档/示例/修复），连续 3+ 高质量 PR 后可参与核心模块
- Bug 报告用模板（复现步骤/期望/实际/环境），安全漏洞走私密渠道（SECURITY.md）
