# 验收准则：VIS-001 表现层设计系统化（08-roadmap Phase 6 P1；11-default-themes 全规格）
# 实现位置：packages/cli/src/themes/*.css（4 套设计语言）+ themes.ts（主题包模型）
#          + packages/cli/src/gallery.ts（主题画廊）+ design-compliance.ts（机器化合规）
#          + scripts/checks/visual.mjs（verify visual check）+ scripts/visual-regression.spec.ts（像素级回归）

Feature: 表现层设计系统化（VIS-001）
  4 套完整设计语言（Minimal/Serif/Modern/Warm，各自排版/色彩/组件/暗色独立成立）+
  主题画廊对比页 + 机器化视觉门禁（设计合规 + 像素级回归）——视觉质量靠机器保障，不靠主观判断。

  Scenario: VIS-001 4 套设计语言兑现
    Given 内置主题注册表（BUILTIN_THEMES）
    Then 含 minimal / serif / modern / warm 四套
    And serif 含衬线标题与深靛蓝主色（#1e3a5f）与米白纸感背景
    And modern 含 violet 主色（#7c3aed）与暗色优先结构（:root 即暗色）
    And warm 含暖橙主色（#d97706）与 12px 大圆角
    And 每套含亮/暗两套令牌（暗色不是亮色的简单反色）

  Scenario: VIS-001 主题包默认模式（modern 首次进入即暗色）
    Given doclight.json theme:"modern"
    When buildSite() 或 dev server 渲染页面
    Then 页面防闪烁脚本含默认暗色声明（localStorage 无记录时进暗色）
    And 亮色主题包无默认模式声明（跟随系统偏好）

  Scenario: VIS-001 主题画廊（preview/build --themes）
    Given 运行 doclight build --themes
    Then 产物含 gallery/ 目录：索引页 + 4 主题 × 亮/暗 共 9 个 HTML
    And 每面板用同一篇内置示例文档渲染（覆盖标题/代码/表格/容器/公式/图表/引用/列表）
    And 面板 fixedTheme 钉死模式（不依赖 localStorage/系统偏好，对比纯净）
    Given 运行 doclight preview --themes
    Then 先构建画廊再服务产物（/gallery/ 可访问）

  Scenario: VIS-001 设计合规机器化门禁（verify visual check）
    Given 默认主题与 4 套内置主题 CSS
    Then 对比度合规：text/text-strong/text-secondary 对背景 ≥ 4.5（WCAG AA），primary ≥ 3
    And 间距合规：--space-* 全部为 4px 倍数（8pt 网格）
    And 字号合规：从 base 起相邻比例 ≈1.25（模块化缩放，±0.08）
    And verify 含 visual check（脚本直读 themes/*.css 断言 + 画廊产物校验）

  Scenario: VIS-001 像素级视觉回归（verify:visual，基线人工锁定）
    Given 运行 npm run verify:visual:update（首次生成基线，人确认后锁定）
    Then 生成 4 主题 × 亮暗 × 3 断点（1440/768/375）共 24 张基线截图
    Given 基线已锁定后运行 npm run verify:visual
    Then 与基线 diff（maxDiffPixelRatio 0.01），偏离即失败并产出差异
    And 只跑 chromium（跨浏览器字体差异不污染基线）
