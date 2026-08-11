# docs/agent-handoffs/ — Agent 交接文档

> 对应规范：[12-development-standards §6.3](./tech-design/12-development-standards.md)、[AGENT.md](../../AGENT.md)

## 为什么存在

本项目由 Agent 长期开发，**换 Agent / 换会话会丢上下文**。交接文档是保证「上下文不丢」的载体。每个进行中/卡住/已交接的任务，在合入前都必须有交接记录。

## 交接格式（强制）

每次交接 / 中断必须输出以下结构：

```
任务 ID / 需求 ID：
当前状态：done / in-progress / blocked
已完成：做了什么（文件 + 测试）
遗留问题：什么没做、为什么
验证状态：哪条命令跑到什么结果
上下文链接：相关规格、示例、评审 findings
下一步建议：明确的后续动作
```

## 文件命名

- `<TASK-或需求ID>-<slug>.md`，如 `TASK-001-scaffold.md`
- 或放在对应 PR 描述中（交接内容二选一即可，不必重复）

## 约定

- 状态为 blocked 的任务**必须**写交接文档，不得静默卡住（AGENT.md 失败处理）
- 交接文档属于契约层文件（contract check 校验本目录存在）
