---
name: doclight-verify
description: 校验 DocLight 开发环境契约（Phase 0 产出）是否落实：文件/目录/契约文件/构建与校验命令。用法：/doclight-verify
---

# doclight-verify — 开发环境契约校验

> 校验对象：Phase 0「Agent 自迭代开发环境」交付物（[10-agent-dev-environment §7 验收清单](../../../docs/tech-design/10-agent-dev-environment.md)）
> 使用时机：代码实现后 / 环境被改动后，确认环境契约未退化。

## 三个子技能

| 子技能 | 校验内容 |
|---|---|
| `build` | 构建与验证：`npm run verify` 一条命令跑通且全绿 |
| `contract` | 契约文件：必需文件/目录存在、结构合法（contracts / specs / docs） |
| `dev` | 开发环境：monorepo 结构、Node/pnpm 版本、依赖最小化 |

## 校验清单

### build（构建与验证）

1. 运行 `npm run verify`，确认输出 `VERIFIED ✓`
2. 若失败，读取 `artifacts/reports/verify.json` 定位失败 check
3. 逐个 check 修复，直至全绿

### contract（契约文件）

必需存在且合法：

- [ ] `contracts/doclight.schema.json` — 合法 JSON + JSON Schema（$schema/type 齐备）
- [ ] `specs/README.md` + `specs/features/` 目录
- [ ] `docs/agent-handoffs/README.md`
- [ ] `adr/` 决策记录目录
- [ ] `.claude/skills/doclight-verify/SKILL.md`（本文件）

### dev（开发环境）

- [ ] monorepo：`packages/{renderer,display,core,cli,mcp-server}` 各含 package.json + README（意图文档）
- [ ] Node ≥ 20（`.nvmrc` / engines 一致）
- [ ] 包管理器 pnpm（pnpm-workspace.yaml 存在）
- [ ] 依赖最小化：新增依赖走 12 §1.4 审批

## 输出

按 12 §0.1 双读友好输出：

- 人可读：逐项 checklist 勾选/缺失说明
- 机器可检查：结论为「通过 / 不通过 + 缺失项清单」，Agent 可直接据此修复
