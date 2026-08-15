---
title: 从 MkDocs 迁移到 DocLight
summary: MkDocs 迁移指南：一键迁移（含 admonition 自动转换）+ mkdocs.yml 概念对照 + 常见差异处理（MIG-001）
tags: [迁移, MkDocs]
difficulty: 入门
---

# 从 MkDocs 迁移到 DocLight（MIG-001）

MkDocs（含 Material）是好工具，但需要 Python 环境 + 构建步骤，且 AI 可读性弱（无 llms.txt / MCP）。DocLight 保留「Markdown + 文件夹 = 文档站」，补齐零环境（纯 Node/静态托管）与 AI 原生（llms.txt/MCP/双读）。

> 好消息：你的 `.md` 内容 **100% 复用**——Markdown 本身通用，只有 admonition 语法需要一次自动转换。

## 一、快速迁移（命令行工具）

```bash
# 在 MkDocs 项目根目录执行
doclight migrate-mkdocs --dir ./

# 输出：
#   复制: 23 篇 Markdown → <cwd>/docs
#   mkdocs.yml nav 导航: 15 项（DocLight 自动导航替代）
#   备注: mkdocs.yml site_name「XXX」→ 建议写入 doclight.json title
#   备注: 已转换 12 个 admonition 为 DocLight 容器（:::info 等）

# 本地预览
doclight dev

# 构建 + 部署
doclight build --site-url https://你的域名
doclight deploy
```

迁移工具做什么：

| 动作 | 说明 |
|---|---|
| 解析 `mkdocs.yml` | `site_name` → 建议写入 doclight.json title；`docs_dir` 自定义目录也能识别 |
| 复制 `.md` | 保持目录结构复制到 `docs/` |
| **转换 admonition** | `!!! note` → `:::info` 等（见下表），4 空格缩进自动剥离 |
| 解析 `nav` | 自定义导航顺序写入报告，可用数字前缀调整 |
| 幂等 | 目标文件已存在不覆盖，可重复执行 |

## 二、admonition 转换对照

| MkDocs | DocLight | 说明 |
|---|---|---|
| `!!! note` / `!!! info` / `!!! abstract` | `:::info` | 信息容器 |
| `!!! tip` / `!!! success` / `!!! example` | `:::tip` | 提示容器 |
| `!!! warning` / `!!! caution` | `:::warning` | 警告容器 |
| `!!! danger` / `!!! error` / `!!! failure` | `:::danger` | 危险容器 |
| `??? note`（折叠） | `:::info`（普通） | DocLight 无折叠容器，降级为普通容器（备注提示） |
| 未列出的自定义类型 | 原样保留 | 不硬转未知语法（诚实原则） |

带标题的 admonition（`!!! note "自定义标题"`）转换后标题成为容器首行。

## 三、mkdocs.yml 概念对照

| mkdocs.yml | DocLight | 说明 |
|---|---|---|
| `site_name` | doclight.json `title` | 站点标题 |
| `docs_dir` | `--dir` | 迁移工具自动识别自定义目录 |
| `nav:` | 自动生成 | 文件夹 = 分组；数字前缀控制排序 |
| `theme: material` | 内置主题 | 唯一内置主题（default = minimal，松绿 Pine）+ 自定义 CSS 主题包（见 [themes](themes.md)） |
| `markdown_extensions` | 内置 | Mermaid 容错 / 代码高亮+复制 / KaTeX / 容器全部开箱 |
| `extra_css` | doclight.json `theme` | 指向你的 CSS 文件即可 |
| `plugins: - search` | 内置 | Ctrl+K 搜索开箱即用 |

## 四、常见差异处理

| 情况 | 处理 |
|---|---|
| 站内链接 `[x](other.md)` | 无需改——构建时自动转 `.html` |
| 图片/附件 | 相对路径原样保留，非 `.md` 文件自动拷贝 |
| MkDocs 插件功能 | 搜索/高亮/复制/公式内置；其他插件功能可用 DocLight 插件实现（见 [plugin-guide](plugin-guide.md)） |
| Material 的主题定制 | 用设计令牌（CSS 变量）覆盖（见 [themes](themes.md)） |
| 部署 | `doclight deploy` 一键 GitHub Pages，或静态托管上传 `dist-site/` |

## 五、迁移后验证

```bash
doclight build     # 生成 dist-site/（sitemap.xml / robots.txt）
doclight preview   # 本地预览产物
```

- 抽查原文中的 `!!! ` 是否都转换为 `:::` 容器（报告会给出转换计数）
- 检查导航排序是否符合预期（不符则加数字前缀）
- 配 `--site-url` 后确认 canonical / OG 标签

---

> 相关：[从 docsify 迁移](migration-from-docsify.md) · [从 GitBook 迁移](migration-from-gitbook.md) · [主题生态](themes.md)
