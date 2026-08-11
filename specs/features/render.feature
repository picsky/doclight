# 验收准则：REND-001 Node 渲染内核（marked + DOMPurify sanitize + frontmatter）
# 对应设计：03-runtime-engine §3.3、02-architecture §2.3.1/§2.3.7
# 实现位置：packages/renderer/src/

Feature: Node 渲染内核
  Node 侧统一渲染 Markdown 为已消毒 HTML，浏览器展示层不接触原始 Markdown。

  Scenario: GFM 语法完整渲染
    Given 一个含表格、任务列表、删除线的 Markdown
    When 调用 render()
    Then 输出 HTML 包含 table 包裹容器、删除线 <del> 与任务列表 checkbox

  Scenario: 标题注入锚点 id
    Given 含多级标题的 Markdown
    When 调用 render()
    Then 每个标题带 id 锚点（中文保留，英文归一化为连字符）

  Scenario: 相对链接与图片路径修正
    Given 当前文档路径为 guide/quickstart.md
    When 渲染含 [x](other.md) 与 ![logo](../img/logo.png) 的 Markdown
    Then 链接解析为 guide/other.md，图片解析为 img/logo.png（../ 归一化）
    And 外部链接带 target="_blank" rel="noopener"

  Scenario: XSS 注入被清除（强制安全层）
    Given 恶意 Markdown（script 标签 / javascript: URL / onerror 事件属性 / iframe / 实体绕过）
    When 调用 render()
    Then 输出 HTML 不含可执行脚本、危险 URL 与事件属性
    And 合法内容（段落/加粗）保留

  Scenario: frontmatter 被提取
    Given 带 frontmatter 的 Markdown（title/summary/tags）
    When 调用 render()
    Then 返回的 frontmatter 含对应字段
    And 正文不含 frontmatter 块
