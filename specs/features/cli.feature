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
