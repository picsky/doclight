# specs/ — 行为规格目录（目标层）

> 对应设计：[10-agent-dev-environment §1](../docs/tech-design/10-agent-dev-environment.md)（目标层 Spec）
> 状态：Phase 0 建目录与约定；具体规格随 Phase 1-4 落地

## 为什么存在

规格是「做什么 + 怎么验收」的机器可读载体。每个需求以 **RFC 式规格文档 + Gherkin 行为规格** 双形态存在，让开发 Agent 明确知道「什么算做完」，验收准则可被自动化测试直接消费。

## 规划中需求（Phase 2 扩展语法渲染，随实现落地）

> 调研结论（2026-08-13，见仓库根 `research-report-agent-content-opportunity.md` / `research-report-agent-content-demand-validation.md`）：扩展语法渲染是 DocLight 差异化核心（Agent 原生能力），已落入 08-roadmap Phase 2 优先级。
> 以下 ID 为**规划中登记**，`.feature` 文件与 `packages/*` 实现须**一并落地**（spec:check 要求 ID 在实现中有引用，避免破坏 `npm run verify` 6/6 全绿门禁）。

| 需求 ID | 名称 | 说明 | 状态 |
|---|---|---|---|
| REND-002 | 扩展语法注册表 | 白名单式（类型 / DOMPurify sanitize / 懒加载映射 / 降级策略），不引入 MDX/JSX | 规划中 |
| REND-003 | Mermaid 容错渲染 | LLM 生成语法错误→降级为图表源码+提示，不白屏 | 规划中 |
| REND-004 | 双读友好验证 | 扩展渲染后 llms.txt/MCP 仍返回纯 markdown 原稿 | 规划中 |

> 落地时：新建 `specs/features/render-ext.feature` 承载上述 ID + `packages/renderer/src/ext/` 实现 + 单测，三者同时合入。

## 目录结构约定

```
specs/
├── README.md            # 本文件：约定与索引
├── <NNN>-<topic>.md     # RFC 式设计规格（背景→目标→范围→设计→验收准则）
└── features/
    └── <topic>.feature  # Gherkin 行为规格（Given/When/Then）
```

## 需求 ID 与追溯（10 §1.4）

- 每个需求项有唯一 ID：`<前缀>-<序号>`（如 `SRCH-001`）
- 前缀表：`SRCH`(搜索) / `REND`(渲染) / `NAV`(导航) / `TOC` / `THEME` / `SSG` / `MCP` / `PLUG`(插件) / `SPACE`(内容空间) / `CLI` / `DEV`(dev server，Phase 1 新增) — 新增前缀须登记
- Agent 在**提交信息与代码中引用需求 ID**（`feat(SRCH-001): ...`）
- `npm run spec:check` 校验链路：specs 中的每个 ID 在 `packages/*` 的源码或测试中有引用
- 只有 `.feature` 与编号 RFC 规格（`NNN-*.md`）承载需求 ID；本 README 中的示例 ID 仅供说明，不计入追溯（spec:check 不扫描约定文档）

## RFC 式规格格式约定

```
# <NNN> · <标题>（需求 ID）

## 背景    为什么现在做（数据/用户/roadmap 依据）
## 目标    完成什么（可衡量、机器可验证）
## 范围    明确做/不做（防 scope 蔓延）
## 设计    关键方案与决策
## 验收准则  Gherkin（Given/When/Then，可被测试直接消费）
```

## Gherkin 验收准则示例

```gherkin
# 验收准则：SRCH-001 内置搜索零配置可用
Feature: 内置搜索
  Scenario: 无任何配置即可搜索
    Given 一个只有 docs/ 文件夹的站点
    When 用户按 Cmd+K 打开搜索框并输入关键词
    Then 搜索结果在 50ms 内返回
    And 结果包含路径面包屑与命中摘要
```
