# TASK: Phase 6 P2——DEMO-001 演示形态（2026-08-13）

> 状态：✅ 完成（verify 7/7 全绿目标；spec:check 50/50；单测 452/452 目标；视觉回归 26/26）
> 上游：ADR-0004（v3 定位）+ 08-roadmap Phase 6 P2 + 01 §原则二（文档与演示同源不同形）
> + research §五 P2（演示 = 独立表现形式；质量由演示专用视觉组件保证，不让 Agent 裸写语法碰运气）
> **本文件是 Phase 6 第三棒交接（P0/P1 见前两棒；Phase 6 全部主线至此完成）**

---

## 本次完成清单（需求 ID 可追溯）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **DEMO-001 演示源解析** | `parseSlides`：frontmatter 元数据（title/author/date）+ `---` 分页（frontmatter 块不算分页）+ 布局指令 `<!-- layout: cover/section/content/end -->`（缺省：首页 cover，其余 content）+ 演讲者备注 `<!-- notes: -->`（提取且不进正文） | `packages/cli/src/slides.ts` | slides.test.ts 10 例（解析/构建/主题/安全/CLI） |
| **DEMO-001 自包含产物** | `buildSlidesHtml`：每页经渲染内核 render（扩展语法/容器可用，XSS sanitize）+ `.slide` section（data-layout/data-notes 承载）+ 演示设计系统 CSS（`--slide-*` 令牌 + 布局/动效/打印/响应式/reduced-motion）+ 壳层 JS（键盘/触摸/点击导航、URL #N 直达、进度条、页码、F 全屏、S 演讲者备注视图）；单文件零外部引用（file:// 可开，与 bundle 同哲学） | `packages/cli/src/slides.ts` | 单测 + 浏览器冒烟 10 项全 PASS（导航/备注/hash/sanitize/代码块/主题） |
| **DEMO-001 演示设计系统** | 3 内置主题：dark（默认深色渐变+teal）/ light（亮色纸感+靛蓝）/ warm（暖色+琥珀）+ 自定义 CSS 文件（`--slide-*` 令牌覆盖）+ 未知主题警告回退（诚实原则） | `SLIDE_THEMES` + `resolveSlideThemeCss` | slides.test.ts（三主题/自定义/回退） |
| **DEMO-001 CLI 接线** | `doclight slides <file.md> [--theme] [--author] [--out-dir]`：输出 dist-slides/<name>.html + 页数/字节报告 + 导航提示；help 与未知命令清单更新 | `packages/cli/src/index.ts`（runSlides + 命令分发） | slides.test.ts（runSlides 产物断言） |
| **DEMO-001 Agent 入口** | doclight-slides Skill（`.claude/skills/doclight-slides/`：何时用演示/编排语法/四步流程/同源不同形原则/失败处理表）+ `docs/slides.md` 演示指南（语法/布局语义/主题定制/演示者功能/文档关系表） | Skill + docs | 双读友好（Agent + 人） |
| **DEMO-001 视觉回归门禁** | visual check 增演示产物（buildSlidesHtml 构建 artifacts/visual/slides-demo.html + 壳层完整性 + ≤100KB 预算）；verify:visual 增 2 组演示截图基线（封面 + #3 内容页，file:// 直开） | `scripts/checks/visual.mjs` + `scripts/visual-regression.spec.ts` | visual check 7/7 + 回归 26/26 |

## 关键设计决策

1. **同源不同形落地**：演示源是独立编排的 markdown（每页一观点），复用渲染内核（扩展语法一致）但
   产物/视觉语言/叙事结构完全独立——**不做「文档切页成演示」的机械转换**（01 §原则二红线）。
2. **语法对齐生态**：`---` 分页 + `<!-- layout: -->` + `<!-- notes: -->` 是 Marp/Slidev 生态通用
   心智模型，Agent 零学习成本；布局指令是增强（缺省自动推断），**裸写也好看**（质量兜底）。
3. **自包含单文件 = 分发形态**：与 bundle 同哲学（内嵌 CSS+JS，file:// 可开）；代码高亮/KaTeX/Mermaid
   诚实降级为可读源码（REND-003 精神）——单文件零 vendor，演示主打排版与叙事。
4. **演示设计系统独立令牌**（`--slide-*`）：与文档 4 套主题（`--color-*`）刻意不同形——
   两个表现形式的视觉语言各自独立成立；自定义 CSS 覆盖与主题包同模式。
5. **壳层零依赖零框架**：导航/全屏/备注/进度约 60 行原生 JS 内嵌（演示产物不含外部库，
   体积 ≤100KB 预算由 visual check 门禁保障）。
6. **演示视觉回归 = file:// 直开**：演示本来就是单文件分发形态，截图基线直接以 file:// 打开
   （顺带验证了真实分发形态可用性）。

## 体积门禁（无变化）

| 产物 | 门禁 | 实测 |
|---|---|---|
| 展示层 gzip | < 25KB | 10.4KB（本次零改动——演示是独立 CLI 产物） |
| Node 内核 | < 30KB | 27.8KB |
| 演示单文件 | ≤ 100KB | 约 8.7KB（4 页示例，含壳层） |

**无新增运行时依赖**（演示壳层原生 JS；视觉回归复用既有 Playwright）。

## 验证命令

```bash
npm run verify          # 7/7 全绿（visual check 含演示产物）
npm run verify:visual   # 26 组截图基线 diff（含演示封面/内容页）
npm run spec:check      # 50/50（DEMO-001 追溯）
# 手动验证：
doclight slides docs/slides.md --theme warm --author "DocLight 团队"   # 用演示指南自身做 dogfood
doclight preview --dir dist-slides                                      # 预览
```

## 遗留（v1.0 收尾）

- **OSS-001 开源化**（LICENSE + README 重写 v3 定位 + npm 包名注册）——npm 包名与域名**待用户决策**；
  Phase 6 全部主线至此完成，剩余仅此项外部决策项
- 可选增强：演示演讲者视图（当前为页内备注条，非独立窗口）；演示内嵌 mermaid 渲染
  （需 vendor，当前降级源码）；`doclight slides` 多文件目录批处理
