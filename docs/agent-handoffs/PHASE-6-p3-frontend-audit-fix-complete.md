# PHASE-6 P3 · 前端全量审查与修复完成（A+B 落地）

> 完成时间：2026-08-15　需求链路：前端审查（P0 产物脱节 / P1 结构性缺陷 / P2 一致性收敛）
> 交接文档格式见 `agent-handoffs/README.md`。本阶段 = 对 04/11/16 三份设计文档 + 展示层/主题/壳层做系统审查后，把「门禁、产物、源码、设计库、规格」五面一次性收敛到闭环。

## 一、背景

2026-08 前端审查发现（4 路并行深度审查 + 真实浏览器实测）：

1. **P0 产物与源码脱节**：仓库内 `dist-site/` 是修复前陈旧构建——`display.js` 双 `winGlobal` 声明，
   `type="module"` 加载即 SyntaxError，搜索/TOC/复制/主题切换/SPA 全部瘫痪；门禁没拦住（e2e 假绿 +
   视觉回归产物缺失即 skip + 合规断言只查 6 个 token）。
2. **P1 结构性缺陷**：head 插槽 span 破坏 HTML5 解析（SEO 元数据全落 body）、侧边栏显示文件名而非
   frontmatter 标题、焦点环 token 三命名断链、正文链接对比度不达 AA（默认亮色 teal-600 仅 3.57:1）、
   插件 onRouteChange 取消/重定向契约失效、SPA 不滚顶/吞修饰键/子路径 base 断裂/首页不激活/失败静默、
   移动端关闭态抽屉可 Tab 聚焦等。
3. **P2 一致性**：warm 暗色代码 token 坍缩、minimal 与默认令牌不一致、设计库孤儿产物、UI Kit 双维护、
   规格文档系统性滞后（04/03 未回写）、16 文档算术错误（36→24）。

## 二、本阶段交付（A 工程基线 + B 设计系统收敛）

### 1. 门禁加固（scripts/）

- `scripts/lib/report.mjs`：`mkResult` 对 `total === 0` 一律判 fail（0 用例 = 未验证）——杜绝残留空报告假绿
- `scripts/checks/e2e.mjs`：运行前删除旧报告 + 校验 Playwright 退出码（非 0 显式失败并带 stderr 证据）
- `scripts/visual-regression.spec.ts`：产物缺失从 `test.skip` 改为 `beforeAll` throw（整组失败，0 像素被比较 = 假绿不再可能）
- `package.json`：`verify:visual` / `verify:visual:update` 前置 `node scripts/checks/visual.mjs`（先构建画廊/演示产物再截图）
- **新增 `scripts/checks/smoke.mjs` 并接入 verify（第 8 项 check）**：真实浏览器加载「CLI 现构建的 SSG 产物」，
  断言：无页面 JS 错误 / window.doclight 挂载 / TOC 渲染 / head 结构完整 / 导航高亮 / 侧边栏用标题 /
  搜索可开 / SPA 导航 + 面包屑同步——直接防止「源码修好、产物没重建」类事故回归

### 2. CLI 构建管线（OSS-001 遗留落地）

- **`scripts/build-cli.mjs`**（esbuild）：`packages/cli/src` → 自包含 `packages/cli/dist/cli.mjs`
  （external：jsdom/@resvg/resvg-js/qrcode——均为 CLI 直接依赖）；主题 CSS 复制到产物旁（themes.ts 按 import.meta.url 读取）
- `scripts/build.mjs` / `scripts/verify.mjs` 编排接入（Node ≥20 可直接 `node packages/cli/dist/cli.mjs`）
- `package.json`：根 devDeps + `esbuild`；`packages/cli` deps + `jsdom`（运行时经 renderer 依赖）、`bin` 指向 dist/cli.mjs
- **`dist-site/` 已用当前源码重建**（50 页 + 主题画廊；gitignored 构建产物）

### 3. 页面壳修复（packages/cli/src/site.ts 等）

- **head 插槽改 `<template data-doclight-slot>`**（head 内 span 会触发 HTML5 隐式开 body）——
  实测修复：head 内 meta/title 恢复正常位置，SEO-001/002 恢复生效
- **导航标题**：新增 `collectNavTitles`（读 frontmatter.title），dev/build/bundle 三入口接线——
  侧边栏从此显示「Agent 接入指南」而非 `agent-guide`
- 导航分组 `ul` 直嵌 `ul` 非法嵌套修复（renderNav）
- 焦点环 token 统一消费 `--ring-color`（--color-ring/--ring 三命名断链修复）
- 新增 `--color-link / --color-link-hover`（正文链接专用色：亮色 teal-700 / 暗色 teal-400，AA 4.5）；
  `article a` 消费之；暗色块补 link 覆盖（CSS 变量继承陷阱）
- 暗色 muted 提亮 `#80808a`（4.14→4.95）；`color-scheme: light/dark`（原生控件随主题）
- 移动端 44px 触摸目标（icon-btn/search-trigger/back-to-top）；`toc-sheet`/移动侧边栏/回顶按钮
  关闭态 `visibility: hidden`（不进 Tab 顺序）；复制按钮 `:focus-within` 可见
- active 光晕恢复（sidebar/toc-link——16 §9.2.5 承诺，此前被 box-shadow:none 禁用）
- TOC 指示点死代码清理（CSS/标记/渲染管线/测试）；`--space-7/9/11`、`--radius-md` 令牌补全；
  动效令牌贯通（--transition-* 引用 --ease-standard）
- 容器徽标暗色深字（暗色 warning 白字 2.87 → 深字 ≥7）
- `window.DOCLIGHT_BASE` 注入（子路径部署下导航高亮/搜索链接修复）

### 4. 展示层修复（packages/display/src/）

- **router.ts**：SPA 导航滚回顶部（含锚点定位）、修饰键/中键放行、fetch 失败降级整页跳转 +
  竞态序号、面包屑随 SPA 同步、首页导航高亮（根级 README/index 等价 "/"）、
  base 前缀归一、aria-current 同步、bundle 未知键早退
- **plugin-manager.ts**：onRouteChange 取消/重定向契约接入 `router.beforeEach` 决策链
  （此前事件在 pushState 后发出、返回值被丢弃）；`["opts"]` 私有越界写入改 `configure()`；
  生命周期注释对齐（onRouteChange 前置 / onMount 后置）
- **search.ts**：dialog/aria-modal 上移遮罩、焦点陷阱、关闭还原焦点、option 语义 +
  aria-activedescendant、status aria-live、document 级 Esc、base 前缀结果链接
- **toc.ts**：指示点死代码移除、激活项 aria-current
- **theme.ts**：auto 模式实时跟随系统偏好（matchMedia change 监听）
- **ux.ts**：回顶尊重 prefers-reduced-motion
- **extensions.ts**：ResizeObserver 特性守卫（老浏览器不再整条 mount 中断）
- **index.ts**：mount 幂等 + readyState 兜底（DOMContentLoaded 已过时直接挂载）
- **slots.ts**：template 标记（head 插槽）动态内容兄弟插入

### 5. 主题收敛（packages/cli/src/themes/*.css）

- **warm**：亮色主色 #b45309（链接 4.79）、muted 提深、暗色代码 token 坍缩 4 色→7 色展开、
  暗色注释 2.96→4.05、TOC active 卡片圆角
- **modern**：暗色主色 #8b5cf6（链接 4.53）、暗色 muted 提亮、亮色代码 token 坍缩展开为 8 色、
  TOC active 玻璃高光
- **serif**：muted 提亮（暗 3.94→5.3 / 亮 bg-soft 2.99→4.4）、代码注释提深（亮 3.04→4.99 / 暗 3.42→4.22）、
  --color-primary-light 消费（行内代码）、回顶按钮方角化修复（保持圆形）
- **minimal**：逐令牌与 DEFAULT_THEME_CSS 对齐（#ffffff→#fdfdfc 等 8 处）+ 暗色 link token

### 6. 合规门禁扩展（packages/cli/src/design-compliance.ts）

- muted 提级 ≥4.5；新增 `color-link/color-link-hover` 规则（≥4.5，未定义回退 primary）
- **checkCodeTokens**：--code-token-* 与 --code-bg ≥3（rgba 玻璃底与模式底色混合计算）
- **checkBadgeGlyph**：语义色徽标字形 ≥3（亮色白字 / 暗色深字）
- `parseColorWithBg`：rgba 颜色与背景混合（玻璃底色）

### 7. 设计库对齐（.design_library/doclight/）

- README 顶部「⚠️ 定位声明」：明示为设计参考稿、非运行时事实来源 + 「产品实现对照表」
- colors_and_type.css：暗色机制增补 `[data-theme="dark"]` 别名（与产品防闪烁脚本一致）
- css.json：6 处 isPrimary 误标移除 + color 组补全 13 个产品令牌（color-primary/link/bg-soft 等）

### 8. 规格回写（docs/tech-design/）

- **04**：标题表（32/24/20/17.6 → 39/31.25/25/20 的 1.25 链）、灰阶表（#fdfdfc/#0a0e14/muted #71717a）、
  链接样式（常态主色 + 35% 下划边线 + --color-link）、代码块细节、响应式断点（1280/768）、
  回到顶部（独立叠放 + reduced-motion）、键盘导航（焦点陷阱/aria-live 已实现；方向键/? 面板标注未实现）
- **03**：§3.6.1 令牌块全面回写（topbar 56px / toc 220px / muted / 字号链 / 间距 7/9/11 / 缓动贯通），
  §3.7.1 TOC 由「细线导轨」回写为「常驻面板」并附补记
- **11**：modern/warm 主色更新（#8b5cf6 / #b45309，含原因）、minimal token 块更新、theme.json 标注未实现
- **16**：24 组基线算术修正（36→24）、gradient-brand 公式回写实现值、最近搜索时间标签标注未实现、
  搜索面板无障碍补齐记录

### 9. 渲染内核双读一致性 + 壳层 a11y 收口（2026-08-15 补，Agent C 完整报告送达后）

- **M5 双读锚点一致**：新增 `headingPlainText`（link.ts），渲染内核 heading（markdown.ts）与大纲分析
  （analyze.ts extractHeadings）共用它生成锚点 id——含链接/行内代码的标题（`## 参见 [MDN](url)` 等）
  两侧 id 不再分叉（此前页面 id 含 `-https-mdn-dev` 噪音），docs.json/llms.txt/MCP 分节锚点直达页面
  （REND-004）；新增一致性单测
- **M6 landmark 语义**：侧边栏导航包 `<nav aria-label="站点导航">`（CSS `.sidebar > ul` → `.sidebar nav > ul`）；
  toc-panel / toc-sheet-nav 补 `aria-label="本页目录"`
- **L1**：renderNav 的 `data-path` 属性转义（防引号属性注入）
- **L4**：主题切换按钮 `aria-pressed` 状态同步（theme.ts syncPressed）

## 三、验证

- `npm run verify` 全绿（lint / typecheck / test 457 / size / contract / visual / e2e / **smoke 新增**）
- **e2e 门禁修好后立刻抓到两个预存 Bug**（此前假绿从未执行过这些断言）：
  1. `plugin-pwa` manifest `start_url` 在根部署时输出 `"//"`（空 base 回退 "/" 再拼 "/"）——已修复
  2. `e2e/extensions.spec.ts` 复制按钮定位仍按「按钮在 pre 内」的旧结构（2026-08-14 工具条已
     脱离滚动容器、与 pre 同级）——测试已按 `.doclight-code-wrap` 更新
- 视觉回归基线更新：`npm run verify:visual:update`（颜色/光晕/布局改动 → 26 张基线重生成并人工确认）
- 实测（Playwright）：桌面/暗色/移动端三态、搜索面板、SPA 导航 + 面包屑同步、Tab 顺序（屏外元素不再可聚焦）、
  head 内 meta/title 位置

## 四、遗留（诚实标注，非本阶段范围）

- `?` 快捷键帮助面板（04 §4.6.1 承诺）——待办
- 侧边栏方向键导航——待办
- 搜索「最近搜索带时间标签」（16 §4.1）——待办
- `theme.json` 结构化主题元数据 + `doclight theme new` 脚手架（11 §5）——待办
- 上一篇/下一篇分页导航（frontmatter `next` 已解析未消费）——待办
- 打印样式链接 URL（04 §4.7）——待办
- 外部链接 ↗ 图标（04 §4.4.7）——待办
- 平板段（769-1024）侧边栏折叠交互——待办
- 任务列表 checkbox 样式——**✅ 已补**（2026-08-15：site.ts 增加 GFM 任务列表样式，accent-color 主色 + 去列表标记 + flex 对齐；设计库「有产品无」缺口关闭）

### 10. SSG 产物 file:// 降级适配（2026-08-15，用户反馈）

- **问题**：SSG 产物（dist-site）用 file:// 双击打开时无法跳转——display.js 绝对路径 `/display.js` 被 CORS 拦截（`doclight` 未挂载）、站内链接绝对化指向盘符根（跳到 chrome-error）。SSG 本就需 HTTP（`doclight preview`），但体验应优雅降级而非崩溃。
- **修复**：`renderPage` 对 ssg 形态注入 file:// 适配脚本（仅 `location.protocol === "file:"` 生效，HTTP 零影响）——跳过展示层外链、站内绝对链接改相对整页跳转。file:// 下每页都是服务端直出的完整 HTML，可正常阅读与导航（TOC/搜索/主题等交互降级为静态）；离线完整体验仍用 `doclight bundle` 单文件。
- **验证**：Playwright 实测 file:// 双击 → 点击侧边栏文章整页跳转并正确渲染目标页；HTTP 端 SPA 不受影响（无 JS 错误）；`verify` 8/8 + `verify:visual` 26/26。
- **注意**：DevTools 仍会有一条 display.js 的 CORS 控制台错误（浏览器预加载扫描器在适配脚本执行前已发起 fetch，运行期移除无法阻止）——纯噪音，不影响用户。

## 五、关键文件

- 门禁：`scripts/lib/report.mjs`、`scripts/checks/e2e.mjs`、`scripts/checks/smoke.mjs`（新增）、`scripts/visual-regression.spec.ts`、`scripts/verify.mjs`
- 管线：`scripts/build-cli.mjs`（新增）、`scripts/build.mjs`
- 壳层：`packages/cli/src/site.ts`、`packages/cli/src/dev-server.ts`、`build.ts`、`bundle.ts`
- 展示层：`packages/display/src/{router,toc,search,plugin-manager,slots,theme,ux,extensions,index}.ts`
- 主题：`packages/cli/src/themes/{minimal,modern,serif,warm}.css`
- 门禁逻辑：`packages/cli/src/design-compliance.ts`
- 设计库：`.design_library/doclight/{README.md,colors_and_type.css,css.json}`
- 规格：`docs/tech-design/{04,03,11,16}`
