# PHASE-7 DP-004 交接 · 内容表现纵深

> 任务：DP-004 内容表现纵深（18-design-polish §3.4）。换会话先读本文件 + 18-design-polish.md。

## 一句话总结

真实内容不再露怯：h4–h6 层级补全、超长代码块渐进展开（「显示全部」）、长表格纵向滚动 +
sticky 表头、暗色模式图片降亮度防刺眼、引用/callout 分工确立（引用=灰线引述、callout=语义行动提示）。

## 改动清单

**页面模板与组装（packages/cli/src/site.ts DEFAULT_THEME_CSS）**
- h4/h5/h6 层级补全（宪法 §3.2 批准类型阶内：14.5/13.5/13px，靠字号+字重+留白分层；
  h6 小标签化 uppercase）
- 超长代码块：`.codeblock.collapsed pre { max-height: 480px }` + `.code-expand` 按钮样式
  （无 JS 时自然全量显示——渐进式水合铁律）
- 长表格：`.table-wrap.tall` 纵向滚动 + sticky 表头（thead 底色不透明防穿透；
  无 JS 自然展开）
- 暗色图片：`[data-theme="dark"] article img { filter: brightness(.92) contrast(1.03) }`
- blockquote cite 出处样式；分工原则写入注释（引用=灰线无底色、callout=语义色竖线+图标）

**展示层（packages/display/src/extensions.ts）**
- `addCodeExpand()`：>480px 的代码块加 collapsed + 「显示全部/收起」按钮（aria-expanded 同步）
- `addTableTall()`：>480px 的表格加 tall 类（纵向滚动 + sticky 表头）
- enhance() 挂载两增强（同步零依赖，SPA 导航后重跑）

**测试**
- 新增 `packages/cli/test/dp004-content-depth.test.ts`（6 例：直读默认主题 CSS 断言 + 模板直出）

## 验证状态

- `npx vitest run packages/cli/test/dp004-content-depth.test.ts packages/display/test/extensions.test.ts`：13 通过
- `npm run verify`：**8/8 全绿**
- 展示层体积 15.40KB gzip（DP-004 增量 +0.32KB，门禁 <25KB 余量充足）
- CLI bundle + dist-site（59 篇）重建；9000 端口 dev server 重启正常

## 遗留与注意

- 章节级页脚：next-grid 已具备（「下一步」卡片，导航树驱动 = 章节页脚），本轮未改动——
  与演示页 1:1 保持一致
- 代码块行号/diff 高亮：本轮未做（行号需要逐行 DOM 注入，diff 高亮属 Prism 插件域——
  均可在后续按需提案，不擅自加）
- 图注规范：figure.diagram figcaption 已有（设计对齐），普通图片走暗色降亮度即可
- 表格 .tall 阈值与代码 .collapsed 阈值统一 480px（约 24 行代码/15 行表格）

## 下一步

DP-005 导航智能（18 §3.5）：侧边栏分组折叠 + 状态持久化、滚动双向联动（当前项自动可见）、
版本切换器实体化、←/→ 键盘翻页。
