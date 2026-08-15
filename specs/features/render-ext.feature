# 验收准则：REND-002 扩展语法注册表 / REND-003 Mermaid 容错 / REND-004 双读友好
# 对应设计：08-roadmap §Phase 2 扩展语法渲染 + research-report §6.3 MVP
# 实现位置：packages/renderer/src/extensions/（注册表/容器/代码块/KaTeX 标记）+ packages/display/src/extensions.ts（懒加载增强）+ packages/cli/src/dev-server.ts（vendor 端点与样式）
# PLUG-012（2026-08）：Mermaid 已从内置默认扩展迁移为 @doclight/plugin-mermaid 官方插件——
#   重 vendor 依赖按需启用；围栏渲染（fallback 标记）由插件 extendMarked 提供，容错渲染
#   由插件运行时钩子提供，样式/vendor 由插件声明（specs/features/plugin.feature §PLUG-012）。

Feature: 扩展语法渲染（白名单式注册表，零构建）
  扩展语法在 Node 渲染内核标记、浏览器展示层按需懒加载增强；不引入 MDX/JSX，展示层体积不因扩展增长。
  # 设计对齐（2026-08-16）：新增 Tabs / 步骤 / 代码块文件名头 / 图解 SVG 白名单（宪法 §4.5）。

  Scenario: REND-002 白名单式注册表默认全开（轻/零依赖扩展）
    Given 一个含扩展语法的文档站（不写任何配置）
    When 渲染一篇含容器/代码块/KaTeX/Tabs/步骤的 Markdown
    Then 五种内置扩展全部渲染为带 class 标记的 HTML
    And 未知容器类型不识别（降级为普通段落）
    And mermaid 围栏按普通代码块渲染（未启用插件，PLUG-012 迁移语义）

  Scenario: REND-002 代码高亮 + 复制按钮（设计对齐：代码块头部条）
    Given 含语言围栏代码块的 Markdown（可带 title="文件名"）
    When 渲染并加载展示层
    Then 代码块输出 codeblock/code-head（文件名 + 语言 + 复制按钮直出）+ language-* 标记
    And Prism 懒加载后高亮 token；复制按钮点击反馈「✓ 已复制」（1.6s 恢复）

  Scenario: REND-002 Tabs 容器（:::tabs / :::tab，跨组联动）
    Given :::tabs 含多个 :::tab <名> 小节
    When 渲染并加载展示层
    Then 输出 tab-bar/tab-btn/tab-panel（首个激活），每节内层 Markdown 完整渲染
    And 点击任一 tab 名 → 全站同名 tab/panel 全局联动（名即键）
    And 无 JS 时首个面板直出可见（纯 CSS 标记降级）

  Scenario: REND-002 步骤容器（:::steps）
    Given :::steps 含有序列表，每项首段 **加粗**
    When 渲染
    Then 输出 ol.steps + 每项 span.step-title（标题块）+ 正文段落，纯 CSS 计数

  Scenario: REND-002 图解 SVG 白名单（宪法 §4.5）
    Given Markdown 内嵌 <figure class="diagram"> + inline SVG（d-box/d-edge 等 token 类）
    When 渲染
    Then SVG 安全子集存活（节点/连线/标注 + class 令牌）
    And svg 内 script/onload/危险 URL/链接元素全部清除（注入断言常驻）

  Scenario: REND-003 Mermaid 容错渲染不白屏（启用 @doclight/plugin-mermaid 时）
    Given doclight.json 启用 mermaid 插件，且含 LLM 生成的 Mermaid 语法错误代码块
    When 渲染并加载展示层
    Then 围栏输出 .doclight-mermaid fallback（class 标记 + 源码子元素）
    And 渲染失败时保留图表源码 + 错误提示，页面不白屏
    And Mermaid 源码在 sanitize 后完整保留（不依赖 data-* 属性）

  Scenario: REND-002 自定义容器
    Given :::tip / :::warning / :::danger / :::info 容器
    When 渲染
    Then 输出 doclight-container + 对应类型 class，内层 Markdown 完整渲染

  Scenario: REND-002 KaTeX 公式标记
    Given 含 $…$ 内联与 $$…$$ 块级公式的 Markdown
    When 渲染并加载展示层
    Then 懒加载 KaTeX 后渲染为数学排版
    And 未加载时 TeX 源码可见（降级可读）

  Scenario: REND-004 双读友好（扩展渲染不破坏 agent 消费原稿）
    Given 含扩展语法的 Markdown 源文件
    When 渲染生成站点
    Then 原始 .md 源文件不被修改（llms.txt/MCP 仍返回纯 markdown 原稿）
    And 扩展内容仅存在于渲染产物标记，源码保持可读

  Scenario: XSS 安全（扩展放大攻击面被白名单收敛）
    Given 扩展语法内注入脚本/事件属性/危险 URL
    When 渲染
    Then 输出 HTML 不含可执行脚本（脚本被转义/清除）
    And 合法扩展标记（class）保留，渲染不中断
