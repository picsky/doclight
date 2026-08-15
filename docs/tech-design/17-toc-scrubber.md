# 17 · 章节擦洗条规格（Chapter Scrubber，TOC-002）

> 状态：✅ 已接受（2026-08-15，对齐点 A 用户确认）
> 需求 ID：TOC-002（TOC-001 演进）
> 对应原则：ADR-0004 原则一（表现层即产品）+ 01 §1.3 原则三（内容是主角）
> 设计哲学：「让内容发光，让界面退后」（Calm Technology——章节擦洗条把文章目录
> 从「并列的一列文字」退化为「贴着滚动轴的安静形状」）
> 上游文档：[03-runtime-engine](./03-runtime-engine.md) §3.7（TOC-001 既有规格）、
> [04-reading-experience](./04-reading-experience.md)（排版/色彩基线）、
> [16-design-system](./16-design-system.md)（克制为底 + 精致细节）
> 用户决策（2026-08-15）：桌面端常驻文字面板 → 章节擦洗条；Bar/Tick 双形态随主题；
> 移动端 FAB+底部面板保留；轨道端点保留展开入口（可发现性兜底）

---

## 0. 一句话

**本页目录从常驻 220px 文字面板，演进为一条沿正文右缘的章节擦洗条**：默认形态是条形阵列
（每条 = 一个章节，条数即章节数），当前章节条点亮拉长；hover 分两级渐进披露
（短 hover 突出该条，长 hover 显示标题文字）；点击跳转、滚动高亮不变。

---

## 1. 形态与布局

### 1.1 轨道（Rail）

```
正文区                   轨道（6px 宽，贴正文右缘）
┌────────────────┐      ┌──┐
│  第一章标题      │      │▬▬│ ← 默认条（横条形态：宽 16px 高 2px）
│  正文……         │      │──│
│  1.1 小节       │      │▬▬│ ← h3 子条（宽 60%，视觉降级）
│                │      │  │
│  第二章标题      │      │▬▬│ ← 激活条：拉长至 24px + 主色点亮
│  ……            │      │  │
└────────────────┘      └──┘
   （轨道与正文间距 12px，z-index 低于顶栏）
```

| 属性 | 规格 |
|---|---|
| 轨道宽度 | 6px（含 1px padding），`--toc-rail-width` 令牌 |
| 位置 | `position: fixed`，right: `calc((100vw - 正文宽)/2 - 24px)` 或三栏布局中贴正文右缘；sticky 于视口垂直居中偏上 |
| 默认可见度 | `opacity: 0.5`，border 色（`--color-border`）——安静但可感知 |
| 首次滚动后 | 渐显至 `opacity: 1`（阅读进度驱动，`.visible` 类） |
| 条（h2） | 宽 16px，高 2px，圆角 1px，垂直堆叠 |
| 条（h3） | 宽 60%（9.6px），同高，视觉层级降级 |
| 条间距 | 章节数自适应：`(轨道可用高度 - 总条高) / (章节数-1)`，min 4px |
| 激活条 | 拉长至 24px + 主色（`--color-primary`）+ 过渡 150ms |
| 短 hover 条 | 拉长至 20px + 主色 60% 混合色，过渡 150ms |
| 隐藏条件 | 无 h2/h3、无 JS、<1280px |

### 1.2 两种基础形态（主题差异化画布）

| 形态 | 描述 | 主题 |
|---|---|---|
| **Bar 横条**（默认） | 水平条垂直堆叠，激活拉长 | Minimal、Warm |
| **Tick 竖刻度** | 竖向 1px 刻度线沿轨道排布，激活变亮变粗 | Serif、Modern |

> 呼应用户观察：「有的显示为横向横条，有的显示为竖向条」——方向即形态变体，
> 由主题语言决定，不是全局二选一。

---

## 2. 交互规格（Hover Intent 时序）

| 事件 | 时序 | 行为 |
|---|---|---|
| 进入轨道 hover | — | 轨道整体渐显至 opacity 1（150ms） |
| **短 hover** 某条 | ≤300ms | 该条拉长（Bar）/ 变粗（Tick）+ 主色微染；不出文字 |
| **长 hover** 某条 | ≥500ms 持续 | 条左侧浮出标题气泡（文字 + 微阴影），气泡 150ms 淡入 |
| 移出 | — | 气泡 200ms 内淡出收回；条恢复默认 |
| **点击** 条 | — | 平滑滚动到章节 + `history.replaceState` 锚点（沿用 TOC-001 scrollToHeading） |
| 滚动侦测 | IntersectionObserver | 当前章节条激活（沿用 TOC-001 startSpy 逻辑，复用） |
| 键盘 Tab 聚焦轨道 | — | 等价长 hover：显示完整文字（气泡或面板），方向键逐条移动，Enter 跳转 |

**时序实现**：两个 timer——`shortHoverTimer`（300ms 拉长）、`longHoverTimer`（500ms 揭示）；
`mouseleave` 清空两者。transition 150ms `--transition-fast`，reduced-motion 下全部瞬态。

---

## 3. 移动端（≤768px）

- **不变**：FAB + 底部面板（TOC-001 §3.7.2 保留）——移动端无 hover，文字列表是唯一可达形态
- 轨道在移动端 `display: none`（纯装饰，无 hover 无意义）
- 底部面板内容与轨道同源（同一 headings 数据，两个渲染出口）

---

## 4. 主题变体规格

| 主题 | 形态 | 默认条 | 激活态 | 气泡 |
|---|---|---|---|---|
| Minimal | Bar | 灰 border 色 | teal 拉长 | 白底细边框 |
| Serif | Tick | 纸色细刻度 | 深靛蓝加粗 | 米白纸感卡片 |
| Modern | Tick | 玻璃微光刻度 | violet 加粗 | 玻璃毛玻璃气泡 |
| Warm | Bar | 暖 border 色 | 暖橙拉长 | 暖白卡片圆角 |

> 全部走 CSS 变量覆盖（THEME-002 契约）：主题 CSS 只需覆盖 `--toc-*` 令牌 + 少量组件规则，零 JS 改动。

---

## 5. 无障碍与降级

- 轨道容器：`role="navigation"` + `aria-label="本页目录"`
- 每条：`role="link"` + `aria-label="跳转到章节：<标题>"`（文本在气泡内，aria 常驻）
- 焦点：`tabindex="0"` 容器内方向键导航（roving tabindex），`:focus-visible` 显示标题气泡——键盘等价长 hover
- `prefers-reduced-motion`：拉长/气泡/渐显全部瞬态
- 无 JS：轨道不渲染（与现有 TOC 行为一致，SSG file:// 直出不回归）
- 对比度：默认条 `--color-border` vs 背景 ≥3（AA 图形标准）；激活条主色 ≥3；气泡文字 ≥4.5

---

## 6. 可发现性兜底

- 轨道端点（顶部）保留一个 16px 展开图标：点击展开**完整文字目录面板**（复用现有
  toc-rail 面板渲染）——第一次进入的用户不迷路，资深用户享受安静
- 展开面板与轨道互斥（展开时轨道淡出）

---

## 7. 与现有代码的关系（迁移路径）

| 现有资产 | 去向 |
|---|---|
| `toc.ts` parseHeadings / startSpy / scrollToHeading | **全复用**，新增轨道渲染 + hover 时序 |
| `toc.ts` renderTocHtml（文字面板） | 保留为「展开面板」与移动端面板的渲染出口 |
| `.toc-rail` CSS（220px 面板） | 重定义为轨道样式（或新增 `.toc-scrubber`，面板样式保留给展开态） |
| `--toc-width: 220px` 令牌 | 保留（展开面板用），新增 `--toc-rail-width: 6px` |
| 三形态（dev/SSG/bundle） | 同一展示层 bundle，天然一致（SNAP-001 验证） |

---

## 8. 验收标准（DoD）

- `npm run verify` 8/8 全绿（含 458 单测 + e2e 矩阵）
- 视觉回归 24 组基线更新且通过（4 主题 × 亮暗 × 3 断点），新增轨道三态（默认/短hover/长hover）基线
- 交互测试断言 hover 时序：短停留不出文字、长停留出文字、移开后 200ms 内收回
- 无障碍断言：轨道 Tab 可达、焦点态显示标题、aria 标注完整
- 设计合规门禁通过（对比度 ≥3 条 vs 背景、8pt 网格、1.25 节奏）
- 三形态一致（dev / SSG / bundle 轨道表现一致，SNAP-001）
- 移动端 FAB + 底部面板行为无回归

---

## 9. 与其它文档的关系

| 文档 | 关系 |
|---|---|
| [03-runtime-engine](./03-runtime-engine.md) | §3.7 是本规格的上游（TOC-001 基线），实现后回写 |
| [04-reading-experience](./04-reading-experience.md) | 排版/色彩/交互基线 |
| [16-design-system](./16-design-system.md) | 克制为底 + 精致细节的落实（轨道是「界面退后」的典型） |
| [09-appendix](./09-appendix.md) | 术语登记：章节擦洗条（Chapter Scrubber） |
| [11-default-themes](./11-default-themes.md) | 4 套主题的轨道变体 |
