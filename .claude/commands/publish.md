---
description: 把当前内容发布到 DocLight 内容空间（CLI-005，14-agent-content-space §2.6 用户触发入口）
---

用户明确叫停，执行「现在发布」。按 `doclight-publish` 技能（.claude/skills/doclight-publish/SKILL.md）执行：

1. 先确认目标空间：运行 `doclight space status --json`，读取 active 空间与 provider。
2. 发布：运行 `doclight publish --json`（发布到 active 空间）。
   - 若用户指定了目标（local / git / space），改为 `doclight publish --to <目标> --json`。
3. 读取结果并反馈：
   - `ok: true` → 回报 `url`（file:// 或 https://）。
   - `ok: false` → 读取 `error` 与 `steps`，按指引修复后重试；无法自动修复则把结构化错误原样反馈给用户。

注意：发布是向外动作；若尚未确认目标空间且用户没说默认，先问一句再发布。
