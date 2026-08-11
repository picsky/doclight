# TASK: Phase 0 完成交接（Agent 自迭代开发环境）

> 状态：✅ done（2026-08-11）
> 上游：tech-design/08-roadmap Phase 0、tech-design/10-agent-dev-environment（五层规格）
> **下一步：Phase 1 —— Node 渲染内核 + dev server（~2 周，见 08-roadmap）**

> 本文件是换会话的第一入口。开工前：先跑 `npm run verify` 确认从全绿基线出发（AGENT.md 流程第 4 步）。

---

## 已完成（Phase 0 交付物）

- **monorepo 骨架**：pnpm workspaces + 5 包（renderer/display/core/cli/mcp-server，各含意图文档 README）
- **工具链**：ESLint 9 flat + Prettier + TypeScript strict + Vitest + Playwright 配置，全 devDependencies
- **构建管线**：`scripts/build*.mjs`（原生 Node.js，tsc 转译展示层 + gzip 度量，无 Vite/Rollup）
- **verify 命令族**：`verify:lint/typecheck/test/size/contract` + 聚合 `npm run verify` → VERIFIED ✓
- **反馈层**：所有 check 双格式输出（终端摘要 + `artifacts/reports/<check>.json`），失败即退出码 1
- **契约层**：`contracts/doclight.schema.json`（只加不改）+ `specs/`（需求 ID 溯源，`spec:check`）+ `docs/agent-handoffs/`
- **doclight-verify skill**：`.claude/skills/`（build/contract/dev 三子技能校验环境契约）
- **文档**：CONTRIBUTING.md（Agent 优先）+ AGENT.md/CLAUDE.md 状态同步
- **CI**：`.github/workflows/ci.yml`（push/PR 触发，verify + 报告上传）
- **远程**：私有 `github.com/picsky/doclight`（完备后转公开）
- **ADR-0001**：包命名统一 renderer（02 为权威，12 已同步修订）

## 遗留（明确非目标，Phase 1 后跟进）

| 项 | 依赖 | 说明 |
|---|---|---|
| 视觉回归基线（4 模板×亮暗×3 断点） | Phase 1 模板 | harness 就位，基线待锁定 |
| 同构快照 / 浏览器三引擎矩阵 | Phase 1 渲染内核 | verify:isomorphic / browser-matrix 待加入 CHECKS |
| Golden Master 参考站（自举） | Phase 1 产品可用 | DocLight 文档站用 DocLight 构建 |
| 评审 Agent 真实逻辑 | 模型接入 | review.mjs 现为契约占位（findings 结构已定义） |
| npm 包名注册 + 域名 | 用户决策 | `doclight` npm 名可用；`@doclight/core` 已被占（避免 scoped @doclight） |
| CI 的 NPM 发布 stage | 人批准 | 12 §2.5：发布必须人按按钮 |

## 验证状态（已实测）

- `npm run verify` → **VERIFIED ✓**（build → lint → typecheck → test → size → contract，5/5）
- `npm run spec:check` → ✓（README 示例 ID 不计入追溯）
- 体积门禁演练：26KB 超限产物 → 结构化失败（`26652B > 25600B`）+ 退出码 1 ✅

## 关键决策与约定（换会话勿推翻）

- 包命名 renderer 是 ADR-0001 定案；`packages/renderer/core/` 受保护，改动需显式批准
- 展示层 < 25KB gzip / Node 内核 < 25KB（ADR-0002 上调）硬门禁；**加依赖走审批**（12 §1.4）
- 渲染统一在 Node 侧（file:// 死穴 + XSS 单点），浏览器不接触原始 Markdown
- 需求 ID 前缀登记表在 `specs/README.md`；提交信息引用需求 ID（`feat(REND-001): ...`）
- 中文写作：文档/注释/PR 用中文，代码标识符用英文

## 下一步建议（Phase 1 起点）

1. **目标声明（对齐点 A）**：Node 渲染内核（marked + DOMPurify sanitize + GFM + frontmatter + 自定义 renderer）+ dev server（原生 http + 热重载 + 首屏直出）+ 展示层骨架
2. **先做 spike 验证**：marked 扩展性（02 §2.3.1 风险应对：不足则换 markdown-it +16KB）——先验证后设计
3. 需求 ID：`REND`（渲染）/ `NAV`（导航）/ `TOC` 等（在 specs/README 登记）
4. 每任务：实现 + 测试（Gherkin + 单测）+ `npm run verify` 自验证 + 提交引用需求 ID
5. 视觉相关改动附截图（验收证据义务，12 §3.4）

## 交接人

开发 Agent（本会话）。人类维护者确认 Phase 0 完成。
