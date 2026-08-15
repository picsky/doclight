# TOC-002 章节擦洗条完成（Chapter Scrubber）

> 日期：2026-08-15
> 需求 ID：TOC-002（TOC-001 演进）
> 规格：docs/tech-design/17-toc-scrubber.md（用户对齐点 A 确认）
> 验证：`npm run verify` 8/8 全绿 + 视觉回归 26/26 + 浏览器实测 20/20

---

## 一句话

**本页目录从常驻 220px 文字面板，演进为沿正文右缘的章节擦洗条**：默认形态是条形/
刻度阵列（每条 = 一个章节），安静驻留；短 hover 拉长、长 hover 浮出标题气泡、
滚动点亮当前章节；轨道端点「展开」按钮 ↔ 文字面板互斥。

设计哲学落地：「让内容发光，让界面退后」（Calm Technology）——目录从并列文字
退化为贴着滚动轴的安静形状，消除标题重复呈现。

---

## 交付清单

| 文件 | 改动 |
|---|---|
| `docs/tech-design/17-toc-scrubber.md` | **新增**规格文档（形态/交互/主题变体/无障碍/验收） |
| `docs/tech-design/03-runtime-engine.md` | §3.7 回写为章节擦洗条（TOC-002） |
| `docs/tech-design/16-design-system.md` | 组件规格 TOC 行更新 |
| `docs/tech-design/09-appendix.md` | 术语登记：章节擦洗条（Chapter Scrubber） |
| `packages/display/src/toc.ts` | `renderScrubberHtml` 纯函数 + `initScrubber`（轨道构建/长 hover 气泡时序/键盘导航/展开互斥）；`startSpy` 同步点亮轨道条 |
| `packages/cli/src/site.ts` | 轨道默认 Bar 形态 CSS + 气泡 + 展开按钮 + 互斥规则 |
| `packages/cli/src/themes/serif.css` | Tick 竖刻度形态（纸感细刻度） |
| `packages/cli/src/themes/modern.css` | Tick 竖刻度形态（玻璃微光） |
| `packages/cli/src/themes/warm.css` | Bar 横条圆头变体（暖卡片） |
| `packages/display/test/toc.test.ts` | 新增 6 个擦洗条渲染测试 |
| `e2e/display.spec.ts` | TOC 3 个 e2e 更新为擦洗条断言（含展开态） |

## 关键实现决策

1. **短 hover 用 CSS :hover 即时完成**（无 JS timer）——拉长是即时反馈，体验更灵敏；
   JS 只负责长 hover（500ms 阈值）气泡揭示。两段交互零冲突。
2. **roving tabindex 键盘导航**：轨道容器 tabindex=0，聚焦时自动落到第一条，
   方向键循环移动，Enter 跳转，Esc 收回——键盘等价长 hover（焦点态揭示气泡）。
3. **展开互斥用纯 CSS**（`.toc-rail.expanded` 类）：展开时轨道 display:none、
   面板显示——无额外过渡逻辑，状态单一。
4. **移动端零改动**：FAB + 底部面板保留（无 hover 环境，文字列表不可替代）；
   轨道 CSS 天然隐藏（toc-rail 在 <1280px 即 display:none）。
5. **无 JS 零残留**：轨道由 JS 动态插入 `.toc-rail`（不在服务端 HTML 模板），
   SSG file:// 直出无轨道也无死态——与 TOC-001 降级行为一致。
6. **4 套主题差异化**：Minimal/Warm = Bar 横条、Serif/Modern = Tick 竖刻度，
   全部走 CSS 覆盖层（THEME-002 契约），零 JS 改动。

## 验证结果

- `npm run verify`：**8/8 全绿**（lint / typecheck / test 464 / size / contract / e2e）
- 展示层体积：13.3KB gzip（门禁 <25KB ✓，新增轨道逻辑仅 +1KB）
- 视觉回归：26/26（画廊为静态产物无轨道，基线不受影响；4 主题令牌合规门禁通过）
- 浏览器实测（Playwright，1440×900 + 390×844）：**20/20**
  - 轨道存在 / 默认 opacity 0.5 / 条数=章节数 / hover 渐显
  - 短 hover 拉长不出文字 / 长 hover 气泡=章节标题 / 移出收回
  - 轨道 Tab 可达 / 方向键 roving / 焦点揭示 / Enter 跳转（scrollY 0→783）
  - 展开互斥（面板显示↔轨道隐藏）/ aria 标注完整
  - 移动端：轨道隐藏 + FAB 保留

## 下一步

- 无阻塞遗留。可选：轨道三态视觉回归基线（默认/短hover/长hover，当前靠 e2e 断言，
  如需像素级锁定可加 Playwright 截图基线）
- `docs/agent-handoffs/PHASE-6-p3-frontend-audit-fix-complete.md` 之后的新能力，
  建议在 CLAUDE.md 当前状态补一行 TOC-002（见交接要求）
