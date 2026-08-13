export const meta = {
  name: 'agent-content-demand-validation',
  description: '批判性验证"AI Agent 内容展示基础设施"需求是否真实存在（禁止 WebSearch/WebFetch）',
  phases: [
    { title: 'Adversarial Web', detail: 'Exa + Jina 反证调研' },
    { title: 'Adversarial Social', detail: 'Twitter/X + Reddit 反证调研' },
    { title: 'Reality Check', detail: 'GitHub + HN 可行性现实核查' },
    { title: 'Verdict', detail: '需求真实性裁决' }
  ]
}

const FORBIDDEN_TOOLS_NOTICE = `
【强制工具约束】
- 严禁使用 WebSearch、WebFetch、百炼搜索、通用网络搜索等工具。
- 只能使用 Agent Reach 工具链：
  1) Exa AI 搜索：mcporter call exa.web_search_exa query="..." numResults=N
  2) Jina Reader：curl -s "https://r.jina.ai/URL"
  3) GitHub CLI：gh search repos "..." --sort stars --limit N ；gh search issues "..." --repo owner/repo --limit N
  4) OpenCLI：opencli twitter search/read/user-posts/article；opencli reddit search/read/subreddit/hot/popular；opencli hackernews ask/show
- 所有发现必须标注来源 URL 或命令来源。
- 如果无法通过上述工具获取某条信息，请明确说明"未找到来源"，不要编造。
`

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    demandReal: { type: 'boolean', description: '需求是否真实存在（综合判断）' },
    demandRealityScore: { type: 'number', description: '需求真实性评分 1-10' },
    verdict: { type: 'string', description: '一段话总结裁决' },
    evidence: {
      type: 'object',
      properties: {
        supporting: { type: 'array', items: { type: 'object', properties: { claim:{type:'string'}, confidence:{type:'string'}, evidence:{type:'string'} } } },
        against: { type: 'array', items: { type: 'object', properties: { claim:{type:'string'}, confidence:{type:'string'}, evidence:{type:'string'} } } },
        ambiguous: { type: 'array', items: { type: 'object', properties: { claim:{type:'string'}, confidence:{type:'string'}, evidence:{type:'string'} } } }
      }
    },
    hypothesisChecks: {
      type: 'object',
      properties: {
        h1_markdown_insufficient: { type: 'object', properties: { real:{type:'boolean'}, evidence:{type:'string'} } },
        h2_ui_inconsistency_pain: { type: 'object', properties: { real:{type:'boolean'}, evidence:{type:'string'} } },
        h3_token_cost: { type: 'object', properties: { real:{type:'boolean'}, evidence:{type:'string'} } },
        h4_willing_to_pay: { type: 'object', properties: { real:{type:'boolean'}, evidence:{type:'string'} } },
        h5_presentation_layer_needed: { type: 'object', properties: { real:{type:'boolean'}, evidence:{type:'string'} } }
      }
    },
    alternativeExplanations: { type: 'array', items: { type: 'string' }, description: '需求的替代解释——用户真正需要的可能不是这个' },
    sources: { type: 'array', items: { type: 'object', properties: { id:{type:'number'}, title:{type:'string'}, url:{type:'string'}, channel:{type:'string'}, usage:{type:'string'} } } }
  },
  required: ['demandReal','demandRealityScore','verdict','evidence','hypothesisChecks','alternativeExplanations','sources']
}

phase('Adversarial Web')
const advWeb = await agent(
  `${FORBIDDEN_TOOLS_NOTICE}

你是**怀疑派** AI 产品研究员。你的任务不是为"AI Agent 内容展示基础设施"找支持证据，而是**主动寻找反对证据和真实需求检验**。

核心问题：**"让 Agent 输出 Markdown + 扩展语法、由渲染引擎生成丰富 HTML 页面"这个需求，是否真实存在、是否足够痛？**

用 Exa + Jina 调研以下反证方向（每个方向搜 2-3 次）：
1. 用户实际上是如何发布 Agent 生成的内容的？会不会大多数人直接复制粘贴到 Notion/Google Docs/PDF，根本不需要专用渲染层？
2. Markdown 是否正在被放弃？还是说 Markdown 对 90% 内容已经足够好、不够的是那 10% 的边缘需求？
3. "UI 一致性/美观"是否是 AI 内容用户的真实痛点？还是说大家根本不关心、能看就行？
4. 有没有证据表明"丰富交互式 HTML 文档/演示"是少数极客需求，而非大众需求？
5. 付费意愿：用户愿意为"Agent 内容展示层"付多少钱？还是说这应该是免费/开源的东西？
6. 现有免费方案（Obsidian Publish、GitHub Pages、docsify、Markdown 直接看）是否已经满足了需求？
7. 搜索"AI presentation gimmick" "AI generated content too much" "markdown is enough" "docs are hard to keep updated" 等反证关键词。

输出 JSON 包含：
- supportingEvidence: [{claim, confidence, evidence}]
- againstEvidence: [{claim, confidence, evidence}]（重点是这里，要尽可能多、尽可能有力）
- ambiguousEvidence: [{claim, confidence, evidence}]
- alternativeExplanations: [用户真正需求的替代解释]
- sources: [{id, title, url, channel, usage}]
`,
  { schema: {
    type: 'object',
    properties: {
      supportingEvidence: { type: 'array', items: { type: 'object', properties: { claim:{type:'string'}, confidence:{type:'string'}, evidence:{type:'string'} } } },
      againstEvidence: { type: 'array', items: { type: 'object', properties: { claim:{type:'string'}, confidence:{type:'string'}, evidence:{type:'string'} } } },
      ambiguousEvidence: { type: 'array', items: { type: 'object', properties: { claim:{type:'string'}, confidence:{type:'string'}, evidence:{type:'string'} } } },
      alternativeExplanations: { type: 'array', items: { type: 'string' } },
      sources: { type: 'array', items: { type: 'object', properties: { id:{type:'number'}, title:{type:'string'}, url:{type:'string'}, channel:{type:'string'}, usage:{type:'string'} } } }
    },
    required: ['supportingEvidence','againstEvidence','ambiguousEvidence','alternativeExplanations','sources']
  }, label: 'adversarial-web: disconfirming research', model: 'deepseek-v4-flash', effort: 'high' }
)
log(`Adversarial Web: ${advWeb.againstEvidence.length} against-evidence, ${advWeb.supportingEvidence.length} supporting`)

phase('Adversarial Social')
const advSocial = await agent(
  `${FORBIDDEN_TOOLS_NOTICE}

你是**怀疑派** AI 产品研究员，负责社媒反证调研（Twitter/X + Reddit，最高优先级信源）。

核心问题：**用户真的觉得"Agent 生成的内容需要更丰富/更稳定的展示层"吗？还是这只是少数人的想象？**

用 OpenCLI 调研以下反证方向：
1. Twitter/X 搜索："markdown is enough" "AI output too ugly but I don't care" "just paste to Notion" "AI generated website pointless" "docs don't need fancy" "artifact gimmick"
2. Reddit（LocalLLaMA, ClaudeAI, ChatGPT, webdev, selfhosted, technicalwriting）搜索：
   - "I just paste AI output to Google Docs" / "how do you share Claude output"（看真实做法）
   - "markdown is fine" / "we don't need interactive docs"
   - "AI website builder is a gimmick"
   - "docs maintenance is the real problem"（真实痛点是否是维护而非渲染）
3. 寻找：用户对"美化 AI 输出"这件事的真实态度——是刚需还是可有可无？
4. 寻找：有没有人明确说"不需要另一个展示层工具"？
5. 对比：人们对 AI 演示工具（Gamma 等）的真实评价——是惊艳还是"花哨但不实用"？

输出 JSON 包含：
- realUserBehavior: [{behavior, platform, evidence, url}]（用户实际上怎么发布 AI 内容）
- againstQuotes: [{quote, platform, author, date, url}]（反证原声）
- supportingQuotes: [{quote, platform, author, date, url}]（支持原声，可能较少）
- apathyEvidence: [{observation, evidence, url}]（用户漠视/不关心美化的证据）
- keyFindings: [{finding, supportsDemand(boolean), confidence, evidence}]
- sources: [{id, title, url, channel, usage}]
`,
  { schema: {
    type: 'object',
    properties: {
      realUserBehavior: { type: 'array', items: { type: 'object', properties: { behavior:{type:'string'}, platform:{type:'string'}, evidence:{type:'string'}, url:{type:'string'} } } },
      againstQuotes: { type: 'array', items: { type: 'object', properties: { quote:{type:'string'}, platform:{type:'string'}, author:{type:'string'}, date:{type:'string'}, url:{type:'string'} } } },
      supportingQuotes: { type: 'array', items: { type: 'object', properties: { quote:{type:'string'}, platform:{type:'string'}, author:{type:'string'}, date:{type:'string'}, url:{type:'string'} } } },
      apathyEvidence: { type: 'array', items: { type: 'object', properties: { observation:{type:'string'}, evidence:{type:'string'}, url:{type:'string'} } } },
      keyFindings: { type: 'array', items: { type: 'object', properties: { finding:{type:'string'}, supportsDemand:{type:'boolean'}, confidence:{type:'string'}, evidence:{type:'string'} } } },
      sources: { type: 'array', items: { type: 'object', properties: { id:{type:'number'}, title:{type:'string'}, url:{type:'string'}, channel:{type:'string'}, usage:{type:'string'} } } }
    },
    required: ['realUserBehavior','againstQuotes','supportingQuotes','apathyEvidence','keyFindings','sources']
  }, label: 'adversarial-social: Twitter+Reddit disconfirming', model: 'deepseek-v4-flash', effort: 'high' }
)
log(`Adversarial Social: ${advSocial.againstQuotes.length} against-quotes, ${advSocial.realUserBehavior.length} real behaviors`)

phase('Reality Check')
const realityCheck = await agent(
  `${FORBIDDEN_TOOLS_NOTICE}

你是**怀疑派**技术研究员，负责用 GitHub CLI + Hacker News 做"需求现实核查"。

核心问题：**这个方向在技术上是否已经被免费方案解决？"token 成本/一致性"的说法是否站得住脚？**

用 GitHub + HN 调研：
1. 是否已有免费方案完全满足"Agent 内容 → 丰富渲染"？例如：
   - Obsidian Publish（免费/便宜）
   - GitHub Pages + 任意 SSG
   - docsify / mdbook / 各种 markdown 渲染
   - Jupyter Notebook / Quarto（学术内容）
   - reveal.js（演示）
   这些是否已经"够用"？
2. "Agent 输出 Markdown+扩展 vs 输出 HTML 的 token 成本"：这个论点是否有实际数据支持？搜索 GitHub/HN 上有没有人实测过？
3. 渲染一致性：是真实技术难题，还是 Agent 已经在解决（如 Anthropic 的 artifacts）？
4. 有没有 GitHub 项目已经在做类似"AI 内容展示层"并失败了/无人问津？星星数能说明什么？
5. 搜索 "AI docs" "markdown slides" "agent publishing" "AI content renderer" 看这些项目的真实热度（stars/issue 活跃度），判断是真需求还是伪需求。
6. Hacker News 上：人们对 AI 生成内容的美化/展示的真实讨论。

输出 JSON 包含：
- existingFreeSolutions: [{solution, capability, limitation, url}]（现有免费方案能否满足需求）
- tokenCostReality: {hasData, assessment, evidence}
- consistencyReality: {hasData, assessment, evidence}
- deadProjects: [{name, stars, issueActivity, lesson, url}]（同类项目无人问津的证据）
- hnDiscussion: [{topic, sentiment, url}]
- feasibilityVerdict: string
- sources: [{id, title, url, channel, usage}]
`,
  { schema: {
    type: 'object',
    properties: {
      existingFreeSolutions: { type: 'array', items: { type: 'object', properties: { solution:{type:'string'}, capability:{type:'string'}, limitation:{type:'string'}, url:{type:'string'} } } },
      tokenCostReality: { type: 'object', properties: { hasData:{type:'boolean'}, assessment:{type:'string'}, evidence:{type:'string'} } },
      consistencyReality: { type: 'object', properties: { hasData:{type:'boolean'}, assessment:{type:'string'}, evidence:{type:'string'} } },
      deadProjects: { type: 'array', items: { type: 'object', properties: { name:{type:'string'}, stars:{type:'number'}, issueActivity:{type:'string'}, lesson:{type:'string'}, url:{type:'string'} } } },
      hnDiscussion: { type: 'array', items: { type: 'object', properties: { topic:{type:'string'}, sentiment:{type:'string'}, url:{type:'string'} } } },
      feasibilityVerdict: { type: 'string' },
      sources: { type: 'array', items: { type: 'object', properties: { id:{type:'number'}, title:{type:'string'}, url:{type:'string'}, channel:{type:'string'}, usage:{type:'string'} } } }
    },
    required: ['existingFreeSolutions','tokenCostReality','consistencyReality','deadProjects','hnDiscussion','feasibilityVerdict','sources']
  }, label: 'reality-check: GitHub+HN', model: 'deepseek-v4-flash', effort: 'high' }
)
log(`Reality Check: ${realityCheck.existingFreeSolutions.length} free solutions, ${realityCheck.deadProjects.length} dead projects`)

phase('Verdict')
const verdict = await agent(
  `${FORBIDDEN_TOOLS_NOTICE}

你是**首席怀疑派**产品研究员，负责综合三路反证调研，给出**需求真实性的最终裁决**。

研究课题：AI Agent 内容的 Markdown 扩展渲染基础设施（文档站 + 演示），需求是否真实存在？

输入数据：
1. Adversarial Web 反证：${JSON.stringify(advWeb).slice(0, 5000)}...
2. Adversarial Social 反证：${JSON.stringify(advSocial).slice(0, 5000)}...
3. Reality Check 现实核查：${JSON.stringify(realityCheck).slice(0, 5000)}...

裁决要求：
1. **不得偏向乐观**。如果证据不足，就判"证据不足"，不要为了支持方向而曲解。
2. 逐项检验五个假设：
   - H1：Markdown 表现力不足 → 用户真的遇到瓶颈？
   - H2：UI 不一致是痛点 → 用户真的在意？
   - H3：token 成本 → 这个论点有数据支撑吗？
   - H4：付费/迁移意愿 → 真实存在吗？
   - H5：需要"展示层基础设施" → 还是现有工具已够？
3. 列出"需求的替代解释"：用户真正想要的可能是别的（如内容维护、协作、SEO、分发），而不是渲染层。
4. 给出 demandRealityScore（1-10）和 demandReal（boolean）。
5. 所有论断标注来源 [id]。

输出 JSON 严格符合以下 schema（中文）：
${JSON.stringify(VERDICT_SCHEMA)}
`,
  { schema: VERDICT_SCHEMA, label: 'verdict: demand reality', model: 'deepseek-v4-flash', effort: 'max' }
)

return verdict
