# PHASE-7 DP-006 交接 · 动效与微交互工艺

> 任务：DP-006 动效与微交互工艺（18-design-polish §3.6）。换会话先读本文件 + 18-design-polish.md。

## 一句话总结

动效全部在宪法 §3.4 内落地（≤300ms、有动机、reduced-motion 全量降级）：SPA 转场方向感知
（前进右入/后退左入）、主题切换图标呼吸、搜索弹层结果错峰入场（24ms/项封顶 288ms）、
移动端 FAB 显示章节序号（「6/11」）、抽屉右滑手势（保守，不劫持点击/纵向滚动）。

## 改动清单

**展示层（packages/display/src/）**
- `ux.ts`：initPageTransition 方向感知——routechange payload 带 replace（后退）时用
  page-enter-back（从左入），否则 page-enter（从右入）
- `theme.ts`：#themeBtn 点击加 theme-swap 类（图标呼吸一次；reduced-motion 跳过）
- `search.ts`：renderResults + renderAllDocs 结果项 animation-delay stagger
  （i×24ms 封顶 288ms；CSS 动画在 reduced-motion 下全局静止）
- `toc.ts`：移动端 FAB 章节序号——setActive 时 FAB 显示「3/12」（aria-label 同步
  「目录：第 3 章，共 12 章」；无激活时恢复汉堡图标）
- `sidebar.ts`：抽屉右滑手势（touchstart/touchend，dx>60px 关闭；passive 不劫持滚动）

**页面模板（packages/cli/src/site.ts DEFAULT_THEME_CSS）**
- @keyframes doclight-page-in-back（从左入）+ .page-enter-back
- #themeBtn.theme-swap svg 呼吸动画（scale .72→1 + opacity .45→1，.3s var(--ease)）
- .modal.open .result-item result-in 动画（translateY(6px)→0，.22s）
- .toc-fab.with-count 序号字号（12.5px/600/tabular-nums）

## 验证状态

- `npx vitest run packages/display/test/{search,ux,theme,toc}.test.ts`：30 通过
- `npm run verify`：**8/8 全绿**
- 展示层体积 16.42KB gzip（DP-006 增量 +0.40KB，门禁 <25KB 余量充足）
- 浏览器实测（9000 端口）：theme-swap ✅ / 搜索 stagger 0,24,48,72ms ✅ /
  移动端 FAB「6/11」✅ / 前进后退转场类切换 ✅（代码级）

## 遗留与注意

- 转场方向以 history.replace 判定（popstate = 后退）——浏览器前进按钮也走 replace，
  方向语义一致（回退类）
- stagger 的 inline animation-delay 属「行为样式」而非「内容承载」，不违反扩展内容
  承载铁律（决策②针对内容扩展的 data-* 依赖）
- 抽屉手势为保守实现（仅关闭方向）；滑入开启未做（需边缘热区，风险大于收益）
- 全部动效走 prefers-reduced-motion 全局静止（CSS 层已有规则，JS 侧 theme-swap 显式跳过）

## 下一步

DP-007 AI 原生身份显性化（18 §3.7）：内容溯源徽标 + llms.txt 收录提示 +
component-gallery 升级为设计宣言（与 DP-001 画廊改造合并）+ 写作端预览一致性规范。
