# 验收准则：DEMO-001 演示形态（08-roadmap Phase 6 P2；01 §原则二 同源不同形）
# 实现位置：packages/cli/src/slides.ts（解析 + 构建）+ index.ts（doclight slides 命令）
#          + .claude/skills/doclight-slides/（Agent 编排）+ docs/slides.md + scripts（视觉回归）

Feature: 演示形态（DEMO-001）
  与文档同源不同形：同一渲染内核，独立的表现形式——每页一个观点、强视觉、少文字、
  逐页叙事；演示质量由演示专用视觉组件（布局/主题）保证，绝不做「文档切页成演示」。

  Scenario: DEMO-001 演示源解析
    Given 一个 markdown 文件（frontmatter + `---` 分页）
    Then frontmatter 元数据提取（title/author/date；frontmatter 块不算分页）
    And `---` 正确分页（每页一个观点）
    And 布局指令 `<!-- layout: cover/section/content/end -->` 生效
    And 首页缺省自动 cover，其余缺省 content
    And 演讲者备注 `<!-- notes: -->` 提取且不进正文

  Scenario: DEMO-001 自包含产物
    Given 运行 doclight slides <file.md>
    Then 输出自包含单文件 HTML（CSS + 导航 JS 内嵌，无外部脚本/样式，file:// 可开）
    And 每页渲染为 .slide section（data-layout + data-notes 承载）
    And 内容经渲染内核 sanitize（XSS 不注入；备注转义注入）
    And 壳层功能：键盘/触摸导航、URL #N 直达、进度条、页码、全屏、演讲者备注视图
    And 打印每页一页 + prefers-reduced-motion 尊重

  Scenario: DEMO-001 演示主题
    Given --theme 参数
    Then 内置三套：dark（默认深色）/ light（亮色）/ warm（暖色）
    And 自定义 CSS 文件路径生效（--slide-* 令牌覆盖）
    And 未知主题警告 + 回退 dark（诚实原则）

  Scenario: DEMO-001 视觉回归门禁
    Given npm run verify（visual check）
    Then 演示产物构建到 artifacts/visual/slides-demo.html（含壳层 + 体积预算 ≤100KB）
    And verify:visual 含演示截图基线（封面 + 内容页，file:// 直开）
