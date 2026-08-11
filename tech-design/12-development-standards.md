# 12 · 开发规范总纲（Development Standards）

> 状态：待评审（🟡）
> 对应原则：[原则零 Agent-First](./01-product-positioning.md)
> 配套文档：[10-agent-dev-environment](./10-agent-dev-environment.md)（机器化保障）、[15-development-process](./15-development-process.md)（任务驱动开发流程总览）、[08-roadmap](./08-roadmap.md)
> 使用对象：开发 Agent、评审 Agent、人类维护者、开源贡献者

---

## 0. 规范总览

### 0.1 双读友好原则

本项目由 Code Agent 自主开发，且开源后会有真人贡献者。因此**每一条规范都必须是「双读友好」的**：

- **对 Agent**：可机器消费（结构化、可检查、有明确通过/失败判定）
- **对人**：可一眼看懂（口语化说明、checklist 化）

**判定标准**：一条规范若无法用脚本或检查清单验证，就不算有效规范。

### 0.2 强度分级：内部通道 vs 外部通道

| 通道 | 场景 | 护栏强度 | 说明 |
|---|---|---|---|
| **A 内部自迭代** | 维护者发起的 Agent 开发 | 高 | CI 全量 + 评审 Agent 全量 + 人抽查 20% |
| **B 外部 PR** | 开源贡献者提交 | 极高 | CI 全量 + 评审 Agent 全量 + 人 100% 把关 + 核心文件保护 |
| **C 维护者直改** | 紧急修复/发布 | 中 | CI 全量 + 事后 review 补记录 |

**原则**：质量门槛对所有通道一视同仁，**没有捷径**。差异化只在「人介入的深度」，不降低机器门禁。

### 0.3 规范如何执行（三层把关）

```
第 1 层：机器强制（CI）——lint / 类型 / 测试 / 体积 / 契约，不通过即阻塞
第 2 层：评审 Agent——代码层审查，输出 findings，blocker 不消不合并
第 3 层：人兜底——战略层把关（依赖引入、破坏性变更、视觉基线、发布）
```

---

## 1. 代码规范

### 1.1 语言与工具链

| 项 | 规范 |
|---|---|
| 语言 | TypeScript，严格模式（`strict: true`） |
| Lint | ESLint（统一配置，零 error 才可提交） |
| 格式化 | Prettier（统一配置，无争议） |
| Node 版本 | 锁定 `.nvmrc` / `engines`（≥ 20 LTS） |
| 包管理器 | 统一（建议 pnpm），lockfile 提交入库 |

### 1.2 项目结构与模块边界

- monorepo 结构（参考 [02-architecture](./02-architecture.md)）：`packages/runtime`、`packages/cli`、`packages/mcp-server`
- **依赖方向**：runtime 不依赖 cli；cli 可依赖 runtime；公共类型放 `packages/core` 或共享目录
- 每新增目录必须先在文档中说明归属，禁止「顺手」新建位置不明的目录
- 模块职责单一：一个文件只做一件事，职责边界模糊 = 设计问题

### 1.3 命名规范

| 对象 | 规范 | 示例 |
|---|---|---|
| 文件名 | kebab-case | `event-bus.js` |
| 变量/函数 | camelCase | `resolveRelativeLink` |
| 类/组件 | PascalCase | `PluginManager` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RESULTS` |
| CSS 变量 | kebab-case，以 `--` 前缀 | `--color-primary` |
| 插件包名 | `doclight-plugin-*` | `doclight-plugin-mermaid` |
| 概念命名 | 遵循术语表（见 4.4），禁止发明同义新词 | 用「形态 / 产物」不是「runtime/browser mode」 |

### 1.4 依赖引入规范（高危操作）

> **加依赖是本项目最高危的操作之一**：直接威胁展示层 25KB / Node 内核 20KB 体积预算与供应链安全。Agent 最常「随手引库」绕过问题，必须强制审批。

| 规则 | 说明 |
|---|---|
| 默认拒绝 | 能用原生 JS / 已有代码解决，就不许加依赖 |
| **必走审批** | 任何新依赖（含 devDependencies）必须记录在 PR 描述中，标注：用途 / 体积（gzip）/ 许可证 / 维护状态 / 替代方案 |
| 体积预算 | 新增依赖后核心 gzip 不得超限（CI 门禁） |
| 供应链 | `npm audit` 零高危；锁版本；锁定锁文件 |
| 替代优先 | 优先 `marked` / `miniSearch` 等已验证选型；新库需说明为何不选现有选型 |
| 定期审查 | 依赖清单每季度审查，移除闲置依赖 |

### 1.5 架构约束（禁止项）

- ❌ 展示层 / 渲染内核引入大型框架（React/Vue 类）或重型依赖
- ❌ 全局可变状态（除非是显式设计的事件总线）
- ❌ 运行时直接依赖 DOM 操作写死布局（走组件/插槽系统）
- ❌ 在 core/ 中引入 Node.js 专有 API（runtime 是浏览器环境）
- ❌ 绕过插件系统直接修改核心行为（除非显式 RFC）

### 1.6 代码质量门槛

| 门槛 | 值 | 执行 |
|---|---|---|
| 类型检查 | 零 error | CI |
| Lint | 零 error | CI |
| 覆盖率 | 整体 ≥ 80%，核心模块 ≥ 90% | CI |
| 复杂度 | 圈复杂度 ≤ 15（超限需重构） | CI |
| 死代码 | 零（未使用导出） | CI |

### 1.7 安全规范（强制）

> **实测依据（2026-08）**：marked 默认不 sanitize，`<script>` 与 `javascript:` 链接原样输出。sanitize 是强制安全层。

| 规则 | 说明 |
|---|---|
| 强制 sanitize | 所有 Markdown 渲染必须经过 DOMPurify（渲染管线第 3 步，不可跳过） |
| 渲染单点 | 浏览器端不接触原始 Markdown，渲染只在 Node 内核发生（见 02-2.4） |
| 安全测试义务 | 新增渲染相关代码必须附带安全测试用例 |
| 回归测试集 | 恶意输入集（script 注入 / javascript: URL / 事件属性 / HTML 实体绕过）为 CI 常驻用例 |
| 红线 | 任何绕过 sanitize 的实现 = **blocker**，不可合入 |

### 1.8 浏览器兼容性

| 规则 | 说明 |
|---|---|
| 目标浏览器 | Chrome / Edge / Firefox / Safari 最近两个主要版本（ES2020+） |
| 矩阵测试 | 展示层代码必须通过浏览器矩阵测试（三引擎 × 三形态产物，见 [10](./10-agent-dev-environment.md)） |
| 禁止依赖 | 核心功能不得依赖非标准能力（如 File System Access API，Safari 不支持） |
| 新特性确认 | 新增 CSS/JS 特性需确认目标浏览器支持，否则提供降级 |

---

## 2. 开发流程规范

### 2.1 分支策略

- **Trunk-based + 短生命周期分支**：`main` 始终可发布；特性分支 ≤ 3 天存活
- 分支命名：`feat/<需求ID>-<slug>` / `fix/<需求ID>-<slug>` / `chore/<slug>`
- 禁止长期分叉（避免合入地狱）；Agent 小步提交

### 2.2 提交通道（CI 门禁）

```
提交 → CI（lint → test → visual → isomorphic → perf → contract）
     → 任一失败：结构化反馈回提交者（Agent 自动修复 / 人修复）
     → 全绿 → 进入评审
```

- CI 全绿是**合入前提**，不是「参考」
- 失败反馈必须结构化（见 [10](./10-agent-dev-environment.md) 反馈层）

### 2.3 Code Review（强制环节）

> **Review 是提交通道的一部分，不是可选动作。** 无 review 的提交不得合入（CI 自动阻塞）。

| 项 | 规范 |
|---|---|
| 强制范围 | 所有通道（内部 A / 外部 B）必须 review |
| 评审主体 | 评审 Agent 全量执行；人按强度分级介入（A 抽 20%，B 100%） |
| 评审维度 | 正确性 / 设计一致性 / 性能 / 安全 / 无障碍 / 测试覆盖 / 规范符合度 / 规格符合度 |
| **Blocker（必须修）** | bug、体积超限、契约破坏、无对应测试、安全漏洞、架构约束违反 |
| **非 Blocker（可留）** | 风格偏好、可读性建议、可优化项 |
| 评审输出 | 结构化 findings（severity / file / line / title / evidence / suggestedFix） |
| 时限 | 2 个工作日；超时自动升级提醒 |
| 复审 | findings 全部处理（修或显式驳回）后关闭 |

**Review Checklist（人机共用）**见第 8 节。

### 2.4 合入门禁

- CI 全绿 + review 零 blocker + 契约测试通过
- Squash merge（保持历史干净），PR 描述成为 commit 主体
- 合入后基线更新（截图基线 / perf-history）自动同步

### 2.5 发布与版本

- **SemVer**：契约破坏 = major；新功能向后兼容 = minor；修复 = patch
- 版本发布 = 产物分发（单文件 index.html + npm 包）
- 发布流程：tag → CI 构建发布产物 → 校验产物完整性 → 发布 → 更新 CHANGELOG
- **人批准发布**：发布必须人确认（Agent 可准备一切，最终按钮人按）
- 破坏性变更需 RFC 评审 + 迁移指南（见 [08-roadmap](./08-roadmap.md) Phase 5 迁移工具）

---

## 3. 提交与 PR 规范

### 3.1 Commit Message

**Conventional Commits** 格式（机器可消费、可追溯）：

```
<type>(<scope>): <subject>
<需求ID>

<body>

BREAKING CHANGE: <说明>
```

| 字段 | 规范 |
|---|---|
| type | `feat` / `fix` / `refactor` / `docs` / `test` / `chore` / `perf` |
| scope | 模块或文件（如 `runtime` / `search` / `cli`） |
| subject | 祈使句，小写开头，≤ 50 字符 |
| 需求 ID | 引用规格中的需求 ID（如 `SRCH-001`），**无 ID 的任务用 `chore`** |
| BREAKING CHANGE | 破坏性变更必须显式标注 |

### 3.2 PR 模板

每个 PR 必须包含：

```markdown
## 目的
<!-- 解决什么问题，引用需求 ID -->

## 改动范围
<!-- 改了哪些文件/模块，为什么这样改 -->

## 验收证据
<!-- 机器证据：CI 结果链接；视觉证据：截图；性能证据：基准数据 -->

## 测试
<!-- 新增/修改的测试，覆盖了什么场景 -->

## 关联
<!-- 依赖的 PR / 规格 / issue -->
```

**涉及视觉的 PR 必须带截图**（改前/改后或基线对比），**涉及性能的必须带基准数据**——这是给人看也是给 Agent 看的验收证据。

### 3.3 PR 大小与聚焦

- **一个 PR 一件事**：混合不相关改动 = blocker
- 建议 ≤ 400 行变更（超限需拆分说明）
- 大特性拆分为里程碑式的小 PR 序列（每个可独立验证）

### 3.4 验收证据义务

| 改动类型 | 必须提供的证据 |
|---|---|
| 功能逻辑 | 相关测试全绿 |
| 视觉/UI | 截图（多断点，涉及模板时多模板） |
| 性能敏感 | 基准数据对比（构建/搜索/体积） |
| 契约/API | 契约测试通过 + Schema/类型变更说明 |
| 安全相关 | 安全测试用例 + 说明 |

---

## 4. 文档规范

### 4.1 意图文档

- **每个模块必须有「意图文档」**：为什么存在、解决什么问题、与相邻模块的边界——不只是怎么用
- 放在模块根目录 `README.md` 或 `docs/intent.md`
- 无意图文档的新模块 = blocker

### 4.2 注释规范

- 注释解释 **why**，不解释 **what**（代码本身就是 what）
- 非显然的决策必须注释原因（否则 Agent 未来可能"清理"掉它）
- 注释用中文（项目主语言），代码标识符用英文
- 禁止整段注释掉的死代码（直接删除）

### 4.3 API 文档格式

- 遵循 [07-plugin-system](./07-plugin-system.md) 定义的 API 文档结构（描述/签名/参数/返回值/示例/相关）
- API 文档与 TypeScript 类型定义**同步生成或校验**（类型即文档，防漂移）

### 4.4 术语统一

- 术语表（[09-appendix](./09-appendix.md) 9.3）是**强制词典**，新增术语必须登记
- 文档与代码中的概念命名必须一致（如「三形态」对应 dev / SSG / bundle）
- 英文术语首次出现给出中文注释，之后统一

### 4.5 示例代码规范

- 所有示例代码**必须可运行**，并有测试验证（防"文档骗人"）
- 示例用标准语法（CommonMark + GFM），不用方言（呼应无锁入原则）
- 示例命名有语义（`quickstart.md` 不叫 `example1.md`）

---

## 5. 开源协作规范

> 目标：让开源贡献者**提升**产品质量，而不是稀释它。

### 5.1 外部 PR 质量护栏

- 外部 PR 走 B 通道：CI 全量 + 评审 Agent 全量 + 人 100% 把关
- 外部 PR 缺测试 / 缺验收证据 = blocker
- 外部贡献者在合入前需签署 DCO（见 5.5）

### 5.2 核心文件保护（CODEOWNERS）

受保护路径（仅维护者可改，外部 PR 需显式批准）：

```
/packages/renderer/core/         # Node 渲染内核（体积/安全敏感）
/contracts/                      # 契约测试与类型
/test/visual/baselines/          # 视觉回归基线
/doclight.schema.json            # 配置 Schema
/SECURITY.md                     # 安全政策
```

### 5.3 贡献者信任梯度

- 新贡献者从**小 PR 起步**（文档/示例/修复），逐步建立信任
- 连续 3+ 个高质量 PR 后，可参与核心模块
- 权限按需授予（triage → write → maintain），不一次性放开

### 5.4 Issue 规范

- **Bug 模板**：复现步骤 / 期望行为 / 实际行为 / 环境（浏览器/模式/版本）
- **功能请求模板**：场景 / 问题 / 期望 / 与现有功能的差异
- 标签体系：`bug` / `enhancement` / `good first issue` / `help wanted` / `agent-friendly` / `needs-spec`
- 需求 ID 体系与 Issue 打通（Issue 是需求 ID 的来源之一）

### 5.5 DCO / CLA / Code of Conduct

- **DCO**（Developer Certificate of Origin）：每个 commit 需 `Signed-off-by`，轻量、免法律文档
- Code of Conduct：行为基线（简洁版，引用标准模板）
- 不强制 CLA（对个人贡献者负担重，DCO 足够）

### 5.6 安全披露

- `SECURITY.md`：声明受支持版本、报告渠道（私密渠道，**不公开 issue**）
- 安全修复流程：先修后公开（协调披露），修复 PR 不提前讨论细节
- 安全相关 PR 走最高审查级别

---

## 6. Agent 专属规范

> 开源项目中只有本项目才需要的规范——它们是给开发 Agent 的「工作伦理」。

### 6.1 Agent 任务模板

每个交给 Agent 的任务必须包含（无论来自人还是自动调度）：

```
目标：要完成什么（含需求 ID）
约束：不能做什么（依赖限制、文件保护、体积预算）
验收：DoD 清单（机器可验证）
失败处理：卡住/超时怎么办（熔断、回滚、上报）
上下文：相关规格文档与示例
```

### 6.2 Agent 权限规范

| 范围 | 权限 |
|---|---|
| `packages/*/src`（非核心） | Agent 可直接修改 |
| `packages/runtime/core/` | 需显式批准（RFC 或维护者确认） |
| `contracts/` / 基线截图 | 只读，改需专门流程 |
| 新增依赖 | 必走 1.4 审批 |
| `doclight.json` Schema | 只加不改，破坏性变更需 RFC |
| 发布 | 只能准备，不能执行（人按按钮） |

### 6.3 Agent 交接规范

多 Agent 协作 / 任务交接的文档格式：

```
任务 ID / 需求 ID
当前状态：done / in-progress / blocked
已完成：做了什么（文件 + 测试）
遗留问题：什么没做、为什么
验证状态：哪条命令跑到什么结果
上下文链接：相关规格、示例、评审 findings
下一步建议：明确的后续动作
```

交接文档存在 `docs/agent-handoffs/` 或 PR 描述中，保证换 Agent 会话不丢上下文。

### 6.4 决策记录（ADR）

> **Agent 长期开发会反复做决策。ADR 是 Agent 项目的记忆机制**——防止"换个会话就推翻重来"。

- 每个关键设计决策写一条 ADR：`adr/NNNN-title.md`
- 格式：背景 → 选项 → 决策 → 后果 → 关联需求
- 引用它的实现与文档（双向可追溯）
- 推翻旧决策必须写新 ADR 并标注 Deprecated

**触发 ADR 的场景**：依赖选型、架构变更、契约设计、破坏性变更、性能策略调整。

---

## 7. 违规处理与护栏

### 7.1 阻断项 vs 提示项

| 级别 | 判定 | 处理 |
|---|---|---|
| 🚫 Blocker | 违反 1.4/1.5/2.3/2.4/3.3 等硬性规范 | 不可合入，必须修复 |
| ⚠️ Warning | 可读性/可维护性建议 | 可合入，需在 PR 中说明处理决定 |
| 💡 Nit | 风格微调 | 不阻塞，可后续清理 |

### 7.2 回滚与恢复

- 任何合入破坏基线 → 立即回滚到上一个全绿基线（见 [10](./10-agent-dev-environment.md) 4.4）
- 回滚后写复盘记录（ADR 或 issue），防止同类错误复发
- 恢复优先级高于新功能

---

## 8. 附：Checklist 总表（人机共用）

### 8.1 Review Checklist

```
[ ] 正确性：逻辑是否符合规格与需求 ID
[ ] 边界：空值/异常/极端输入是否处理
[ ] 安全：是否引入 XSS / 注入 / 供应链风险
[ ] 性能：是否超体积/性能预算
[ ] 契约：插件 API / Schema / CLI 是否破坏兼容
[ ] 测试：是否有对应测试，覆盖关键分支
[ ] 规范：命名/结构/注释是否符合本章
[ ] 文档：意图文档与 API 文档是否同步
[ ] 无障碍：涉及 UI 的改动是否符合 WCAG
[ ] 验收证据：截图/基准/测试结果是否齐全
```

### 8.2 PR Checklist（提交者自查）

```
[ ] 一个 PR 只做一件事
[ ] Commit message 符合 Conventional Commits + 需求 ID
[ ] 无新增依赖（或已走审批并说明）
[ ] CI 全绿（lint/test/visual/perf/contract）
[ ] 视觉改动附截图
[ ] 性能改动附基准数据
[ ] 破坏性变更标注 BREAKING CHANGE + 迁移说明
[ ] 覆盖核心文件的改动已获批准
```

### 8.3 Commit Checklist

```
[ ] type(scope): subject ≤ 50 字符
[ ] 引用需求 ID
[ ] 破坏性变更显式标注
[ ] （开源提交）Signed-off-by
```

---

## 9. 与其它文档的关系

| 文档 | 关系 |
|---|---|
| [10-agent-dev-environment](./10-agent-dev-environment.md) | 规范的第 1 层「机器强制」的落地工具 |
| [08-roadmap](./08-roadmap.md) | Phase 0 需将本规范并入环境搭建 |
| [01-product-positioning](./01-product-positioning.md) | 原则零 Agent-First 是全部规范的依据 |
| [07-plugin-system](./07-plugin-system.md) | API 文档格式与插件命名规范来源 |
| [09-appendix](./09-appendix.md) | 术语表（4.4 的强制词典） |
