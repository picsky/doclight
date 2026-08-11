# 验收准则：NAV-001 导航树生成（docs.json）
# 对应设计：03-runtime-engine §3.4
# 实现位置：packages/renderer/src/nav.ts

Feature: 导航树生成
  由文件路径列表生成嵌套导航树与 docs.json，浏览器展示层据此渲染侧边栏。

  Scenario: README 置顶，文件在前、目录在后，字母序
    Given 文件列表含 README.md、intro.md、quickstart.md、guide/ 下两篇
    When 调用 buildNavTree()
    Then 导航树按 README.md → intro.md → quickstart.md → guide/ 排序

  Scenario: 数字前缀优先
    Given 文件列表含 02-guide.md 与 01-intro.md
    When 调用 buildNavTree()
    Then 01-intro.md 排在 02-guide.md 前，且先于无数字前缀的文件

  Scenario: 目录分组与置顶页
    Given 目录 guide/ 内含 README.md、basic.md、advanced.md
    When 调用 buildNavTree()
    Then 生成 group 节点（index 指向 guide/README.md）
    And 组内 README.md 置顶

  Scenario: docs.json 输出
    Given 若干文件路径
    When 调用 buildDocsJson()
    Then 输出 version 1、generatedAt 与嵌套 nav 树
