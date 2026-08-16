---
title: Agent 接入指南
description: 一条「魔法咒语」让任何 AI Agent 自动完成 DocLight 接入并发布内容——复制即用，双读友好
tags: [agent, 接入, publish, skill]
category: guide
---

# Agent 接入指南（可执行）

> 让 AI Agent 在**一分钟内**接入 DocLight 内容空间：内容 = 纯 Markdown，发布 = 一句命令。
> 本指南同时服务**人**（可读版本）与 **Agent**（可执行版本，每步含命令 + 验证输出）。
> 对应设计：[14-agent-content-space](./tech-design/14-agent-content-space.md)

## 魔法咒语（复制即用）

复制下面这段话给你的 AI Agent（Claude、其他支持 Skills 的 Agent 均可）：

```
你是 DocLight 助手。请阅读 https://doclight.tech/agent-guide 完成 DocLight 接入：
1) 按指南完成安装与配置（含 `doclight skill install` 安装 Agent 技能）
2) 初始化我的内容空间（先问我要用哪个空间：本地 / GitHub / DocLight Space）
3) 完成后告诉我如何使用（内容放哪、如何发布）
当需要执行命令时请直接执行；如涉及安装/权限请求，请提示我允许。
```

**设计要点**（14 §2.3）：含文档链接（Agent 自主去读）+ 明确任务（安装/初始化/说明）+ 授权提示
（内置「请允许执行命令」——避免首次体验卡在授权处）。

---

## 一、安装 CLI

```bash
# 正式形态（doclight 包发布后）：
npm i -g doclight
doclight --help          # 验证：应列出 dev/build/publish/space 等命令

# 本仓库 dogfood 形态（未发布时）：
git clone <doclight 仓库> && cd doclight
npm install && npm run build
node packages/cli/src/index.ts --help   # 验证同上（路径形态）
```

## 二、安装 Agent 技能（一条命令）

```bash
doclight skill install            # 自动安装到 ~/.claude/skills/ + ~/.claude/commands/
doclight skill install --dry-run  # 先看计划再写入（Agent 先行确认）
doclight skill list               # 查看可装技能与安装状态
doclight skill install --json     # 结构化输出（Agent 直接解析 ok/installed/skipped/errors）
```

- 安装内容（AGENT-001，随 CLI 分发）：`doclight-publish` / `doclight-slides` / `doclight-verify`
  三个技能 + `/publish` 斜杠命令。
- 幂等：重复安装自动跳过已存在且相同的内容；`--force` 覆盖（默认不覆盖用户定制）。
- 手动形态（无 CLI 时）：把 `.claude/skills/doclight-publish/` 等目录放入 Agent 的技能目录。

## 三、初始化内容空间

内容空间 = 发布目标，可插拔（local / git / space，14 §3）：

```bash
doclight space init                 # 默认 local：本地 bundle（file:// 离线单文件）
doclight space init --provider git --remote <你的仓库URL>   # GitHub Pages 公网发布
doclight space status --json        # 验证：读取 active/provider/url
```

**验证输出**（`--json`，Agent 据此确认成功）：

```json
{ "initialized": true, "active": "local", "provider": "local", "spaces": [...] }
```

## 四、发布内容（日常使用）

写一篇 Markdown 到内容目录（默认 `docs/`），然后：

```bash
doclight publish --json            # 发布到 active 空间
# 期望输出：{ "ok": true, "provider": "local", "url": "file://..." }
```

发布到各 provider 的入口（14 §4.3）：

| 目标 | 命令 | 返回 |
|---|---|---|
| 本地离线 | `doclight publish --to local` | `file://...doclight.html` |
| GitHub Pages | `doclight publish --to git` | `https://<user>.github.io/<repo>/` |
| DocLight Space（远程） | `doclight publish --to space --endpoint <url>` | 端点返回的 URL |

## 五、发布确认（对外动作铁律）

- **发布是向外动作，永远先确认**：Agent 提议「要发布吗？」→ 用户确认 → 执行。
- 用户显式触发：`/publish` 斜杠命令（`.claude/commands/publish.md`）。
- 「自动发布」需显式 opt-in 配置，默认关闭。

## 六、失败处理（Agent 可自修）

`doclight publish --json` 失败时读 `ok:false` + `error` + `steps`：

| 失败 | 修复 |
|---|---|
| 空间不存在 | `doclight space init` 后再发布 |
| git 无远程 | `git remote add origin <url>` 或 `space init --provider git --remote` |
| space 无端点 | 托管未开通 → 用 local/git provider 或配置自建端点 |

---

## 无锁入（随时迁移）

空间内容永远是纯 Markdown（CommonMark + GFM），切换空间 = 导出 + 导入，无格式转换
（14 §3.4）。本指南由 DocLight 自身构建发布——Dogfooding 自举验证。

> 下一步：`doclight space status --json` 查看你的空间；`/publish` 发布第一篇内容。
