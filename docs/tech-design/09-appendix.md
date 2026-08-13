# 09 · 附录

---

## 9.1 竞品功能对比矩阵

### 核心能力对比

| 功能 | DocLight | docsify | VitePress | MkDocs Material | Docusaurus | Starlight | Mintlify | GitBook |
|---|---|---|---|---|---|---|---|---|
| **零构建运行** | ✅ 核心 | ✅ 核心 | ❌ | ❌ | ❌ | ❌ | ✅ SaaS | ✅ SaaS |
| **单文件运行** | ✅ 核心 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **SSG 静态导出** | ✅ 核心 | ❌ 死穴 | ✅ 核心 | ✅ 核心 | ✅ 核心 | ✅ 核心 | ✅ | ✅ |
| **内置本地搜索** | ✅ 零配置 | ⚠️ 插件/弱 | ⚠️ MiniSearch | ⚠️ 需插件 | ⚠️ 需 Algolia | ✅ 内置 | ✅ AI 搜索 | ✅ AI 搜索 |
| **中文搜索优化** | ✅ FlexSearch | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ |
| **llms.txt** | ✅ 自动生成 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **MCP Server** | ✅ 内置 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Agent 可定制** | ✅ 架构级 | ⚠️ 有限 | ⚠️ 有限 | ⚠️ 有限 | ⚠️ 有限 | ⚠️ 有限 | ❌ 闭源 | ❌ 闭源 |
| **代码高亮** | ✅ Prism/Shiki | ⚠️ 需插件 | ✅ Shiki | ✅ Pygments | ✅ Prism/Shiki | ✅ Shiki | ✅ Shiki | ✅ |
| **Mermaid** | ✅ 按需加载 | ⚠️ 插件 | ✅ | ✅ 插件 | ✅ 插件 | ✅ | ✅ | ✅ |
| **主题定制** | CSS 变量 | CSS + 插件 | CSS + Vue | CSS + 主题包 | CSS + React | CSS + Astro | 有限 | 有限 |
| **插件系统** | ✅ 钩子+插槽 | ✅ 插件 | ⚠️ 插件 API | ✅ 插件生态 | ✅ 插件生态 | ✅ 插件 | ❌ | ❌ |
| **多版本** | ⚠️ 插件 | ⚠️ 插件 | ❌ 内置无 | ⚠️ 插件 | ✅ 内置 | ✅ 内置 | ✅ | ✅ |
| **i18n** | ⚠️ 插件 | ⚠️ 插件 | ✅ 内置 | ⚠️ 插件 | ✅ 内置 | ✅ 内置 | ✅ | ✅ |
| **离线可用** | ✅ bundle 单文件 | ⚠️ 仅 Firefox | ❌ 需构建 | ❌ 需构建 | ❌ 需构建 | ❌ 需构建 | ❌ | ❌ |
| **开源协议** | MIT | MIT | MIT | MIT | MIT | MIT | 闭源 SaaS | 闭源 SaaS |
| **核心体积** | ~25KB 展示层 | ~20KB | ~50KB+ | ~30KB + Python | ~80KB+ | ~60KB+ | - | - |

### 定位对比

| 工具 | 定位 | 目标用户 | 护城河 | 最大弱点 |
|---|---|---|---|---|
| **DocLight** | 零构建 + AI 原生的轻量文档引擎 | 个人/小团队/课程站 | 单文件 + AI 友好 + 极简 | 生态初期 |
| **docsify** | 运行时渲染的极简文档站 | 个人/小项目 | 零构建、轻量 | 无 SEO、生态老化 |
| **VitePress** | Vue 生态静态文档框架 | Vue 团队/中小项目 | Vite 生态 + Vue 官方 | 无内置 versioning |
| **MkDocs Material** | Python 生态文档事实标准 | Python 技术团队 | Material 主题 + 生态 | 2.0 治理风险 |
| **Docusaurus** | React 生态重型文档框架 | 中大团队/企业 | 生态最大 + Meta 背书 | 慢、重、配置复杂 |
| **Starlight** | Astro 生态文档主题 | 想脱离 React 的团队 | Astro 架构 + 轻量 | 生态较新 |
| **Mintlify** | AI 原生文档平台（SaaS） | 成长型公司 | AI 原生 + MCP 标准 | 定价悬崖 + 安全事件 |
| **GitBook** | 平台型 docs-as-code（SaaS） | 团队/初创 | 编辑体验 + 协同 | 涨价 + 维护疑虑 |

---

## 9.2 调研依据索引

### 市场与竞品

| 结论 | 来源依据 |
|---|---|
| Docusaurus 构建慢、配置复杂 | Docusaurus #4765 (41👍/131 评论)；Bus Pirate 宣布弃用 |
| MkDocs 2.0 治理危机 | r/Python "The Slow Collapse of MkDocs" (489 score) |
| docsify 无 SEO 死穴 | docsify #136 (37👍/53 评论)；freeplane 弃用讨论 |
| GitBook 涨价 + 停滞 | GitBook #1808 (54👍/108 评论)；Trustpilot 1.9/5 |
| Mintlify 定价悬崖 | Mintlify Pro $250-300/月；HN 安全帖 1167 分 |
| Mintlify 66% agent 流量 | Mintlify 官方博客 2026-07 数据 |
| Starlight 增长最快 | Astro/Starlight npm 下载量半年 3.5 倍 |
| 新玩家扎堆低价 | Velu $49, Docsio $60, docs.page 免费 |

### 用户痛点

| 痛点 | 来源依据 |
|---|---|
| 配置复杂 / 框架臃肿 | 多篇 SSG 对比文；r/webdev 讨论；Twitter 吐槽 |
| 构建慢 | Docusaurus #9754 (3 小时构建)；#4765 (长期 issue) |
| 搜索弱 / 缺本地搜索 | Docusaurus #776 (72👍)；mkdocs-material #6307 |
| SEO 失效 | docsify #136, #761, discussions#1581 |
| 定价飞涨 | GitBook $16→$109；ReadMe $79→$349 (+342%) |
| 内容与产品脱节 | State of Docs 2026：30% 认为是第一大挑战 |
| 非开发者难维护 | r/technicalwriting 迁移帖 |

### AI 相关

| 结论 | 来源依据 |
|---|---|
| AI 问答同质化严重 | 多篇评测；"美化版搜索框"口碑 |
| 41% 无文档团队的组织没上任何 AI | State of Docs 2026 |
| 25% 团队计划投资 MCP | State of Docs 2026 调研 |
| AI agent 流量占比快速上升 | Mintlify 66% (2026-07)；GitBook 51.8% (2026-05) |
| llms.txt 是新兴标准 | AnswerDotAI/llms-txt 2557★ |
| AI 计量计费差评集中 | Mintlify credits；ReadMe 加购模式 |
| Agent 不读源码可读的文档 | dev.to 文章 + 对照实验 |

### 迁移相关

| 迁移方向 | 驱动因素 | 来源 |
|---|---|---|
| Docusaurus → Hugo | 构建速度 | Bus Pirate 官方公告 |
| MkDocs → Starlight | 治理危机 + 现代化 | r/Python 讨论 |
| GitBook → Docusaurus | 涨价 + 锁定 | dev.to post-mortem |
| docsify → VitePress | SEO + 生态 | freeplane 讨论 |
| Mintlify → 自托管 | 定价 + 安全 | HN 讨论 |

---

## 9.3 术语表

| 术语 | 全称 | 含义 |
|---|---|---|
| **SSG** | Static Site Generation | 静态站点生成，构建时预渲染 HTML |
| **bundle** | - | 便携包，单文件内嵌全部内容（离线分发形态） |
| **DOMPurify** | - | HTML 消毒库，XSS 防护（强制安全层） |
| **sanitize** | - | 消毒，移除可执行内容以防范 XSS |
| **SSE** | Server-Sent Events | 服务器单向推送，dev server 热重载用 |
| **MCP** | Model Context Protocol | 模型上下文协议，AI Agent 与工具通信的开放标准 |
| **llms.txt** | - | 给大语言模型看的站点内容索引文件 |
| **GFM** | GitHub Flavored Markdown | GitHub 扩展的 Markdown 语法 |
| **hydration** | - | 水合，静态 HTML 加载后 JS 接管交互的过程 |
| **JTBD** | Jobs To Be Done | 任务完成理论，用户「雇佣」产品来完成什么任务 |
| **PLG** | Product-Led Growth | 产品驱动增长，靠产品本身获客 |
| **BYO-LLM** | Bring Your Own LLM | 用户自带大语言模型 API Key |
| **WCAG** | Web Content Accessibility Guidelines | Web 内容无障碍指南 |
| **FOIT** | Flash of Invisible Text | 不可见文本闪烁（Web Font 加载问题） |
| **LCP** | Largest Contentful Paint | 最大内容绘制，性能指标 |

---

## 9.4 参考资源

### 相关标准与规范
- [llms.txt 规范](https://llmstxt.org/)
- [MCP 协议](https://modelcontextprotocol.io/)
- [CommonMark 规范](https://commonmark.org/)
- [Schema.org TechArticle](https://schema.org/TechArticle)
- [WCAG 2.1](https://www.w3.org/TR/WCAG21/)

### 竞品参考
- [docsify](https://docsify.js.org/)
- [VitePress](https://vitepress.dev/)
- [MkDocs Material](https://squidfunk.github.io/mkdocs-material/)
- [Docusaurus](https://docusaurus.io/)
- [Astro Starlight](https://starlight.astro.build/)
- [Mintlify](https://mintlify.com/)
- [GitBook](https://www.gitbook.com/)

### 设计参考
- [Refactoring UI](https://refactoringui.com/) — 设计原则
- [Butterick's Practical Typography](https://practicaltypography.com/) — 排版
- [Material Design 3](https://m3.material.io/) — 设计系统
