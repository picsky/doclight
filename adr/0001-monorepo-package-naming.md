# ADR-0001: Monorepo 包命名统一为 renderer

> 状态：✅ 已接受
> 日期：2026-08-11
> 决策者：人类维护者（对齐点 A 确认）+ 开发 Agent

---

## 背景

脚手架前发现文档间包命名不一致：

| 文档 | 位置 | 写法 |
|---|---|---|
| 02-architecture | §2.2.1 | `packages/renderer/`（含 `core/`） |
| 12-development-standards | §1.2 依赖方向 / §6.2 权限表 | `packages/runtime` |
| 12-development-standards | §5.2 CODEOWNERS | `packages/renderer/core/` |

12 文档内部也自相矛盾（同文档既出现 runtime 又出现 renderer）。

## 选项

1. **renderer**：遵循架构权威文档 02，与「Node 渲染内核」术语一致；CODEOWNERS 已用 renderer。
2. **runtime**：遵循 12 规范权限表与依赖方向表述；需同步改 02 与 CODEOWNERS。

## 决策

采用 **`packages/renderer`**（选项 1），并以 02 架构文档为权威来源，同步修订 12 规范中的 `runtime` 字样。

理由：
- 02 是架构决策的权威文档，命名与术语表「Node 渲染内核」直接对应；
- CODEOWNERS（安全敏感路径）已使用 renderer，改动更小；
- `runtime` 一词易与「浏览器运行时（browser runtime）」混淆，二义性更大。

## 后果

- monorepo 包结构定为：`packages/renderer`（Node 渲染内核，含 `core/`）、`packages/display`（浏览器展示层）、`packages/core`（公共类型）、`packages/cli`（CLI，Phase 3）、`packages/mcp-server`（MCP，Phase 4）
- 12 文档 §1.2 与 §6.2 已同步修订为 renderer
- 依赖方向：renderer 不依赖 cli；cli 可依赖 renderer

## 关联需求

- [02-architecture](./tech-design/02-architecture.md) §2.2
- [12-development-standards](./tech-design/12-development-standards.md) §1.2 / §5.2 / §6.2
