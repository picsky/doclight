# 10 · Agent 自迭代开发环境

> 状态：待评审（🟡）
> 对应原则：[原则零 Agent-First](./01-product-positioning.md)
> 上游依据：[research-report.md](../research-report.md)、[08-roadmap.md](./08-roadmap.md)

---

## 0. 设计哲学：Agent 是开发主力

**DocLight 主要由 Code Agent 自主开发。** 这意味着开发体验的「用户」不是人，是 Agent。传统开发环境的所有假设（人看错误信息、人跑测试、人判断美丑）在这里全部失效。

### 核心转变

| 传统假设（为人设计） | Agent 自迭代（为本项目） |
|---|---|
| 错误信息给程序员看 | 错误输出是 **API**，Agent 像解析 JSON 一样解析它 |
| 代码评审请人看 | **评审 Agent** 独立审查，输出结构化 findings |
| 设计美丑靠人主观判断 | **视觉回归 + 设计合规** 机器可验证 |
| 目标是「差不多能跑」 | 目标是 **DoD（完成定义）机器可检查** |
| 靠人记得产品长什么样 | **Golden Master 基线** 每次改动可对比可回滚 |

### 设计原则

1. **目标可机器验证** — Agent 必须先知道「什么算做完了」，才有依据自迭代
2. **反馈可机器消费** — 所有失败、警告、建议都结构化输出，Agent 能直接读并动手修
3. **闭环可自动执行** — 提交 → 验证 → 反馈 → 修复 形成循环，无需人介入
4. **防退化** — Agent 改动可能渐进式变差，必须有基线对比和独立把关
5. **人随时可接管** — 环境不排斥人，但默认路径是 Agent 全自动

---

## 1. 目标层（Spec）——Agent 知道「要做什么」

### 1.1 机器可读规格

所有需求以「规格文档 + 行为规格」双形态存在：

```
specs/
├── 01-routing.md          # RFC 式设计 + 验收准则
├── 02-markdown.md
├── 03-search.md
├── 04-theming.md
├── 05-ssg.md
├── 06-mcp.md
├── 07-plugin-api.md
└── features/
    ├── search.feature    # Gherkin 行为规格
    ├── ssg.feature
    └── mcp.feature
```

**格式约定**：
- 每个规格以 RFC 式结构：背景 → 目标 → 范围（做/不做）→ 设计 → 验收准则
- 验收准则用 **Gherkin**（`Given/When/Then`）书写，可被自动化测试直接消费
- 每个需求项有唯一 ID（如 `SRCH-001`），Agent 在提交信息与代码中引用，实现规格可追溯

**示例（Gherkin 验收准则）**：
```gherkin
# 验收准则：SRCH-001 内置搜索零配置可用
Feature: 内置搜索
  Scenario: 无任何配置即可搜索
    Given 一个只有 docs/ 文件夹的站点
    When 用户按 Cmd+K 打开搜索框并输入关键词
    Then 搜索结果在 50ms 内返回
    And 结果包含路径面包屑与命中摘要
```

### 1.2 DoD（Definition of Done）可机器检查

每个任务的完成定义必须是可执行命令验证的，**不许出现「人工确认」字样**：

| DoD 条目 | 验证方式 |
|---|---|
| 功能行为正确 | `npm run test` 全绿（含新功能 Gherkin 测试） |
| 视觉无回归 | `npm run verify:visual` diff 为 0 |
| 性能达标 | `npm run verify:perf` 门禁通过 |
| 体积不超预算 | `npm run verify:size` 门禁通过 |
| 无类型/规范错误 | `npm run verify:lint` 通过 |
| 文档同步 | 规格文档与实现一致（快照对比） |

### 1.3 设计 token 即视觉规范

视觉目标以**设计令牌（CSS 变量）+ 基准截图**表达，而不是文字描述：
- 颜色、间距、字号、圆角、阴影等全部是 token，见 [03-runtime-engine.md](./03-runtime-engine.md) 3.6
- **设计合规检查**自动校验实现是否符合 token（对比度、8pt 间距网格、字号节奏）
- 视觉回归的**基线截图**就是「长什么样」的唯一权威

### 1.4 规格追溯

建立调研报告 → 设计文档 → 规格 → 实现 的链路索引：

```
research-report.md   ← 为什么做（证据）
  ↓ 引用
tech-design/*.md     ← 做什么（设计）
  ↓ 引用（需求 ID）
specs/*.feature      ← 怎么验收（行为规格）
  ↓ 实现（提交信息引用需求 ID）
packages/*/src       ← 代码
```

`npm run spec:check` 检查：每个需求 ID 都有对应测试、每个测试都反链到需求。

---

## 2. 验证层（Verify）——Agent 知道「做对没有」

### 2.1 验证矩阵

| 验证维度 | 工具 | 门禁标准 |
|---|---|---|
| 单元测试 | Vitest | 全绿，覆盖率 ≥ 80% |
| 端到端行为 | Playwright + Gherkin | 全绿 |
| **视觉回归** | Playwright 截图 + 像素 diff | **4 模板 × 亮暗 × 桌面/移动，diff = 0** |
| **三形态产物一致性** | 自定义脚本 | dev / SSG / bundle 对同一 Markdown 输出逐字节一致 |
| **浏览器矩阵** | Playwright × {Chromium, Firefox, WebKit} | 三形态产物在 file:// 与 http 下全通过 |
| **真实内容渲染** | 自定义脚本（research-report.md 等 fixtures） | 渲染正确、无异常 |
| **安全测试** | 恶意 Markdown 回归集 | script / javascript: / 事件属性 全部清除 |
| **性能预算** | 自定义脚本 | 展示层 < 25KB gzip、100 页 < 5s、搜索 < 50ms |
| **设计合规** | 自定义脚本 | WCAG 对比度、8pt 网格、字号节奏 |
| Lighthouse | Playwright + Lighthouse | Perf ≥ 95、A11y ≥ 95、BP = 100、SEO = 100 |
| 代码质量 | ESLint + TypeScript | 零 error |
| 契约稳定 | 契约测试 | 插件 API / doclight.json Schema 向后兼容 |

### 2.2 视觉回归（视觉质量的机器化）

视觉质量不能靠「人看一眼说好」，必须机器可验证：

```
npm run verify:visual
  → 对 4 模板 × 亮暗 × 桌面(1440) / 平板(768) / 移动(375) 生成截图
  → 与基线截图像素级对比
  → 输出 diff 报告（diff 图 + 差异区域坐标 + 差异百分比）
  → 任何差异 = 失败（Agent 拿到 diff 图和坐标就能定位修复）
```

- **基线截图**由 Golden Master 参考站 + 人工/评审 Agent 一次性确认后锁定
- 允许的例外必须显式声明（如「仅字体渲染差异，浏览器无关」）
- 截图产物同时是**多模态反馈**——失败时 diff 图直接进入 Agent 上下文

### 2.3 三形态产物一致性（渲染唯一性保证）

渲染只在 Node 内核发生一次，天然无双端漂移。剩余保证：三种产物形态输出一致。

```
npm run verify:isomorphic
  → 同一篇 Markdown，分别经 dev / SSG / bundle 三条路径渲染
  → 逐字节比对，差异即失败
  → 覆盖所有内置语法特性（表格/代码/容器/公式/图表/sanitize）
```

### 2.4 性能预算（硬门禁，不是参考）

| 预算项 | 门禁值 | 超限行为 |
|---|---|---|
| 展示层（gzip） | < 25KB | CI 直接失败 |
| Node 渲染内核（gzip，不进入浏览器） | < 20KB | CI 直接失败 |
| SSG 构建 | 100 页 < 5s | CI 直接失败 |
| 搜索响应 | < 50ms（100 篇） | CI 直接失败 |
| 首屏 LCP | < 500ms（SSG，3G） | CI 直接失败 |

预算历史写入 `perf-history.json`，Agent 可追踪趋势、防止渐进式膨胀。

---

## 3. 反馈层（Feedback）——Agent 知道「哪里不对」

### 3.1 结构化输出（错误信息是 API）

所有命令与 CI 步骤必须双格式输出：

```jsonc
// 例：视觉回归失败输出（report.json 片段）
{
  "status": "fail",
  "check": "visual-regression",
  "total": 24, "passed": 23, "failed": 1,
  "failures": [
    {
      "id": "modern-dark-mobile",
      "template": "modern", "mode": "dark", "viewport": "mobile",
      "diffRatio": 0.021,
      "diffImage": "artifacts/diffs/modern-dark-mobile.png",
      "regions": [ { "x": 120, "y": 340, "w": 480, "h": 60 } ],
      "likelyCause": "component:sidebar:focus-ring"
    }
  ]
}
```

- 终端人类可读摘要 + `--json` 机器可读全文
- **失败输出本身就是给 Agent 的修复线索**（坐标、区域、疑似组件）
- 每个 check 有稳定 ID，Agent 可 grep、可缓存、可重试

### 3.2 评审 Agent（独立视角把关）

每次提交触发独立的**评审 Agent**，与开发 Agent 视角隔离：

```
npm run review
  → 读取本次提交 diff + 相关规格 + 关联测试
  → 从维度审查：正确性 / 视觉一致性 / 性能 / 无障碍 / 规格符合度
  → 输出 findings 清单（JSON）：
      { severity, file, line, title, evidence, suggestedFix }
  → 开发 Agent 依 findings 修复，循环直至零 blocker
```

评审 Agent 的职责不是「挑错」，而是**对规格的对抗性验证**——假设实现是错的，努力证伪。

### 3.3 失败截图回流

- 一切与视觉/布局相关的失败，产物必须包含截图（基线/实际/diff 三图）
- 截图路径写入结构化输出，Agent 可直接读取图片理解问题
- Golden Master 对比结果同样是图，Agent 可「亲眼看」自己改动的视觉效果

### 3.4 反馈回路约定

| 反馈来源 | 格式 | 消费方 |
|---|---|---|
| 单元/E2E 失败 | JUnit XML + JSON | 开发 Agent |
| 视觉回归 diff | JSON + 三图 | 开发 Agent（多模态） |
| 性能超限 | JSON + 历史趋势 | 开发 Agent |
| 评审 findings | findings JSON | 开发 Agent |
| 设计合规违规 | JSON（含 token 与位置） | 开发 Agent |

---

## 4. 闭环层（Loop）——Agent 自动迭代

### 4.1 一条命令跑全部验证

```bash
npm run verify
  # 等价于依次执行：
  #   npm run verify:lint
  #   npm run verify:test
  #   npm run verify:visual
  #   npm run verify:isomorphic
  #   npm run verify:perf
  #   npm run verify:size
  #   npm run verify:contract
  # 全部通过输出：VERIFIED ✓（含摘要）
```

任何 Agent（开发/评审/新人）跑这一条命令就知道当前仓库状态。

### 4.2 自迭代循环剧本

**设计目标**：开发 Agent 提交 → 自动验证 → 自动反馈 → 自动修复，循环直至全绿。

```
┌────────────┐   提交    ┌────────────┐   触发   ┌────────────┐
│ 开发 Agent │ ────────► │    CI      │ ────────► │  验证矩阵  │
└────────────┘          └────────────┘          └────────────┘
     ▲                                                │
     │             评审 findings + 失败详情            ▼
     └─────────────────────────────── 开发 Agent 修复 ◄┘
        （反馈结构化，Agent 直接读直接改）
```

落地形态：
1. **CI 阶段**：lint → test → visual → isomorphic → perf → contract，任一步失败即停止并产出完整结构化反馈
2. **评审阶段**：CI 全绿后触发评审 Agent，产出 findings
3. **修复阶段**：开发 Agent 读取反馈，定向修复，重新提交
4. **循环终止条件**：验证全绿 + 评审零 blocker + 覆盖率达门槛

> 此剧本可固化为 workflow 脚本（fan-out 验证、对抗性评审），使「开发 agent 开发 agent 产品」真正自动化。

### 4.3 Golden Master 参考站（Dogfooding）

- **DocLight 的官方文档站用 DocLight 自身构建**（自举）
- 该文档站即 **Golden Master**：内容、视觉、性能、行为的「标准答案」
- 所有默认模板的基线截图取自它
- 每次核心改动后用 Dogfooding 构建验证「产品能正常构建自己的文档站」——这是最真实的集成测试

### 4.4 可回滚基线

- 每次合入的 `verify` 通过状态与产物（基线截图、perf-history）一起提交
- 任一改动导致回归，可一键回滚到上一个全绿基线（`git revert` + 基线自动恢复）
- 基线由版本管理锁定，不允许静默覆盖

---

## 5. 契约层（Contract）——防止 Agent 退化

### 5.1 API 契约测试

外部承诺的 API（插件钩子、app 实例、doclight.json Schema、CLI 命令）必须有契约测试：

```
npm run verify:contract
  → 插件 API：钩子签名、参数类型、返回值类型（TypeScript 类型即契约）
  → doclight.json：JSON Schema 校验（新增字段 = 向后兼容）
  → CLI：命令、参数、退出码、输出格式稳定性
  → MCP：工具名、参数 Schema、返回结构稳定性
```

**规则**：只加不改。破坏性变更必须走 RFC 评审 + 迁移指南。

### 5.2 代码质量门禁

- ESLint + TypeScript（严格模式）零 error
- 覆盖率 ≥ 80%（核心模块 ≥ 90%）
- 无死代码（类型检查 + lint 兜底）
- 所有新增代码必须携带需求 ID 引用

### 5.3 依赖与供应链安全

- 依赖最少化（原则：能不用库就不用库）
- `npm audit` + lockfile 校验进 CI
- 依赖升级走契约测试（版本升级不破坏插件 API）

### 5.4 变更与版本规范

- Conventional Commits（类型化提交信息，可被 Agent 消费）
- 提交信息引用需求 ID 与规格（`feat(SRCH-001): ...`）
- CHANGELOG 自动生成
- 版本语义化（SemVer），契约破坏 = minor/major 升级

---

## 6. 开发用 MCP Server（开发端的 L4）

与「运行时 MCP」（消费文档站）区分，提供**开发 MCP Server**，让开发 Agent 像操作工具一样操作仓库：

| Tool | 功能 | 说明 |
|---|---|---|
| `run_verify` | 运行指定验证 | lint / test / visual / perf / contract |
| `get_verify_result` | 读取最近验证结果 | 结构化 JSON |
| `snapshot_visual` | 生成指定模板/断点截图 | 多模态反馈 |
| `diff_baseline` | 与基线对比 | 返回 diff 图与坐标 |
| `read_spec` | 读取指定规格/DoD | 按需求 ID 检索 |
| `get_review_findings` | 读取评审结果 | findings JSON |
| `get_perf_history` | 读性能趋势 | 防膨胀 |
| `scaffold_plugin` | 生成插件脚手架 | 模板自带文档 |

实现建议：与使用端 MCP 共用协议基础设施，配置上区分「使用端 / 开发端」。

---

## 7. 环境验收清单

Phase 0 结束时，用以下清单验收环境本身（环境也是产品，同样需要 DoD）：

| # | 验收项 | 验证方式 |
|---|---|---|
| 1 | `npm run verify` 一条命令全绿 | 命令执行 |
| 2 | 故意引入一个视觉 bug，CI 能定位到具体模板/断点/坐标 | 演练 |
| 3 | 故意超限 1KB 体积，CI 直接失败并给出结构化报告 | 演练 |
| 4 | 评审 Agent 能对一次虚假合入给出可执行的 findings | 演练 |
| 5 | 失败截图能进入 Agent 上下文（多模态可读） | 演练 |
| 6 | 规格需求 ID 可追溯到测试与代码 | `npm run spec:check` |
| 7 | 契约测试能拦住一次插件 API 破坏性变更 | 演练 |
| 8 | 回滚到上一全绿基线能在 1 分钟内完成 | 演练 |

---

## 8. 指标与成功标准

| 指标 | 目标 |
|---|---|
| 从提交到全绿反馈 | < 5 分钟（CI） |
| 单任务自迭代轮次（提交→修复→绿） | ≤ 3 轮 |
| 视觉回归基线 | 4 模板 × 亮暗 × 3 断点 = 24 组，零回归 |
| 浏览器矩阵 | Chromium / Firefox / WebKit × 三形态 × file://+http 全通过 |
| 安全测试集 | 恶意输入回归全绿，零 XSS |
| 反馈可机器消费率 | 100%（所有 check 有 JSON 输出） |
| 无人工参与闭环 | 常规任务可全自动 |
| 契约测试覆盖 | 插件 API / Schema / CLI / MCP 全覆盖 |

---

## 9. 与其它文档的关系

| 文档 | 关系 |
|---|---|
| [00-README](./00-README.md) | 原则零的落地载体 |
| [01-product-positioning](./01-product-positioning.md) | Agent-First 原则来源 |
| [06-ai-native](./06-ai-native.md) | 开发端五层的完整规格 |
| [08-roadmap](./08-roadmap.md) | Phase 0 的实施清单 |
| [11-default-themes](./11-default-themes.md) | 视觉回归的基线来源 |
