# 文档站工具市场调研报告（2026-08）

> 调研时间：2026-08-11
> 调研渠道：Agent Reach（Exa 语义搜索、Jina Reader、Twitter/X、Reddit、GitHub CLI）
> 分析框架：PSP（人物-场景-问题）+ 竞品 + AI 机会
> 调研发起：Harness 双课程文档站产品化验证

---

## 1. 执行摘要

一句话结论：**自建的单文件纯前端 Markdown 文档站具备真实但窄化的产品化窗口——不是再做一个"轻量 Docusaurus"，而是做"AI 时代零构建、秒开、离线可用、自带搜索、默认好看"的文档站，填补 Mintlify $0→$300 定价悬崖留下的中小团队空档。**

核心数字：Mintlify 2026-07 承载站流量中 **66% 来自 AI agent**（月 2.13 亿次 agent 请求 vs 1.05 亿人类访问）；MkDocs 2.0 破坏性变更引发 r/Python 489 score 恐慌帖；Docusaurus 大仓库构建需 3 小时（#9754）；GitBook 涨价致用户月费 $16→$109、自托管替代帖 80 score；**41% 无正式文档团队的组织一个 AI 功能未上线**；84% 开发者已在用 AI 工具。

关键建议：**做，但先补上你现有方案的最大短板——纯客户端渲染的 SEO 死穴（docsify 同款问题），再以"单文件零构建 + 本地搜索 + MCP/llms.txt 就绪"三位一体做差异化，切入开发者个人/小团队 + 中文课程站两个细分。** 商业化以"开源免费 + 扁平定价托管版"为主，坚决不做 AI 计量计费。

---

## 2. 人物分析（People）

### 2.1 核心用户画像（Persona）

| Persona | 描述 | 代表证据 |
|---|---|---|
| **P1 个人开发者 / 开源维护者** | "只想 serve ./docs 里的 Markdown，别逼我学 React"；预算 $0；看重快、简单、离线可看 | @jamonholmgren（21 likes）；Bus Pirate 弃 Docusaurus 转 Hugo（27 likes） |
| **P2 技术写作者 / 文档工程师** | 非开发者，被 docs-as-code 的 Markdown 方言、文件夹结构、CI/CD 折磨；希望"编辑即发布" | r/technicalwriting 迁移帖楼主："formatting Markdown and managing the Docusaurus folder structure can be difficult for non-developers" |
| **P3 自托管 / homelab 爱好者** | 数据自主、离线、无云依赖；被 GitBook 涨价和 docsify 无 SEO 劝退 | r/selfhosted 80 score 帖；"This setup ain't got no SEO juice at all" |
| **P4 小团队 / 创业公司（2-15 人）** | 预算敏感（$50-150/月封顶），被 Mintlify $0→$300 悬崖挡在门外；要文档即代码、Git 版本控制 | r/KnowledgeBaseSoftware："Takes maybe 30 minutes to set up, costs us nothing" |
| **P5 受监管组织 / 企业** | 要 SSO、审计、自托管、隐私合规；51% 担心数据隐私、36% 合规 | State of Docs 2026；Mintlify 安全事件后信任受损 |

### 2.2 用户分层

- **个人开发者（量最大，ARPU≈0）**：P1+P3 的融合体，是开源引流和口碑裂变的主力，付费意愿最低。
- **独立开发者 / 微创业（$0-50/月）**：愿意为省时间付小额，最恨计量计费。
- **小团队（$50-300/月）**：付得起钱但卡在 Mintlify 定价悬崖和 GitBook 飞涨之间，是最真实的可付费客群。
- **企业 / 受监管（$300+/月，需 Enterprise）**：需要 SSO/SOC2/自托管，独立小工具难以进入，但可做"开源版引流 + 企业版变现"。

### 2.3 决策链路

- **谁选工具**：docs-as-code 场景由**开发者主导**（选型 = 开发者的事，GitHub 星数/issue 是核心判据，见 commitlint#3905"Used by 141 vs 20.2k"）；无技术团队的组织由**技术写作者/内容经理**选（倾向 Notion/语雀/GitBook 类可视化平台）。
- **谁买单**：个人自掏腰包；团队由 CTO/工程负责人批预算（$300/月 就是个人/小团队的心理红线）；企业走采购流程（SSO/SOC2/法务）。
- **谁使用**：技术写作者写、开发者查、支持团队答、产品经理读——多角色共用，所以"非开发者可维护"是刚需。
- **谁迁移、何时迁移**：见 3.2 痛点触发点；迁移由**上游事件**（停更/涨价/坏版本）驱动，而非主动求新。

---

## 3. 场景分析（Scenarios）

### 3.1 核心使用场景 TOP 5（按调研出现频次）

1. **项目/产品文档直出**（"serve ./docs 即可"）——跨所有渠道频次最高（jamonholmgren、MkDocs Collapse 帖、多篇 SSG 对比）。
2. **API 文档 / 开发者门户**——ReadMe/Mintlify/Kapa 主战场；GitBook OpenAPI"覆盖不合并"痛点集中于此（dev.to post-mortem）。
3. **内部知识库 / 自托管 wiki**——r/selfhosted 与 r/KnowledgeBaseSoftware 主场景；"保持文档有用且更新"是最大抱怨。
4. **课程 / 教程 / 学习资料站**——本次调研无直接竞品覆盖，但 commitlint、asdf-vm、freeplane 等开源项目文档均为教程型内容；**与发起方现有 Harness 双课程站场景直接吻合，是相对空白的细分**。
5. **对外帮助中心 / FAQ / 支持文档**——GitHub Docs Copilot Search、Biel/Kapa 的工单拦截场景（Mapbox 30% 工单拦截、Monday 10x 互动）。

### 3.2 痛点触发点（驱动换工具的事件）

- **上游治理崩溃**：MkDocs 2.0 破坏性变更（无迁移路径、社区无法报 bug）→ r/Python 489 score；GitBook 疑停更（#1808，54👍/108 评论）。
- **定价飞涨 / 免费转付费**：GitBook $16→$109/月、"custom URLs 需近 $500/月"；ReadMe $79→$349（+342%）。
- **性能崩塌**：Docusaurus 大仓库构建 3 小时（#9754）、bundle size 随路由膨胀（#7256）；mkdocs-material 导航慢 10 倍（#6188）。
- **工具坏了没人修**：docsify 无 SSG/SEO 多年无进展（#136/#761/discussions#1581，Google 官方确认不索引 hash 路由）；mkdocs serve 热重载失效（#8478，77👍）。
- **安全事件**：Mintlify 供应链漏洞（HN 1167 分）、2024 GitHub token 泄露 → 客户信任崩塌。
- **AI agent 消费需求**：Mintlify 66% agent 流量 → "没有 MCP/llms.txt 的文档站被 AI 生态忽略"成为新触发点。

### 3.3 替代方案（不买专门工具时人们怎么做）

- **Notion / 语雀 / 飞书 / Confluence**：可视化、协同好，但内容锁平台、难导出、非开发者友好、定价飞涨（GitBook 同型问题）。
- **Markdown + Git + CI/CD**（GitHub Pages + Actions）：最普及的 docs-as-code 替代，但"写作等 PR/发版"慢（r/technicalwriting 楼主原话）、需要 CI 基础设施（"Open source is free, if your time has no value"）。
- **Word / 单文件 Markdown 直发**：零工具成本，但无导航/搜索/版本，只能算"没有文档站"。
- **SaaS 聊天式平台**（Kapa/Biel 嵌入现有站）：是"叠加层"而非替代，且 41% 无文档团队的组织根本没上线任何 AI。
- **核心洞察**：没有工具能同时满足"零配置 + 快 + 搜索好 + SEO 好 + 可迁移 + AI 就绪"，这正是空档所在。

---

## 4. 问题分析（Problems）

### 4.1 JTBD 优先级表（用户"雇佣"这个工具干什么）

| 排序 | Job to Be Done | 重要性 | 现有工具满足程度 | 证据 |
|---|---|---|---|---|
| 1 | 把 Markdown 快速变成可读文档站 | 极高 | 中（都满足但都"重"） | jamonholmgren"只想 serve ./docs" |
| 2 | 秒开 / 离线可看 / 性能好 | 极高 | 低 | Docusaurus 3 小时构建、MkDocs O(n²) 导航 |
| 3 | 内置好用且免费的搜索 | 高 | 低（普遍要接 Algolia/付费） | Docusaurus #776（72👍）、mkdocs-material #6307 |
| 4 | 静态输出 / SEO / 被检索 | 高 | 低（docsify 类完全失效） | docsify #136、Google 不索引 hash 路由 |
| 5 | 低维护成本 / 零配置 / 非开发者可维护 | 高 | 低 | "spent three hours configuring Webpack" |
| 6 | 内容可迁移 / 反锁定 | 中高 | 低（GitBook 导出 lossy） | dev.to post-mortem、Astro from-gitbook 指南 |
| 7 | AI 就绪（MCP / llms.txt / 可被 agent 消费） | 中（上升最快） | 极低（仅头部 SaaS 有） | "AI chat/MCP/llms.txt 是 table stakes" |
| 8 | 多版本 / i18n | 中 | 中低 | mkdocs #193（104👍）、VitePress 无内置 versioning |
| 9 | 版本切换器 / 认证 SSO | 低 | 低 | "hardest thing... is to have a version switcher" |

### 4.2 现有工具共同痛点排行榜（按严重程度）

1. **配置复杂 / 框架臃肿（Docusaurus/React 类）**——多源反复出现："docusaurus too huge"、"bootstrapping... full Next.js project"、Webpack/npm 依赖修复噩梦。
2. **构建 / 运行慢（Docusaurus 最严重）**——官方承认 long-standing issue（#4765，41👍/131 评论）；大站分钟级构建；Bus Pirate 官方点名弃用。
3. **搜索弱 / 缺本地搜索（横跨三大阵营）**——Lunr.js 多年未换代（#6307）、docsify 搜索插件难配且结果带 Markdown 语法污染（#1369）。
4. **SEO 失效 / 无法生成纯静态产物（docsify 最严重）**——浏览器端渲染 = 空壳页面，Google 不收录 hash 路由；freeplane："makes the site almost useless"。
5. **定价飞涨 / 厂商锁定 / 维护停滞（GitBook 最典型）**——$16→$109、导出 lossy、Trustpilot 1.9/5、73% 一星；#1808"还活着吗"54👍。
6. **写作体验差 / Markdown 方言不兼容**——RST"最差数据格式"（+58）；mkdocs-material 方言不兼容 CommonMark；PM 想"完全避开 Markdown"。
7. **内容与产品脱节 / 难以同步更新**——State of Docs 2026：30% 认为这是第一大挑战，接近第二名两倍。
8. **AI 集成缺失 / 生态不成熟**——Docusaurus/VitePress 社区 AI 插件几乎全是 0-3 星、未上 npm。

### 4.3 非功能需求排序

1. **性能**（构建/热重载/首屏都快）——Bus Pirate 直接点名 "super fast"。
2. **零配置 / 低学习成本**——"Zero Config"是 2025-2026 最热卖点词。
3. **部署简单**（静态托管、无服务器、GitHub Pages）——docsify #136 与 Docusaurus #3825 的共同诉求。
4. **SEO / 可被爬取**（含 AI 爬虫）——docsify 被排除的头号理由。
5. **定制化自由度**（默认好看 + 可定制、少写 CSS）——Docusaurus #2961 Tailwind 诉求（163👍）。
6. **可迁移性 / 反锁定**（干净导出 Markdown）。
7. **安全 / 隐私**（自托管、数据自主）——Mintlify 事件后权重上升。
8. **AI 兼容**（llms.txt / MCP / 可被 agent 消费）——新兴但上升极快。

---

## 5. 竞品概览

| 工具 | 定位 | 目标用户 | 核心优势 | 致命短板 | 价格/开源 | 热度指标 |
|---|---|---|---|---|---|---|
| **Docusaurus** | React 静态文档框架 | 中大团队/企业 | 生态最大、功能全、官方文档最佳 | 构建慢、React 栈重、配置复杂 | 开源 | 60k+★；#4765 41👍/131 评论 |
| **MkDocs / Material** | Python 静态文档生成器 | Python 生态/技术团队 | 上手快、Material 主题好看 | 治理风险（2.0 破坏性变更）、Material 订阅化、热重载易坏、方言不兼容 | 开源 | #8478 77👍；r/Python 489 score |
| **VitePress** | Vue 生态静态文档框架 | Vue 团队/中小项目 | 轻、快、Vite 生态 | 无内置 versioning、AI 插件几乎无成熟 | 开源 | 生态同 Vite；Ask AI 走 Algolia |
| **Hugo Docs** | Go 静态生成器 | 大站点/性能敏感 | 极快、单二进制、扩展性好 | 无版本化、定制需模板功底 | 开源 | Bus Pirate 迁移目标 |
| **Astro / Starlight** | 内容优先 SSG | 内容站/想脱离 React 团队 | "现代轻量 Docusaurus 替代"、15 份迁移指南 | 仍是构建链、需 Node 环境 | 开源 | MkDocs→Starlight 公认同品类最易迁移 |
| **docsify** | 运行时渲染单页文档 | 极简个人站 | 零构建、纯静态托管即跑 | **无 SEO（空壳页面）、无 SSG、无内置搜索、样式老旧** | 开源 | #136 37👍/53 评论；freeplane 弃用 |
| **Fumadocs / Nextra** | React 文档框架 | 想要定制自由的 React 团队 | 现代、可定制 | 仍是 React 栈、需构建 | 开源 | Fumadocs 12,855★ |
| **GitBook** | 平台型 docs-as-code | 团队/初创 | 编辑体验、协同、AI 功能全（Agent/MCP 分析） | 定价飞涨、导出 lossy、维护停滞疑虑、OpenAPI 覆盖不合并 | 免费→$249/site/月 | #1808 54👍/108 评论；Trustpilot 1.9/5 |
| **Mintlify** | AI 原生文档平台（知识基础设施） | 开发者优先的成长型公司 | AI 原生、MCP 事实标准、设计极佳、Agent Analytics | **$0→$300 定价悬崖、AI credits 计量失控、安全/稳定事件、无中间档** | Hobby 免费→Pro $250-300/月 | ARR $21.4M、NRR 150%、2 万+ 公司；HN 1167 安全帖 |
| **ReadMe** | API 文档 + 开发者门户 | API 产品团队 | Try-It 交互、OpenAPI 导入、AI Linter/Audit | 加购膨胀（Ask AI +$150、日志 +$100）、Enterprise $3000 | $0→$3000/月 | G2 4.6-4.7 |
| **Algolia DocSearch / Ask AI** | 搜索 + 答案层（叠加物） | 所有文档站 | 免费、BYO LLM、有真实案例 | 是"叠加层"非工具、crawler 捡死链、索引延迟 | Ask AI 对 DocSearch 免费 | 9,000+ 项目；AppSignal 案例 |
| **Scribe**（相邻赛道） | 流程/操作录制文档 | 企业运营/培训 | 录制即文档、AI 自动脱敏 | 非开发者文档、数据基础设施属性未验证 | 席位制 | 估值 $1.3B、5M+ 用户 |
| **新玩家集群**（Docsio/Velu/docs.page/Duitar/SaturnDocs/Devscribe） | "更便宜 + 无锁定 + MCP/llms.txt" 的 Mintlify 平替 | 2-15 人小团队 | 低价（$49-60/月）、不计量、开源 | 生态弱、同质化严重、多为极早期 | $0-60/月 或开源 | docs.page 666★；llms-txt 2557★ |

---

## 6. 关键发现

### 6.1 机会点

1. **零构建 / 单文件 / 秒开 / 离线**（置信度：**高**）——"Zero Config"是当下最热卖点，jamonholmgren/Bus Pirate 的"简单 + 快"诉求是最高权重证据；docsify 证明这个方向有大量需求，但其"无 SEO"死穴恰好是你可以修复的（输出静态 HTML 产物）。
2. **Mintlify $0→$300 定价悬崖空档**（置信度：**高**）——多家新玩家（Velu $49、Docsio $60、docs.page 免费）已验证此切入路径；$50-150/月是中小文档站真实预算区间。
3. **MCP / llms.txt AI 就绪**（置信度：**中高**）——25% 团队计划投资 MCP servers，是增速最快的新需求；Mintlify 66% agent 流量证明"被 AI 消费"已是文档价值核心；且这是低成本高差异点（开放标准，几周可实现）。
4. **中文市场 + 课程/教程站细分**（置信度：**中**）——本次调研（全英文渠道）未发现针对中文开发者/课程站的同型轻量产品；发起方已有双课程站现成内容与设计资产，语雀/飞书无法满足"极客 + 可离线 + 代码高亮"需求。
5. **"残差内容" + 写作辅助闭环**（置信度：**中**）——AI 时代文档真价值在"源码查不到的约定/默认值/边界"；"答不上来的问题进写作 backlog"（Biel 模式）是付费意愿最强的需求组合之一。

### 6.2 风险点

1. **红海化 + 低价通缩**（置信度：**高**）——2024-2026 新玩家扎堆且全打低价，MCP/llms.txt 是开放标准、技术壁垒低，差异化难维持（HN 有人 1 天搭出 Mintlify 风格 docs）。
2. **现有方案本身的 SEO 死穴**（置信度：**高**）——单文件纯前端渲染 = docsify 同款"空壳页面"问题；若不先做静态 HTML 产物/SSG，产品会被市场直接归入"无 SEO juice"一档，这是**上线的必要条件**，不是加分项。
3. **变现困难 / 开发者不付费**（置信度：**中高**）——41% 无正式文档团队的组织不会为任何 AI 付费；开发者个人客群 ARPU≈0；纯开源无商业模式将沦为一个"漂亮的 side project"。
4. **大玩家反扑**（置信度：**高**）——GitBook/Mintlify/ReadMe/Confluence 都在补 AI+MCP+llms.txt；Docusaurus v3.9 已接 Algolia Ask AI，封掉"开源无 AI"短板。
5. **AI 功能做不好反而伤品牌**（置信度：**中高**）——数据表明 AI 问答同质化严重（"美化版搜索框"口碑污染）、无引用/幻觉损害信任、"Agent 根本不读文档"的实验（token +20-30% 无收益）——AI 不能作为核心卖点，只能作为可选附加。

### 6.3 反直觉发现

1. **"AI 让文档更好"与"AI Agent 根本不读文档"同时为真**——67% 团队认为 AI 改善文档（findability 提升），但对照实验显示对源码可读的库，llms.txt/手册反而拖慢 agent（token +20-30%、成功率无增益）。**含义：堆 AI 问答不解决"被消费"问题，文档价值在"残差内容"（约定/默认值/单位）。**
2. **迁移的最大动因不是"想要更多"，而是"现有工具死了/涨价了"**——MkDocs 2.0 治理危机、GitBook 疑停更/涨价、docsify 多年不修 SEO，都是"逃离"而非"投奔"；新工具的传播要顺着"逃难指南"（参考 Astro 15 份 from-X 迁移指南）做内容。
3. **"简单"打败"功能全"**——MkDocs 生态最全、Docusaurus 功能最全，但用户因"过度设计"出走（催生一整批 zero-config 新项目）；功能缺失（版本化）反而不是出走主因。
4. **41% 无文档团队的组织一个 AI 功能都没上**——AI 不是"必须有"，市场仍在早期，DIY 生态（Inkeep/Kubeflow docs-agent）正在把基础聊天机器人商品化，单独收费空间极小。

---

## 7. 建议

**结论：建议做，但按"修复 SEO → 轻量直出 → AI 就绪"三步走，以开源 + 扁平定价托管双轨推进。**

### 7.1 切什么细分场景（为什么）

- **主战场**：个人开发者 + 开源项目的轻量文档站（对应 P1/P3），以及 2-15 人小团队的 docs-as-code（对应 P4）。理由：这是"Zero Config + 快 + 免费"诉求最集中的客群，也是 Mintlify 定价悬崖最直接的受害者，且传播路径清晰（GitHub/Reddit/HN 逃难指南式内容）。
- **侧翼细分**：中文课程/教程站（契合发起方现有 Harness 双课程资产 + teal 极简设计）。理由：本次全英文调研中无同型竞品，中文开发者市场对"可离线、秒开、代码高亮、移动端友好"的课程站存在真实空档。
- **不做**：企业/受监管市场（SSO/SOC2/合规门槛高，独立小工具无资源进入）。

### 7.2 打什么差异化（3 个核心差异化点）

1. **真·零构建 + 双击即看 + 静态 SEO 产物**——单 HTML 文件运行（docsify 的爽点）**且**可选导出为静态 HTML 页面目录（docsify 永远做不到的 SEO 修复）；"不用 Node、不用 npm、不用 Webpack"是最高频的原话诉求，这是与 Docusaurus/MkDocs/VitePress 的全部对手的区隔。
2. **免费内置本地全文搜索，零配置、不接 Algolia**——直接回应三大工具的共同痛点（Docusaurus #776 72👍）；搜索是所有高频需求里满足度最差的，做对了就是最可感知的差异。
3. **AI 就绪但不绑架**：一行配置生成 llms.txt / 可选 MCP server（对标 Mintlify 的 `/mcp` + `/.well-known/mcp`），**免费**；AI 问答作为可选附加（BYO LLM Key、无计量、无平台抽成），直接对冲行业最大差评点"计量计费账单惊雷"（$100 订阅跑出 $3,000 账单）。
   - 为什么用户会为此迁移：这是"Docusaurus 的功能 + 零配置"这一被反复说出口的理想状态的最近实现，且没有 GitBook 的锁定与 Mintlify 的定价悬崖。

### 7.3 MVP 做什么（功能清单，按优先级）

1. 单 HTML 文件零构建运行 + 静态 HTML 产物导出（SSG 模式，修复 SEO——**必须最先做**）。
2. docs.json + 多文件 md 的内容模型（现有资产直接复用）。
3. 树形导航 + PC 右侧导轨 hover 展开（少数派式）+ 移动端弹出面板（已有）。
4. 全文本地搜索（**零配置内置，不依赖外部服务**）。
5. 深浅主题 + teal 单强调色极简设计 + mermaid + 代码高亮（已有）。
6. 多版本支持（回应 mkdocs #193 的 104👍 诉求，最简单实现是版本目录切换）。
7. llms.txt / llms-full.txt 自动生成（一行配置）。
8. 可选 MCP server（阅读检索工具，参考 docs.page/Mintlify 实现）。
9. 可选 BYO-LLM 问答组件（带来源引用、有兜底话术、答不出进写作 backlog）。

**MVP 明确不做**：AI Agent 写作、计量计费、SSO/团队协作、SaaS 托管（首版仅静态部署到 GitHub Pages/任意托管）。

### 7.4 为什么现在是时机

- AI 消费文档成为主流：Mintlify 66% agent 流量（2026-07），"被 agent 引用"是文档新价值锚点。
- llms.txt（Jeremy Howard 推动）与 MCP 尚未完全标准化，先做者有机会成为默认基础设施。
- 大工具集体失位：Docusaurus 慢且重、MkDocs 治理危机（2026 最新）、GitBook 停滞、Mintlify 定价悬崖——四个对手同时露出空档，历史上少见。
- docsify 多年不修 SEO（2019 提案至今无进展）留下的"轻量 + 可用"空档长期无人填。

### 7.5 可能的商业模式

- **双轨制（推荐）**：核心开源（Apache-2.0，类似 docs.page/Fumadocs），**扁平定价托管版**（$49-99/月封顶，含 AI credits 不限量或透明计价）——直接用"不计量"对冲 Mintlify 最大差评点，参考 Velu $49 / Docsio $60 验证过的区间。
- 企业版（$300+/月）：SSO、审计日志、私有化部署、MCP 分析面板——但这是第二步，非 MVP。
- 或 **纯开源引流**：定位为个人作品集 / 开源影响力项目 / 课程配套工具（与发起方 Harness 课程站互为放大器），不追求直接变现。
- **明确不采用**：AI 计量 credits（行业差评集中地）、每座位收费（GitBook 被批"惊喜账单"）。

### 7.6 如果不做，资源投向哪里

若最终判断不商业化，最理性的用法是：**把现有单文件方案固化为"课程站的公开演示 + 开源示例"**，作为 Harness 课程生态的一部分建立品牌，而非单独产品线。

---

## 8. 附录（去重后信息来源）

### Twitter / GitHub

- https://x.com/i/status/1929891214540579005
- https://x.com/i/status/1705794578920653233
- https://github.com/facebook/docusaurus/issues/4765
- https://github.com/facebook/docusaurus/issues/776
- https://github.com/facebook/docusaurus/issues/3825
- https://github.com/facebook/docusaurus/issues/2961
- https://github.com/squidfunk/mkdocs-material/issues/8478
- https://github.com/squidfunk/mkdocs-material/issues/6188
- https://github.com/squidfunk/mkdocs-material/pull/2213
- https://github.com/docsifyjs/docsify/issues/136
- https://github.com/docsifyjs/docsify/issues/231
- https://github.com/docsifyjs/docsify/issues/761
- https://github.com/docsifyjs/docsify/discussions/1581
- https://github.com/GitbookIO/gitbook/issues/1808
- https://github.com/0xfirechain/new-docs/blob/main/MIGRATION.md
- https://github.com/braidpool/braidpool/issues/164
- https://github.com/freeplane/docs/discussions/78
- https://github.com/conventional-changelog/commitlint/issues/3905
- https://github.com/bundlewatch/bundlewatch/issues/481
- https://github.com/chartjs/Chart.js/issues/7267
- https://github.com/prysmaticlabs/prysm/issues/4301

### Reddit

- https://www.reddit.com/r/Python/comments/1s0gfyb/the_slow_collapse_of_mkdocs/
- https://www.reddit.com/r/Python/comments/1juie2r/sphinx_vs_mkdocs_vs_your_favorite_pythonic_doc/
- https://www.reddit.com/r/KnowledgeBaseSoftware/comments/1s8l7ql/gitbooks_new_pricing_killed_it_for_us_what_gitbook/
- https://www.reddit.com/r/selfhosted/comments/1kmhtpc/looking_for_a_good_gitbook_alternative_in_2025/
- https://www.reddit.com/r/selfhosted/comments/1ryri2y/wonderfully_simple_way_to_document_your_homelab/
- https://www.reddit.com/r/technicalwriting/comments/1u2ugxo/looking_for_an_opensource_selfhosted_allinone_docs/
- https://www.reddit.com/r/technicalwriting/comments/1mqdqzj/the_right_tools_for_tech_writing_rant/
- https://www.reddit.com/r/technicalwriting/comments/1rxp7xs/results_are_in_state_of_docs_report_2026/
- https://www.reddit.com/r/technicalwriting/comments/1su9ccu/
- https://www.reddit.com/r/technicalwriting/comments/1th99f4/
- https://www.reddit.com/r/technicalwriting/comments/1us6eqe/
- https://www.reddit.com/r/webdev/comments/1tk81oh/what_user_documentation_software_to_use/
- https://www.reddit.com/r/webdev/comments/1et6vjd/user_docs_from_scratch_or_use_something_like/
- https://www.reddit.com/r/javascript/comments/1r3hicg/i_built_a_lightweight_js_markdown_documentation/

### 技术博客 / 对比文

- https://dev.to/mjkloski/we-used-gitbook-for-two-years-heres-the-honest-post-mortem-of-why-we-left-52fm
- https://www.youngju.dev/blog/culture/2026-05-14-static-site-generators-2026-hugo-eleventy-astro-mkdocs-docusaurus-mintlify-starlight-comparison-deep-dive.en
- https://docsio.co/blog/docsify
- https://docsio.co/blog/readme-pricing
- https://www.besthub.dev/articles/how-we-replaced-gitbook-with-docusaurus-for-scalable-documentation-2f12810738a9
- https://www.devtoolreviews.com/reviews/mintlify-vs-gitbook-vs-docusaurus-vs-readme-2026
- https://blog.markdowntools.com/posts/mkdocs-vs-docusaurus-vs-gitbook

### AI 功能现状

- https://www.gitbook.com/features/ai
- https://www.gitbook.com/blog/gitbook-vs-mintlify
- https://www.mintlify.com/docs/ai-native
- https://www.mintlify.com/docs/credits
- https://docs.readme.com/main/docs/ai-overview
- https://www.algolia.com/blog/product/ask-ai-smarter-search-for-docs-and-beyond
- https://blog.appsignal.com/2026/04/24/from-keyword-search-to-ask-ai-how-we-upgraded-appsignals-docs-experience.html
- https://docusaurus.io/docs/search
- https://github.com/vuejs/vitepress/blob/main/docs/en/reference/default-theme-search.md
- https://github.com/vuejs/vitepress/issues/5124
- https://news.ycombinator.com/item?id=46317098
- https://dev.to/mixcode/nobody-reads-my-docs-anymore-not-even-the-ai-agents-dec
- https://passo.uno/ai-wikis-docs-teather-as-a-service/
- https://documentation.ai/blog/mintlify-vs-gitbook

### AI 需求与付费意愿

- https://www.stateofdocs.com/2026/ai-and-documentation-consumption
- https://www.jamdesk.com/blog/the-definitive-api-documentation-pricing-comparison-2026-2
- https://biel.ai/blog/how-much-does-an-ai-docs-chatbot-cost
- https://news.ycombinator.com/item?id=44330107
- https://news.ycombinator.com/item?id=47134263
- https://recatools.com/ai-directory/kapa-ai/
- https://ferndesk.com/blog/mintlify-review
- https://github.blog/changelog/2025-06-30-copilot-search-now-on-github-docs/

### AI 原生新玩家

- https://www.mintlify.com/blog/series-b
- https://sacra.com/c/mintlify/
- https://sacra.com/c/scribe/
- https://techcrunch.com/2025/11/10/scribe-hits-1-3b-valuation-as-it-moves-to-show-where-ai-will-actually-pay-off/
- https://docsio.co/
- https://checkthat.ai/brands/mintlify/reviews
- https://news.ycombinator.com/item?id=46606423
- https://github.com/AnswerDotAI/llms-txt
- https://futurepicker.com/en/gitbook-vs-mintlify-vs-readme-vs-docusaurus-2026/
- https://tech.eu/2025/04/22/tella-raises-2-1m-for-ai-powered-video-creation/
- https://docs.dev
- https://www.vcbacked.co/company/dev-docs
