---
name: doclight-publish
description: 把内容整理并发布到用户的 DocLight 内容空间（CLI-005，14-agent-content-space §4）。当用户做完一份内容（教程/报告/知识库）说「发布」「存起来」「分享出去」时使用。
---

# doclight-publish — 内容发布技能

> 对应设计：[14-agent-content-space §4](../../../docs/tech-design/14-agent-content-space.md)
> 原理：**CLI 是唯一事实来源**（`doclight publish` 输出结构化 JSON），本技能只教 Agent 如何用 CLI，
> 不重复实现发布逻辑（零 server、零配置）。
> 对外动作铁律：**发布前必须有用户确认**（默认）；「自动发布」是显式 opt-in。

## 何时使用

用户明确要求「发布 / 分享 / 存到空间」时。发布是**向外动作**，永远先确认目标空间再执行。

## 流程（四步，预览-确认-发布，WORK-001）

### 1. 整理内容为 Markdown

按 DocLight 约定把内容写成纯 Markdown（CommonMark + GFM），放内容目录（默认 `docs/`）下。
frontmatter 建议补全（缺省会由 analyzeDoc 自动计算 summary/wordCount/readingTime）：

```markdown
---
title: 页面标题          # 必填，用于导航与 URL
description: 一句话摘要   # 可选，SEO 与 llms.txt 用
tags: [教程, 入门]       # 可选，分类检索用
category: guide          # 可选
---
```

路径约定：文件夹 = 导航分组；`README.md`/`index.md` 为置顶页（根级收敛为首页）。

### 2. 预览态（写入先进预览态，不自动发布）

```bash
doclight publish --preview   # 构建 + 本地预览服务（不发布）；返回预览 URL
```

人确认视觉效果与内容无误后再进入下一步。**对外动作铁律：发布前必须有用户确认**（默认）；
「自动发布」是显式 opt-in。

### 3. 发布到空间（发布前自动快照，可回滚）

```bash
doclight publish              # 发布到默认（active）空间；TTY 下 y/N 确认门（--yes 跳过）
doclight publish --json       # 结构化输出（Agent 优先），读 ok/url/error/snapshot 字段
doclight publish --to local   # 本地 bundle（file:// 离线单文件）
doclight publish --to git     # 构建 + 推 gh-pages → 公网 URL
doclight publish --to space   # 远程空间（需先配置端点；未开通时 CLI 会给出引导）
```

发布前自动快照（`.doclight/snapshots/`，WORK-001）：出错/后悔可回滚——
`doclight rollback --list` 查看 → `doclight rollback <id>` 一键恢复内容源。

空间管理（先看当前空间）：

```bash
doclight space status --json  # 当前空间 / provider / URL
doclight space switch <name>  # 切换空间（内容纯 Markdown，无锁入）
```

### 4. 验证并反馈

- 读 `--json` 输出：`ok: true` → 反馈 `url`（file:// 或 https://）与 `snapshot.id`；`ok: false` → 读 `error` 与 `steps` 修复。
- 发布到 git/space 后可用 `doclight space status --json` 复核。

## 规范

- 内容必须为纯 Markdown；不引入 HTML 承载内容（扩展语法用 class 标记 + 子元素承载）。
- 发布前检查 frontmatter 完整性（缺 title 会退化为文件名）。
- 用户未指定空间时先 `doclight space status` 确认 active，避免发错目标。
- **先预览后发布**：`publish --preview` 确认 → `publish` 正式发布；发布后内容有快照兜底。

## 失败处理

CLI 输出结构化 JSON。定位修复路径：

| 失败 | 修复 |
|---|---|
| `error` 含「空间不存在」 | 先 `doclight space init` 再发布 |
| git `ok:false` + steps | 按 steps 配置远程（`git remote add origin` 或 `space init --provider git --remote`） |
| space `ok:false` + steps | 托管未开通 → 用 local/git provider，或配置自建 Space 端点 |
| 产物缺 docs.json | 先 `doclight build` 生成 dist-site |
| 发布后发现内容错误 | `doclight rollback --list` → `doclight rollback <id>` 恢复发布前内容 |

## 双读友好

- 给人：本文件 + [Agent 接入指南](../../../docs/agent-guide.md)（含魔法咒语）
- 给 Agent：`doclight publish --json` 的结构化结果（本技能据此自修）
