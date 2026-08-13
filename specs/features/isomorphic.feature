# 验收准则：SNAP-001 同构快照（三形态渲染一致性，Phase 0 遗留）
# 对应设计：08-roadmap 风险表「三形态产物不一致」+ 03-runtime-engine §3.1（渲染唯一在 Node 内核）
# 实现位置：packages/cli/test/isomorphic.test.ts

Feature: 同构快照（dev / SSG / bundle 三形态内容一致）
  渲染唯一在 Node 内核（renderer），三形态（dev 热渲染 / SSG 静态导出 / bundle 单文件）
  对同一篇 Markdown 必须产出相同的内容 HTML。允许差异仅限：
  链接后缀（决策⑤：dev 保持 .md、SSG/bundle 转 .html）与页面外壳（导航/标题/水合脚本）。

  Scenario: SNAP-001 三形态逐页内容一致
    Given 一个含标题/段落/内链/表格/代码块的 docs/ 夹具
    When 分别经 buildSite（SSG）、bundleSite（bundle）、dev server 渲染
    Then 三形态的内容区（<article> 内）在归一链接后缀后逐页相等
    And 表格 / 强调 / 行内代码 / 代码块均渲染进内容区
