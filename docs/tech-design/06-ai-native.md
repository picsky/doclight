# 06 · AI 原生设计

---

## 6.1 设计哲学：AI 友好是架构问题，不是功能问题

> 不是加一个聊天框就叫「AI 友好」，而是从架构层面让 Agent 能轻松理解、使用、定制这个产品。

### AI 友好的五个层次（使用端）

```
Level 5 ─ 可被定制（Customizable）  ← 我们的目标
  │        插件系统 + 主题系统 + 插槽，Agent 能改造产品
  │
Level 4 ─ 可被操作（Actionable）
  │        MCP Server，Agent 能搜索、阅读、导航
  │
Level 3 ─ 可被理解（Understandable）
  │        语义 frontmatter + 结构化数据 + 文档摘要
  │
Level 2 ─ 可被搜索（Searchable）
  │        结构化搜索索引 + 搜索 API
  │
Level 1 ─ 可被读取（Content Accessible）
           llms.txt + 干净的 HTML + 机器可读清单
```

大部分工具停留在 Level 1-2，DocLight 要做到 Level 5。

### 双五层模型：使用端 + 开发端

> AI 友好必须同时覆盖两类 Agent：**使用 DocLight 的 Agent**（消费文档站）与**开发 DocLight 的 Agent**（建设仓库）。上文的五层是「使用端」，本设计扩展出「开发端」。

| 层次 | 使用端（产品即服务） | 开发端（仓库即产品） |
|---|---|---|
| **L5 可被定制** | 插件/主题/插槽，Agent 能改造产品 | 脚手架/模板自带说明，Agent 能写新模块与插件 |
| **L4 可被操作** | 运行时 MCP Server，Agent 能搜索/读取/导航 | 开发 MCP：Agent 能跑验证、生成截图、读基准 |
| **L3 可被理解** | 语义 frontmatter + 结构化数据 + JSON-LD | 模块意图文档 + TS 类型 + JSON Schema + 规格追溯 |
| **L2 可被搜索** | 搜索索引 + 搜索 API | 仓库知识导航（架构地图）+ 行为规格（Gherkin） |
| **L1 可被读取** | llms.txt + 干净 HTML + docs.json | Agent 优先的 CONTRIBUTING + 机器可读规范 |

开发端五层的完整规格见 [10-agent-dev-environment.md](./10-agent-dev-environment.md)，含目标（Spec）、验证（Verify）、反馈（Feedback）、闭环（Loop）、契约（Contract）五个子系统。

### 设计原则

1. **结构化优先**：给 AI 的数据都要是结构化的，不要让 AI 去「猜」
2. **可预测性**：每个 API 的输入输出都有明确定义和类型
3. **少黑盒**：工作原理透明，Agent 知道做了什么、怎么做的
4. **渐进暴露**：从简单读取到深度定制，每层 API 都清晰
5. **人和 AI 共享基础**：语义化 HTML、清晰的结构、好的命名——对人对 AI 都好

---

## 6.2 Level 1-2：可被读取 + 可被搜索

### 6.2.1 llms.txt 智能生成

**是什么**：给 AI Agent 看的「站点地图」，告诉 Agent 这个站有什么内容、哪些重要。

**生成策略**：不是简单列文件名，而是**智能分层 + 摘要**。

```
# llms.txt — 由 DocLight 自动生成
# 最后更新：2026-08-01
# 文档总数：42
# 站点语言：zh-CN

[站点摘要]
DocLight 是一款零构建、AI 原生友好的开源文档站引擎。
核心特性：单文件运行、内置搜索、SSG 静态导出、MCP 支持。
仓库：https://github.com/doclight/doclight

[核心文档] ★★★ 最高优先级
  README.md                     # 项目介绍 / 快速概览
  guide/quickstart.md           # 5 分钟快速上手
  guide/core-concepts.md        # 核心概念与设计思想
  guide/installation.md         # 安装与配置

[使用指南] ★★☆ 中优先级
  guide/theming.md              # 主题定制
  guide/plugins.md              # 插件使用
  guide/deployment.md           # 部署指南
  guide/ssg-build.md            # 静态构建与 SEO
  guide/ai-integration.md       # AI 集成与 MCP

[参考资料] ★☆☆ 低优先级
  api/                          # API 参考（完整列表）
    api/runtime-api.md
    api/plugin-api.md
    api/cli-api.md
  changelog.md                  # 变更日志
  faq.md                        # 常见问题

[Agent 专用端点]
  /mcp                          # MCP Server（MCP 协议）
  /search-index.json            # 预构建搜索索引（JSON）
  /docs.json                    # 文档结构清单（JSON）
  /llms-full.txt                # 全文 llms.txt（大上下文模型用）
  /.well-known/mcp              # MCP well-known 发现端点

[术语表]
  形态 — 三种产物形态（dev 预览 / SSG 发布 / bundle 便携包），共享同一渲染内核
  SSG — Static Site Generation，构建时预渲染为静态 HTML
  bundle — 单文件便携包，内嵌全部内容与 AI 数据
  MCP — Model Context Protocol，AI 代理与外部工具通信的协议
  llms.txt — 给大语言模型看的站点内容索引文件
```

**智能分级规则**：

| 优先级 | 判定条件 | 包含内容 |
|---|---|---|
| ★★★ 高 | 根目录 README、quickstart、入门类 | 项目介绍、快速开始、核心概念 |
| ★★☆ 中 | guide/、tutorial/、how-to/ 目录 | 使用指南、教程、配置 |
| ★☆☆ 低 | api/、reference/、changelog、faq | 参考资料、详细 API |

**用户可手动调整**：
```json
{
  "build": {
    "llmsTxt": {
      "priority": {
        "high": ["README.md", "guide/quickstart.md"],
        "medium": ["guide/"],
        "low": ["api/", "changelog.md"]
      },
      "exclude": ["internal/", "draft-*.md"]
    }
  }
}
```

### 6.2.2 docs.json：机器可读的文档清单

```json
{
  "version": 1,
  "generatedAt": "2026-08-01T00:00:00Z",
  "siteTitle": "DocLight Documentation",
  "siteDescription": "零构建、AI 原生友好的文档站引擎",
  "totalDocs": 42,
  "languages": ["zh-CN"],
  "docs": [
    {
      "path": "guide/quickstart.md",
      "title": "快速开始",
      "summary": "5 分钟上手 DocLight，从安装到第一篇文档",
      "tags": ["入门", "安装"],
      "category": "指南",
      "priority": "high",
      "difficulty": "beginner",
      "readingTime": 5,
      "wordCount": 1200,
      "updatedAt": "2026-08-01",
      "hasCode": true,
      "prerequisites": ["README.md"],
      "next": ["guide/configuration.md"],
      "headings": [
        { "level": 2, "id": "install", "text": "安装" },
        { "level": 2, "id": "first-doc", "text": "创建第一篇文档" },
        { "level": 2, "id": "deploy", "text": "部署" }
      ]
    }
  ]
}
```

**为什么 Agent 需要这个？**
- 不用先爬一遍全站才知道有什么
- `summary` 和 `tags` 让 Agent 快速判断相关性
- `headings` 让 Agent 预览文档结构，决定要不要读全文
- `prerequisites` 和 `next` 构建知识图谱，Agent 可以推理阅读路径

### 6.2.3 bundle 便携包 = Agent 内容包

bundle 形态不仅服务人，也是**给 Agent 的完整内容包**：

- 内嵌 `llms.txt` 全文 + `docs.json` + 全部已渲染 HTML + 搜索索引
- Agent 打开单个文件即可获得：全站结构（docs.json）、内容索引（llms.txt）、检索能力（搜索索引）
- 无需爬站 / 联网，适合离线或受限环境下的 Agent 消费
- 与在线形态互补：**在线走 MCP 动态检索，离线走 bundle 静态读取**

### 6.2.4 能力协议 capabilities.json + 发布产物 Agent 友好（Phase 6 P0，CAP-001 / AEO-001）

**能力协议（CAP-001）**：Agent 写内容前必须能回答「这个站能渲染什么」，而不是猜。
`capabilities.json`（构建产物，站点根）声明：

- `markdown.extensions`：内置扩展语法白名单（REND-002 注册表，含降级说明）
- `plugins`：启用插件及其 `capabilities` 声明（如 mermaid 插件 → `["mermaid"]`）
- `markdown.frontmatter`：frontmatter 约定键（FRONT-001）
- `outputs` / `mcp`：Agent 接口端点与 MCP 工具清单（get_capabilities 置首）

**三形态一致**：同一生成器（`buildCapabilityManifest`）——SSG 产物根 / dev server `/capabilities.json` /
bundle 产物目录。**AGENTS.md 同源**：`buildAgentsMd(manifest)` 生成（doclight init 写入，
本仓库 dogfood），capabilities.json 是它的机器形态，单一事实来源不漂移。
MCP `get_capabilities` 工具：产物缺失时诚实降级（complete=false + 重建提示，不伪造）。

**发布产物 Agent 友好（AEO-001）**：发布后的站点 Agent 读取最优——

- **每页 markdown 版本**：`.md` 源文件随构建拷贝进产物（与 .html 同相对路径），每页
  `<head>` 输出 `<link rel="alternate" type="text/markdown">`——Agent 免解析 HTML 直接取原稿；
  sitemap 不含 .md（SEO 不重复收录）
- **llms.txt v2 Link 关系**：每页 `<head>` 输出 `<link rel="describedby" href=".../llms.txt">`
- **token 计数**：docs.json 每篇 `tokens` + 头部 `totalTokens`、llms.txt 条目「约 N tokens」与
  头部总数、llms-full.txt 头部总数、页面 `<meta name="doclight:tokens">`——Agent 读取成本
  一级指标（Cisco 单文档 193K tokens 威胁上下文窗口，research §二）；估算为启发式
  （CJK×0.75 + 非CJK词×1.3，上取整），非真实分词器，见 `packages/cli/src/tokens.ts`

---

## 6.3 Level 3：可被理解

### 6.3.1 语义 Frontmatter

每篇文档的 frontmatter 同时服务人和 AI：

```markdown
---
# ── 给人看的 ──
title: 快速开始
date: 2026-08-01

# ── 给 AI 看的 ──
summary: 5 分钟上手 DocLight，从安装到第一篇文档
tags: [入门, 安装]
difficulty: beginner          # beginner / intermediate / advanced
reading_time: 5 min           # 预估阅读时间
prerequisites: [README.md]    # 前置阅读
next: guide/configuration.md  # 建议下一篇
keywords: [安装, 配置, 入门]  # SEO + AI 检索

# ── Agent 行为提示 ──
ai:
  # 回答用户什么类型的问题时应该引用这篇文档
  answer_for: ["怎么安装", "快速上手", "入门指南"]
  # 这篇文档在什么上下文中最有用
  context: "用户第一次接触 DocLight，想快速跑起来"
  # 不应该用这篇文档回答什么问题
  not_for: ["高级配置", "主题定制", "插件开发"]
---
```

**设计要点**：
- 字段名语义化，人也能看懂
- 都是可选的，不写也没关系
- `ai.*` 是增强字段，没有的话 AI 用基础字段也能工作
- 提供了结构化的「什么时候用这篇文档」的提示，大幅提升检索准确率

### 6.3.2 语义 HTML + 结构化数据

每个页面注入 JSON-LD：
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "快速开始",
  "description": "5 分钟上手 DocLight...",
  "articleSection": "指南",
  "wordCount": 1200,
  "keywords": "入门,安装",
  "datePublished": "2026-08-01",
  "dateModified": "2026-08-01",
  "author": { "@type": "Organization", "name": "DocLight" }
}
</script>
```

HTML 本身也是语义化的：
- `<article>` 包裹正文
- `<nav>` 标记导航
- `<aside>` 标记侧边栏和 TOC
- 标题层级正确（一个 H1，H2/H3 结构清晰）

---

## 6.4 Level 4：可被操作 — MCP Server

MCP 不只是「搜索 + 读取」两个工具，而是一整套让 Agent 与文档站交互的协议。

### 6.4.1 工具清单

| Tool | 功能 | 说明 |
|---|---|---|
| `search_docs` | 全文搜索 | 支持关键词、标签过滤、按优先级排序 |
| `read_doc` | 读取文档 | 支持全文、指定章节、指定行数范围 |
| `list_docs` | 列出文档树 | 可按路径前缀、分类、标签过滤 |
| `get_site_summary` | 获取站点摘要 | 快速了解全站内容和结构 |
| `get_outline` | 获取文档大纲 | 返回标题结构，预览内容 |
| `find_examples` | 搜索代码示例 | 只搜索代码块，返回带语言的结果 |
| `get_glossary` | 获取术语表 | 提取所有术语定义 |
| `resolve_path` | 解析路径 | 相对路径转绝对路径、锚点校验 |
| `get_prerequisites` | 获取前置知识 | 推理阅读路径 |

### 6.4.2 工具详细设计

#### search_docs

```typescript
// 输入
{
  query: string,
  limit?: number,        // 默认 10
  category?: string,     // 按分类过滤
  tags?: string[],       // 按标签过滤
  priority?: "high" | "medium" | "low",
  includeContent?: boolean  // 是否包含全文片段（默认 true）
}

// 输出
{
  results: [
    {
      path: "guide/quickstart.md",
      title: "快速开始",
      score: 0.92,
      category: "指南",
      tags: ["入门", "安装"],
      snippet: "安装 DocLight 只需要一条命令：npm install -g doclight",
      matchedSection: "安装",    // 命中的章节
      readingTime: 5,
      hasCode: true,
      url: "/guide/quickstart.html"
    }
  ],
  total: 42,
  queryTimeMs: 15
}
```

**为什么结构化程度这么高？**
- Agent 不用自己解析搜索结果
- 每个字段都有明确语义，Agent 知道是什么意思
- `matchedSection` 告诉 Agent 命中了哪一节，不用全文读

#### read_doc

```typescript
// 输入
{
  path: string,
  section?: string,    // 指定章节（heading id）
  startLine?: number,
  endLine?: number,
  format?: "markdown" | "html" | "text"  // 默认 markdown
}

// 输出
{
  path: "guide/quickstart.md",
  title: "快速开始",
  format: "markdown",
  wordCount: 1200,
  readingTime: 5,
  content: "# 快速开始\n\n...",
  headings: [/* 完整大纲 */],
  next: "guide/configuration.md",
  previous: "guide/core-concepts.md"
}
```

#### get_site_summary

```typescript
// 输出
{
  title: "DocLight Documentation",
  description: "零构建、AI 原生友好的文档站引擎",
  totalDocs: 42,
  languages: ["zh-CN"],
  categories: [
    { name: "入门", count: 3, priority: "high" },
    { name: "指南", count: 8, priority: "medium" },
    { name: "API 参考", count: 12, priority: "low" }
  ],
  keyTopics: ["安装", "配置", "主题", "插件", "部署", "MCP"],
  suggestedEntry: "guide/quickstart.md",
  aiFeatures: ["llms.txt", "mcp", "search-api"]
}
```

### 6.4.3 MCP Server 实现

**两种运行方式**：

| 方式 | 适用场景 | 说明 |
|---|---|---|
| **独立服务** | 已部署的文档站 | 独立 HTTP 服务，Agent 通过网络连接 |
| **插件模式** | 本地开发时 | 作为 DocLight 插件，开发服务器自带 MCP |

**独立服务部署**：
```bash
# 安装
npm install -g @doclight/mcp-server

# 启动
doclight-mcp --docs ./docs/ --port 3000
```

**well-known 发现**：
```
/.well-known/mcp → MCP 服务发现端点
返回 MCP Server 的能力描述和工具列表
```

Agent 只要知道域名，就能自动发现并使用 MCP 服务。

---

## 6.5 Level 5：可被定制 — Agent 友好的工程设计

### 6.5.1 配置即数据

所有配置都是纯 JSON，Agent 能读能写能验证。

```json
// doclight.json — 结构扁平、语义清晰、有默认值
{
  "title": "My Docs",
  "theme": {
    "colorPrimary": "#0d9488",
    "fontSans": "system-ui",
    "maxWidth": "680px"
  },
  "search": {
    "engine": "auto",
    "shortcut": "cmd+k"
  },
  "plugins": [
    { "name": "mermaid" },
    { "name": "copy-code" }
  ]
}
```

**对 Agent 友好的设计**：
- 字段名直观，看名字就知道干什么的
- 嵌套不深（最多 2-3 层）
- 所有字段都有默认值，配置是「改默认」不是「必须写」
- 有 JSON Schema 可以验证配置正确性
- 配置变更可以热重载，不用重启

### 6.5.2 插件脚手架：Agent 写插件只需要填空

**脚手架生成的插件模板**：
```javascript
// DocLight Plugin: my-plugin
// 生成时间：2026-08-01
// 完整 API 文档：https://doclight.tech/api/plugin-api
//
// 可用钩子（按执行顺序）：
//   beforeRender(markdown, context)  → 返回修改后的 markdown
//   afterRender(html, context)       → 返回修改后的 html
//   onMount(app)                     → 页面加载后执行
//   onRouteChange(path, app)         → 路由变化时执行
//   extendMarked(marked)             → 扩展 marked 解析器
//   addSearchFields(doc)             → 返回 { field: value } 扩展搜索
//
// context 对象包含：
//   { path, title, frontmatter, headings }

export default {
  name: 'my-plugin',
  version: '1.0.0',
  description: '插件描述',

  // 在 Markdown 渲染前修改内容
  beforeRender(markdown, context) {
    // TODO: 在这里修改 markdown
    return markdown
  },

  // 页面挂载后执行
  onMount(app) {
    // app 是 DocLight 实例
    // app.on('route-change', (path) => { ... })
    // app.addSearchField((doc) => ({ customField: doc.frontmatter.myField }))
    // app.insertSlot('content:before', '<div>自定义内容</div>')
  }
}
```

**设计要点**：
- 模板本身就是文档——注释里写清楚了每个钩子的用途
- 函数签名简单，参数命名清晰
- TODO 标记告诉 Agent 该往哪里写代码
- API 文档链接直接给出，Agent 可以深入了解

### 6.5.3 插槽系统：Agent 知道往哪里插

**插槽命名原则：`位置:方位`**

| 插槽名 | 位置 | 用途示例 |
|---|---|---|
| `head:end` | `<head>` 末尾 | 注入额外 CSS/JS |
| `sidebar:before` | 侧边栏顶部 | Logo、品牌、搜索框 |
| `sidebar:after` | 侧边栏底部 | 版本号、链接、反馈按钮 |
| `topbar:before` | 顶栏左侧 | 额外按钮 |
| `topbar:after` | 顶栏右侧 | 主题切换、GitHub 链接 |
| `content:before` | 内容区顶部 | 文章元信息、AI 摘要、标签 |
| `content:after` | 内容区底部 | 上一页/下一页、评论、相关文章 |
| `toc:before` | TOC 上方 | 目录标题、筛选 |
| `toc:after` | TOC 下方 | 扩展导航 |
| `footer` | 页面底部 | 版权、社交链接 |

**Agent 使用示例**：
```javascript
// Agent 想加一个「AI 摘要」在内容顶部
app.insertSlot('content:before', `
  <div class="ai-summary">
    <strong>AI 摘要：</strong>${summary}
  </div>
`)

// Agent 想在侧边栏底部加反馈按钮
app.insertSlot('sidebar:after', `
  <button class="feedback-btn">💬 反馈</button>
`)
```

**为什么 Agent 友好？**
- 插槽名是自然语言式的，Agent 能准确理解位置
- 插入的是纯 HTML，Agent 最擅长生成
- 不用改核心代码，不会破坏东西
- 插入的内容会自动适配主题和响应式

### 6.5.4 主题定制：改 JSON 就行

**主题配置是纯 JSON，Agent 能精确控制**：

```json
{
  "theme": {
    "colorPrimary": "#0d9488",
    "colorBg": "#ffffff",
    "colorText": "#374151",
    "fontSans": "system-ui",
    "fontMono": "ui-monospace",
    "fontSizeBase": "16px",
    "lineHeightRelaxed": 1.75,
    "maxWidthContent": "680px",
    "sidebarWidth": "280px",
    "tocWidth": "200px",
    "radius": "6px",
    "darkMode": "auto"
  }
}
```

**Agent 定制主题的工作流**：
1. 读取当前 theme 配置
2. 修改对应的变量
3. 调用 `doclight theme preview` 生成截图
4. 验证视觉效果
5. 迭代调整

每个变量的语义都很明确（`colorPrimary` 就是主色，`maxWidthContent` 就是内容区宽度），Agent 不用猜。

### 6.5.5 API 文档的 Agent 友好化

**所有 API 都有：**
- TypeScript 类型定义（结构化，Agent 直接读类型就知道接口）
- 输入输出示例（JSON 格式，可直接复制）
- 错误码列表（什么情况会出什么错）
- 使用示例（完整的端到端例子）

**文档组织方式**：
- 快速开始 → 核心概念 → API 参考 → 示例
- 层级清晰，Agent 可以一步步深入
- 每个页面有 frontmatter 标记难度和用途

---

## 6.6 可选：AI 问答组件（BYO-LLM）

### 设计原则

- ❌ 不内置 LLM
- ❌ 不做平台抽成
- ❌ 不做计量计费
- ✅ 用户自带 API Key
- ✅ 所有调用直接从浏览器发往 LLM 提供商
- ✅ API Key 存在 localStorage，永不上传

### 工作流程

```
用户提问
  → 本地搜索 Top K 文档片段（用内置搜索引擎，零成本）
  → 拼装 prompt（系统提示 + 上下文片段 + 用户问题）
  → 直接调用 LLM API（浏览器 → LLM 提供商，无中间服务器）
  → 流式输出到界面
  → 每条回答附带来源引用（点击跳转原文）
```

### 配置方式

```javascript
doclight.use(aiChat({
  provider: 'openai',          // openai / anthropic / groq / ollama
  apiKey: 'user-own-key',      // 用户自己的 key，存 localStorage
  model: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1',  // 可自定义，支持兼容 API
  searchTopK: 5,              // 检索多少个片段
  systemPrompt: '你是文档助手，请基于提供的上下文回答问题。',
  showSources: true,          // 显示来源引用
  fallbackMessage: '抱歉，我在文档中没有找到相关内容。'
}))
```

### 为什么不做核心功能

调研数据表明：
- AI 问答同质化严重（"美化版搜索框"口碑污染）
- 无引用/幻觉会损害信任
- 41% 无文档团队的组织不会为 AI 付费
- AI 功能做不好反而伤品牌

所以 AI 问答是**可选插件**，不是核心功能。核心是「AI 原生友好」（结构化 + MCP + 可定制），不是聊天框。
