# 08 · 开发路线图

---

## 总体策略

**先做内核，再长功能；先跑通，再优化；先有人用，再谈生态。**

每个阶段都必须有可用的产出，而不是等到最后才能用。

---

## Phase 0：Agent 自迭代开发环境 + 项目脚手架（~5 天）

> 本项目主要由 Code Agent 自主开发，因此 Phase 0 的第一优先级不是「脚手架」，而是搭好让 Agent 能自迭代的**环境闭环**（完整规格见 [10-agent-dev-environment.md](./10-agent-dev-environment.md)）。

### 目标
搭好 Agent 自迭代开发环境：让 Agent 有清晰目标、可机器验证、能自动获取高质量反馈并自迭代。

> **状态（2026-08-11）：✅ 主体完成** —— 环境闭环已跑通（`npm run verify` 全绿），交付清单见 `docs/agent-handoffs/PHASE-0-complete.md`。
> 遗留：视觉基线/同构快照/浏览器矩阵/Golden Master/评审 Agent 逻辑（依赖 Phase 1 代码）；npm 注册与域名（待用户决策）。

### 任务清单

#### 目标层（Spec）
- [ ] 行为规格规范：RFC 式设计 + Gherkin 验收准则（DoD 可机器验证）
- [ ] 设计 token 基准：设计令牌即视觉规范（对比度/间距/字号节奏自动合规检查）
- [ ] 规格追溯：调研报告 → 设计文档 → 实现 的链路索引

#### 验证层（Verify）
- [ ] 初始化 monorepo 结构
- [ ] 配置构建工具（纯 Node.js，不用 Vite/Rollup）
  - [ ] 构建脚本：展示层（合并 + 压缩 + gzip）与 Node 渲染内核
  - [ ] CLI 工具构建
- [ ] 配置测试框架（Vitest + Playwright）
- [ ] 视觉回归基线：多断点截图 + 像素级 diff（4 套默认模板 × 亮暗 × 桌面/移动）
- [ ] 性能预算门禁：展示层 < 25KB gzip、Node 内核 < 25KB（ADR-0002 上调，实测依赖约 24KB）、100 页构建 < 5s、搜索 < 50ms（CI 硬门禁）
- [ ] 同构快照：运行时渲染 vs SSG 渲染一致性对比测试
- [ ] 设计合规检查：WCAG 对比度、字号节奏、8pt 间距网格自动校验

#### 反馈层（Feedback）
- [ ] 所有测试/CI 输出结构化（JSON + 人类可读摘要双格式）
- [ ] 评审 Agent 配置（独立视角审查，输出 findings 清单）
- [ ] 失败截图回流机制（Agent 上下文可读图）

#### 闭环层（Loop）
- [ ] `npm run verify` 一条命令跑全部验证
- [ ] Golden Master 参考站（Dogfooding：DocLight 文档站用 DocLight 构建）
- [ ] 自迭代循环剧本：提交 → CI → 评审反馈 → 修复 的自动循环
- [ ] CI/CD 配置（GitHub Actions）
  - [ ] 自动化测试
  - [ ] 自动化构建
  - [ ] 视觉回归
  - [ ] NPM 发布

#### 契约层（Contract）
- [ ] 配置 ESLint + Prettier（或等效方案）
- [ ] 确定代码风格和目录规范
- [ ] API 契约测试（插件 API / doclight.json Schema 稳定性）
- [ ] 依赖审查 + 供应链安全

#### 文档与命名
- [ ] 写 CONTRIBUTING.md（Agent 优先：架构地图、验证命令、常见失败模式）
- [ ] 选好最终名字 + 申请域名 + 注册 npm 包名

### 交付物
- 可运行的空项目骨架 + CI 绿灯
- **Agent 自迭代闭环跑通**（提交 → 验证 → 反馈 → 修复）
- 视觉回归 + 性能预算 + 契约测试就位
- Agent 优先的开发规范文档

---

## Phase 1：Node 渲染内核 + dev server（~2 周）

> 三形态架构的第 ① 形态（见 [02](./02-architecture.md)）。渲染统一在 Node 侧，浏览器端为展示层。

### 目标
Node 渲染内核 + dev server 跑起来，实现最基本的文档浏览功能。

### 任务清单

#### Node 渲染内核
- [ ] 集成 marked.js
- [ ] GFM 支持（表格、任务列表、删除线）
- [ ] **DOMPurify sanitize（XSS 防护，强制，含安全测试用例集）**
- [ ] 自定义 renderer
  - [ ] 标题锚点注入
  - [ ] 相对链接修正
  - [ ] 图片路径修正
  - [ ] 代码块处理
  - [ ] 表格包裹容器
- [ ] Frontmatter 提取与解析
- [ ] 导航树生成（docs.json）

#### dev server（形态 ①）
- [ ] Node 原生 HTTP 服务器
- [ ] Path 路由（HTML5 history fallback）
- [ ] 文件变更监听 + SSE 推送（热重载，不刷新整页）
- [ ] 首屏直出（Node 渲染 → 返回完整 HTML）

#### 浏览器展示层
- [ ] 展示层产物（JS/CSS 内联）
- [ ] 路由系统（path + hash 双模式）
  - [ ] URL 解析与更新
  - [ ] hashchange / popstate 监听
  - [ ] 前进后退支持
  - [ ] 路由钩子（beforeEach / afterEach）
- [ ] 事件总线（插件通信用）
- [ ] 工具函数集合

#### 导航系统
- [ ] docs.json 解析
- [ ] 树形导航渲染
- [ ] 当前页面高亮
- [ ] 折叠/展开交互
- [ ] 移动端侧边栏（滑入滑出）

#### 内容区
- [ ] 已渲染 HTML 加载与注入（不渲染 Markdown）
- [ ] 页面切换过渡（淡入淡出）
- [ ] 上一页/下一页
- [ ] 骨架屏（SSG 直出时无需）

#### TOC 系统
- [ ] 标题提取
- [ ] PC 右侧导轨（hover 展开）
- [ ] 移动端底部面板
- [ ] 滚动监听（IntersectionObserver）
- [ ] 点击跳转

#### 主题系统
- [ ] CSS 变量设计令牌
- [ ] 亮色 / 暗色主题
- [ ] 主题切换按钮
- [ ] 防闪烁脚本
- [ ] 跟随系统（prefers-color-scheme）

#### 基础 UI
- [ ] 顶栏（标题、菜单按钮、主题切换）
- [ ] 回到顶部
- [ ] 阅读进度条
- [ ] 响应式布局（手机/平板/桌面）

### 交付物
- Node 渲染内核 + dev server（形态 ①）
- 浏览器展示层产物（内联 JS/CSS）
- 基本导航、TOC、主题切换
- 展示层体积 < 25KB gzip（无 marked）

### 验收标准
- `doclight dev` 一条命令启动本地文档站
- 支持亮/暗主题切换
- 移动端可用
- sanitize 通过安全测试集（script / javascript: 注入被清除）

---

## Phase 2：搜索 + 体验优化（~1.5 周）

### 目标
补上「内置搜索」这个核心差异化功能，打磨阅读体验细节。

### 任务清单

#### 搜索引擎
- [ ] 集成 MiniSearch
- [ ] 索引懒加载（首次打开搜索框才构建）
- [ ] Cmd/Ctrl + K 搜索框
  - [ ] 键盘导航（↑↓ 选择，Enter 打开，Esc 关闭）
  - [ ] 实时搜索（输入即时出结果）
  - [ ] 结果高亮
  - [ ] 路径面包屑
  - [ ] 最近搜索记录
- [ ] 中文自动检测 + FlexSearch 切换
- [ ] 搜索索引持久化（localStorage + 版本校验）

#### 代码高亮
- [ ] Prism.js 集成
- [ ] 按需加载语言包
- [ ] 暗色主题同步
- [ ] 行号（可选）

#### Mermaid
- [ ] 按需加载 mermaid.js
- [ ] 检测 mermaid 代码块自动渲染
- [ ] 主题同步

#### 体验细节
- [ ] 代码块复制按钮
- [ ] 自定义容器（:::tip / :::warning / :::danger）
- [ ] 链接 hover 预览（简单版）
- [ ] 专注模式按钮
- [ ] 字号调节（A- / A+）
- [ ] 打印样式优化
- [ ] Powered by DocLight 标记（默认开启，一行关闭）

#### 无障碍
- [ ] 键盘导航完整支持
- [ ] Focus ring 样式
- [ ] ARIA 标签
- [ ] 语义化 HTML
- [ ] `prefers-reduced-motion` 支持

### 交付物
- 内置全文搜索（零配置）
- 代码高亮 + mermaid
- 完整的阅读体验细节

### 验收标准
- 搜索响应 < 50ms（100 篇文档）
- 中文搜索可用
- 代码高亮 + 一键复制
- 所有交互元素可键盘操作

---

## Phase 3：SSG 静态导出（~1.5 周）

### 目标
补上 SEO 死穴，从「能看」升级到「能被搜到」；同时提供 bundle 便携包，兑现跨浏览器离线。这是超越 docsify 的关键一步。

### 任务清单

#### CLI 工具
- [ ] CLI 基础框架（命令解析）
- [ ] `doclight init` — 初始化项目
  - [ ] 生成 doclight.json
  - [ ] 生成示例 docs/
  - [ ] 生成 index.html

#### 开发服务器
- [ ] Node.js 原生 HTTP 服务器
- [ ] 文件变更监听（chokidar）
- [ ] SSE 推送变更通知
- [ ] 浏览器端热更新（不刷新页面，只换内容）
- [ ] Path 路由支持（HTML5 history API fallback）

#### 静态构建
- [ ] `doclight build` 命令
- [ ] 目录扫描 + 文档树生成
- [ ] 同构渲染（复用 marked renderer）
- [ ] 页面模板（HTML 骨架 + 预渲染内容）
- [ ] 完整 HTML 输出
- [ ] 静态资源复制
- [ ] 增量构建（只重建变更文件）

#### SEO 优化
- [ ] `<title>` + `<meta description>` 自动生成
- [ ] Open Graph 标签
- [ ] JSON-LD 结构化数据
- [ ] 自动生成 sitemap.xml
- [ ] 自动生成 robots.txt
- [ ] canonical URL
- [ ] 面包屑导航

#### 搜索索引预构建
- [ ] 构建时生成 search-index.json
- [ ] 运行时直接加载（不用再构建）

#### 其他生成
- [ ] `doclight preview` — 预览构建结果
- [ ] `doclight info` — 显示项目信息

#### bundle 便携包（形态 ③）
- [ ] `doclight bundle` 命令
- [ ] 页面 HTML 打包为 JSON 数据块
- [ ] 内嵌搜索索引 + llms.txt + docs.json
- [ ] 单文件产物（file:// 三引擎验证）

#### 迁移工具（前移：获客第一触点）
> 调研结论：迁移最大动因是「现有工具死了/涨价了」，传播靠逃难指南。docsify 迁移是获客第一触点，故从 Phase 5 前移至此。
- [ ] docsify → DocLight 迁移指南
- [ ] 基本自动迁移工具（docsify 目录结构 → DocLight）

#### 一键部署与分发（见 13-deployment-distribution）
- [ ] `doclight deploy` 命令（GitHub Pages / Cloudflare / Netlify 自动检测）
- [ ] OG 分享卡片图生成（每页社交预览图，Node 侧生成）
- [ ] `doclight embed` iframe 嵌入代码
- [ ] bundle 下载二维码

### 交付物
- 可用的 CLI 工具
- 一键构建静态站点（SSG）
- 一键构建 bundle 便携包
- **一键部署（deploy）+ 分发能力（OG 图 / iframe / 二维码）**
- SEO 友好的输出
- 开发服务器 + 热更新
- docsify 迁移指南 + 基本迁移工具

### 验收标准
- `doclight build` 能生成完整静态站点
- `doclight bundle` 生成的单文件在 Chromium/Firefox/WebKit 的 file:// 下可用
- `doclight deploy` 能推送到目标平台并返回可用 URL
- 每页含 OG 分享卡片图
- Lighthouse SEO 得分 100
- Lighthouse Performance 得分 95+
- 100 页构建时间 < 5s
- 开发服务器热更新 < 200ms

---

## Phase 4：AI 就绪（~1 周）

### 目标
补齐 AI 原生友好：llms.txt + 语义 frontmatter + 读取 MCP，并实现「Agent 内容空间」核心——内容写入 + 一句话接入（见 [14](./14-agent-content-space.md)）。这是拉开差异化的关键，也是产品核心应用场景的主战场。

### 任务清单

#### llms.txt
- [ ] `doclight build --llms-txt` 命令
- [ ] 智能分级（自动判断优先级）
- [ ] 站点摘要生成
- [ ] Agent 专用端点说明
- [ ] 用户自定义优先级配置
- [ ] llms-full.txt（全文版本）

#### 语义 frontmatter
- [ ] 完整的 frontmatter 字段规范
- [ ] `summary` 自动提取（首段）
- [ ] `readingTime` 自动计算
- [ ] `wordCount` 自动统计
- [ ] `headings` 大纲数据
- [ ] `ai.*` 增强字段支持

#### docs.json 增强
- [ ] 每篇文档的结构化元数据
- [ ] 标签、分类、难度
- [ ] 前置/后续阅读关系
- [ ] 标题大纲

#### MCP Server
- [ ] MCP 协议基础实现
- [ ] 工具实现：
  - [ ] `search_docs` — 全文搜索
  - [ ] `read_doc` — 读取文档
  - [ ] `list_docs` — 列出文档树
  - [ ] `get_site_summary` — 站点摘要
  - [ ] `get_outline` — 文档大纲
  - [ ] `find_examples` — 代码示例搜索
- [ ] well-known 发现端点
- [ ] 独立服务模式（HTTP）
- [ ] 插件模式（集成到开发服务器）

#### 内容写入与接入体验（Agent 内容空间核心，见 14）
- [ ] `doclight publish` CLI（发布到 local / git / space）
- [ ] `doclight-publish` Skill（SKILL.md）
- [ ] Agent 接入指南（可执行，含魔法咒语模板）
- [ ] `/publish` 斜杠命令
- [ ] `doclight space init / switch / status`
- [ ] Harness 课程站 dogfood 验证

### 交付物
- llms.txt 自动生成
- 语义化 frontmatter 支持
- 可用的 MCP Server（读取端）
- 内容写入通道（publish CLI + Skill + 接入指南）
- 完整的 AI 集成文档

### 验收标准
- `doclight build` 自动生成 llms.txt
- MCP Server 所有工具正常工作
- 主流 AI Agent（Claude Desktop 等）能连接和使用
- 文档结构能被 AI 清晰理解
- **复制「魔法咒语」给 Agent 后能自动完成接入并发布内容（dogfood 验证）**
- `doclight publish` 能发布到各 provider 并返回 URL

---

## Phase 5：插件系统 + 生态（持续迭代）

### 目标
从「产品」到「平台」，建立插件生态。

### 任务清单

#### 插件系统内核
- [ ] 插件管理器
- [ ] 完整的钩子系统（8 个钩子）
- [ ] 插槽系统（10+ 插槽）
- [ ] 插件配置机制
- [ ] 插件热重载（开发模式）
- [ ] 插件卸载 + 清理

#### 官方插件
- [ ] `@doclight/plugin-mermaid`（从内置移到插件）
- [ ] `@doclight/plugin-giscus` — Giscus 评论
- [ ] `@doclight/plugin-plausible` — Plausible 统计
- [ ] `@doclight/plugin-pwa` — PWA 支持
- [ ] `@doclight/plugin-ai-chat` — BYO-LLM 问答
- [ ] `@doclight/plugin-rss` — RSS 订阅

#### 插件开发体验
- [ ] 插件脚手架（`doclight plugin new`）
- [ ] 完整的插件 API 文档
- [ ] 插件开发教程
- [ ] 插件测试模板

#### 主题生态
- [ ] 主题包规范
- [ ] 3+ 官方主题（默认、暗色、手写风等）
- [ ] 主题市场（文档站展示）

#### 迁移工具
- [ ] docsify → DocLight 迁移指南
- [ ] MkDocs → DocLight 迁移指南
- [ ] GitBook → DocLight 迁移指南
- [ ] 自动迁移工具（基本的）

### 交付物
- 稳定的插件 API
- 6+ 官方插件
- 3+ 官方主题
- 插件开发文档和教程
- 迁移指南

---

## 时间线总览

| 阶段 | 时间 | 里程碑 | 核心产出 |
|---|---|---|---|
| Phase 0 | 5 天 | 项目启动 | Agent 自迭代环境 + 基础设施 + 规范 |
| Phase 1 | 2 周 | M1 - 内核可用 | Node 渲染内核 + dev server + 展示层 |
| Phase 2 | 1.5 周 | M2 - 体验完善 | 内置搜索 + 阅读体验 |
| Phase 3 | 1.5 周 | M3 - SEO 就绪 | SSG + bundle + 一键部署 + docsify 迁移工具 |
| Phase 4 | 1 周 | M4 - AI 原生 | llms.txt + MCP |
| Phase 5 | 持续 | v1.0 | 插件系统 + 生态 |

**总计**：约 6-7 周到 v0.4（AI 就绪），v1.0 视社区反馈而定。

---

## 风险与应对

| 风险 | 影响 | 概率 | 应对方案 |
|---|---|---|---|
| marked.js 扩展性不足 | 中 | 低 | Phase 1 先验证；不够再换 markdown-it（+16KB） |
| 中文搜索质量不达标 | 高 | 中 | FlexSearch 作备选；必要时集成更专业的中文分词 |
| XSS 安全漏洞 | 高 | 中 | DOMPurify 强制 sanitize + 恶意输入回归测试集（CI 常驻） |
| 三形态产物不一致 | 中 | 低 | 渲染唯一在 Node 内核；快照测试保证三形态输出一致 |
| 插件生态起不来 | 高 | 高 | 先把最常用功能内置；官方出 6+ 插件打底；降低开发门槛 |
| 性能超出体积预算 | 中 | 中 | 严格监控；按需加载；持续优化 |
| 命名冲突 / 域名不可用 | 低 | 中 | Phase 0 先调研好备选名 |
| 维护精力不足 | 高 | 中 | 核心做小做稳；吸引社区贡献者；不追求大而全 |
| 默认设计平庸（开箱不惊艳） | 高 | 中 | 4 套设计语言 + 视觉回归硬门禁；Agent 多轮自迭代打磨 |
| Agent 自迭代退化（改动越改越差） | 高 | 中 | Golden Master 基线 + 像素级 diff + 评审 Agent 独立把关 |
| 反馈不可被机器消费（Agent 无法自修） | 高 | 低 | 所有错误/CI 输出结构化 JSON；失败截图回流 |

---

## 成功指标

### v0.4（Phase 4 完成）

| 指标 | 目标 |
|---|---|
| 展示层体积 | < 25KB gzip（无 marked，渲染在 Node 侧） |
| 首屏加载（SSG） | LCP < 500ms（3G, CDN） |
| 搜索响应 | < 50ms（100 篇） |
| 构建速度 | 100 页 < 5s |
| Lighthouse 总分 | 95+ |
| 零配置可用 | ✅ 三形态（dev / SSG / bundle） |
| MCP 工具数 | 6+ |
| 视觉回归 | 4 模板 × 亮暗 × 桌面/移动 全覆盖，零回归 |
| 默认模板 | 4 套完整设计语言 + 主题预览对比页 |
| 安全 | sanitize 安全测试集全绿，零 XSS 漏洞 |
| 浏览器矩阵 | Chromium/Firefox/WebKit × 三形态产物全通过 |
| 一键部署 | `doclight deploy` 推送到目标平台并返回可用 URL |
| 分发能力 | OG 卡片图 / iframe 嵌入 / bundle 二维码全可用 |

### v1.0（生态就绪）

| 指标 | 目标 |
|---|---|
| 官方插件 | 6+ |
| 官方主题 | 3+ |
| 测试覆盖率 | > 80% |
| 文档完整性 | 全功能有文档 + 示例 |
| 迁移指南 | 3+（docsify/MkDocs/GitBook） |
