# 验收准则：TOC-001 本页目录（03 §3.7）

Feature: 本页目录（TOC）

  Scenario: 有标题的文章自动生成目录
    Given 一篇含多个 h2/h3 标题的文档
    When 页面加载完成
    Then 桌面端右侧出现目录导轨（指示点 + hover 展开面板）
    And 移动端右下角出现目录浮动按钮，点击弹出底部面板
    And 目录只包含 h2/h3（不含 h1 与 h4+）

  Scenario: 点击目录跳转到对应章节
    Given 目录已生成
    When 用户点击某个目录项
    Then 页面平滑滚动到对应标题（标题不被顶栏遮挡）
    And URL 锚点同步更新

  Scenario: 滚动时高亮当前章节
    Given 目录已生成
    When 用户滚动页面
    Then 当前视口附近的标题在目录中高亮

  Scenario: 无标题的页面不显示目录
    Given 一篇没有任何 h2/h3 的文档
    When 页面加载完成
    Then 不显示任何目录 UI

  Scenario: SPA 导航后目录跟随新页面重建
    Given 用户正在阅读 A 文档
    When 通过站内链接导航到 B 文档
    Then 目录更新为 B 文档的标题结构
