# 07 · 插件系统设计

---

## 7.1 设计哲学

### 核心原则

1. **小内核，大生态**：核心只做最本质的事，功能靠插件长出来
2. **简单到 Agent 也能写**：插件 API 设计的第一个用户是 AI Agent，第二个才是人
3. **约定优于配置**：默认行为合理，能不配置就不配置
4. **渐进式复杂度**：从「加载一个 JS 文件」到「完整插件包」之间有很多台阶
5. **稳定的 API**：核心 API 一旦确定就不变，新增只加不改

### 插件能做什么

| 能力 | 实现方式 | 示例 |
|---|---|---|
| 改 Markdown 内容 | `beforeRender` 钩子 | 自定义语法、变量替换 |
| 改 HTML 输出 | `afterRender` 钩子 | 添加元素、修改结构 |
| 操作 DOM | `onMount` 钩子 | 交互组件、动画效果 |
| 响应路由变化 | `onRouteChange` 钩子 | 页面统计、内容检查 |
| 扩展 Markdown | `extendMarked` 钩子 | 自定义容器、新语法 |
| 扩展搜索字段 | `addSearchFields` 钩子 | 索引 frontmatter 自定义字段 |
| 在页面插入内容 | 插槽系统 | 顶部摘要、底部评论 |
| 添加新页面 | 虚拟页面 API | 搜索页、标签页 |
| 注册快捷键 | 快捷键 API | 自定义全局快捷键 |
| 访问核心 API | app 实例 | 读取状态、触发导航 |

---

## 7.2 插件生命周期

```
加载阶段
  │
  ├─ plugin.register()      插件注册，读取配置
  │
初始化阶段
  │
  ├─ plugin.init(app)       初始化，可访问 app 实例
  │
运行阶段（持续）
  │
  ├─ beforeRender(md, ctx)  每次渲染 Markdown 前
  ├─ afterRender(html, ctx) 每次渲染 HTML 后
  ├─ onMount(app)           每次页面挂载完成
  └─ onRouteChange(path)    每次路由变化
  │
卸载阶段
  │
  └─ plugin.destroy()       插件卸载，清理资源
```

---

## 7.3 钩子系统（Hooks）

### 7.3.1 完整钩子列表

| 钩子 | 调用时机 | 参数 | 返回值 | 常用场景 |
|---|---|---|---|---|
| `init(app)` | 初始化时 | app 实例 | - | 注册事件、初始化状态 |
| `beforeRender(markdown, context)` | Markdown 渲染前 | markdown: string<br>context: 对象 | 修改后的 markdown | 变量替换、自定义语法预处理 |
| `afterRender(html, context)` | HTML 渲染后 | html: string<br>context: 对象 | 修改后的 html | 添加 DOM、包裹元素 |
| `extendMarked(marked)` | 初始化时 | marked 实例 | - | 扩展 marked 解析器 |
| `onMount(app)` | 页面挂载后 | app 实例 | - | 绑定事件、初始化组件 |
| `onRouteChange(path, app)` | 路由变化时 | path: string<br>app: 实例 | - / false（取消） | 统计、埋点、校验 |
| `addSearchFields(doc)` | 构建索引时 | doc: 文档对象 | { key: value } | 扩展搜索字段 |
| `destroy()` | 卸载时 | - | - | 清理事件、释放资源 |

### 7.3.2 Context 对象

`beforeRender` 和 `afterRender` 钩子收到的 `context` 对象：

```javascript
{
  path: 'guide/quickstart.md',      // 文档路径
  title: '快速开始',                 // 文档标题
  frontmatter: {                     // frontmatter 数据
    summary: '...',
    tags: ['入门'],
    // ...
  },
  headings: [                        // 标题大纲
    { level: 2, id: 'install', text: '安装' },
    // ...
  ],
  isFirstRender: true,               // 是否首次渲染
}
```

### 7.3.3 钩子执行顺序

多个插件时，钩子按插件注册顺序依次执行：

```
Plugin A.beforeRender → Plugin B.beforeRender → marked 渲染
                                                          ↓
Plugin A.afterRender ← Plugin B.afterRender ← HTML 结果
```

`beforeRender` 是正向顺序，`afterRender` 是反向顺序（类似洋葱模型，但简化版，避免过度复杂）。

---

## 7.4 插槽系统（Slot System）

### 7.4.1 设计思路

插件想在页面上插入 UI 元素，不应该直接操作 DOM（容易冲突、容易破坏布局）。插槽系统提供了明确的「插入点」，插件往插槽里放内容就行。

### 7.4.2 插槽位置总览

```
┌──────────────────────────────────────────────────────────┐
│ head:start   ◄── <head> 开始处                            │
│ head:end     ◄── <head> 结束处                            │
├──────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────────────┐ ┌───────────────────┐ │
│ │sidebar:  │ │ topbar:before    │ │ topbar:after      │ │
│ │before    │ │                   │ │                   │ │
│ │          │ ├───────────────────┤ ├───────────────────┤ │
│ │          │ │                   │ │ toc:before       │ │
│ │          │ │                   │ │                   │ │
│ │content   │ │  内容区            │ │                   │ │
│ │-:before  │ │                   │ │                   │ │
│ │          │ │  content:before   │ │                   │ │
│ │          │ │  ◄── 这里 ──►     │ │                   │ │
│ │          │ │                   │ │                   │ │
│ │          │ │  content:after    │ │ toc:after        │ │
│ │sidebar:  │ │                   │ │                   │ │
│ │after     │ │                   │ │                   │ │
│ └──────────┘ └───────────────────┘ └───────────────────┘ │
└──────────────────────────────────────────────────────────┘
  footer  ◄── 页面底部
```

### 7.4.3 完整插槽列表

| 插槽名 | 位置 | 典型用途 |
|---|---|---|
| **head:start** | `<head>` 最开始 | 预加载、meta 标签 |
| **head:end** | `<head>` 末尾 | 额外 CSS、字体、JS |
| **sidebar:before** | 侧边栏顶部 | Logo、品牌、搜索框 |
| **sidebar:after** | 侧边栏底部 | 版本号、链接、社交账号 |
| **topbar:before** | 顶栏左侧 | 额外按钮、面包屑 |
| **topbar:after** | 顶栏右侧 | GitHub 链接、翻译按钮 |
| **content:before** | 内容区顶部 | 文章元信息、AI 摘要、标签 |
| **content:after** | 内容区底部 | 上一页/下一页、评论、相关文章、编辑按钮 |
| **toc:before** | TOC 面板顶部 | 目录标题、筛选搜索 |
| **toc:after** | TOC 面板底部 | 扩展导航、反馈入口 |
| **footer** | 页面最底部 | 版权、友情链接、备案号 |

### 7.4.4 API

```javascript
// 插入内容
app.insertSlot('content:before', '<div>自定义内容</div>')

// 插入 HTML 字符串
app.insertSlot('sidebar:after', htmlString)

// 插入 DOM 元素
const el = document.createElement('div')
el.textContent = 'Hello'
app.insertSlot('content:after', el)

// 插入函数（每次路由变化重新执行）
app.insertSlot('content:before', (doc) => {
  return `<div class="tags">${doc.frontmatter.tags.join(', ')}</div>`
})

// 移除
app.removeSlot('content:before', 'my-plugin-id')
```

### 为什么 Agent 友好

1. **命名直观**：`sidebar:after` 一看就知道是侧边栏底部
2. **不会错**：只能插入到定义好的位置，不会破坏布局结构
3. **自动适配**：插入的内容自动继承主题样式和响应式
4. **冲突隔离**：多个插件插同一个位置，自动依次排列

---

## 7.5 插件类型

### 7.5.1 最简插件：一个函数

```javascript
// 最简单的插件：一个函数就是 beforeRender 钩子
doclight.use(function(markdown) {
  return markdown.replace(/TODO/g, '<span class="todo">TODO</span>')
})
```

### 7.5.2 普通插件：对象形式

```javascript
const myPlugin = {
  name: 'my-plugin',
  version: '1.0.0',

  beforeRender(md, ctx) { return md },
  afterRender(html, ctx) { return html },
  onMount(app) { },
  onRouteChange(path, app) { },
}

doclight.use(myPlugin)
```

### 7.5.3 带配置的插件：函数工厂

```javascript
function myPlugin(options = {}) {
  return {
    name: 'my-plugin',
    version: '1.0.0',
    config: options,

    onMount(app) {
      // 使用 options...
    }
  }
}

doclight.use(myPlugin({ color: 'red' }))
```

### 7.5.4 插件包：npm 包

```
doclight-plugin-mermaid/
├── index.js           # 插件主文件
├── styles.css         # 插件样式
├── package.json       # 包信息
└── README.md          # 使用说明
```

```json
// doclight.json 中配置
{
  "plugins": [
    { "name": "mermaid", "config": { "theme": "default" } }
  ]
}
```

---

## 7.6 内置插件

常用功能内置，用户开箱即用。

| 插件 | 功能 | 默认启用 | 体积 |
|---|---|---|---|
| **search** | 全文搜索（Cmd+K） | ✅ | ~7-15KB |
| **highlight** | 代码语法高亮 | ✅ | ~15KB |
| **copy-code** | 代码块复制按钮 | ✅ | <1KB |
| **mermaid** | Mermaid 图表渲染 | ❌ 按需 | ~60KB（CDN 加载） |
| **katex** | 数学公式 | ❌ 按需 | ~20KB（CDN 加载） |
| **pangu** | 中英文自动间距 | ❌ 按需 | ~5KB |

---

## 7.7 官方插件（推荐生态）

| 插件 | 功能 | 说明 |
|---|---|---|
| **@doclight/plugin-giscus** | Giscus 评论 | GitHub Discussions 驱动 |
| **@doclight/plugin-utterances** | Utterances 评论 | GitHub Issues 驱动 |
| **@doclight/plugin-plausible** | Plausible 统计 | 隐私友好的网站统计 |
| **@doclight/plugin-umami** | Umami 统计 | 自托管网站统计 |
| **@doclight/plugin-pwa** | PWA 支持 | 离线缓存 + 安装到桌面 |
| **@doclight/plugin-versioning** | 多版本切换 | 文档版本管理 |
| **@doclight/plugin-i18n** | 多语言 | 国际化支持 |
| **@doclight/plugin-ai-chat** | AI 问答 | BYO-LLM 聊天组件 |
| **@doclight/plugin-rss** | RSS 订阅 | 生成 RSS feed |
| **@doclight/plugin-sitemap** | 站点地图 | 生成 sitemap.xml |

---

## 7.8 插件开发指南（Agent 友好版）

### 快速开始

```bash
# 生成插件脚手架
doclight plugin new my-plugin
```

生成的文件：
```
doclight-plugin-my-plugin/
├── index.js         # 插件主文件（带完整注释模板）
├── styles.css       # 插件样式（可选，可删）
├── plugin.json      # 插件元数据
├── README.md        # 使用说明（自动生成模板）
└── example.html     # 本地测试用例
```

### 开发工作流

```
1. 读 index.js 中的注释 → 理解每个钩子的用途
2. 找到需要的钩子 → 删掉不需要的
3. 在 TODO 位置写代码
4. 用 example.html 本地测试
5. 读 API 参考 → 了解更多可用 API
```

### API 参考结构

为了让 Agent 能快速找到需要的 API，文档组织如下：

```
api/plugin-api/
├── README.md             # 总览 + 快速导航
├── hooks.md              # 所有钩子列表 + 参数 + 示例
├── app-instance.md       # app 实例的所有方法和属性
├── slot-system.md        # 插槽系统详解
├── search-api.md         # 搜索相关 API
├── router-api.md         # 路由相关 API
├── theme-api.md          # 主题相关 API
└── examples/
    ├── basic.md          # 最简单的插件
    ├── custom-syntax.md  # 自定义 Markdown 语法
    ├── ui-component.md   # 添加 UI 组件
    └── search-plugin.md  # 扩展搜索
```

每个 API 页面的结构：
```
# 方法名

**描述**：一句话说明干什么的

**签名**：代码块，包含 TypeScript 类型

**参数**：
- `param1` (类型) — 说明

**返回值**：类型 — 说明

**示例**：完整的可运行示例

**相关**：相关的其他 API 链接
```

---

## 7.9 主题系统

### 7.9.1 三层定制（从易到难）

```
Level 1：改 CSS 变量（最简单）
  → 改颜色、字体、间距、圆角
  → 只需要 JSON 配置或几行 CSS

Level 2：加自定义样式
  → 调整组件外观、添加新样式
  → 写 custom.css

Level 3：完整主题包
  → 全面替换视觉风格
  → 独立的主题包，可分享可安装
```

### 7.9.2 主题包结构

```
themes/
└── my-theme/
    ├── theme.css          # 变量覆盖 + 组件样式（必须）
    ├── prism.css          # 代码高亮主题（可选）
    ├── mermaid.css        # Mermaid 主题（可选）
    ├── preview.png        # 预览图（主题市场展示用）
    └── theme.json         # 主题元数据
```

**theme.json**：
```json
{
  "name": "my-theme",
  "displayName": "我的主题",
  "version": "1.0.0",
  "author": "username",
  "description": "主题描述",
  "darkMode": true,
  "tags": ["minimal", "dark", "colorful"]
}
```

### 7.9.3 主题变量参考

完整的可定制 CSS 变量（约 50+ 个），分类如下：
- 颜色（品牌色 + 8 级灰阶 + 4 种语义色）
- 字体（sans / mono / 各级字号）
- 行高（紧凑 / 正常 / 宽松）
- 间距（4px 基准的 8 级间距）
- 布局（内容区宽度、侧边栏宽度、TOC 宽度、顶栏高度）
- 圆角（小 / 中 / 大）
- 阴影（小 / 中）
- 过渡（快 / 正常）
- 代码块（字号、行高、内边距）

每个变量都有默认值，用户可以只改需要的几个。

---

## 7.10 插件安全

### 沙箱限制

- 插件运行在主页面上下文（没有 iframe 沙箱，因为要操作 DOM）
- 但插件是用户主动安装的，信任模型同浏览器扩展
- 官方插件经过安全审计
- 社区插件标注「官方」/「社区」/「未审核」

### 最佳实践

- 插件只做它声称要做的事
- 不收集用户数据（统计类插件明确告知）
- 不修改不在职责范围内的东西
- 提供卸载清理（`destroy` 钩子）
