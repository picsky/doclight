# PHASE-7 DP-002 交接 · 品牌层

> 任务：DP-002 品牌层（18-design-polish §3.2）。换会话先读本文件 + 18-design-polish.md。

## 一句话总结

DocLight 有了自己的「脸」：icon 标志（favicon 三形态一致）、首页 hero 节奏（与内页分离）、
品牌化 404 空态页（dev/build/preview 三形态）、签名时刻（阅读进度收尾脉冲，用户已确认）。

## 用户决策（不可回退）

- 签名时刻候选三选一 → 用户确认 **「阅读进度收尾脉冲」**（读完 100% 时进度条右端光点呼吸一次；
  ≤300ms、只出现一次、prefers-reduced-motion 下降级——宪法 §3.4 动效纪律）
- 其余品牌层项（标志/hero/空态/微文案）按计划落地

## 改动清单

**页面模板与组装（packages/cli/src/）**
- `site.ts`：
  - favicon 内联 icon 标志（松绿 Pine 圆角方底 + 三线星形，data URI 零外部资源、三形态一致）
  - 首页 hero：根 README/index → `<article class="article home">`；CSS 留白节奏与内页分离
    （隐藏面包屑、lede 19px 衬线、meta 下距加大；h1/h2 字号仍在宪法类型阶内）
  - `render404Page()`：复用完整壳层渲染「页面未找到」空态（404 字码 + 引导文案 + 回首页/搜索按钮）；
    `notFound` 标记跳过 TOC 链接与反馈卡（空态页无章节可反馈）
  - 签名时刻 CSS：`#progress.complete` 光点脉冲（progress-done keyframes，≤300ms）
- `build.ts`：SSG 产物生成 `404.html`（GitHub Pages/Netlify 静态托管 404 约定；失败不阻断构建）
- `dev-server.ts`：文档类路径 404（无扩展名/.md/.html）返回设计过的 404 页面；
  资源类路径保持 text/plain（机器端点诚实降级）
- `preview.ts`：产物含 404.html 时未命中路径返回之（status 404 + 设计页面）

**展示层（packages/display/src/）**
- `ux.ts`：阅读进度收尾脉冲（completed 状态机——100% 触发一次、回滚清零可重触发、
  reduced-motion 跳过、SPA 导航后复位）

**测试**
- 新增 `packages/cli/test/dp002-brand.test.ts`（5 例）：favicon / 首页 hero 类 / render404Page 结构 /
  build 产物 404.html / dev server 404 端点

## 验证状态

- `npx vitest run packages/cli packages/display`：39 文件 **339 通过 / 1 环境跳过**
- `npm run verify`：**8/8 全绿**（lint 142/142 / typecheck / test / size / contract / e2e / visual / smoke）
- 展示层体积 13.46KB gzip（签名时刻增量 +0.12KB，门禁 <25KB 余量充足）
- CLI bundle + dist-site（57 篇）重建；9000 端口 dev server 重启——实测：首页 article.home ✅、
  404 设计页 ✅（HTTP 404 + 完整壳层空态）

## 遗留与注意

- 空态「搜索无结果 / 加载失败」沿用设计对齐的统一样式（演示页一致），本轮未改动
- 微文案 tone 审查：复制「✓ 已复制」/ 反馈「感谢你的反馈！」/ Powered by 关闭——已一致，未改动
- `404.html` 入产物但**不进 sitemap/llms.txt**（非内容页，无需登记）
- bundle 形态无 404 概念（hash 路由未知键 = 首页内容，router 已提前返回）

## 下一步

DP-003 阅读状态感（18 §3.3）：阅读位置持久化 + TOC 已读标记 + 新鲜度可视化（相对时间/最近更新徽标）+
阅读完成度（进度条联动剩余时长）。
