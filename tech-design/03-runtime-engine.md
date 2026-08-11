# 03 · 渲染内核与展示层

> 注：文件名 `03-runtime-engine.md` 沿袭早期命名，内容已按三形态架构（Node 渲染内核 + 浏览器展示层）更新。

---

## 3.1 入口架构：Node 渲染内核 + 三种产物形态

### 3.1.1 为什么渲染收敛到 Node

**实测依据（2026-08）**：浏览器安全模型禁止 JS 在 `file://` 协议下动态读取本地文件（Chromium/WebKit 失败，仅 Firefox 允许）。因此「浏览器动态渲染 Markdown」无法兑现「零配置 + 离线 + 跨浏览器」。DocLight 的解法：

- **渲染统一在 Node 侧**（单一事实来源），输出已渲染的静态 HTML
- **浏览器端是轻量展示层**，不接触原始 Markdown
- 三种产物形态（dev / SSG / bundle）共享同一渲染内核，内容一致

**收益**：
- 跨浏览器离线可用（bundle 已在三引擎实测通过）
- XSS sanitize 单点防护（Node 侧）
- 消除同构双端渲染漂移
- 浏览器端更小（~25KB，无 marked，见 02-2.2）

### 3.1.2 产物形态

| 形态 | 命令 | 产物 | 场景 | 环境要求 |
|---|---|---|---|---|
| **① dev server** | `doclight dev` | 本地服务 | 写作/预览，热重载 | 需 Node |
| **② SSG** | `doclight build` | `dist/` 静态目录 | 公开发布、SEO | 需 Node 构建一次 |
| **③ bundle** | `doclight bundle` | 单个 `doclight.html` | 离线分发、双击即看 | **零依赖、跨浏览器** |

### 3.1.3 产物 HTML 结构（②③ 共用展示层）

```html
<!DOCTYPE html>
<html lang="zh-CN" data-theme="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>DocLight</title>

  <!-- 防闪烁：同步确定主题（~200 bytes，内联） -->
  <!-- 内联 CSS（~5KB gzip） -->
  <!-- 预渲染内容（SSG：整页完整 HTML；bundle：首篇 + 内嵌数据） -->
</head>
<body>
  <!-- 预渲染导航（SEO 关键，非 JS 生成） -->
  <aside id="sidebar">…</aside>
  <main id="main"><div class="paper"><div id="content">…预渲染内容…</div></div></main>

  <!-- bundle 专用：所有页面 HTML + 搜索索引 + llms.txt + docs.json 内嵌数据块 -->
  <script type="application/json" id="doclight-bundle">…</script>

  <!-- 展示层 JS（~25KB gzip，无 Markdown 渲染） -->
  <script>/* 展示层运行时 */</script>
</body>
</html>
```

### 3.1.4 加载流程（展示层）

```
1. HTML 解析 → 预渲染内容立即可见（SSG/bundle 首屏直出，无 JS 依赖）
2. 内联 JS 执行 → 初始化展示层（~20ms）
3. 导航树（SSG：HTML 内；bundle：内嵌数据）→ 构建导航 UI
4. 解析 URL → 显示对应页面（SSG：加载已渲染 HTML；bundle：从内嵌数据渲染）
5. 搜索索引懒加载（首次 Cmd+K 时）
```

---

## 3.2 路由系统

### 3.2.1 双模式设计（按形态自动选择）

| 模式 | URL 格式 | 适用形态 | 说明 |
|---|---|---|---|
| **Path 模式** | `/path/to/doc.html` | ① dev / ② SSG | 每页独立完整 HTML，SEO 友好 |
| **Hash 模式** | `#/path/to/doc` | ③ bundle | 单文件内导航，离线双击即看 |

### 3.2.2 Hash 模式详细设计

**URL 格式**：`#/path/to/doc.md#anchor`

- 第一段 `/path/to/doc.md` = 文档路径
- 第二段 `#anchor` = 页面内锚点
- 空 hash = 首页（README.md 或 index.md）

**路由解析流程**：
```javascript
function parseHash() {
  const hash = location.hash.slice(1)  // 去掉 #
  const [pathPart, anchorPart] = hash.split('#')
  const path = pathPart || 'README.md'  // 默认首页
  return { path, anchor: anchorPart || null }
}
```

**导航变更**：
- 点击内部链接 → `location.hash = '#/' + newPath`
- 监听 `hashchange` 事件 → 触发路由更新
- 支持浏览器前进/后退

### 3.2.3 Path 模式详细设计

**使用场景**：SSG 构建后，每个页面都是独立的 HTML 文件

**工作方式**：
- 首屏：服务器返回完整 HTML（直出，SEO 友好）
- JS 加载后：劫持内部链接点击，走 SPA 模式（fetch + 渲染）
- 刷新任何页面：都是完整 HTML，不依赖 JS

**hybrid 策略**：
```
用户第一次访问 /guide/quickstart.html
  → 服务器返回完整 HTML（包含内容）
  → 浏览器渲染，用户立即看到内容
  → JS 加载，hydration
  → 用户点击下一篇 /guide/advanced.html
    → JS 拦截点击，不刷新页面
    → fetch advanced.md → 渲染 → 更新 URL
    → 比整页刷新更快
  → 用户刷新页面
    → 服务器返回完整 HTML
    → 内容始终存在，SEO 友好
```

### 3.2.4 路由钩子（插件用）

```javascript
router.beforeEach(({ from, to }) => {
  // 返回 false 取消导航
  // 返回字符串重定向
  // 不返回则继续
})

router.afterEach(({ from, to }) => {
  // 路由变化后执行
})
```

---

## 3.3 Markdown 渲染系统

### 3.3.1 渲染管线

> 此管线运行在 **Node 渲染内核**（服务端/构建时），输出已 sanitize 的 HTML，浏览器展示层不再执行 Markdown 渲染。

```
原始 Markdown
    │
    ▼
[1] 提取 frontmatter → 存入 doc 对象
    │
    ▼
[2] marked 解析 → HTML 片段
    │  （应用自定义 renderer）
    │
    ▼
[3] DOMPurify sanitize（XSS 防护，强制，见 02-2.3.7）
    │
    ▼
[4] 代码高亮 → Prism/Shiki
    │  （按需加载语言包）
    │
    ▼
[5] 标题锚点注入 → 生成 TOC 数据
    │
    ▼
[6] 相对链接修正 → 转为站内 path/hash
    │
    ▼
[7] 图片路径修正 → 相对路径正确解析
    │
    ▼
[8] 插件 beforeRender / afterRender 钩子
    │
    ▼
最终 HTML → 输出（SSG 写文件 / bundle 内嵌 / dev 推送浏览器）
```

### 3.3.2 自定义 Renderer

基于 marked.Renderer 扩展，保留默认行为的同时增强：

```javascript
const renderer = {
  // 标题：注入 id，用于锚点和 TOC
  heading(text, level, raw) {
    const id = slugify(raw)
    return `<h${level} id="${id}">${text}</h${level}>`
  },

  // 链接：修正相对路径，判断是否外部链接
  link(href, title, text) {
    if (isExternal(href)) {
      return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`
    }
    const corrected = resolveRelativeLink(currentDoc.path, href)
    return `<a href="#/${corrected}">${text}</a>`
  },

  // 图片：懒加载 + 相对路径修正
  image(href, title, text) {
    const src = resolveRelativePath(currentDoc.path, href)
    return `<img src="${src}" alt="${text}" loading="lazy" />`
  },

  // 代码块：检测语言，调用高亮
  code(code, lang) {
    const highlighted = highlight(code, lang)
    return `<pre><code class="language-${lang}">${highlighted}</code></pre>`
  },

  // 表格：包裹容器，支持横向滚动
  table(header, body) {
    return `<div class="table-wrap"><table>${header}${body}</table></div>`
  },
}
```

### 3.3.3 Frontmatter 支持

```markdown
---
title: 自定义标题（不写则取第一个 #）
summary: 这篇文章讲了什么（用于搜索摘要和 llms.txt）
tags: [入门, 安装]
date: 2026-08-01
difficulty: beginner
reading_time: 5 min
prerequisites: [README.md]
next: guide/configuration.md
---

# 正文从这里开始
```

**设计原则**：
- frontmatter 是可选增强，不是必须
- 字段都是「人能看懂、Agent 也能看懂」的语义化字段
- 不定义复杂的模板语法（跟 MkDocs 不一样）
- 未识别的字段原样保留，插件可以读取

### 3.3.4 支持的 Markdown 语法

**基础（CommonMark）**：
- 标题、段落、列表、引用、代码块
- 链接、图片、粗体、斜体、删除线
- 水平线、转义字符

**GFM 扩展（默认开启）**：
- 表格
- 任务列表（`- [ ]` / `- [x]`）
- 删除线
- 自动链接
- 围栏代码块（带语言标识）

**扩展语法（通过插件）**：
- `:::tip / :::warning / :::danger` 自定义容器
- `{.class}` 类名注入
- 脚注
- 数学公式（KaTeX）
- Mermaid 图表

**原则**：核心只支持标准语法，扩展通过插件。保持内容的可迁移性。

---

## 3.4 导航系统

### 3.4.1 自动导航生成

**零配置模式**：扫描目录，自动生成树形导航。

```
docs/
├── README.md          ← 首页
├── intro.md
├── quickstart.md
├── guide/
│   ├── basic.md
│   └── advanced.md
└── api/
    └── reference.md
```

自动生成的导航结构：
```
├── 首页（README.md）
├── intro.md
├── quickstart.md
├── guide/
│   ├── basic.md
│   └── advanced.md
└── api/
    └── reference.md
```

**排序规则**：
1. 数字前缀优先（`01-intro.md` 排在 `02-guide.md` 前面）
2. 字母顺序次之
3. README.md / index.md 排在目录最前面

### 3.4.2 手动配置

```json
{
  "nav": [
    { "title": "入门", "items": ["intro.md", "quickstart.md"] },
    {
      "title": "指南",
      "items": [
        { "title": "基础", "path": "guide/basic/" },
        { "title": "进阶", "path": "guide/advanced/" }
      ]
    },
    { "title": "API 参考", "path": "api/" }
  ]
}
```

**灵活的配置方式**：
- `"path/to/file.md"` → 单个文件
- `"path/to/dir/"` → 整个目录（自动展开）
- `{ title, items }` → 手动分组
- 三种方式可以任意混合嵌套

### 3.4.3 docs.json 预生成

**问题**：浏览器不能直接列目录，怎么知道有哪些文件？

**三种解决方案（按优先级）**：

| 方案 | 适用场景 | 原理 |
|---|---|---|
| **1. 预生成 docs.json** | 大多数情况 | CLI 命令或 GitHub Action 生成目录清单 |
| **2. 手动配置 nav** | 小型站点 | 用户在 doclight.json 里手写 |
| **3. 服务器 autoindex** | 有服务器控制权 | 利用 nginx/apache 的目录索引 JSON |

**docs.json 格式**：
```json
{
  "version": 1,
  "generatedAt": "2026-08-01T00:00:00Z",
  "docs": [
    {
      "path": "guide/quickstart.md",
      "title": "快速开始",
      "summary": "5 分钟上手",
      "tags": ["入门"],
      "wordCount": 1200,
      "updatedAt": "2026-08-01"
    }
  ],
  "nav": [ /* 可选，手动导航配置 */ ]
}
```

### 3.4.4 侧边栏交互

**桌面端**：
- 树形结构，可折叠/展开
- 当前页面高亮
- 悬停显示完整标题（截断时）
- 展开/收起全部按钮
- 可折叠侧边栏（增大阅读空间）

**移动端**：
- 侧边栏默认隐藏
- 左上角菜单按钮拉出
- 从左侧滑入，遮罩层点击关闭
- 支持手势滑动关闭

---

## 3.5 搜索引擎

### 3.5.1 设计目标

- 零配置：开箱即用，不需要 Algolia 等外部服务
- 极速：输入即时出结果（< 50ms）
- 准确：支持模糊匹配、中文分词、结果高亮
- 轻量：< 15KB gzip

### 3.5.2 搜索体验

**触发方式**：
- `Cmd/Ctrl + K`（全局快捷键）
- 点击搜索图标
- 直接输入 `/` 焦点跳到搜索框（类似 GitHub）

**交互**：
```
┌─────────────────────────────────┐
│ 🔍 搜索文档...              ⌘K  │
├─────────────────────────────────┤
│ ┌──┐ 快速开始                   │
│ │📄│ guide/quickstart.md        │
│ └──┼────────────────────────    │
│     5 分钟上手，从安装到第一     │
│     篇文档【安装】【配置】      │
├─────────────────────────────────┤
│ ┌──┐ 配置指南                   │
│ │📄│ guide/configuration.md     │
│ └──┼────────────────────────    │
│     所有可配置项的详细说明       │
└─────────────────────────────────┘
  ↑↓ 选择  Enter 打开  Esc 关闭
```

**功能**：
- 实时搜索（输入即时出结果，无提交按钮）
- 结果高亮（匹配的关键词标红）
- 键盘导航（↑↓ 选择，Enter 打开，Esc 关闭）
- 路径面包屑（知道结果在哪个位置）
- 摘要片段（显示命中的上下文）
- 最近搜索（localStorage 记录）

### 3.5.3 索引构建策略

**懒加载构建**（运行时默认）：
```
首屏 → 不构建索引（不影响首屏速度）
用户按 Cmd+K → 显示搜索框 + "正在构建索引..."
  → 后台 fetch 所有 Markdown 文件
  → 解析 + 提取正文 + 构建索引
  → 构建完成 → 可搜索
```

**预构建索引**（SSG 模式推荐）：
```
构建时 → 生成 search-index.json
运行时 → 直接加载索引（< 100ms）
用户按 Cmd+K → 立即可搜索
```

### 3.5.4 双引擎切换

**MiniSearch（默认，英文优化）**：
- ~7KB gzip
- 模糊搜索、字段权重、结果高亮
- 英文效果好，中文需要分词插件

**FlexSearch（中文优化）**：
- ~15KB gzip
- 内置 CJK 分词（character n-gram）
- 性能极高（号称最快 JS 搜索引擎）
- 支持上下文检索

**自动检测**：
```javascript
function detectLanguage(docs) {
  const sample = docs.slice(0, 3).map(d => d.content).join('')
  const chineseChars = (sample.match(/[一-龥]/g) || []).length
  const ratio = chineseChars / sample.length
  return ratio > 0.1 ? 'zh' : 'en'
}
```

---

## 3.6 主题系统

### 3.6.1 设计令牌（CSS Variables）

```css
:root {
  /* 颜色 - 品牌 */
  --color-primary: #0d9488;
  --color-primary-hover: #0f766e;
  --color-primary-light: #ccfbf1;

  /* 颜色 - 中性灰阶（8 级） */
  --color-bg: #ffffff;
  --color-bg-soft: #f9fafb;
  --color-bg-code: #f3f4f6;
  --color-border: #e5e7eb;
  --color-border-soft: #f3f4f6;
  --color-text-muted: #9ca3af;
  --color-text-secondary: #6b7280;
  --color-text: #374151;
  --color-text-strong: #111827;

  /* 字体 */
  --font-sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", "Cascadia Code", ui-monospace, monospace;

  /* 字号（模块化缩放 1.25） */
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-2xl: 1.5rem;    /* 24px */
  --font-size-3xl: 2rem;      /* 32px */

  /* 行高 */
  --line-height-tight: 1.3;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;  /* 正文阅读 */

  /* 间距（4px 基准） */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;

  /* 布局 */
  --max-width-content: 680px;
  --sidebar-width: 280px;
  --toc-width: 200px;
  --topbar-height: 52px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius: 6px;
  --radius-lg: 8px;

  /* 阴影（克制使用） */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 1px 3px rgba(0,0,0,0.1);

  /* 过渡 */
  --transition-fast: 150ms ease;
  --transition: 200ms ease;
}
```

### 3.6.2 暗色模式

```css
[data-theme="dark"] {
  --color-bg: #0a0a0a;
  --color-bg-soft: #171717;
  --color-bg-code: #262626;
  --color-border: #262626;
  --color-border-soft: #1f1f1f;
  --color-text-muted: #737373;
  --color-text-secondary: #a3a3a3;
  --color-text: #d4d4d4;
  --color-text-strong: #f5f5f5;
}
```

**模式切换**：
- `auto`（默认）：跟随系统 `prefers-color-scheme`
- `light`：强制亮色
- `dark`：强制暗色

**防闪烁方案**：
```html
<!-- 放在 <head> 最前面，同步执行 -->
<script>
(function() {
  try {
    var t = localStorage.getItem('doclight-theme')
    if (!t) {
      t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    document.documentElement.setAttribute('data-theme', t)
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'light')
  }
})()
</script>
```

这段脚本必须内联在 `<head>` 中，在 CSS 之前执行，确保页面渲染前主题就确定了。

### 3.6.3 主题定制（从易到难）

**Level 1：改几个变量（最简单）**
```html
<style>
  :root {
    --color-primary: #8b5cf6;  /* 换成紫色 */
    --max-width-content: 720px; /* 内容区更宽 */
  }
</style>
```

**Level 2：加自定义 CSS**
```html
<link rel="stylesheet" href="custom.css">
```

**Level 3：完整主题包**
```
themes/
├── my-theme/
│   ├── theme.css      /* 变量覆盖 + 组件样式 */
│   ├── prism.css      /* 代码高亮主题 */
│   └── preview.png    /* 预览图 */
```

---

## 3.7 TOC（本页目录）系统

### 3.7.1 桌面端：右侧导轨（少数派式）

**交互设计**：
- 常态：右侧一条细线导轨，标记当前阅读位置
- Hover：导轨展开成完整目录面板
- 点击导轨任意位置：跳转到对应章节
- 滚动页面：导轨上的指示器跟随移动

**视觉设计**：
```
    导轨（常态）       Hover 展开面板
┌───┐            ┌───────────────┐
│ ● │  标题 1    │ ● 标题 1      │
│   │            │   1.1 子标题  │
│   │  标题 2    │ ○ 标题 2      │← 当前章节
│   │            │   2.1 子标题  │
│ ○ │  标题 3    │ ○ 标题 3      │
│   │            │   3.1 子标题  │
└───┘            └───────────────┘
```

### 3.7.2 移动端：底部按钮 + 弹出面板

- 右下角浮动按钮（目录图标）
- 点击弹出底部面板，显示完整目录
- 支持手势下滑关闭
- 面板高度不超过屏幕 70%

### 3.7.3 TOC 生成规则

- 提取 `h2` 和 `h3`（不包含 h1，也不往下到 h4+，避免太细）
- 当前阅读的标题高亮（通过 IntersectionObserver 检测）
- 点击平滑滚动到对应位置
- 锚点 URL 同步更新

---

## 3.8 性能优化策略

### 首屏性能

1. **预渲染直出**：SSG/bundle 首屏即完整 HTML，无 JS 依赖
2. **内联展示层**：JS/CSS 内联，无额外请求
3. **懒加载**：搜索索引、mermaid、代码高亮按需加载
4. **预取策略**：
   - hover 链接时预加载目标页面（已渲染 HTML / bundle 内嵌数据）
   - 当前页的上一篇/下一篇预加载
   - 搜索索引空闲时后台构建

### 运行时性能

1. **虚拟列表？不需要**：文档导航通常几百项以内，直接渲染就行
2. **防抖**：搜索输入 100ms 防抖
3. **节流**：滚动事件 16ms 节流（一帧）
4. **requestIdleCallback**：非紧急操作（索引构建、预取）放在空闲时
5. **缓存**：
   - Markdown 内容内存缓存（浏览过的页面不重复 fetch）
   - 搜索索引构建后持久化到 localStorage（有版本号校验）
