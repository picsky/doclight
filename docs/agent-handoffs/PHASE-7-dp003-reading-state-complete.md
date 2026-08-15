# PHASE-7 DP-003 交接 · 阅读状态感

> 任务：DP-003 阅读状态感（18-design-polish §3.3）。换会话先读本文件 + 18-design-polish.md。

## 一句话总结

文档站有了「记得读者的位置、对新鲜度诚实」的产品感：阅读位置跨会话持久化 + 「继续阅读」
安静提示、TOC 章节已读标记、更新时间相对化（「5 天前更新」）、阅读完成度一行文字
（「已读 59% · 约剩 2 分钟」）、侧边栏「最近更新」徽标。明确不做：专注模式、字号调节
（用户已判定伪需求，不回滚）。

## 改动清单

**展示层（packages/display/src/）**
- `reading.ts`（新）：initReadingState 挂载——
  - 阅读位置持久化（滚动防抖 400ms 写 localStorage，2%–98% 区间才记；隐私模式降级）
  - 继续阅读 pill（左下角、8s 自动淡出、可关闭、点击平滑跳转、reduced-motion 降级）
  - 相对时间改写（`<time class="doc-updated">` → 「N 分钟/小时/天前更新」，title 保留绝对日期）
  - 阅读完成度（meta 行尾部 `#readStatus` 动态追加，读数 = meta 阅读时长 × 滚动进度）
  - 纯函数可测：relativeTimeText / readStatusText / resumeText / parseReadingTime / readingKey
  - SPA 导航自动重建（bus routechange）
- `toc.ts`：已读标记——滚过的章节加 `read` 类（颜色安静提级 --text-3→--text-2），
  路径级持久化（tocReadKey / readTocVisited 纯函数），SPA 换页切换集合
- `index.ts`：挂载 initReadingState

**页面模板与组装（packages/cli/src/）**
- `site.ts`：
  - meta 更新时间改 `<time class="doc-updated" datetime="…">` 语义标记（SSR 直出绝对日期，SEO 不变）
  - `collectNavUpdated()`：每篇文档更新时间（frontmatter.date/updated ?? mtime），三形态共用
  - `renderNav(…, updatedAts?)`：最近 14 天更新的文档加「最近更新」徽标
    （side-recent accent 圆点，纯 CSS class 承载）
  - CSS：.resume-pill（浮层阴影 + 进出场 ≤300ms + 移动端让开 TOC FAB）/
    .read-status（tabular-nums）/ .side-recent / .toc a.read
- `dev-server.ts` / `build.ts` / `bundle.ts`：三形态传 collectNavUpdated（徽标数据同源）

**测试**
- 新增 `packages/display/test/reading-state.test.ts`（5 例纯函数）

## 验证状态

- `npx vitest run packages/display packages/cli/...`：**143 通过**
- `npm run verify`：**8/8 全绿**（lint / typecheck / test / size / contract / e2e / visual / smoke）
- 展示层体积 15.08KB gzip（DP-003 增量 +1.6KB，门禁 <25KB 余量仍充足）
- 浏览器实测（9000 端口 live）：相对时间「5 天前更新」✅ / 完成度「已读 59% · 约剩 2 分钟」✅ /
  继续阅读 pill「上次读到 59%」✅ / TOC read 11 个 ✅ / 侧边栏徽标 12 个 ✅

## 遗留与注意

- 阅读位置键 = 路径级（dev/ssg pathname、bundle hash 路由键），三形态互不串扰
- 已读集合按「章节被滚过」记（active 及之前全部），不是精确到视口停留——足够安静且零打扰
- 相对时间以构建/渲染时刻为基准由浏览器实时计算（构建产物永不「过时」）
- 「约剩 X 分钟」按滚动进度线性估算（阅读时长 × (1-进度)）——一行文字，非承诺精度

## 下一步

DP-004 内容表现纵深（18 §3.4）：h4+ 层级补全 + 代码块纵深（行号/diff/超长展开）+
表格纵深（sticky 表头）+ blockquote/callout 分工 + 图文关系 + 章节级页脚。
