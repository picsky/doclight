# 验收准则：DEV-001 dev server（形态① 首屏直出 + 热重载）
# 对应设计：02-architecture §2.4、03-runtime-engine §3.1.2
# 实现位置：packages/cli/src/dev-server.ts

Feature: dev server
  doclight dev 一条命令在本地启动文档站，请求即得完整渲染页面。

  Scenario: 首屏直出
    Given 文档根目录含 README.md 与若干 .md
    When 请求 / 或 /path/to/doc
    Then 返回完整 HTML（内容服务端渲染、导航内联、sanitize 已生效）

  Scenario: 路径路由
    Given 文档 guide/quickstart.md 存在
    When 请求 /guide/quickstart.md 或 /guide/quickstart
    Then 均渲染同一文档（带/不带 .md 后缀）

  Scenario: frontmatter 标题进页面标题
    Given 文档 frontmatter 含 title
    When 请求该文档
    Then <title> 使用 frontmatter title

  Scenario: XSS 注入被清除
    Given 文档含 <script> 注入
    When 请求该文档
    Then 返回 HTML 不含可执行脚本

  Scenario: 导航数据端点
    Given 站点含目录分组
    When 请求 /__doclight/docs.json
    Then 返回 version 1 与嵌套导航树

  Scenario: 热重载推送
    Given 浏览器已连接 /__doclight/events
    When 文档目录文件变更
    Then SSE 推送 reload 事件

  Scenario: 路径穿越防护
    When 请求包含 ../ 的越界路径
    Then 返回 404
