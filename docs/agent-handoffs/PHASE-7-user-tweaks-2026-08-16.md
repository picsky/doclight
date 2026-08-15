# PHASE-7 用户微调交接（2026-08-16 晚，三项反馈）

> 用户对 Phase 7 交付的三项反馈，已全部修复。换会话先读本文件。

## 反馈与修复

| # | 反馈 | 根因 | 修复 |
|---|---|---|---|
| 1 | 继续阅读 pill 无需显示，默认继续阅读 | pill 提示 UI 多余 | reading.ts：删除 pill 全部 DOM/样式/文案（resumeText 一并移除）；改为 **autoResume**——进入页面检测到保存位置（2%~98%）时 rAF 后**瞬移恢复**（无动画无提示）；SPA 换页同样自动恢复 |
| 2 | 页面整体可以左右晃动 | DP-006 后退转场 `.page-enter-back` 用 `translateX(-14px)`——整页内容水平平移；叠加触控板横向滚动手势 → 感知为横向晃动 | 后退转场改为**纯淡入**（仅 opacity，无水平位移）；`html { overflow-x: clip }` 兜底（clip 不破坏 sticky） |
| 3 | TOC 已读标记移除 | DP-003 已读标记（read 类 + localStorage 持久化）不合预期 | toc.ts 移除 tocReadKey/readTocVisited/applyReadMarks/visited 全套；CSS 移除 `.toc a.read` 规则；保留 FAB 章节序号（DP-006） |

## 验证

- `npx vitest run packages/display`：88 通过（reading-state.test.ts 同步改写）
- `npm run verify`：**8/8 全绿**
- 浏览器实测：pill 0 ✅ / 自动恢复位置 ✅（重载后滚动位置恢复）/ back 转场纯淡入 ✅ /
  html overflow-x: clip ✅ / TOC read 类 0 ✅
- 展示层体积 16.06KB gzip（净减 0.5KB——pill 移除）
- CLI bundle + dist-site（63 篇）重建；9000 端口 dev server 重启

## 注意

- 阅读位置持久化机制保留（滚动防抖 400ms 保存），只是恢复方式从「提示后点击」改为「静默直接恢复」
- 三形态同构不受影响（autoResume 纯展示层行为，dev/ssg/bundle 一致）
