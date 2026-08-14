---
name: doclight-slides
description: 用 Markdown 编排专业演示（DEMO-001，01 §原则二 文档与演示同源不同形）。当用户要做演示/PPT/幻灯片/分享/汇报/talk/deck 时说"做个演示/做几页 PPT/讲一讲"，或内容需要"逐页叙事、每页一个观点"时使用。
---

# doclight-slides — 演示编排技能

> 对应设计：[01-product-positioning §原则二](../../../docs/tech-design/01-product-positioning.md)（同源不同形）
> + [docs/slides.md](../../../docs/slides.md)（演示指南）
> 原理：演示是**独立表现形式**，不是文档切片——每页一个观点、少文字、强视觉、逐页叙事。
> 质量由演示专用视觉组件保证（`doclight slides` 内置布局/主题），不让 Agent 裸写语法碰运气。

## 何时使用

- 用户明确要做**演示**（区别于文档）：分享会、课程讲解、产品汇报、技术 talk
- 内容天然是"逐页叙事"结构（一页一个论点，听众跟着走）
- 注意：用户要"文档/知识库/说明"时**不要**用本技能（那是 doclight-publish 的场景）

## 演示源语法（Agent 编排约定）

单个 markdown 文件，`---` 分页：

```markdown
---
title: 演示标题
author: 作者名
date: 2026-08-14
---

# 封面主标题

副标题：一句话讲清楚这个演示是什么。

<!-- notes: 开场白：先说结论 -->

---

<!-- layout: section -->

# 章节页：大标题居中

---

<!-- layout: content -->

## 内容页标题

- 每页一个观点（不要超过 3 个要点）
- 少文字：一句话一行，听众在看你在讲
- 支持代码块 / 表格 / 容器（:::tip 等扩展语法）

<!-- notes: 这一页的演讲提示 -->

---

<!-- layout: end -->

# 谢谢

欢迎提问。
```

**规则**：
- 第 1 页自动 `cover`（封面：大标题 + 副标题 + 作者/日期署名）
- 布局指令（可选）：`<!-- layout: cover | section | content | end -->`
  - `section` 章节页（大文字居中，用于叙事转折）
  - `content` 内容页（默认）
  - `end` 结束页（"谢谢"收尾）
- 演讲者备注（可选）：`<!-- notes: 提示文字 -->`（观众页不显示；S 键演示者视图可见）
- 每页一个观点：**一页不要塞超过 3 个要点**；能用一句话说清的不要用一段话
- 演示是叙事不是文档：不要复制文档章节过来切页

## 构建与验证

```bash
doclight slides talk.md                    # 默认 dark 主题 → dist-slides/talk.html
doclight slides talk.md --theme light      # 亮色（会议室投影友好）
doclight slides talk.md --theme warm       # 暖色（分享会）
doclight slides talk.md --theme custom.css # 自定义 CSS（--slide-* 令牌覆盖）
doclight slides talk.md --author "姓名"    # 封面署名
```

产物是**自包含单文件**（CSS + 导航 JS 内嵌，file:// 双击可开，零网络零依赖）：
`dist-slides/talk.html`。预览：`doclight preview --dir dist-slides`。

**导航**：`←` `→` 空格翻页 · `F` 全屏 · `S` 演讲者备注 · URL `#3` 直达第 3 页。

**验证**：跑一遍 `npm run verify`（visual check 校验演示产物构建）+ 打开产物自查
（建议检查：封面信息、每页是否"一观点一屏"、备注是否齐全、手机上字号是否可读）。

## 编排流程（四步）

1. **问清主题与受众**：演示给谁讲、讲多久（页数 ≈ 分钟数 / 1.5）
2. **列叙事大纲**（逐页）：封面 → 为什么 → 是什么 → 怎么做 → 案例 → 收尾；
   每页先写观点句，再补支撑（一页一观点）
3. **写 markdown 源**：按上面语法编排（布局指令 + 备注），适度用容器/代码块/表格
4. **构建 + 自查 + 交付**：`doclight slides` → 打开检查 → 给用户文件路径与预览方式

## 规范与失败处理

| 情况 | 处理 |
|---|---|
| 用户说"把这篇文档做成 PPT" | **先解释同源不同形**：演示不是文档切片——按叙事重写一页一观点（可复用文档的素材与结论） |
| 一页内容过长 | 拆页：一个观点一页；支撑细节放备注（`<!-- notes: -->`） |
| 主题不符合预期 | `--theme light/warm` 或自定义 CSS（改 `--slide-*` 令牌，见 docs/slides.md §4） |
| 输出目录冲突 | `--out-dir <path>` 指定 |
| 需要中文演讲备注导出 | 备注在 HTML 的 `data-notes` 属性中（S 键视图可见） |
