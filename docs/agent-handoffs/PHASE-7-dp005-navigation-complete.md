# PHASE-7 DP-005 交接 · 导航智能

> 任务：DP-005 导航智能（18-design-polish §3.5）。换会话先读本文件 + 18-design-polish.md。

## 一句话总结

长站点的导航不再迷路：侧边栏分组可折叠（状态持久化）、SPA 导航后激活项自动滚动可见
（双向联动）、←/→ 键盘翻页（阅读流手感）。版本切换器**设计规格已出**（设计先行），
实现随产品层版本数据接入。

## 改动清单

**展示层（packages/display/src/）**
- `sidebar.ts`：
  - 分组折叠——side-title 可点击 + chevron 旋转指示；折叠隐藏 side-sub（index 首页条目除外）；
    激活组强制展开（读者所在章节的组不折叠）；状态持久化 localStorage（按分组标题键）
  - 键盘翻页——←/→ 上一页/下一页（pager 链接驱动；输入框/搜索弹层开/修饰键按下不劫持）
  - 纯函数：parseCollapsedGroups / serializeCollapsedGroups / shouldHandlePagingKey（鸭子类型判定，Node 可测）
- `router.ts`：双向联动——highlightActive 后侧边栏激活项 scrollIntoView(nearest)
  （长侧边栏不迷路；nearest 避免整页跳动）

**页面模板（packages/cli/src/site.ts DEFAULT_THEME_CSS）**
- .side-title 折叠形态：cursor/chevron（45° 旋转过渡 ≤300ms）/collapsed 隐藏 side-sub
- 版本切换器设计规格写入 18-design-polish §3.5（数据源/形态/键盘/SPA 语义/降级五条）——
  设计先行，实现随产品层版本数据接入（无数据时按钮不渲染，现状零回归）

**测试**
- 新增 `packages/display/test/nav-smart.test.ts`（3 例纯函数）

## 验证状态

- `npx vitest run packages/display/test/{nav-smart,sidebar,router}.test.ts`：17 通过
- `npm run verify`：**8/8 全绿**
- 展示层体积 16.02KB gzip（DP-005 增量 +0.62KB，门禁 <25KB 余量充足）
- 浏览器实测（临时分组站点 9100）：折叠 ✅ / 刷新持久化 ✅ / 再展开 ✅ /
  → 下一页 ✅ / ← 上一页 ✅（方向语义正确）

## 遗留与注意

- 版本切换器：仅设计规格（18 §3.5 细则五条），UI 实现待产品层提供版本数据源后接
  （doclight.json/docs.json versions 数组；schema 只加不改原则先行提案）
- 折叠键 = 分组标题（目录名）；站点改名会重置折叠状态（可接受：内容结构变了）
- 键盘翻页与浏览器默认行为隔离：输入框/弹层/修饰键全放行，零误劫持

## 下一步

DP-006 动效与微交互工艺（18 §3.6）：SPA 方向感知转场、主题切换交叉淡化、
搜索弹层结果 stagger、移动端 FAB 章节序号 + 抽屉边缘手势（保守实现）。
