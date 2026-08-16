# 机会调研报告：AI Agent 内容展示基础设施（乐观版）

> 调研时间：2026-08-12
> 调研框架：PSP（人物-场景-问题）
> 调研渠道：Agent Reach（Exa + Jina Reader + GitHub CLI + OpenCLI Twitter/Reddit/HackerNews）
> 模型：deepseek-v4-flash（三路并行调研 + 综合）
> **机会评分：7.5/10**（文档站优先，演示次之）
> 上游：`research-report.md`、`research-report-agent-content-demand-validation.md`（批判性裁决 3/10——本文为乐观版，需并排对比）

---

## 0. 执行摘要

三方渠道交叉验证确认：**Agent 以 Markdown 为主要内容输出格式已成共识**，用户（尤其 Claude Code 重度用户）需要把裸 .md 渲染成富交互、可分享、人机双读的文档或演示。

- **文档站赛道需求最实**，与 DocLight 现有引擎契合度最高（增量演进），应优先于演示
- **演示赛道需求在升温**但工具成熟（Marp/Slidev/MkSlides）且面临 Claude Code 原生 artifacts 发布平台的平台风险
- **最大差异化空白**：「零构建 + 扩展语法渲染（Mermaid/代码高亮+复制/KaTeX）+ llms.txt/MCP 双读」三位一体
- **MVP**：从三个高频扩展语法开始，演示作为第二阶段复用同一渲染层

---

## 1. 人物分析（People）

### 1.1 核心用户画像

| Persona | 描述 | 证据 |
|---|---|---|
| **Agent 重度用户 / 独立开发者** | Claude Code 重度用户，agent 产出多份 .md（spec/架构/交接），需零摩擦渲染成可分享富文档；期望 wiki 由 LLM 持续维护 | karpathy「渲染 markdown/幻灯片优于文本答案」[9]；OpenDocs「一条命令把 .md 变链接」[7]；sitemd 面向 Claude/Cursor/Codex [6] |
| **内容创作者 / 独立发布者** | agent 生产博客，追求自动 SEO/OG/JSON-LD/llms.txt，不被托管平台绑架 | Postlark「Publish with agents, read with humans」[1]；Pipepost 跨 6 CMS [2] |
| **技术型个人知识库持有者（homelab/自建 wiki）** | 文档混乱、内容困在聊天记录，重建靠翻历史 | r/homelab「文档是一场灾难」[11]；karpathy「wiki 是 LLM 的地盘」[9] |
| **团队/企业文档负责人** | 重视设计、搜索、Ask AI、维护自动化，愿为文档随代码自维护付费 | Mintlify Autopilot [8]；Docusaurus Ask AI [19] |
| **演示/教学制作者（indie/maker）** | 把 agent 输出或 demo 快速做成幻灯片 | karpathy 提 Marp [9]；Claude Code artifacts 发布平台 [14]；MkSlides [29] |

### 1.2 细分市场

1. 文档站（docs site）：Agent 生成/维护，零构建 + 双读友好
2. 演示（presentation）：Marp/Slidev/Reveal.js 式 Markdown→幻灯片
3. 博客发布（blog publishing）：SEO 自动 + llms.txt 的 agent 发布
4. Artifact 分享：agent 产物一键分享 URL
5. 个人知识库/自建 wiki：LLM 维护的持续文档库

### 1.3 决策链路

触发（agent 完成内容产出）→ 判断「交付给谁看」→ 选形态（文档站/演示/博客/分享链接）→ 按五维评估（零构建/交互丰富度/可分享性/SEO 双读/免部署）→ 现有工具不够则换/补一个「低摩擦 + 富渲染 + 双读」引擎。

---

## 2. 场景分析（Scenarios）

| 核心场景 | 频率 | 痛点触发 | 替代方案 |
|---|---|---|---|
| Agent 交付物即时渲染分享 | 高频（每周多次） | agent 产出多份 .md，裸文本/散在聊天记录无法通读分享 | VSCode 预览/粘贴聊天框/OpenDocs [7]/干脆不读 |
| LLM 维护的个人 wiki/文档库 | 中高频 | 文档散落聊天记录，重建翻 20 分钟历史 [11] | Obsidian/karpathy 式脚本合集 [9]/SSG 需构建 |
| Agent 生成演示/幻灯片 | 中频 | 想 markdown→幻灯片，现有工具需学习或构建链 | Marp [26]/Slidev [20]/Reveal.js [18]/MkSlides [29]/Claude artifacts [14] |
| Agent 写作博客自动发布 | 中频 | 要 SEO 自动 + llms.txt + 不被绑定 | Postlark [1]/Pipepost [2]/Ghost/Hashnode |
| 文档站 AI 检索与问答 | 高频（读者侧） | 文档量大，搜索/Ask AI 集成普遍不成熟 | Docusaurus Ask AI [19]/VitePress [24]/Mintlify [8] |

### 触发事件

- agent 完成长任务，一次性产出 5+ 份 .md
- 需要把成果发给别人，但对方不想看裸 markdown
- 文档库增长到难以逐篇阅读，需要搜索/概览层
- 要做产品 demo/教学分享，需要幻灯片形态
- 文档站需要被 AI 检索（llms.txt/MCP），对接 Cursor/Claude Code
- 现有文档散落聊天记录，重建被迫翻 20 分钟历史 [11]

---

## 3. 问题分析（Problems）

### 3.1 JTBD 优先级

| 优先级 | Job to Be Done | 满足度 | 证据 |
|---|---|---|---|
| P0 | agent 产出多份 markdown → 渲染成可通读、可分享的富文档 | 低（工具散落） | karpathy [9]；OpenDocs [7]；Postlark [1] |
| P0 | 文档库增长 → 能搜索、概览、被 AI 检索 | 低（集成不成熟） | Mintlify ~50ms 搜索 [8]；VitePress llms.txt 需求 [24]；MD2HD [10] |
| P1 | 沉淀散落聊天记录的内容 → 一键变成持久文档/wiki | 很低（现状=「灾难」） | r/homelab [11]；公共 artifacts [12][13]；OpenWiki [25] |
| P1 | 展示成果 → markdown 变可交互演示 | 中（Marp/Slidev 摩擦不小） | karpathy [9]；MkSlides [29]；Slidev [20] |
| P2 | 发布博客 → SEO/llms.txt 自动、不被绑定 | 中（Postlark/Pipepost 已部分解决） | Postlark [1]；Pipepost [2] |

### 3.2 非功能需求

- 零构建（DocLight 核心约束；完整 MDX/JSX 构建链与之冲突 [23]）
- 体积门禁：展示层 <25KB gzip / Node 内核 <30KB（ADR-0002），扩展渲染须懒加载/按需注入
- XSS 安全：marked 默认放行原始 HTML，必须 DOMPurify + 扩展白名单 [21]
- 可分享 URL / 免部署（OpenDocs [7]、artifacts 发布平台 [14] 证实的刚需）
- SEO/OG/JSON-LD 自动（Postlark 为标杆 [1]）
- 人机双读：llms.txt + MCP + Accept: text/markdown 内容协商（mkdnsite [4]、sitemd [6]）
- 容错渲染：LLM 生成的 Mermaid 语法易崩，必须降级容错 [17 #5990]
- 离线/私有/自托管能力（agent-artifact-engine [5]、mkdnsite [4]）

### 3.3 情感需求

- 阅读疲劳：「读了一篇又一篇 .md 读累了」[10]
- 混乱与无力感：文档是「灾难」、内容困在聊天记录里 [11]
- 兴奋/期望：artifacts 发布平台「将从根本上改变 indie 做 demo 的方式」[14]
- 怀疑与分裂：富交互可视化被部分用户斥为「slop / 已知 UX 失败」[10]
- 对「魔法感」的向往：零构建开箱即用（docsify「魔术」定位 [22]、mkdnsite「目录即站点」[4]）

---

## 4. 竞品概览（Competitive）

### 4.1 主要玩家

| 产品 | 类型 | 定位 | 核心优势 | 致命短板 | 定价 |
|---|---|---|---|---|---|
| **Postlark** | Agent-first 博客平台（SaaS） | Publish with agents, read with humans；CLI+MCP+REST，内置 llms.txt、SEO 全自动 | MCP 原生；唯一内置 llms.txt 博客平台；0KB JS；CLI 批量 deploy .md | 托管 SaaS；仅博客形态；无 Mermaid/MDX 扩展 | 商业，有 Free tier |
| **Pipepost** | MCP 发布管道（本地 stdio） | 一条命令把 Claude Code 变发布管道 | 30 个工具自然语言串联；cross_publish canonical；IndexNow；本地无云端 | 不渲染不托管；按积分计费 | 3 免费积分/月，1 credit/发布 |
| **Pantheon Content Publisher** | 企业 CMS 发布层 | Google Docs/Word/AI 直发 CMS | MCP 服务器；质量检查；一键发布多 CMS | 绑定 Pantheon+CMS；无自有渲染内核 | 企业商业 |
| **mkdnsite** | 零构建 Markdown Web 服务器（开源 MIT） | 目录即站点：同一 URL 内容协商 HTML/Markdown 双读 | 零构建；内容协商双读；llms.txt+MCP；GFM alerts/KaTeX/Mermaid/高亮/复制/⌘K 搜索 | 年轻项目、插件生态弱；交互限于内置；无 SSG 优化；无演示形态 | 开源 MIT |
| **agent-artifact-engine** | 自托管产物发布引擎（开源） | agent 发布不可变 HTML/MD/safe MDX 产物 | safe MDX；不可变版本化；CSP+sandbox；oEmbed；MCP | 偏基础设施非内容层；无丰富交互渲染 | 开源 |
| **sitemd** | 面向 AI 编码 agent 的 SSG（开源） | Markdown 文件夹→生产级静态站，MCP+skills | 内置 MCP server；双 skill；一键 deploy | 有构建产物；渲染扩展未突出 | 开源 |
| **OpenDocs** | Claude Code 发布 CLI（托管） | opendocs publish → 可分享 URL | 三步接入；SKILL.md 全自动；免部署 | 托管；基础文档形态；无扩展渲染 | 托管，含免费档 |
| **Mintlify** | AI-first 文档平台（SaaS） | Assistant(MCP)+Autopilot 文档随代码自维护 | 开箱设计；MDX 组件；MCP server；~50ms 搜索 | 托管 SaaS；渲染闭源；无零构建 | 商业 |
| **Docusaurus** | 开源文档站 SSG | 正在融入 Ask AI | 生态成熟；MDX；#11333 人机双读方向 | 构建型；依赖重；AI 集成前沿探索 | 开源 |
| **VitePress** | 开源 SSG（Vite+Vue） | 已内置 Ask AI 面板，有 llms.txt 需求 | #5333 AgentSkills、#4590 llms.txt 直接对应课题 | 构建型；依赖 Vite/Vue | 开源 |
| **docsify** | 零构建文档站（开源） | 「魔术」文档站：index.html+docs 即站点 | 零构建运行时渲染；成熟用户群 | #2135 架构可扩展性局限；扩展/双读未成体系 | 开源 |
| **Slidev** | Markdown+Vue 幻灯片（开源） | 开发者演示，Markdown+扩展组件 | 可内嵌组件/插件 | Vue 构建链；非零构建 | 开源 |
| **Marp** | Markdown 演示生态（开源） | Markdown→幻灯片 | 渲染引擎成熟；主题/CLI | 需外部转换；无扩展语法体系 | 开源 |

### 4.2 Markdown 扩展渲染能力矩阵

| 方案 | 能力 | 优点 | 缺点 |
|---|---|---|---|
| MDX | Markdown 内嵌 JSX 组件 | 官方标准、生态最大（Mintlify/Docusaurus 采用） | 依赖 React/JSX 构建链，与零构建冲突 |
| Mermaid | 文本→交互式 SVG 图表 | 通用、LLM 友好、跨工具内置 | 布局需人工调；LLM 语法易崩需容错（#5990）；体积大 |
| GFM alerts/KaTeX/Chart.js/高亮+复制 | 警报块、公式、图表、代码 | 零依赖开箱、覆盖高频需求 | 交互限于内置集合，无 MDX 生态 |
| Marp 式 `---` 分隔符 | 纯 MD 即内容 → 富 HTML 演示 | 演示最小落地；MkSlides 验证 | 需自建渲染转换层 |
| Slidev | Markdown+Vue 组件幻灯片 | 交互组件完整 | Vue 构建链 |
| unified/mdast/hast | 语法树管线 | 插件生态最省力 | 依赖重，与体积门禁冲突 |

### 4.3 市场空白（评分：需求/竞争/契合）

| 机会 | 需求 | 竞争 | 契合 | 证据 |
|---|---|---|---|---|
| **「零构建 + 扩展语法渲染 + llms.txt/MCP 双读」三位一体** | 8 | 5 | 9 | Postlark 有 llms.txt 无渲染扩展 [1]；mkdnsite 零构建+部分扩展但交互有限 [4]；sitemd 有 MCP 但有构建产物 [6] |
| Agent 内容从聊天记录沉淀为持久文档/wiki | 8 | 5 | 8 | r/homelab [11]；karpathy [9]；OpenWiki 只覆盖上游 [25] |
| 文档站一体化 agent 集成（搜索+Ask AI+llms.txt） | 8 | 7 | 8 | Mintlify [8]；Docusaurus [19]；VitePress [24] |
| 演示低摩擦 Markdown→Slides + 扩展复用 | 7 | 8 | 6 | karpathy [9]；MkSlides [29]；但 Marp/Slidev 成熟 + Claude artifacts 平台威胁 [14] |
| Markdown 视觉化/概览层 | 5 | 4 | 5 | MD2HD 需求真实但社区分裂 [10] |

---

## 5. 关键发现

### 5.1 机会点

| 机会 | 置信度 | 证据 |
|---|---|---|
| 「零构建+扩展渲染+双读」三位一体空白真实存在，DocLight 已占两块（零构建+双读），只差扩展渲染 | 高 | Postlark [1]；mkdnsite [4]；sitemd [6]；MDX 被 React 拖累 [23] |
| Agent 以 Markdown 为主要输出格式是共识，渲染成富 HTML 需求获意见领袖背书 | 高 | karpathy [9]；Postlark [1]；OpenDocs [7]；sitemd [6] |
| 文档站 AI 集成（搜索/Ask AI/llms.txt）是主战场，各家不成熟未收敛 | 高 | Mintlify [8]；Docusaurus [19]；VitePress [24] |
| Agent 内容沉淀（聊天记录→持久文档）是未被满足的刚需，情绪强度高 | 中高 | r/homelab [11]；公共 artifacts [12][13]；OpenWiki [25] |
| 演示是第二增长曲线，与文档站共享扩展渲染基础设施，增量成本低 | 中 | karpathy [9]；MkSlides [29]；Slidev [20] |

### 5.2 风险点

| 风险 | 置信度 | 证据 |
|---|---|---|
| 扩展渲染显著放大 XSS 攻击面；必须 DOMPurify 白名单 + 容错降级 | 高 | marked 默认放行 HTML [21]；Mermaid #5990 [17] |
| 体积门禁（<25KB gzip）与富扩展渲染冲突（Mermaid 40KB+），必须懒加载 | 高 | ADR-0002；Mermaid 体积 [17] |
| 完整 MDX/JSX 与零构建不可兼得，需自研白名单式扩展语法注册表 | 高 | MDX 依赖 React [23]；零构建约束 |
| 演示/分享面临 Claude Code 原生 artifacts 发布平台竞争 | 中 | Claude Code 2.1.216 [14] |
| 富交互可视化在用户中分裂（fantastic vs slop），需克制 | 中 | MD2HD 社区分裂 [10] |
| 文档站赛道竞争激烈且头部都在做 AI 集成，单纯加扩展语法不足以构成长期壁垒 | 中高 | Docusaurus [19]；VitePress [24]；Mintlify [8] |

---

## 6. 建议

### 6.1 机会评分：7.5/10

### 6.2 主场景（primaryScenario）

**文档站优先于演示**：「Agent 内容空间」——agent 生成文档 → 零构建渲染成富交互文档站（扩展语法渲染 + 搜索 + llms.txt/MCP 双读），演示作为第二阶段复用同一扩展渲染层。

依据：文档站需求最实（r/homelab [11]、karpathy [9]、Mintlify 付费意愿 [8]）、与 DocLight 现有引擎契合度最高（增量演进）、演示赛道竞争成熟且面临 Claude Code 原生 artifacts 平台风险 [14]。

### 6.3 MVP 路径

在 DocLight 现有渲染内核（REND-001 + DOMPurify）上落地「扩展语法注册表（白名单式）」，先支持三个高频扩展：
1. **Mermaid 容错渲染**（LLM 语法错误降级为文本/图表源）
2. **代码高亮 + 复制按钮**
3. **自定义容器 / GFM alerts / KaTeX**

全部按需懒加载注入以守体积门禁；用本仓库 PHASE-2 交接文档等真实 .md 做 dogfood 验证 + 视觉回归。

第二阶段：Marp 式 `---` 分隔符 → 幻灯片，复用同一扩展渲染层。

### 6.4 后续步骤

1. 设计并实现白名单式扩展语法注册表（含 sanitize 配置），首期覆盖 Mermaid / 代码高亮+复制 / KaTeX / GFM alerts / 自定义容器
2. Mermaid 容错渲染 spike（捕获 LLM 语法错误降级为文本），评估体积后确定按需注入/懒加载策略
3. 用本仓库交接文档做 dogfood：渲染→截图→视觉回归
4. 调研文档站一体化 agent 集成在 DocLight 的落点：搜索 + Ask AI + llms.txt 生成
5. 做演示形态 spike（`---` 分隔→幻灯片），与 Claude Code artifacts 做差异化评估
6. 持续监控 Claude Code artifacts 发布平台演进，评估演示/分享赛道平台风险
7. 保持双读友好：每落地一个扩展语法，验证 llms.txt/MCP 视角下 agent 仍能消费原稿

---

## 附录：来源列表

| 编号 | 标题 | URL | 渠道 | 用途 |
|---|---|---|---|---|
| 1 | Postlark（Agent-first 博客平台） | https://postlark.ai/ | web | 竞品定位：llms.txt+SEO 全自动，但无渲染扩展 |
| 2 | Pipepost（MCP 发布管道） | https://pipepost.dev/ | web | 竞品定位：不渲染不托管 |
| 3 | Pantheon Content Publisher | https://pantheon.io/platform/content-publisher | web | 企业 CMS 发布层，无自有渲染内核 |
| 4 | mkdnsite（零构建 Markdown Web 服务器） | https://github.com/mkdnsite/mkdnsite | web | 最接近空白位：零构建+双读+内置扩展 |
| 5 | agent-artifact-engine | https://github.com/code-atlantic/agent-artifact-engine | web | 自托管 artifact 基础设施参照 |
| 6 | sitemd（面向 AI 编码 agent 的 SSG） | https://github.com/sitemd-cc/sitemd | web | MCP+skills 双接入参照 |
| 7 | OpenDocs（Claude Code 发布 CLI） | https://opendocs.cc/integrations/claude-code | web | 印证「一条命令把 .md 变分享链接」 |
| 8 | Mintlify | https://mintlify.com | web | 文档站 AI 集成标杆：Assistant+Autopilot+50ms 搜索 |
| 9 | karpathy 推文 | https://x.com/karpathy/status/2039805659525644595 | social | 核心假设背书：渲染 markdown/幻灯片优于文本 |
| 10 | r/ClaudeAI：MD2HD | https://www.reddit.com/r/ClaudeAI/comments/1vlwqlq/ | social | 阅读 .md 疲劳→视觉化需求，社区分裂 |
| 11 | r/homelab：文档灾难 | https://www.reddit.com/r/homelab/comments/1todstc/ | social | Agent 内容困在聊天记录的核心痛点 |
| 12 | r/ClaudeAI：共享 artifacts | https://www.reddit.com/r/ClaudeAI/comments/1v6yk7d/ | social | artifact 分享/沉淀需求旺盛 |
| 13 | r/artificial：Claude Artifacts 公开化 | https://www.reddit.com/r/artificial/comments/1v8h6l6/ | social | artifact 公开分享已成趋势 |
| 14 | r/ClaudeCode：artifacts 发布平台 | https://www.reddit.com/r/ClaudeCode/comments/1v2f8d5/ | social | 演示/分享赛道的平台威胁 |
| 15 | r/ClaudeAI：Artifacts 替代 BI | https://www.reddit.com/r/ClaudeAI/comments/1skeycp/ | social | 交互式 HTML 产物边界（缺 live 数据） |
| 16 | r/ClaudeAI：可交接快速原型 | https://www.reddit.com/r/ClaudeAI/comments/1skeycp/ | social | 对话式调整→可交付原型 |
| 17 | Mermaid | https://github.com/mermaid-js/mermaid | technical | 扩展语法→交互图表；LLM 语法易崩需容错（#5990） |
| 18 | Reveal.js | https://github.com/hakimel/reveal.js | technical | 演示渲染层参照 |
| 19 | Docusaurus | https://github.com/facebook/docusaurus | technical | 文档站 AI 集成（Ask AI）+ 人机双读方向 |
| 20 | Slidev | https://github.com/slidevjs/slidev | technical | 演示场景「Markdown+扩展组件」形态 |
| 21 | marked | https://github.com/markedjs/marked | technical | 现有渲染依赖；默认放行 HTML 是安全红线 |
| 22 | docsify | https://github.com/docsifyjs/docsify | technical | 零构建同类基线；#2135 可扩展性局限 |
| 23 | MDX | https://github.com/mdx-js/mdx | technical | 扩展语法标准范式；React/JSX 与零构建冲突 |
| 24 | VitePress | https://github.com/vuejs/vitepress | technical | Ask AI 面板 + llms.txt 需求（#5333/#4590） |
| 25 | OpenWiki | https://github.com/langchain-ai/openwiki | technical | Agent 内容生产端基础设施；渲染/展示端缺失 |
| 26 | Marp | https://github.com/marp-team/marp | technical | Markdown 演示生态成熟参照 |
| 27 | Open Canvas | https://github.com/langchain-ai/open-canvas | technical | 「Agent 产出+富渲染」可行产品形态 |
| 28 | unified | https://github.com/unifiedjs/unified | technical | mdast/hast 管线；依赖重与体积门禁冲突 |
| 29 | MkSlides | https://github.com/MartenBE/mkslides | technical | 纯 Markdown→Reveal.js 幻灯片；Show HN 78 分 |
| 30 | Quarto | https://github.com/quarto-dev/quarto | technical | 科学出版扩展渲染参照；借鉴价值有限 |
