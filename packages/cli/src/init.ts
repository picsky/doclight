/**
 * doclight init —— 初始化新项目（05 §5.2.1，CLI-001）
 *
 * 在目标路径生成最小可运行骨架：
 * - doclight.json：站点配置（契约 schema 键：title / description / docsDir）
 * - docs/README.md：示例首页（含 frontmatter title/description 演示）
 * - docs/guide/start.md：示例子目录文档（演示导航分组）
 * - index.html：项目入口页（零构建形态「index.html + docs/」的落地；自包含、无外部依赖）
 *
 * 幂等：已存在的文件默认不覆盖（--force 覆盖）。命令本身零依赖。
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { escapeHtml } from "./site.ts";
import { buildAgentsMd } from "./agents.ts";
import { buildCapabilityManifest } from "./capabilities.ts";

export interface InitOptions {
  /** 目标项目根目录，默认当前目录 */
  dir?: string;
  /** 站点标题（写入 doclight.json + index.html） */
  title?: string;
  /** 站点描述（写入 doclight.json） */
  description?: string;
  /** 覆盖已存在文件 */
  force?: boolean;
}

export interface InitResult {
  /** 项目根目录 */
  root: string;
  /** 本次实际写入的文件（相对 root） */
  created: string[];
  /** 已存在未覆盖的文件（相对 root） */
  skipped: string[];
}

/** 示例首页 Markdown（演示 frontmatter + 链接 + 代码块，Agent/人双读） */
export const SAMPLE_README = `---
title: 欢迎
description: 这是一个由 DocLight 生成的示例文档站
---

# 欢迎使用 DocLight

零构建文档站引擎：一个 \`docs/\` 文件夹 + Markdown = 文档站。

- 编辑 \`docs/\` 下的 Markdown 文件即开始写作
- 运行 \`doclight dev\` 本地实时预览
- 运行 \`doclight build\` 导出 SEO 友好的静态站点

## 下一步

- 阅读 [入门指南](guide/start.md) 了解目录约定
- 在 \`docs/\` 中新建 \`.md\` 文件，导航自动更新

\`\`\`bash
doclight dev    # 本地预览
doclight build  # 静态导出（dist-site/）
doclight preview # 预览构建产物
\`\`\`
`;

/** 示例子目录文档（演示分组导航） */
export const SAMPLE_GUIDE = `---
title: 入门指南
---

# 入门指南

DocLight 遵循约定优先、零配置启动：

## 目录结构

- \`docs/\` — 所有 Markdown 内容（文件夹 = 导航分组）
- \`README.md\` / \`index.md\` — 置顶页，根级时收敛为首页
- \`doclight.json\` — 站点配置（可选）

## 写作

每篇文档可用 frontmatter 声明元数据：

\`\`\`markdown
---
title: 页面标题
description: 用于 SEO meta description
date: 2026-01-01
---

# 正文从这里开始
\`\`\`
`;

/** 项目入口 index.html（自包含：零外部依赖，file:// 直接可看） */
export function entryHtml(options: { title: string; description?: string }): string {
  const title = options.title || "DocLight";
  const desc = options.description ? `<p>${escapeHtml(options.description)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: 48px 24px; font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: #374151; line-height: 1.75; max-width: 680px; margin-left: auto; margin-right: auto; }
  h1 { color: #111827; }
  code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.9em; color: #0d9488; }
  .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${desc}
<div class="card">
  <h2 style="margin-top:0">开始</h2>
  <ol>
    <li><code>doclight dev</code> — 本地实时预览</li>
    <li><code>doclight build</code> — 生成静态站点（<code>dist-site/</code>）</li>
    <li><code>doclight preview</code> — 预览构建产物</li>
  </ol>
</div>
<p>编辑 <code>docs/</code> 目录下的 Markdown 文件开始写作，导航自动更新。</p>
</body>
</html>
`;
}

function writeIfAbsent(root: string, rel: string, content: string, force: boolean, created: string[], skipped: string[]): void {
  const full = join(root, rel);
  if (existsSync(full) && !force) {
    skipped.push(rel);
    return;
  }
  writeFileSync(full, content);
  created.push(rel);
}

/** 初始化项目（供命令与测试复用）。仅写入缺失文件；已存在默认跳过（幂等）。 */
export function initProject(options: InitOptions = {}): InitResult {
  const root = resolve(options.dir ?? ".");
  const title = options.title ?? "DocLight";
  const description = options.description;
  const created: string[] = [];
  const skipped: string[] = [];

  mkdirSync(join(root, "docs", "guide"), { recursive: true });

  // doclight.json：仅写契约 schema 收录的键（title/description/docsDir）
  const cfg = JSON.stringify(
    { title, ...(description ? { description } : {}), docsDir: "docs" },
    null,
    2
  );
  writeIfAbsent(root, "doclight.json", cfg + "\n", !!options.force, created, skipped);
  writeIfAbsent(root, "docs/README.md", SAMPLE_README, !!options.force, created, skipped);
  writeIfAbsent(root, "docs/guide/start.md", SAMPLE_GUIDE, !!options.force, created, skipped);
  writeIfAbsent(root, "index.html", entryHtml({ title, description }), !!options.force, created, skipped);
  // CAP-001：AGENTS.md 内容写作入口（Agent 写内容前先读：支持的语法 / frontmatter 约定 / 发布链；
  // 与 capabilities.json 同源——init 生成的 manifest 驱动）
  writeIfAbsent(
    root,
    "AGENTS.md",
    buildAgentsMd(buildCapabilityManifest({ siteTitle: title, siteDescription: description, base: "", form: "ssg" })) + "\n",
    !!options.force,
    created,
    skipped
  );

  // 校验 docs 目录确实创建（写文件隐含，但防御性保留）
  if (!statSync(join(root, "docs")).isDirectory()) {
    throw new Error(`docs/ 创建失败：${join(root, "docs")}`);
  }

  return { root, created, skipped };
}
