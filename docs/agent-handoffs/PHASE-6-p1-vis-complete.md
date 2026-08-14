# TASK: Phase 6 P1·1——VIS-001 表现层设计系统化（2026-08-13）

> 状态：✅ 完成（verify 7/7 全绿目标：lint/typecheck/test/size/contract/**visual**/e2e；spec:check 47/47；
> 视觉回归 24/24 基线已生成待人工锁定）
> 上游：ADR-0004（v3 定位）+ 08-roadmap Phase 6 P1 + 11-default-themes（4 套设计语言全规格）
> **本文件是 Phase 6 P1 第一棒交接**（VIS-001；WORK-001 / MCP-006 见 CLAUDE.md「下一步」）

---

## 本次完成清单（需求 ID 可追溯）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **VIS-001 4 套设计语言兑现** | minimal（= 默认 Minimal 语言显式包 + 组件打磨）/ serif（学术：衬线标题 + 米白纸感 + 深靛蓝 + 2px 圆角）/ modern（科技：violet + 深黑蓝 + **暗色优先结构** + 玻璃拟态 + 8px 圆角）/ warm（温暖：暖橙 + 米白 + 12px 大圆角 + 卡片感容器）；每套含亮/暗令牌 + 组件级特征规则 | `packages/cli/src/themes/{minimal,serif,modern,warm}.css`（独立 CSS 文件 = 未来主题市场载体） | themes.test.ts 11 例 + design-compliance.test.ts 13 例（默认 + 4 主题全量合规断言） |
| **VIS-001 主题包模型** | ThemePackage{css, defaultTheme}；modern 默认暗色（首次进入即暗色）；renderPage 防闪烁脚本优先级：fixedTheme → localStorage → defaultTheme → 系统偏好；三形态接线（build/dev/bundle） | `packages/cli/src/themes.ts` + `packages/cli/src/site.ts`（DEFAULT_THEME_CSS 独立导出 + RenderPageOptions.defaultTheme/fixedTheme） | themes.test.ts（defaultTheme/fixedTheme 注入断言）+ build.test.ts 回归 |
| **VIS-001 主题画廊** | `buildGallery`（索引页 + 4 主题 × 亮/暗 9 个 HTML；面板 fixedTheme 钉死对比纯净；内置示例文档覆盖标题/代码/表格/容器/公式/图表/引用/列表）；`doclight build --themes` / `doclight preview --themes`（先构建再服务） | `packages/cli/src/gallery.ts` + build.ts/index.ts | gallery.test.ts 5 例（产物结构/固定模式/示例文档/与真实站点同构/--themes 接线）+ 浏览器实测（8 面板 computed style 全 PASS） |
| **VIS-001 设计合规门禁** | 纯函数合规检查（WCAG AA 对比度 ≥4.5/≥3 + 8pt 网格 4px 倍数 + 1.25 字号节奏 ±0.08；暗色优先主题自适应；缺失令牌诚实报错）；`scripts/checks/visual.mjs` 进 verify（直读 CSS + 画廊产物校验） | `packages/cli/src/design-compliance.ts` + `scripts/checks/visual.mjs` + verify.mjs | visual check 6/6 + design-compliance.test.ts（含反例：低对比度必被抓） |
| **VIS-001 像素级视觉回归** | Playwright 截图回归：4 主题 × 亮暗 × 3 断点（1440/768/375）24 组；只跑 chromium（字体确定性）；`verify:visual`（diff）/ `verify:visual:update`（生成基线，人工锁定）；快照目录 artifacts/visual/snapshots/ | `scripts/visual-regression.spec.ts` + `playwright.visual.config.ts` + package.json scripts | verify:visual 24/24（基线已生成，待人工确认锁定） |
| **VIS-001 前端打磨 + 组件库文档** | 默认主题字号改 1.25 模块化缩放（lg 20/xl 25/2xl 31.25/3xl 39px）；默认 muted 加深 #71717a（达标 WCAG ≥3）；组件库文档：清单 + 定制三入口（CSS 覆盖/extendMarked/插槽——Astryx 式） | `packages/cli/src/site.ts`（DEFAULT_THEME_CSS）+ `docs/component-gallery.md` + `docs/themes.md` 重写 | 合规断言覆盖默认主题（muted ≥3 门禁由机器保证） |

## 关键设计决策

1. **主题 CSS 独立成文件**（`src/themes/*.css`）：visual check 直读 CSS 做机器断言（零 TS 依赖），
   也是未来主题市场/分发的载体（主题 = 一个 CSS 文件）；元数据（defaultTheme）留在 themes.ts。
2. **minimal = Minimal 设计语言的显式包**（与默认视觉一致 + 少量组件打磨），default 零注入仍是默认——
   11 文档规格「Minimal=默认」与 THEME-002「内置表含 minimal」两者同时满足。
3. **modern 暗色优先结构**：`:root` 即暗色令牌、`[data-theme="light"]` 覆盖亮色 + `defaultTheme:"dark"`
   （防闪烁脚本 localStorage 无记录时进暗色）——「首次进入即暗色」三形态一致生效。
4. **合规门禁边界诚实**：muted 阈值 ≥3（装饰性小字，非交互正文）；xs/sm 字号豁免 1.25 链
   （基础 UI 字号 12/14px）；主题未定义字号令牌时跳过节奏检查（继承默认主题，默认已合规）。
5. **截图回归只跑 chromium**：跨浏览器字体差异污染基线；三形态一致性由 SNAP-001 覆盖；
   基线人工锁定后生效（11 §6.2），diff 阈值 maxDiffPixelRatio 0.01。
6. **画廊面板 fixedTheme 钉死**：不依赖 localStorage/系统偏好，亮暗对比纯净；面板复用 renderPage
   （form=ssg）与真实站点同构（渲染唯一在 Node 内核）。

## 体积门禁（无变化）

| 产物 | 门禁 | 实测 |
|---|---|---|
| 展示层 gzip | < 25KB | 10.4KB（本次零改动——全部能力在 CLI 侧主题覆盖层） |
| Node 内核 | < 30KB | 27.8KB（design-compliance/gallery 纯逻辑，不进运行时） |

**无新增运行时依赖**（合规/画廊零依赖；Playwright 复用既有 devDep；主题 CSS 是静态资源）。

## 验证命令

```bash
npm run verify          # 7/7（新增 visual check：设计合规 + 画廊产物）
npm run verify:visual           # 像素级回归 diff（基线锁定后）
npm run verify:visual:update    # 生成/刷新 24 组基线（首次由人确认后锁定）
doclight build --themes         # 产物含 gallery/（可部署可截图）
doclight preview --themes       # 先构建画廊再预览
npm run spec:check      # 47/47（VIS-001 追溯）
```

## 遗留（Phase 6 P1 剩余 + 后续）

- **P1 · WORK-001 预览-确认-发布**（dev 增量渲染 + 版本快照回滚 + `publish --preview`/确认门）——下一步
- **P1 · MCP-006 写入端**（write_doc/update_doc/delete_doc + 写入触发增量重渲染联动）
- **P2 · DEMO-001 演示形态** + **并行 OSS-001 开源化**（LICENSE/README/npm 包名待用户决策）
- 视觉基线**待人工确认锁定**（artifacts/visual/snapshots/24 张；确认后 verify:visual 成为硬门禁）
- 可选增强：画廊面板启用 KaTeX/Mermaid 真实渲染（当前静态降级源）；主题市场画廊在线版
