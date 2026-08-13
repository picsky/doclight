# DocLight 产品愿景优化与方向验证报告（2026-08-13）

> 调研通道：agent-reach 多平台（Exa 搜索 + GitHub CLI + Jina Reader），检索 AI 演示工具生态、
> Agent 文档基础设施、无头 CMS + Agent 工作流、开源开发者工具商业模式、Agent 定制前端/设计系统。
> 输入：用户四点反馈（①Agent 输出更强、演示要视觉表现力 ②预览-确认-发布工作流 ③低门槛定制、打穿 CMS
> ④开源 vs 商业验证）+ 一轮定位纠偏（文档与演示是两个独立表现形式；DocLight 做表现层，不做内容）。
> 本报告 = 优化后的产品愿景 + 长期前景验证 + 商业可行性结论。

---

## 一、优化后的产品愿景

### 一句话（v3 定稿，用户选定版）

> **DocLight 把 Markdown 变成作品。**
> Agent 写，DocLight 渲染成专业的文档与演示——无需构建、开箱即用、随时可定制。

> 技术本质（内部语言，不用于对外传播）：Markdown 的表现层（Presentation Layer for
> Markdown）——内容的质量是 Agent/人的领域，DocLight 不碰；DocLight 负责"长什么样"，
> 用渲染、排版、图表、动效、主题、演示把纯 Markdown 的视觉表现力拉到顶级。
> **插件、图表、演示，本质都是同一件事：提升 md 的视觉表现力。**

### 定位纠偏记录（v2 → v3）

- ~~v2：DocLight 是让 Agent 做出更好内容的基础设施~~ → **内容质量 DocLight 帮不上忙**，
  内容是 Agent/人的领域。DocLight 的价值在**表现层**——同样一份 md 内容，经 DocLight
  呈现后视觉质量显著更高。
- ~~文档直接演示~~ → **文档与演示是两个独立的表现形式**：同一份内容（source）可以有
  文档版与演示版，各自拥有独立的视觉语言与设计系统。演示**绝不是文档的切片**
  （演示 = 每页一个观点、强视觉、少文字、逐页叙事）；文档也不该被切成幻灯片。
  文档仍然是根基（内容密度、可检索、SEO、Agent 读取友好），演示是它的高视觉强度兄弟形态。

### 三层结构（v3）

```
┌─ ① 内容层（已有，DocLight 不生产内容，只承载与协议化）────────────┐
│   docs/ 纯 Markdown + 语义 frontmatter + 扩展语法能力协议           │
│   能力清单 / AGENTS.md / llms.txt / MCP 读写 / publish 发布         │
│   —— 这一层保证「内容怎么写、Agent 怎么读」，不决定「长什么样」      │
└─────────────────────────────────────────────────────────────────┘
┌─ ② 表现层（核心，v3 定位的全部重心）───────────────────────────────┐
│   渲染表现力：排版系统 + 图表（mermaid/图表组件）+ 代码高亮 + KaTeX   │
│   设计系统：CSS 变量主题（已有 THEME）+ 组件库 + 模板 + swizzle       │
│   多形态表现：文档形态 + 演示形态（独立视觉语言，同一内容源）          │
│   低门槛定制：主题=变量覆盖、组件可 swizzle、插件=一个 JS 文件         │
│   —— 这一层的每一件事都在做同一件事：提升 md 的视觉表现力            │
└─────────────────────────────────────────────────────────────────┘
┌─ ③ 工作流层（回应反馈②）────────────────────────────────────────┐
│   Agent 生成 → 本地增量渲染实时预览 → 人确认 → 发布（绝不自动发布）   │
│   版本历史 + 回滚（Agent 沙箱式写入，人一键批准）                    │
└─────────────────────────────────────────────────────────────────┘
```

### 关键设计原则（由反馈推导）

1. **表现层 = 产品本身的价值**：卖点不是"能渲染 mermaid"，而是"同样的 md 内容，
   用 DocLight 呈现后视觉质量显著更高"——图表、排版、动效、演示都是表现层能力，
   围绕"提升视觉表现力"这一条主线展开，不是零散功能。
2. **文档与演示同源不同形**：同一份内容 → 文档版（密度、可检索、SEO、Agent 读取）
   与演示版（强视觉、逐页叙事、每页一观点）两个独立表现形式，各自有设计系统；
   不做"文档切页成演示"的机械转换。
3. **演示质量由组件/设计系统保证**：不给 Agent"裸语法让它自由发挥"，而是给一套
   演示级视觉组件（布局/图表/动效/封面模板），Agent 用 md 编排——输出质量稳定，
   不靠运气（对比：Marp 设计上限低、Gamma 式生成不可控）。
4. **先预览后发布**：Agent 写入永远先进"预览态"（本地增量渲染），人确认后才 publish。
   对齐行业验证（Mutable "The CMS for AI agents"：Agent 沙箱写入 → 人审查 → 一键发布）。
5. **底层能力 + 极低门槛定制**：前端=CSS 变量覆盖（已有）+ 组件 swizzle（Meta Astryx
   模式）；插件=一个 JS/TS 文件（已有）；主题=变量文件（已有）。用户与 Agent 用自然
   语言即可定制（"把站点改成暖色调"→ Agent 改主题变量 → 预览）。目标：打穿传统 CMS
   的"改样式要写代码/找开发"的死结。

---

## 二、方向验证（调研证据）

### 需求侧：Agent 消费内容已是结构性趋势（非炒作）

| 证据 | 来源 |
|---|---|
| 9 个主流 AI 编码代理流量研究：Agent 一次 GET 拿整页、跳过前端分析事件；Cisco 单文档 193K tokens 威胁上下文窗口 → "token 数是一级文档指标" | Developer Experience with AI Coding Agents 论文，Addy Osmani（Google Cloud AI 总监）[AEO 文章](https://addyosmani.com/blog/agentic-engine-optimization/) |
| Mintlify 文档流量中 Agent 占比 2026 年从 ~10% 涨到 **66%**；"docs from a human support surface into core infrastructure for agents" | [Sacra: Mintlify at $21.4M ARR](https://sacra.com/research/mintlify-at-21m-arr-growing-326-yoy/) |
| **AGENTS.md 正在成为 Agent 的入口**（如同 README.md 是人的入口）；llms.txt = "sitemap for agents"；Serve Markdown not just HTML | 同上（Addy Osmani） |
| llms.txt v2 规范 + 115/219 样本站点采用 + OpenAI/Anthropic/Gemini 自家发布 + Chrome Lighthouse 审计 | [llmstxt.org](https://llmstxt.org/) / [llmtxt.info adoption](https://llmtxt.info/llms-txt-adoption/) |
| GitHub Agentic Workflows：代码合并 → Agent 自动起草跨仓库文档 → 人 SME 审核（"doc-writer skill"） | [GitHub Blog 2026-07](https://github.blog/ai-and-ml/github-copilot/automating-cross-repo-documentation-with-github-agentic-workflows/) |

### 供给侧：空白 + 已验证的商业模式

- **Mintlify**（托管 SaaS）：$23M ARR（2026-07）、+326% YoY、估值 $500M（a16z）。
  商业模型 = B2B SaaS + AI 用量计费 + **"Powered by Mintlify" 病毒分发**。
  弱点：托管 SaaS（贵、自托管不可能、代码不可控）。来源：[Sacra](https://sacra.com/c/mintlify/)
- **开源替代空白**："Docusaurus/VuePress/GitBook OSS lack the AI-native features that are
  becoming table stakes, particularly automated content generation and LLM-optimized output
  formats"（同上 Sacra）——**开源 + AI 原生 = DocLight 的明确空位**。
- **Slidev**（开源演示）："赢在美与代码亲和"（Shiki 高亮 + Vue 组件 + Vite HMR 100ms），
  已做 MCP + 官方 Skill 的 Agent 化；Marp "设计上限低、无内置组件"。→ 演示竞争在
  **视觉能力层**，不在语法层。来源：[2026 markdown presentation 深度对比](https://www.youngju.dev/blog/culture/2026-05-16-markdown-presentation-tools-2026-marp-slidev-revealjs-spectacle-gamma-beautiful-ai-deep-dive.en)
- **Meta Astryx**（开源设计系统）："fully customizable and agent ready"，主题 = CSS
  自定义属性覆盖（"designer can make it theirs without forking"）、组件可 swizzle、
  7 个现成主题、150+ 组件、"built for people and agents with the same tooling"。
  → **DocLight 的视觉能力层/低门槛定制可直接对标此模式**。来源：[github.com/facebook/astryx](https://github.com/facebook/astryx)
- **Mutable**（"The CMS for AI agents"）：Agent 建内容模型/写文案/生成模板 → 人审查 →
  一键发布；沙箱 + 版本历史 + schema 约束 + 多 Agent 并发。→ 验证"预览-确认-发布"工作流。来源：[mutable.site](https://mutable.site/)

### 演示方向的判断

- AI 演示工具已过泡沫整合期：Tome 关闭、Gamma B 轮存活、Beautiful.ai 等找 niche；
  **Microsoft Copilot 深度嵌入 PowerPoint，"Gamma 式 AI deck 生成"正变成内置功能** → 纯
  "prompt-to-deck" 是红海且被巨头吞并。
- markdown 演示（Slidev/Marp）语法层已饱和、Slidev 已 Agent 化 → 语法层没机会。
- **DocLight 的空位 = 演示的"视觉能力层"（v3：独立表现形式，非文档切页）**：开源、可
  自托管、给 Agent 一套**演示专用**的视觉设计系统（布局/组件/动效/图表/封面模板），
  输出质量稳定且可控（对比：Marp 设计上限低、Gamma 式生成不可控）。
  与文档的关系是**同一内容源、两种独立表现形式**——文档版与演示版各自有自己的
  视觉语言与设计系统，Agent 分别产出，不做机械转换。

---

## 三、长期前景结论

**结论：方向成立，且处于正确的时间窗口（2026，Agent 流量拐点）。**

- 需求是**结构性**的（Agent 消费文档的流量占比从 10%→66% 且持续上升；AGENTS.md/llms.txt
  成为事实标准；AEO 成为开发者文档的必修课）。
- 供给有**明确空白**（开源替代无 AI 原生；Mintlify 是托管 SaaS，自托管/可控是真空）。
- DocLight 已具备的差异化组合（零构建 + llms.txt 内置 + MCP 读写 + publish 协议 +
  插件系统 + 多形态输出）恰好落在空白上。

**主要风险（诚实列出）**：
1. 前端视觉质量是当前短板（用户反馈③）——视觉能力层若不补，产品停在"能用不好看"。
2. 演示领域强手如林（Slidev 已 Agent 化、Gamma 已商业化）——需以"视觉组件层 + 文档同源"
   差异化，不能正面拼语法或拼生成。
3. 开源项目的采用需要时间与维护投入——短期内是投入，不是收入。

---

## 四、商业可行性 vs 开源：结论

**结论：推荐「开源优先（积累声望与生态）+ 远期选择性商业化」。**

理由（基于证据）：

1. **该品类的现实路径是开源**：Docusaurus（Meta 维护）、VitePress、Slidev 都是开源
   成名路径；Mintlify 证明"文档"有商业价值，但**托管 SaaS 是重运营**（基础设施、安全、
   计费），对个人/小团队是沉重负担，且与 DocLight 零构建/自托管的定位冲突。
2. **开源 + 病毒分发可兼得**：Mintlify 的 "Powered by Mintlify" 分发模式在开源下同样
   成立（DocLight 已有 Powered by 标记）——开源不损失分发效率，反而降低采用门槛
   （自托管免费、可控、无锁定），比 SaaS 更容易滚起采用量。
3. **开源积累声望更符合用户目标**：开发者工具的声望 = 贡献者 + 采用量 + 生态；
   "AI 原生的零构建文档引擎" 这一命名位有稀缺性，开源可抢注心智。
4. **商业化空间保留（远期，可选）**：
   - 插件市场/主题市场（佣金/付费主题）——生态成型后自然出现；
   - 企业支持/托管（DocLight Cloud）——Mintlify 路径的"可控版本"；
   - GitHub Sponsors——Slidev/VitePress 的成熟模式。
   这些都不影响先开源。

**开源形态建议**：MIT 或 Apache-2.0（宽松许可证最大化采用；Docusaurus 用 MIT、
Slidev 用 MIT，均有先例）；AGENTS.md + 完善文档本身就是"dogfood"（自己的产品就是自己的
能力验证）。

---

## 五、建议的落地路径（供下一步）

| 优先级 | 动作 | 回应反馈 |
|---|---|---|
| P0 | **能力协议**：capabilities（渲染能力清单）+ AGENTS.md 生成 + MCP `get_capabilities`；发布产物补 markdown 页面 + llms.txt v2 Link 关系 + token 计数 | ①②（Agent 知道能用什么、发布后读取友好） |
| P0 | **官方 Agent Skill 升级**：doclight-agent（语法/主题/发布链的完整知识） | ①② |
| P1 | **表现层设计系统化**：Astryx 式 CSS 变量主题库 + 组件 + swizzle 机制 + 前端设计打磨（视觉表现力主线） | ③ |
| P1 | **预览-确认-发布工作流**：dev 增量渲染 + 版本快照 + `doclight publish --preview`/确认门 | ② |
| P1 | **MCP 写入端**（write/update）+ 增量渲染 | ①实时输出实时渲染 |
| P2 | **演示形态（独立表现形式）**：演示专用视觉设计系统（布局/组件/动效/封面模板）插件 + doclight-slides Skill——与文档同源不同形，不做文档切页 | ①（视觉表现力） |

（调研原始证据：`research/` 目录 + 本报告引用的公开来源）
