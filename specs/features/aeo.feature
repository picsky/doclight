# 验收准则：AEO-001 发布产物 Agent 友好（08-roadmap Phase 6 P0；research/product-vision-validation.md §二）
# 实现位置：packages/cli/src/build.ts（.md 副本 + 产物）+ site.ts（renderPage head 链接）+ tokens.ts（估算）
#          + llms.ts（token 计数）+ build.ts/docs.json（结构化元数据）

Feature: 发布产物 Agent 友好（AEO-001）
  发布后的站点 Agent 读取最优：每页有 markdown 版本（免解析 HTML）、llms.txt v2 Link
  关系（rel=describedby）、token 计数（读取成本一级指标——Agent 先评估再读全文）。

  Scenario: AEO-001 每页 markdown 版本
    Given 运行 doclight build
    Then 产物含每篇 .md 源文件（与 .html 同相对路径，如 guide/foo.md）
    And 每页 <head> 含 <link rel="alternate" type="text/markdown" href="...">
    And 首页的 markdown 版本指向根级 README/index 源路径
    And sitemap.xml 不含 .md URL（SEO 不重复收录）

  Scenario: AEO-001 llms.txt v2 Link 关系
    Given 运行 doclight build
    Then 每页 <head> 含 <link rel="describedby" href=".../llms.txt">
    And dev 形态不输出 describedby（dev 不产出 llms.txt，不输出死链）

  Scenario: AEO-001 token 计数
    Given 运行 doclight build
    Then docs.json 每篇含 tokens（启发式估算，CJK×0.75 + 非CJK词×1.3，上取整）
    And docs.json 头部含 totalTokens
    And llms.txt 头部含总 token 数，条目含"约 N tokens"
    And llms-full.txt 头部含总 token 数
    And 每页 <head> 含 <meta name="doclight:tokens" content="N">
    And --base 子路径部署时 alternate/describedby href 带前缀
