# 验收准则：SRCH-001 内置搜索（03 §3.5）

Feature: 内置全文搜索（零配置）

  Scenario: Cmd/Ctrl+K 打开搜索框并实时搜索
    Given 一个只有 docs/ 文件夹的站点
    When 用户按 Cmd/Ctrl+K 打开搜索框并输入关键词
    Then 搜索结果即时返回（100ms 防抖）
    And 结果含标题、路径面包屑与命中摘要

  Scenario: 中文搜索可用
    Given 文档包含中文正文
    When 用户输入中文关键词
    Then 结果命中对应文档（单字/二元组匹配）

  Scenario: 键盘导航选择并打开结果
    Given 搜索框已打开且有多条结果
    When 用户按 ↓ 选择结果并按 Enter
    Then 通过 SPA 导航打开对应文档（无整页刷新）
    And 搜索框关闭

  Scenario: 搜索结果高亮与路径面包屑
    Given 搜索出结果
    Then 标题与摘要中的命中词以强调色高亮
    And 每个结果显示文档路径

  Scenario: 索引懒加载
    Given 页面首屏加载完成
    When 用户尚未打开搜索框
    Then 不发起搜索索引请求
    When 用户首次打开搜索框
    Then 懒加载搜索索引并显示"正在构建索引…"

  Scenario: 最近搜索记录
    Given 用户曾搜索并打开过结果
    When 再次打开搜索框且输入为空
    Then 显示最近搜索记录（localStorage 持久化，最多 5 条）

  Scenario: 搜索索引持久化（03 §3.8.5：localStorage + 版本校验）
    Given 页面内联 window.DOCLIGHT_SEARCH_VERSION（内容哈希）
    When 用户首次打开搜索框
    Then 构建索引并写入 localStorage（键含版本）
    When 内容未变化再次打开搜索框
    Then 版本命中直接使用缓存，免去搜索索引网络请求
    And 内容变化（构建版本变化）后旧缓存失配，重建索引
    Given bundle 形态（单文件）
    Then 索引内嵌（__DOCLLIGHT_BUNDLE__.searchIndex），零网络直接构建
