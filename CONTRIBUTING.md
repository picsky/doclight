# Contributing to DocLight

> 本文件面向两类贡献者：**Code Agent**（本项目主要开发者）与**人类贡献者**（开源协作）。
> 规范总纲见 [tech-design/12-development-standards](./tech-design/12-development-standards.md)，流程见 [15-development-process](./tech-design/15-development-process.md)。

## 0. 一页纸：这个仓库怎么运转

- **原则零 Agent-First**：Agent 是主要开发者，人是审批者。决策先问「Agent 能否理解/使用/修改」。
- **流程**：目标声明（人确认）→ 拆解 → 实现+测试 → `npm run verify` 全绿 → 评审 Agent → 合入 → 沉淀（ADR）。
- **追溯**：调研 → 设计（tech-design/）→ 规格（specs/）→ 实现（packages/），全程引用需求 ID。

## 1. 架构地图

```
packages/
├── renderer/     Node 渲染内核（单一事实来源：Markdown→HTML/sanitize/索引/模板）★ core/ 受保护
├── display/      浏览器展示层（只渲染内核输出的 HTML，gzip < 25KB 硬门禁）
├── core/         公共类型与常量（类型即契约）
├── cli/          doclight CLI（init/dev/build/bundle/deploy/publish，Phase 3）
└── mcp-server/   MCP Server 读取端（Phase 4）
contracts/        doclight.schema.json 等外部承诺 API（只加不改）
specs/            行为规格（RFC 式 + Gherkin，需求 ID 溯源）
scripts/          构建与验证管线（原生 Node.js，无 Vite/Rollup）
adr/              决策记录（换会话不推翻重来）
docs/agent-handoffs/  Agent 交接文档
```

## 2. 验证命令（开工前先跑基线）

```bash
pnpm install        # 装依赖（pnpm 10）
npm run verify      # 一条命令：build → lint → typecheck → test → size → contract
npm run verify:lint     # ESLint 零 error
npm run verify:test     # Vitest 全绿
npm run verify:size     # 体积预算门禁（展示层 < 25KB gzip）
npm run review          # 评审 Agent（structured findings）
npm run spec:check      # 需求 ID 可追溯检查
```

- 所有 check 双格式输出：终端摘要 + `artifacts/reports/<check>.json`（机器可读）
- **开工前必须跑 `npm run verify`，确认从全绿基线出发**（AGENT.md 第 4 步）

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
