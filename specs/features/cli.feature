# 验收准则：CLI-001 init / CLI-002 bundle / CLI-003 deploy / CLI-004 migrate-docsify
# 对应设计：05-ssg-build §5.2.1（命令清单）+ §5.3.4（bundle）+ §5.5（deploy）+ 13-deployment-distribution §2.1 + 08-roadmap Phase 3
# 实现位置：packages/cli/src/{init,bundle,deploy,migrate}.ts

Feature: DocLight CLI 全命令（init / bundle / deploy / migrate-docsify）
  零依赖 CLI（原生 process.argv + 原生 git），每个命令都有可机器验证的产出。

  Scenario: CLI-001 doclight init 初始化新项目
    Given 一个空目录
    When 运行 doclight init --title "我的文档站"
    Then 生成 doclight.json（title/description/docsDir）
    And 生成示例 docs/（README.md + guide/start.md）
    And 生成 index.html（自包含入口页）
    And 重复运行幂等（已存在文件跳过，--force 覆盖）

  Scenario: CLI-002 doclight bundle 单文件便携包
    Given 一个含多篇 Markdown 的 docs/ 目录
    When 运行 doclight bundle
    Then 输出单个 doclight.html（pages/titles/nav/searchIndex 内嵌 + 展示层内联）
    And file:// 打开可用：内容直出、hash 导航、搜索命中内嵌索引、主题切换
    And 零网络请求（导航与索引不发起 fetch）

  Scenario: CLI-003 doclight deploy 一键部署
    Given 一个含 GitHub 远程的 git 仓库
    When 运行 doclight deploy
    Then 自动以 /<repo>/ 为 base 构建（项目页 URL 正确）
    And 产物推送到 gh-pages 分支（.nojekyll 含，Jekyll 不干扰）
    And 返回可用 URL（https://<user>.github.io/<repo>/）
    Given 无 GitHub 远程或平台为 cloudflare-pages/netlify
    Then 输出人工步骤指引（不伪造成功）

  Scenario: CLI-004 migrate-docsify 基本迁移
    Given 一个 docsify 站点（含 _sidebar.md / _navbar.md）
    When 运行 doclight migrate-docsify
    Then 复制全部 .md 到 docs/（保持目录结构）
    And 跳过 _sidebar.md / _navbar.md / index.html（自动导航替代）
    And 解析 _sidebar 导航顺序写入报告
    And 幂等（目标已存在不覆盖）

## MIG-001 MkDocs 迁移

Feature: doclight migrate-mkdocs（mkdocs.yml 解析 + admonition 转换）

  Scenario: admonition 转换为 DocLight 容器
    Given Markdown 含 !!! note / !!! warning "标题" / !!! danger
    When convertMkDocsAdmonitions()
    Then 转换为 :::info / :::warning（含标题行）/ :::danger
    And 4 空格缩进被剥离
    And 未映射类型原样保留

  Scenario: mkdocs.yml 解析
    Given mkdocs.yml 含 site_name 与 nav 列表
    When parseMkdocsConfig() / parseMkdocsNav()
    Then 提取 docs_dir（缺省 docs）与 site_name
    And nav 解析为有序路径列表

  Scenario: migrate-mkdocs 端到端
    Given 一个 MkDocs 项目（mkdocs.yml + docs/*.md）
    When 运行 doclight migrate-mkdocs
    Then 复制 .md 且 admonition 已转换
    And 报告含 site_name 建议（写入 doclight.json title）
    And 幂等

## MIG-002 GitBook 迁移

Feature: doclight migrate-gitbook（SUMMARY.md 解析 + hint/code 块转换）

  Scenario: hint / code 块转换
    Given Markdown 含 {% hint style="info" %} 与 {% code title="x.js" %}
    When convertGitBookBlocks()
    Then hint 转换为 :::info 容器
    And code 转换为 ```js 围栏（语言取扩展名）
    And 未映射 style 原样保留

  Scenario: migrate-gitbook 端到端
    Given 一个 GitBook 仓库（SUMMARY.md + *.md）
    When 运行 doclight migrate-gitbook
    Then 解析 SUMMARY.md 导航顺序写入报告
    And 复制 .md 且 hint/code 已转换
    And 跳过 SUMMARY.md
    And 幂等

  Scenario: CLI-007 doclight embed 嵌入分发（13 §3.1）
    Given 构建后的站点产物（dist-site/）
    When 运行 doclight embed
    Then 生成 snippet.js（自推导基址：从自身 script src 定位站点目录）
    And snippet.js 自动注入响应式 iframe（width 100% + 同源高度自适应 + 异源降级 minHeight）
    And 返回可复制的 <iframe> 代码块（--site-url 时含绝对地址）
