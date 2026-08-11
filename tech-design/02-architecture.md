# 02 · 整体架构与技术选型

---

## 2.1 系统架构总览

DocLight 采用「Node 渲染内核 + 浏览器展示层」的分层架构，产出三种形态。

> 架构决策依据（2026-08 实测）：浏览器安全模型禁止 JS 在 `file://` 下动态读取本地文件（Chromium/WebKit 失败，仅 Firefox 允许），因此**渲染统一收敛到 Node 侧**，浏览器端只展示已渲染的 HTML。这同时解决了 file:// 死穴、XSS 单点防护、同构双端漂移三个问题。

```
┌─────────────────────────────────────────────────────────────────┐
│                     用户内容层（纯文本）                           │
│   docs/ · doclight.json · public/                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Node.js 渲染内核（单一事实来源）                      │
│                                                                 │
│  · Markdown 渲染（marked + DOMPurify sanitize）                  │
│  · 导航 / TOC / 搜索索引生成                                     │
│  · llms.txt / docs.json / sitemap 生成                          │
│  · 主题模板渲染                                                  │
│  · 插件系统（beforeRender / afterRender）                        │
└───────────────┬──────────────────────┬──────────────────────────┘
                │                      │
        ┌───────▼───────┐      ┌───────▼────────┐
        │ ① dev server  │      │  构建产物       │
        │ 本地预览/热重载 │      │               │
        │ (Node http)   │      │ ② SSG → dist/ │
        │               │      │ ③ bundle →    │
        │               │      │   doclight.html│
        └───────┬───────┘      └───────┬────────┘
                │                      │
                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                 浏览器展示层（轻量，无 Markdown 渲染）             │
│  · UI 组件 / 导航交互 / 搜索 / 主题切换 / 插件 onMount            │
│  · 只渲染由内核输出的 HTML，不接触原始 Markdown                    │
└─────────────────────────────────────────────────────────────────┘
```

### 架构核心思想

1. **渲染统一在 Node 侧（单一事实来源）**——Markdown 渲染、sanitize、索引构建只在服务端/构建时发生，浏览器端为轻量展示层，**不接触原始 Markdown**（也消除了同构双端漂移）
2. **三种产物形态共享同一渲染内核**——dev server / SSG / bundle 输出一致，无迁移成本；②③ 产物是已渲染的静态 HTML，任意静态托管或双击即可
3. **安全在源头处理**——XSS sanitize 在渲染时一次性完成（DOMPurify），展示层无需二次防护
4. **所有功能渐进增强**——从 bundle 单文件到完整静态站是平滑阶梯；没有 Node 环境的用户可用 bundle 产物，无需自己构建

---

## 2.2 模块划分：Node 渲染内核 + 浏览器展示层

### 2.2.1 Node 渲染内核（服务端 / 构建时，单一事实来源）

```
packages/renderer/
├── core/
│   ├── markdown.js       Markdown 渲染（marked 封装）
│   ├── sanitize.js       XSS 防护（DOMPurify，强制）
│   ├── frontmatter.js    frontmatter 解析
│   ├── toc.js            标题/TOC 提取
│   └── link.js           相对链接/图片路径修正
├── nav.js                导航树生成
├── search-index.js       搜索索引构建
├── llms-txt.js           llms.txt / docs.json 生成
├── theme.js              主题模板渲染
└── plugins.js            插件系统（beforeRender / afterRender）
```

### 2.2.2 浏览器展示层（轻量，无 Markdown 渲染）

```
dist/index.html（任一形态的产物入口）
│
├── core/                    核心基础（~5KB）
│   ├── router.js            路由系统（path + hash 双模式）
│   ├── event-bus.js         事件总线（插件通信用）
│   └── utils.js             工具函数集合
│
├── ui/                      界面层（~8KB JS + ~5KB CSS）
│   ├── sidebar.js           侧边栏导航
│   ├── toc.js               右侧 TOC 导轨
│   ├── content.js           内容区管理（注入已渲染 HTML）
│   ├── topbar.js            顶部栏
│   └── theme.js             主题系统
│
├── search/                  搜索模块（~7-15KB）
│   ├── search.js            搜索控制器
│   ├── engine-minisearch.js MiniSearch 引擎（默认，英文优化）
│   └── engine-flexsearch.js FlexSearch 引擎（中文优化）
│
└── plugin/                  插件系统（~2KB）
    ├── plugin-manager.js    插件管理器
    └── slot-system.js       插槽系统
```

> 浏览器端不再包含 Markdown 渲染器——所有内容在 Node 侧渲染为 HTML 后注入展示层。

### 体积预算（gzip）

**浏览器展示层**（不含按需加载的资源）：

| 模块 | 预算 | 说明 |
|---|---|---|
| 核心基础（core/） | ~5KB | 路由、事件、工具 |
| 界面层（ui/） | ~8KB JS + ~5KB CSS | 所有 UI 组件 + 主题 |
| 搜索模块（search/） | ~7-15KB | MiniSearch 默认，FlexSearch 可选 |
| 插件系统（plugin/） | ~2KB | 插件管理器 + 插槽 |
| **合计（浏览器展示层）** | **~25KB** | 不含按需加载的资源 |

**Node 渲染内核**（不进入浏览器）：

| 模块 | 预算 | 说明 |
|---|---|---|
| marked | ~13KB（实测 gzip） | Markdown 解析 |
| DOMPurify | ~11KB（实测 gzip） | XSS sanitize（强制，Node 侧需 jsdom） |
| 内核逻辑（导航/索引/模板） | ~5KB | |
| **合计（Node 内核）** | **~30KB** | 只在服务端/构建时运行 |

> 预算口径变更见 [ADR-0002](../adr/0002-node-kernel-size-budget.md)：实测 marked(12.8KB)+dompurify(10.6KB)+逻辑(4KB) = 27.9KB，20KB 估值过于乐观，经两次修订上调至 30KB。内核不进浏览器，体积只影响构建/服务端内存，不影响用户体验。

> 相比原「浏览器动态渲染」方案（~30KB 含 marked），三形态架构让浏览器端更小（~25KB，无 marked），并把安全层（DOMPurify）放到 Node 侧，浏览器端零安全负担。这是本次架构重构的额外收益。

### 按需加载的资源

| 资源 | 大小（gzip） | 触发时机 |
|---|---|---|
| Prism 代码高亮 | ~15KB + 语言包 | 页面包含代码块时 |
| Shiki 代码高亮 | ~50KB + 主题 + 语言 | 用户配置开启 Shiki 时 |
| Mermaid | ~60KB | 页面包含 mermaid 代码块时 |
| KaTeX 数学公式 | ~20KB | 页面包含数学公式时 |
| FlexSearch 中文引擎 | ~15KB | 检测到中文内容或用户配置 |

---

## 2.3 技术选型详细说明

### 2.3.1 Markdown 解析器：marked.js

**选型：marked.js v12+**

| 对比项 | marked | markdown-it | remark/rehype | micromark |
|---|---|---|---|---|
| 体积（gzip） | ~8KB | ~24KB | ~35KB | ~12KB |
| 速度 | 最快 | 中 | 慢 | 快 |
| GFM 支持 | ✅ 内置 | ✅ 需插件 | ✅ 需插件 | ⚠️ 需插件 |
| 可扩展性 | 好（renderer） | 好（插件系统） | 最好（unified 生态） | 一般 |
| 维护活跃度 | 高 | 中 | 高 | 中 |

**选择理由**：
1. 体积最小（8KB vs 24KB+），符合「小而美」原则
2. 速度最快，服务端/构建时渲染性能好
3. GFM 内置，不需要额外插件
4. renderer 扩展机制简单够用，插件开发门槛低
5. 社区成熟，文档齐全

**不选 markdown-it 的原因**：体积是 marked 的 3 倍，而我们不需要那么强的插件系统（我们的扩展通过插件系统做，不在 Markdown 解析层）。

**不选 remark/rehype 的原因**：整个 unified 生态太重（35KB+），而且 AST 转换链学习成本高，不符合「简单」原则。

### 2.3.2 搜索引擎：双引擎自动切换

**默认：MiniSearch**（~7KB gzip）
- 体积小、速度快、API 简洁
- 支持模糊搜索、结果高亮、字段权重
- 英文效果好

**中文优化：FlexSearch**（~15KB gzip）
- 内置 CJK 支持（按字符 n-gram 分词）
- 性能极好（号称最快的 JS 搜索引擎）
- 支持上下文检索

**自动切换策略**：
```
1. 读取前 3 篇文档
2. 检测中文字符占比
3. 中文 > 10% → 自动切换 FlexSearch
4. 否则 → 使用 MiniSearch
5. 用户可在配置中强制指定
```

### 2.3.3 代码高亮：双方案可选

**默认：Prism.js**（~15KB gzip 核心 + 语言包按需加载）
- 体积小、按需加载语言
- 轻量、速度快
- 主题多

**可选：Shiki**（~50KB，质量更高）
- 基于 TextMate 语法，高亮质量最高
- VS Code 同款主题
- 体积大，但质量最好

**策略**：
- 默认 Prism（轻量、零配置）
- 用户可配置开启 Shiki（追求极致高亮质量）
- 两种方案 API 一致，切换无感知

### 2.3.4 构建工具：原生 Node.js + 复用渲染内核

**不引入 Vite / Rollup / esbuild 等构建链**。

**理由**：
- 我们的「构建」就是遍历 Markdown 文件 → 渲染成 HTML → 写文件，不需要打包
- Node 渲染内核已具备完整渲染逻辑，dev / SSG / bundle 三条路径直接复用（唯一事实来源）
- 减少依赖、降低复杂度、提高可靠性
- 用户不需要学习新工具链

**构建工具组成**：
```
cli/
├── index.js         CLI 入口（命令解析）
├── init.js          初始化项目
├── dev.js           开发服务器（原生 http + watch）
├── build.js         静态构建主逻辑
├── ssr.js           服务端渲染（复用 marked renderer）
├── search-index.js  搜索索引构建
├── llms-txt.js      llms.txt 生成
├── sitemap.js       sitemap.xml 生成
└── manifest.js      资源清单生成
```

### 2.3.5 CSS 方案：原生 CSS + CSS 变量

**不使用 CSS 预处理器（Sass/Less），不使用 CSS-in-JS，不使用 Tailwind。**

**理由**：
- 产品本身是轻量级工具，样式量不大（~5KB gzip）
- CSS 变量已经足够强大，支持主题切换和定制
- 零依赖、零构建，符合「零构建优先」原则
- 用户定制简单——改几个 CSS 变量就行，不需要学预处理器
- 代码可读性好，插件开发者容易理解和覆盖

**CSS 架构**：
```
styles/
├── tokens.css      设计令牌（CSS 变量：颜色/字体/间距/圆角）
├── base.css        基础样式（重置/排版/链接/列表）
├── layout.css      布局（侧边栏/内容区/TOC/顶栏）
├── components.css  组件（按钮/搜索框/提示框/代码块）
├── markdown.css    Markdown 内容样式
├── theme-light.css 亮色主题变量覆盖
├── theme-dark.css  暗色主题变量覆盖
└── responsive.css  响应式断点
```

### 2.3.6 测试框架

| 类型 | 工具 | 说明 |
|---|---|---|
| 单元测试 | Vitest | 快、ESM 原生、配置简单 |
| 端到端测试 | Playwright | 跨浏览器、可靠、截图对比 |
| 性能基准 | 自定义脚本 | 构建速度、搜索速度、首屏加载 |

### 2.3.7 XSS 防护：DOMPurify（强制依赖）

**实测依据（2026-08）**：marked 默认不 sanitize，`<script>` 标签与 `javascript:` 链接会原样输出（已验证）。因此 sanitize 是**强制安全层**，不是可选。

- 选型：**DOMPurify**（~7KB gzip，浏览器/Node 通用，白名单配置）
- 位置：在 Node 渲染内核的渲染管线中执行（见 03 文档渲染管线第 3 步）
- 原则：**渲染时一次性 sanitize，展示层不接触原始 Markdown**（sanitize 单点）
- 体积：计入 Node 内核预算，不进入浏览器
- 安全测试：恶意 Markdown 回归测试集（script 注入 / javascript: URL / 事件属性 / HTML 实体绕过）作为 CI 常驻用例，见 [12-development-standards](./12-development-standards.md)

### 2.3.8 浏览器支持矩阵与降级策略

**实测依据（2026-08）**：file:// 下 fetch/XHR 读取本地文件——Chromium/WebKit 失败、仅 Firefox 成功；内容内嵌（bundle）方案三引擎全部成功。

| 能力 | 策略 |
|---|---|
| **目标浏览器** | 现代浏览器：Chrome/Edge/Firefox/Safari 最近两个主要版本（ES2020+） |
| **展示层** | 三引擎全覆盖（bundle/SSG 产物，实测通过） |
| **File System Access API** | 不依赖（Safari 不支持），仅作 dev 模式的辅助能力 |
| **降级策略** | 无 Node 环境的用户使用 bundle 产物（已预渲染）；写作/开发使用 dev server |
| **浏览器矩阵测试** | Playwright × {Chromium, Firefox, WebKit} × {三形态产物}，见 [10](./10-agent-dev-environment.md) |

---

## 2.4 数据流向

### 形态 ①：dev server 模式（写作/预览）

```
用户请求 URL (/path/to/doc)
  → Node 内核渲染 Markdown → HTML（含 sanitize）
  → 返回完整页面（首屏直出）
  → 浏览器展示层接管导航与搜索
  → 文件变更 → SSE 推送 → 重新渲染该页 → 不刷新整页
  → 用户看到更新（热重载）
```

### 形态 ②：SSG 模式（公开发布）

```
构建时：
  遍历 docs/ 目录
    → 每个 md 文件由 Node 内核渲染成完整 HTML（含 sanitize）
    → 写入 dist/path/to/doc.html
  生成搜索索引 → dist/search-index.json
  生成 llms.txt / docs.json → dist/
  生成 sitemap.xml / robots.txt → dist/

运行时：
  浏览器加载静态 HTML → 首屏立即可见（SEO 友好，无 JS 也可读）
  JS 加载 → 展示层接管导航和搜索
  页面切换走 SPA 模式（加载已渲染 HTML，不再渲染 Markdown）
  刷新任何页面都是完整 HTML
```

### 形态 ③：bundle 模式（离线分发）

```
构建时（doclight bundle）：
  遍历 docs/ 目录
    → 每个 md 文件由 Node 内核渲染成 HTML（含 sanitize）
    → 所有页面 + 内容内嵌为单个 doclight.html
  内嵌：已渲染 HTML 页面 + 搜索索引 + llms.txt 全文 + docs.json

运行时：
  双击 doclight.html（file:// 或任意方式）
    → 浏览器展示层从内嵌数据渲染站点
    → 不发起任何网络 / file 读取请求（跨浏览器，实测通过）
```

---

## 2.5 配置系统设计

### 零配置约定

没有 `doclight.json` 也能跑，遵循以下约定：

| 约定项 | 默认值 |
|---|---|
| 内容目录 | `docs/` 或当前目录 |
| 首页 | `README.md` 或 `index.md` |
| 导航结构 | 文件夹 = 分组，文件按字母排序 |
| 主题 | 跟随系统（自动亮/暗） |
| 搜索 | 自动启用，自动选择引擎 |
| 代码高亮 | Prism，自动检测语言 |
| 路由模式 | path（dev / SSG）/ hash（bundle） |

### 配置文件结构

```json
{
  "title": "My Documentation",
  "description": "这是我的文档站",
  "base": "/",

  "theme": {
    "colorPrimary": "#0d9488",
    "fontSans": "system-ui",
    "fontMono": "ui-monospace",
    "maxWidth": "680px",
    "sidebarWidth": "280px",
    "radius": "6px",
    "darkMode": "auto"
  },

  "nav": [
    { "title": "入门", "items": ["intro.md", "quickstart.md"] },
    { "title": "指南", "path": "guide/" }
  ],

  "search": {
    "engine": "auto",
    "shortcut": "cmd+k",
    "maxResults": 10
  },

  "highlight": {
    "engine": "prism",
    "languages": ["javascript", "python", "bash"]
  },

  "plugins": [
    { "name": "mermaid", "config": {} },
    { "name": "copy-code" }
  ],

  "build": {
    "outDir": "dist",
    "llmsTxt": true,
    "sitemap": true,
    "searchIndex": true
  }
}
```

**设计原则**：
- 配置扁平，不嵌套过深
- 字段名直观，看名字就知道干什么的
- 所有字段都有默认值，配置是「改默认」不是「必须写」
- JSON 格式，人和 Agent 都好读好写
