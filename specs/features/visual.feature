# 验收准则：VIS-001 表现层设计系统化（08-roadmap Phase 6 P1；11-default-themes 全规格）
# 实现位置：packages/cli/src/themes/*.css（DP-001 唯一内置主题）+ themes.ts（主题包模型）
#          + packages/cli/src/gallery.ts（主题画廊）+ design-compliance.ts（机器化合规）
#          + scripts/checks/visual.mjs（verify visual check）+ scripts/visual-regression.spec.ts（像素级回归）

Feature: 表现层设计系统化（VIS-001；DP-001 单主题收敛）
  松绿 Pine 单设计语言（默认主题）+ 主题画廊页 + 机器化视觉门禁（设计合规 + 像素级回归）
  ——视觉质量靠机器保障，不靠主观判断。2026-08-16 用户决策：只做一套主题，
  serif/modern/warm 三套完全退役（自定义 CSS 主题机制保留）。

  Scenario: DP-001 单主题收敛
    Given 内置主题注册表（BUILTIN_THEMES）
    Then 含 minimal 且仅此一套（serif / modern / warm 已退役并警告降级）
    And minimal 与默认设计语言一致（松绿 Pine #14714e，宪法圆角 8/10px）
    And 每套含亮/暗两套令牌（暗色不是亮色的简单反色）

  Scenario: THEME-002 主题包默认模式（自定义主题可声明暗色优先）
    Given 自定义 CSS 主题包声明 defaultTheme:"dark"
    Then 页面防闪烁脚本含默认暗色声明（localStorage 无记录时进暗色）
    And 未声明默认模式的主题包跟随系统偏好

  Scenario: VIS-001 主题画廊（preview/build --themes）
    Given 运行 doclight build --themes
    Then 产物含 gallery/ 目录：索引页 + 1 主题 × 亮/暗 共 3 个 HTML
    And 每面板用同一篇内置示例文档渲染（覆盖标题/代码/表格/容器/公式/图表/引用/列表）
    And 面板 fixedTheme 钉死模式（不依赖 localStorage/系统偏好，对比纯净）
    Given 运行 doclight preview --themes
    Then 先构建画廊再服务产物（/gallery/ 可访问）

  Scenario: VIS-001 设计合规机器化门禁（verify visual check）
    Given 默认主题与内置主题 CSS
    Then 对比度合规：正文 ≥ 7（AAA）/ 辅助 ≥ 4.5（AA）/ 强调 ≥ 3（宪法 §3.1）
    And 间距合规：--space-* 全部为 4px 倍数（8pt 网格）
    And 字号合规：全部命中宪法 §3.2 批准类型阶
    And verify 含 visual check（脚本直读 themes/*.css 断言 + 画廊产物校验）

  Scenario: VIS-001 像素级视觉回归（verify:visual，基线人工锁定）
    Given 运行 npm run verify:visual:update（首次生成基线，人确认后锁定）
    Then 生成 1 主题 × 亮暗 × 3 断点（1440/768/375）共 6 张基线截图
    Given 基线已锁定后运行 npm run verify:visual
    Then 与基线 diff（maxDiffPixelRatio 0.01），偏离即失败并产出差异
    And 只跑 chromium（跨浏览器字体差异不污染基线）
