# TASK: VIS-002 设计系统——表现层系统化设计（Phase A-D 完成）

> 状态：✅ 完成（2026-08-14）
> 上游：ADR-0004 原则一（视觉表现力即产品）+ 01 §1.3 原则三（内容是主角）
> 用户决策（2026-08-14 确认）：风格 = 克制为底 + 精致细节；字体 = 系统精调 + 字体插件；
> 主题 = Minimal 打样 → 4 套全量；动效 = 克制
> 规格文档：`docs/tech-design/16-design-system.md`（VIS-002）

---

## 本次完成清单

| 阶段 | 交付 | 文件 |
|---|---|---|
| **A 地基** | 令牌体系升级（三级：--space-5/10、--tracking-*、--ease-*、--shadow-lg/xl、--ring-color）；中文排版专项（tabular-nums、text-rendering）；组件层：搜索面板（毛玻璃+大圆角+进场动画）、代码块语言标签（JS 注入）、提示容器图标（CSS ::before，纯 class 承载）、阅读进度条、回到顶部、SPA 页面进场淡入 | `packages/cli/src/site.ts` + `packages/display/src/{extensions,ux}.ts` |
| **B 主题** | Serif/Modern/Warm 三套适配新组件（进度条/回顶/语言标签/搜索面板/容器图标）+ 设计语言强化（纸感/玻璃/卡片特征） | `packages/cli/src/themes/{serif,modern,warm}.css` |
| **C 体验** | 无障碍：skip-link（WCAG 2.4.1）、抽屉 aria-expanded 同步、Esc 关闭抽屉、触摸反馈、safe-area-inset | `site.ts` + `packages/display/src/sidebar.ts` |
| **D 演示** | slides 容器图标（与文档一致，同源不同形的一致性） | `packages/cli/src/slides.ts` |

## 关键决策

1. **容器图标用 CSS ::before 承载**（✓/ℹ/!/✕，语义色）——符合「扩展承载铁律」（class 标记 + 文本承载，零 JS 依赖），降级为普通 div 时无残留
2. **语言标签 JS 注入**（extractLanguage 复用）——非渲染内核改动，展示层增强，降级安全
3. **进度条/回顶为模板静态元素 + 展示层滚动驱动**——三形态一致（SSG 无 JS 时不可见但无害）
4. **字体策略：系统精调 + 字体插件**（用户决策）——默认零网络请求，插件预留
5. **视觉基线更新 24 组**（4 主题 × 亮暗 × 3 断点）——已 `verify:visual:update` 锁定

## 遗留（后续迭代建议）

- **Web Font 插件**（opt-in）：`doclight.json` 启用后注入 @font-face（默认关闭保轻量离线）——包体已预留位置
- **快捷键帮助面板**（04 §4.6.1 "?" 显示快捷键列表）——未做，克制动效原则下优先级低
- **e2e 假绿**（基线问题）：`scripts/checks/e2e.mjs` 不检查 Playwright 退出码，只读残留报告——verify 的 e2e 长期假绿（本机 Node 26 移除 --experimental-transform-types，Playwright 转译 TS 依赖链失败）。**修复依赖 OSS-001 遗留的 JS 构建管线**（esbuild bundle → dist + bin）——它是唯一干净解法
- **gallery 示例文档无容器**：docs/ 下只有 2 处 :::tip 语法（且 `:::tip 提示` 带标题形式不被容器扩展识别——文档与实现的既有偏差，容器扩展仅支持 `:::tip\n...\n:::` 无标题形式）

## 验证状态

- `npm run verify` 7/7 全绿（lint / typecheck / test / size / contract / visual / e2e）
- `npm run verify:visual` 26/26 通过（基线已更新锁定）
- 展示层 gzip：10.4KB → **10.7KB**（门禁 <25KB，余量充足）
- 单测：330 passed + 1 skipped（display/cli 全量）
- Playwright 实测：语言标签注入 ✓ / 容器图标 4 类 ✓ / 进度条滚动驱动 ✓ / 回顶浮现+回顶 ✓ / 搜索毛玻璃+进场 ✓ / SPA 进场动画 ✓ / 无 JS 错误 ✓

## 上下文链接

- 规格：`docs/tech-design/16-design-system.md`
- 上游：`docs/tech-design/04-reading-experience.md`（排版/色彩基线）、`11-default-themes.md`（4 套设计语言）
- 决策：`adr/0004-v3-presentation-layer-positioning.md`
- 需求 ID：VIS-002（设计系统）；VIS-003（主题语言）/ VIS-004（体验打磨）已并入本批

## 下一步建议

1. 用户审阅效果（dev server 运行中）→ 确认视觉方向 → 后续微调
2. 开工 OSS-001 遗留的 **JS 构建管线**（顺带修 e2e 假绿 + 解锁 npm 发布）
3. 可选：Web Font 插件（opt-in）
