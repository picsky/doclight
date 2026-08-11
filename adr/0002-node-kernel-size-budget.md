# ADR-0002: Node 渲染内核体积预算 20KB → 25KB

> 状态：✅ 已接受
> 日期：2026-08-11
> 决策者：人类维护者（对齐点 A 确认）+ 开发 Agent
> 触发：Phase 1 marked 扩展性 spike 实测（`.spike/marked-extensibility.mjs`）

---

## 背景

02-architecture §2.2 与 08-roadmap 将 Node 渲染内核的 gzip 预算定为 **< 20KB**（marked ~8KB + DOMPurify ~7KB + 内核逻辑 ~5KB）。Phase 1 启动前按「先验证后设计」原则做了 marked 扩展性 spike，实测：

| 依赖 | 实测 gzip | 预算估值 |
|---|---|---|
| marked（未压缩 ESM/UMD） | **12.8KB** | ~8KB |
| dompurify（已 min） | **10.6KB** | ~7KB |
| **小计** | **≈ 23.4KB** | ~15KB |

即：仅两个强制依赖就已超出 20KB 预算（尚未含内核自有逻辑 ~5KB）。即使构建期深度 minify，估算仍落在 23-25KB，硬压 20KB 需裁剪安全层或解析器功能，不可接受。

## 选项

1. **上调预算至 25KB**：内核是**服务端/构建时产物，不进浏览器**，20KB 是「加依赖纪律」的纪律值而非用户体验硬线；浏览器展示层 25KB 才是对用户体验敏感的真正硬门禁。25KB 仍足以维持「加依赖需审批」的纪律。
2. **保持 20KB 硬压**：引入 esbuild/terser 深度 minify + 裁剪 marked 功能。风险：dompurify 已 min 仍 10.6KB，硬压空间有限；裁功能损害 GFM 完整性与可维护性。
3. **更换解析器组合**：markdown-it 更重（24KB+），与「小而美」相悖；自写白名单清洗器有安全风险。不推荐。

## 决策

采用 **选项 1：Node 渲染内核体积预算上调至 < 25KB gzip**。

理由：
- 内核不进浏览器 → 体积对用户体验（LCP/带宽）无直接影响，只影响构建/服务端内存与分发；
- 浏览器展示层 < 25KB 是用户侧硬门禁，保持不变；
- 25KB 仍足够小，维持「加依赖最高危」的审批纪律（12 §1.4）；
- 避免为压体积牺牲安全层（DOMPurify 不可裁剪）或解析器完整性。

## 后果

- 02-architecture §2.2 体积预算表、08-roadmap 性能门禁、12-development-standards、CLAUDE.md 风险提示同步更新为 25KB
- `scripts/checks/size.mjs` BUDGETS 中 renderer 条目预算改为 `25 * 1024`（Phase 1 产出 `dist/renderer.js` 后启用）
- 展示层 25KB、搜索响应、构建速度等其他门禁**不变**
- 若未来内核体积逼近 25KB，需先走审批说明再调整，不得悄悄超限

## 关联需求

- [02-architecture](./tech-design/02-architecture.md) §2.2 / §2.3.1 / §2.3.7
- [08-roadmap](./tech-design/08-roadmap.md) Phase 0 任务清单 / Phase 1 交付物
- [12-development-standards](./tech-design/12-development-standards.md) §1.4
- Phase 1 目标声明 `docs/goals/PHASE-1-goal.md`
