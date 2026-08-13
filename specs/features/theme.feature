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

## THEME-002 主题包（CSS 变量覆盖层）

Feature: 内置主题与自定义主题 CSS

  Scenario: 内置主题注册表含 minimal / warm
    Given doclight-cli 的 BUILTIN_THEMES
    Then 含 minimal 与 warm
    And 两者均覆盖 :root 设计令牌且含 [data-theme="dark"] 暗色令牌

  Scenario: theme 配置注入主题覆盖层
    Given doclight.json theme:"minimal"
    When buildSite()
    Then 产物 HTML 含 <style data-doclight-theme> 且内容覆盖 --color-primary

  Scenario: 缺省与 default 零注入
    Given theme 缺省或 "default"
    When resolveThemeCss()
    Then 返回空字符串（模板内置令牌即默认主题）

  Scenario: 自定义 CSS 文件路径加载
    Given theme 指向存在的 CSS 文件
    When resolveThemeCss()
    Then 返回文件内容

  Scenario: 未知主题警告并回退默认
    Given theme:"nonexistent"
    When resolveThemeCss()
    Then 输出警告
    And 返回空字符串（回退默认，不伪造成功）
