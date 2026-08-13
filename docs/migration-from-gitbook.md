---
title: 从 GitBook 迁移到 DocLight
summary: GitBook 迁移指南：一键迁移（SUMMARY.md 解析 + hint/code 块自动转换）+ 概念对照 + 常见差异处理（MIG-002）
tags: [迁移, GitBook]
difficulty: 入门
---

# 从 GitBook 迁移到 DocLight（MIG-002）

GitBook 已是闭源商业化平台（旧版开源项目停止维护），你的 Markdown 内容是自己的资产——迁到 DocLight：零构建、自托管、SEO + AI 双原生（llms.txt / MCP）。

> 迁移路线：GitBook 的 `.md` 内容可直接复用，只有 `{% hint %}` / `{% code %}` 模板语法需要一次自动转换。

## 一、快速迁移（命令行工具）

```bash
# 在 GitBook 仓库根目录执行
doclight migrate-gitbook --dir ./

# 输出：
#   复制: 23 篇 Markdown → <cwd>/docs
#   SUMMARY.md 导航: 18 项（DocLight 自动导航替代）
#   备注: 已转换 8 个 {% hint %} 块为 DocLight 容器
#   备注: 已转换 15 个 {% code %} 块为代码围栏

# 本地预览
doclight dev

# 构建 + 部署
doclight build --site-url https://你的域名
doclight deploy
```

迁移工具做什么：

| 动作 | 说明 |
|---|---|
| 解析 `SUMMARY.md` | 自定义导航顺序写入报告（数字前缀可调整排序） |
| 复制 `.md` | 保持目录结构复制到 `docs/` |
| **转换 hint 块** | `{% hint style="info" %}` → `:::info` 等 |
| **转换 code 块** | `{% code title="x.js" %}` → ```` ```js ````（语言取扩展名） |
| 跳过 `SUMMARY.md` | DocLight 自动导航替代 |
| 幂等 | 目标文件已存在不覆盖，可重复执行 |

## 二、语法转换对照

| GitBook | DocLight | 说明 |
|---|---|---|
| `{% hint style="info" %}` | `:::info` | 信息容器 |
| `{% hint style="tip" %}` / `"success"` | `:::tip` | 提示容器 |
| `{% hint style="warning" %}` | `:::warning` | 警告容器 |
| `{% hint style="danger" %}` | `:::danger` | 危险容器 |
| `{% code title="hello.js" %}` | ```` ```js ```` | 语言取文件扩展名 |
| `{% tabs %}` / `{% api-method %}` 等 | 原样保留 | 无法干净转换的标签不硬转（诚实原则） |
| 未列出的 hint style | 原样保留 | 同上 |

## 三、概念对照

| GitBook | DocLight | 说明 |
|---|---|---|
| `SUMMARY.md` | 自动生成 | 文件夹 = 分组；README 置顶 → 数字前缀 → 字母序 |
| 在线编辑器 | 本地 Markdown | 任何编辑器 + git 版本控制 |
| 平台托管 | 自托管 | 任意静态托管 / GitHub Pages（`doclight deploy`） |
| 全文搜索 | 内置 | Ctrl+K 搜索开箱即用 |
| 评论/讨论 | giscus 插件 | 回到 GitHub Discussions（见 [plugin-guide](plugin-guide.md)） |
| — | **llms.txt / MCP** | AI Agent 可直接读取/检索（GitBook 没有） |

## 四、常见差异处理

| 情况 | 处理 |
|---|---|
| 站内链接 `[x](other.md)` | 无需改——构建时自动转 `.html` |
| 图片/附件 | 相对路径原样保留，非 `.md` 文件自动拷贝 |
| `GLOSSARY.md` | 作为普通页面保留（或加数字前缀置后） |
| 多版本空间（`v1/` `v2/` 目录） | 目录结构原样保留，自动成为版本分组导航 |
| 部署 | `doclight deploy` 一键 GitHub Pages，或静态托管上传 `dist-site/` |

## 五、迁移后验证

```bash
doclight build     # 生成 dist-site/（sitemap.xml / robots.txt）
doclight preview   # 本地预览产物
```

- 抽查原文中的 `{% hint %}` / `{% code %}` 是否都转换（报告给出计数）
- 检查 SUMMARY.md 顺序是否保留（不符则加数字前缀）
- 配 `--site-url` 后确认 canonical / OG 标签

---

> 相关：[从 docsify 迁移](migration-from-docsify.md) · [从 MkDocs 迁移](migration-from-mkdocs.md) · [主题生态](themes.md)
