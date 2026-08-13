# 验收准则：CAP-001 能力协议（08-roadmap Phase 6 P0；01-product-positioning v3 原则零 Agent-First）
# 实现位置：packages/cli/src/capabilities.ts（生成器）+ build.ts / dev-server.ts / bundle.ts（三形态）
#          + packages/cli/src/agents.ts + init.ts（AGENTS.md）+ packages/mcp-server/src/tools.ts（get_capabilities）

Feature: 能力协议（CAP-001）
  让 Agent 写内容前知道"这个站能渲染什么"：capabilities.json 是机器可读的能力清单
  （Markdown 扩展语法 / 插件能力 / frontmatter 约定 / Agent 端点），AGENTS.md 是同一
  清单的人/Agent 可读形态——单一事实来源，不猜、不试错（01 §原则零）。

  Scenario: CAP-001 build 产出 capabilities.json
    Given 运行 doclight build
    Then 产物含 capabilities.json
    And 含扩展语法白名单（id/title/degradation，与渲染内核注册表一致）
    And 含启用插件列表（name/version/capabilities；如 mermaid 插件声明 ["mermaid"]）
    And 含 frontmatter 约定键清单（title/description/priority/tags/category 等）
    And 含 Agent 接口端点（llms.txt / llms-full.txt / docs.json / search-index.json / capabilities.json）
    And 含 MCP 工具列表（与 mcp-server 注册表一致，get_capabilities 置首）

  Scenario: CAP-001 capabilities.json 三形态一致
    Given dev server 运行中
    Then GET /capabilities.json 返回同 schema 能力清单（dev 形态实时计算）
    Given 运行 doclight bundle
    Then 产物目录含 capabilities.json（bundle 形态 markdownAlternate=false：单文件无独立页面 URL）
    And 三形态 schemaVersion/扩展/工具列表一致

  Scenario: CAP-001 MCP get_capabilities 工具
    Given MCP Server 加载产物站点（含 capabilities.json）
    Then get_capabilities 返回完整能力清单（source=capabilities.json）
    Given 产物缺失 capabilities.json
    Then get_capabilities 诚实降级：complete=false + 重建提示 + 可推导的最小信息（不伪造）

  Scenario: CAP-001 AGENTS.md 生成
    Given 运行 doclight init
    Then 项目根生成 AGENTS.md（内容写作 Agent 入口）
    And 含支持的 Markdown 语法（内置扩展 + 插件能力）
    And 含 frontmatter 约定与构建发布链（dev/build/preview/publish）
    And 含 Agent 接口端点清单
    And 内容由 capabilities.json 同源生成（buildAgentsMd(buildCapabilityManifest(...))）
