# PHASE-7 DP-007 交接 · AI 原生身份显性化（Phase 7 收官）

> 任务：DP-007 AI 原生身份显性化（18-design-polish §3.7）——Phase 7 最后一项。
> 换会话先读本文件 + 18-design-polish.md + 各 DP 交接。

## 一句话总结

DocLight 的 AI 原生身份第一次显性化到界面：内容溯源徽标（frontmatter provenance 驱动、
诚实标注、可关闭）、llms.txt 收录提示（双读者哲学）、主题画廊升级为「设计宣言」页
（宪法的为什么可视化）、写作端预览一致性规范成文。**Phase 7 七项全部收官。**

## 改动清单

**页面模板与组装（packages/cli/src/）**
- `site.ts`：
  - SeoOptions 新增 `provenance?: "ai" | "human" | "mixed"`（frontmatter provenance 驱动）
  - meta 行溯源徽标（origin-badge + origin-{kind} class + × 关闭按钮；缺省不渲染）
  - TOC 卡 llms-note「已收录于 llms.txt · Agent 可读」——**仅 SSG 形态**（dev/bundle 无产物，诚实不伪造）
  - CSS：origin-badge（描边圆角小徽标，ai 态用强调色）/ llms-note（发丝线上方小字）
- `build.ts` / `dev-server.ts` / `bundle.ts`：三形态从 frontmatter 读 provenance（白名单三值）传 seo
- `capabilities.ts`：FRONTMATTER_KEYS 登记 provenance（capabilities.json 三形态同步）
- `gallery.ts`：画廊索引页加「设计宣言」区（宪法五原则 + 令牌事实胶囊；DP-001 画廊改造合并收口）

**展示层（packages/display/src/）**
- `design.ts`：bindOriginBadge——× 关闭 + localStorage 持久化（全站级 doclight-origin-hidden）

**文档**
- `18-design-polish.md`：§3.7 检查项勾选 + 「写作端预览一致性规范」六条成文
- AGENTS.md 重新生成（regenerate-agents.mjs，provenance 入 frontmatter 约定）

**测试**
- 新增 `packages/cli/test/dp007-ai-identity.test.ts`（6 例：白名单三值三形态/缺省不渲染/
  llms-note 仅 SSG/画廊宣言/buildSite+bundle 端到端/capabilities 登记）

## 验证状态

- `npx vitest run packages/cli/test/dp007-ai-identity.test.ts`：6 通过
- `npm run verify`：**8/8 全绿**
- 展示层体积 16.57KB gzip（DP-007 增量 +0.15KB，门禁 <25KB 余量充足）
- 浏览器/产物实测：无 provenance 无徽标 ✅ / dev 无 llms-note ✅ / dist-site 有 llms-note ✅ /
  画廊设计宣言 ✅ / build+bundle provenance 端到端 ✅（单测）

## 遗留与注意

- 溯源徽标信任模型 = frontmatter 自声明（诚实标注，不审计内容真伪——超出引擎职责）
- llms-note 仅 SSG：dev 形态展示层无 llms.txt 产物，不指向死链（诚实原则）
- provenance 键只加不改（schema 无关——frontmatter 非契约 JSON；capabilities 已登记）
- slides 演示形态的 AI 身份显性化未做（独立设计系统，另行提案）

## Phase 7 总结（DESIGN-POLISH 全量完成）

DP-001 主题收敛（唯一内置主题）→ DP-002 品牌层 → DP-003 阅读状态感 → DP-004 内容纵深 →
DP-005 导航智能 → DP-006 动效工艺 → DP-007 AI 原生身份。
展示层体积 13.33KB → **16.57KB gzip**（+3.24KB，仍远低于 25KB 门禁）；
每项 verify 8/8 + 浏览器实测 + 交接文档 + CLAUDE.md/AGENT.md 状态同步。
