# 验收准则：THEME-001 完整主题令牌（03 §3.6 + 04 §4.3）

Feature: 完整主题令牌（设计令牌即视觉规范）

  Scenario: 页面暴露完整设计令牌集
    Given 任意页面加载
    Then :root 定义完整令牌：品牌色 / 8 级灰阶 / 语义色 / 字体栈 / 字号缩放 / 行高 / 间距 / 布局 / 圆角 / 阴影 / 过渡
    And 组件样式全部消费令牌变量（不硬编码色值间距）

  Scenario: 暗色模式覆盖令牌
    Given 页面处于暗色模式（data-theme="dark"）
    Then 灰阶、语义色、阴影令牌切换为暗色值

  Scenario: 主题切换按钮翻转令牌效果
    Given 用户点击主题切换按钮
    Then 页面令牌在亮/暗两套之间切换
    And 选择持久化到 localStorage

  Scenario: 无标题文章时正文排版不受影响
    Given 页面内容为纯段落
    Then 正文字号 16px、行高 1.75、行宽 680px（04 §4.2）
