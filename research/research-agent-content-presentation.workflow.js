export const meta = {
  name: 'agent-content-presentation-research',
  description: '使用 Agent Reach 调研 AI Agent 内容展示基础设施机会（禁止 WebSearch/WebFetch）',
  phases: [
    { title: 'Web', detail: 'Exa + Jina 网页/竞品调研' },
    { title: 'Social', detail: 'Twitter/X + Reddit 社媒调研' },
    { title: 'Technical', detail: 'GitHub + HN 技术生态调研' },
    { title: 'Synthesize', detail: 'PSP 报告综合' }
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

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    generatedAt: { type: 'string' },
    executiveSummary: { type: 'string', maxLength: 400 },
    people: {
      type: 'object',
      properties: {
        personas: { type: 'array', items: { type: 'object', properties: { name: {type:'string'}, description:{type:'string'}, evidence:{type:'string'} } } },
        segments: { type: 'array', items: { type: 'string' } },
        decisionChain: { type: 'string' }
      }
    },
    scenarios: {
      type: 'object',
      properties: {
        coreScenarios: { type: 'array', items: { type: 'object', properties: { name:{type:'string'}, frequency:{type:'string'}, painTrigger:{type:'string'}, alternatives:{type:'string'} } } },
        triggerEvents: { type: 'array', items: { type: 'string' } }
      }
    },
    problems: {
      type: 'object',
      properties: {
        jtbd: { type: 'array', items: { type: 'object', properties: { priority:{type:'string'}, job:{type:'string'}, satisfaction:{type:'string'}, evidence:{type:'string'} } } },
        nonFunctional: { type: 'array', items: { type: 'string' } },
        emotional: { type: 'array', items: { type: 'string' } }
      }
    },
    competitive: {
      type: 'object',
      properties: {
        overview: { type: 'array', items: { type: 'object', properties: { name:{type:'string'}, type:{type:'string'}, positioning:{type:'string'}, targetUser:{type:'string'}, coreStrengths:{type:'string'}, fatalWeakness:{type:'string'}, pricing:{type:'string'}, source:{type:'string'} } } },
        markdownExtensions: { type: 'array', items: { type: 'object', properties: { solution:{type:'string'}, capabilities:{type:'string'}, pros:{type:'string'}, cons:{type:'string'}, source:{type:'string'} } } },
        gaps: { type: 'array', items: { type: 'object', properties: { opportunity:{type:'string'}, demand:{type:'number'}, competition:{type:'number'}, fit:{type:'number'}, evidence:{type:'string'} } } }
      }
    },
    findings: {
      type: 'object',
      properties: {
        opportunities: { type: 'array', items: { type: 'object', properties: { claim:{type:'string'}, confidence:{type:'string'}, evidence:{type:'string'} } } },
        risks: { type: 'array', items: { type: 'object', properties: { claim:{type:'string'}, confidence:{type:'string'}, evidence:{type:'string'} } } }
      }
    },
    recommendations: {
      type: 'object',
      properties: {
        opportunityScore: { type: 'number' },
        primaryScenario: { type: 'string' },
        mvpPath: { type: 'string' },
        nextSteps: { type: 'array', items: { type: 'string' } }
      }
    },
    sources: { type: 'array', items: { type: 'object', properties: { id:{type:'number'}, title:{type:'string'}, url:{type:'string'}, channel:{type:'string'}, usage:{type:'string'} } } }
  },
  required: ['title','executiveSummary','people','scenarios','problems','competitive','findings','recommendations','sources']
}

phase('Web')
const webFindings = await agent(
  `${FORBIDDEN_TOOLS_NOTICE}

你是 AI 产品研究员，负责使用 Exa + Jina Reader 进行网页/竞品调研。

研究课题：AI Agent 内容的 Markdown 扩展渲染基础设施——Agent 输出 Markdown + 扩展语法，渲染引擎生成丰富交互式 HTML，初期聚焦文档站和演示。

任务：
1. 用 Exa 搜索以下方向（每个方向至少搜 2-3 次，numResults=5-10）：
   - Postlark / Pipepost / Pantheon Content Publisher / agentic publishing
   - AI documentation tools 2026 (Mintlify, GitBook, ReadMe, Docusaurus, VitePress)
   - AI presentation tools 2026 (Gamma, Tome, Beautiful.ai, Canva, Pitch)
   - Markdown extension rendering (Mermaid, callouts, MDX, Quarto, Observable, reveal.js, D2)
   - AI generated course / tutorial publishing
2. 用 Jina Reader 读取关键页面获取详细信息。
3. 整理竞品概览表（≥8 个产品）、Markdown 扩展能力矩阵、市场空白评分。

输出 JSON 包含：
- competitors: [{name, type, positioning, targetUser, coreStrengths, fatalWeakness, pricing, source}]
- markdownExtensions: [{solution, capabilities, pros, cons, source}]
- gaps: [{opportunity, demand(1-5), competition(1-5), fit(1-5), evidence}]
- keyQuotes: [{text, source}]
- sources: [{id, title, url, channel, usage}]
`,
  { schema: {
    type: 'object',
    properties: {
      competitors: { type: 'array', items: { type: 'object', properties: { name:{type:'string'}, type:{type:'string'}, positioning:{type:'string'}, targetUser:{type:'string'}, coreStrengths:{type:'string'}, fatalWeakness:{type:'string'}, pricing:{type:'string'}, source:{type:'string'} } } },
      markdownExtensions: { type: 'array', items: { type: 'object', properties: { solution:{type:'string'}, capabilities:{type:'string'}, pros:{type:'string'}, cons:{type:'string'}, source:{type:'string'} } } },
      gaps: { type: 'array', items: { type: 'object', properties: { opportunity:{type:'string'}, demand:{type:'number'}, competition:{type:'number'}, fit:{type:'number'}, evidence:{type:'string'} } } },
      keyQuotes: { type: 'array', items: { type: 'object', properties: { text:{type:'string'}, source:{type:'string'} } } },
      sources: { type: 'array', items: { type: 'object', properties: { id:{type:'number'}, title:{type:'string'}, url:{type:'string'}, channel:{type:'string'}, usage:{type:'string'} } } }
    },
    required: ['competitors','markdownExtensions','gaps','keyQuotes','sources']
  }, label: 'web: Exa+Jina research', model: 'deepseek-v4-flash', effort: 'high' }
)
if (!webFindings) { webFindings = { competitors: [], markdownExtensions: [], gaps: [], keyQuotes: [], sources: [] }; log('WARN: webFindings was null, using empty defaults') }
log(`Web findings: ${webFindings.competitors.length} competitors, ${webFindings.markdownExtensions.length} extension solutions`)

phase('Social')
const socialFindings = await agent(
  `${FORBIDDEN_TOOLS_NOTICE}

你是 AI 产品研究员，负责使用 OpenCLI 的 Twitter/X 和 Reddit 进行社媒/社区调研。社媒是本次调研的最高优先级信源。

【防死循环硬规则（必须遵守，违反则任务失败）】
- 任何单条命令重复执行不得超过 3 次。若某命令连续 3 次失败或返回空结果：立即停止该命令，改用替代方案（换平台/换命令/换关键词），或直接放弃该方向。
- 严禁对同一命令反复重试等待成功。失败 3 次 = 该方向放弃。
- 你必须在 45 次工具调用以内输出最终结构化结果。未获取到的数据项标注 null 或"未获取"，不得因数据缺失而无限重试。
- 若 opencli twitter search 持续失败，改用：opencli reddit search / opencli reddit subreddit / opencli reddit hot / opencli twitter user-posts @username / opencli twitter article。
- 开场必须先复述你的任务（研究课题 + 要回答的问题），确认不偏题后再动手。

研究课题：AI Agent 内容的 Markdown 扩展渲染基础设施——Agent 输出 Markdown + 扩展语法，渲染引擎生成丰富交互式 HTML，初期聚焦文档站和演示。

任务：
1. Twitter/X（opencli twitter search/read/user-posts/article）：
   - 搜索："AI agent content publish", "Claude Artifacts limitations", "AI generated documentation", "Markdown not enough", "agentic publishing", "AI presentation problem"
   - 关注开发者、创始人、技术写作者账号的真实反馈
2. Reddit（opencli reddit search/subreddit/hot/popular）：
   - 重点 subreddit: LocalLLaMA, ClaudeAI, ChatGPT, webdev, selfhosted, technicalwriting, programming, MachineLearning
   - 搜索："AI generated documentation", "publish from Claude", "Markdown limitations", "AI presentation tool", "agent content space", "docsify alternative"
3. 收集一手原声：用户如何发布 Agent 内容？对现有工具哪些不满？文档 vs 演示哪个更痛？

输出 JSON 包含：
- themes: [{theme, quotes: [{platform, author, date, text, url}]}]
- topPainPoints: [{painPoint, frequency, evidenceCount, exampleUrl}]
- keyFindings: [{finding, supportsHypothesis(boolean), evidence}]
- sources: [{id, title, url, channel, usage}]
`,
  { schema: {
    type: 'object',
    properties: {
      themes: { type: 'array', items: { type: 'object', properties: { theme:{type:'string'}, quotes:{type:'array', items:{type:'object', properties:{platform:{type:'string'}, author:{type:'string'}, date:{type:'string'}, text:{type:'string'}, url:{type:'string'}}}} } } },
      topPainPoints: { type: 'array', items: { type: 'object', properties: { painPoint:{type:'string'}, frequency:{type:'string'}, evidenceCount:{type:'number'}, exampleUrl:{type:'string'} } } },
      keyFindings: { type: 'array', items: { type: 'object', properties: { finding:{type:'string'}, supportsHypothesis:{type:'boolean'}, evidence:{type:'string'} } } },
      sources: { type: 'array', items: { type: 'object', properties: { id:{type:'number'}, title:{type:'string'}, url:{type:'string'}, channel:{type:'string'}, usage:{type:'string'} } } }
    },
    required: ['themes','topPainPoints','keyFindings','sources']
  }, label: 'social: Twitter+Reddit research', model: 'deepseek-v4-flash', effort: 'high' }
)
if (!socialFindings) { socialFindings = { themes: [], topPainPoints: [], keyFindings: [], sources: [] }; log('WARN: socialFindings was null, using empty defaults') }
log(`Social findings: ${socialFindings.themes.length} themes, ${socialFindings.topPainPoints.length} pain points`)

phase('Technical')
const techFindings = await agent(
  `${FORBIDDEN_TOOLS_NOTICE}

【防死循环硬规则（必须遵守，违反则任务失败）】
- 任何单条命令重复执行不得超过 3 次。连续 3 次失败/返回空 = 立即放弃该方向，改用替代命令或换关键词。
- 严禁对同一命令反复重试。若搜索通道持续失败，换工具或换仓库，或放弃并在输出标注"未获取"。
- 必须在 45 次工具调用以内输出最终结构化结果；未获取的数据标注"未获取"，不得因缺失而无限重试。
- 开场必须先复述你的任务，确认不偏题后再动手。

你是 AI 产品研究员，负责使用 GitHub CLI 和 Hacker News 进行技术生态与可行性调研。

研究课题：AI Agent 内容的 Markdown 扩展渲染基础设施——Agent 输出 Markdown + 扩展语法，渲染引擎生成丰富交互式 HTML，初期聚焦文档站和演示。

任务：
1. GitHub CLI 搜索：
   - 仓库：gh search repos "agent markdown renderer", "AI documentation site", "MCP server publish content", "markdown slides", "static site AI", "llms.txt generator", "docsify alternative" --sort stars --limit 15
   - Issues：在 docsify, docusaurus, vitepress, mermaid-js, quarto-dev, revealjs 等仓库中搜索 AI/integration/rendering/limitations 相关 issue
2. Hacker News（opencli hackernews ask/show）：
   - 读取最近的 Show HN 和 Ask HN，寻找 AI 文档/演示/内容发布相关项目与讨论
3. 技术可行性评估：
   - Agent 输出 Markdown+扩展 vs 直接输出 HTML 的 token 成本
   - 渲染一致性、可维护性、安全性（XSS）
   - 与 DocLight 现有架构的匹配度

输出 JSON 包含：
- projects: [{name, repo, stars, description, maintenance, relevance, source}]
- issuePainPoints: [{theme, issues: [{repo, title, summary, url}]}]
- feasibility: {tokenCost, consistency, maintainability, security, architectureFit, each with assessment and evidence}
- hnDiscussions: [{title, url, relevance}]
- sources: [{id, title, url, channel, usage}]
`,
  { schema: {
    type: 'object',
    properties: {
      projects: { type: 'array', items: { type: 'object', properties: { name:{type:'string'}, repo:{type:'string'}, stars:{type:'number'}, description:{type:'string'}, maintenance:{type:'string'}, relevance:{type:'string'}, source:{type:'string'} } } },
      issuePainPoints: { type: 'array', items: { type: 'object', properties: { theme:{type:'string'}, issues:{type:'array', items:{type:'object', properties:{repo:{type:'string'}, title:{type:'string'}, summary:{type:'string'}, url:{type:'string'}}}} } } },
      feasibility: { type: 'object', properties: { tokenCost:{type:'string'}, consistency:{type:'string'}, maintainability:{type:'string'}, security:{type:'string'}, architectureFit:{type:'string'} } },
      hnDiscussions: { type: 'array', items: { type: 'object', properties: { title:{type:'string'}, url:{type:'string'}, relevance:{type:'string'} } } },
      sources: { type: 'array', items: { type: 'object', properties: { id:{type:'number'}, title:{type:'string'}, url:{type:'string'}, channel:{type:'string'}, usage:{type:'string'} } } }
    },
    required: ['projects','issuePainPoints','feasibility','hnDiscussions','sources']
  }, label: 'technical: GitHub+HN research', model: 'deepseek-v4-flash', effort: 'high' }
)
if (!techFindings) { techFindings = { projects: [], issuePainPoints: [], feasibility: {}, hnDiscussions: [], sources: [] }; log('WARN: techFindings was null, using empty defaults') }
log(`Technical findings: ${techFindings.projects.length} projects, ${techFindings.issuePainPoints.length} pain themes`)

phase('Synthesize')
const report = await agent(
  `${FORBIDDEN_TOOLS_NOTICE}

你是首席产品研究员，负责综合前三位 Agent 的发现，生成一份完整的 PSP 调研报告。

研究课题：AI Agent 内容的 Markdown 扩展渲染基础设施——Agent 输出 Markdown + 扩展语法，渲染引擎生成丰富交互式 HTML，初期聚焦文档站和演示。

输入数据：
1. Web Agent 发现：${JSON.stringify(webFindings).slice(0, 4000)}...
2. Social Agent 发现：${JSON.stringify(socialFindings).slice(0, 4000)}...
3. Technical Agent 发现：${JSON.stringify(techFindings).slice(0, 4000)}...

要求：
1. 按 PSP 框架（人物-场景-问题）组织报告。
2. 交叉验证三个渠道的发现，标注置信度（高/中/低）。
3. 明确回答：文档站 vs 演示，哪个赛道更优先？
4. 给出产品机会评分（1-10）和 MVP 路径建议。
5. 所有关键论断必须标注来源 [id]。
6. 严格禁止使用 WebSearch/WebFetch；只基于已有输入数据综合。

输出 JSON 严格符合以下 schema（中文内容）：
${JSON.stringify(REPORT_SCHEMA)}
`,
  { schema: REPORT_SCHEMA, label: 'synthesize: PSP report', model: 'deepseek-v4-flash', effort: 'max' }
)

return report
