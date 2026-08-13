# ADR-0004: v3 产品定位——「把 Markdown 变成作品」（表现层）

> 状态：✅ 已接受（2026-08-13，v3 定位定稿）
> 日期：2026-08-13
> 决策者：人类维护者（定位方向）+ 开发 Agent（执行）
> 触发：产品方向复盘——用户四点反馈（Agent 输出更强/预览-确认-发布/低门槛定制打穿 CMS/开源验证）+ 两轮定位纠偏
> 调研依据：`research/product-vision-validation.md`（agent-reach 多平台调研：llms.txt 采用 115/219、Mintlify $23M ARR 与 Agent 流量 66%、Slidev MCP+Skill、Meta Astryx、Mutable CMS）

---

## 背景

Phase 0-5 全部完成后（verify 6/6 全绿、spec 44/44、单测 374），产品具备完整能力：
零构建三形态、扩展语法、llms.txt/MCP 读取端、publish/space 写入端、插件系统。
但定位仍停留在 v1（"服务于人阅读 + AI 原生友好的文档站引擎"）——偏功能罗列，
无法回答"DocLight 到底给用户什么独特价值"。经方向复盘，用户明确：

1. **内容质量 DocLight 帮不上忙**——内容是 Agent/人的领域；
2. **文档与演示是两个独立表现形式**——绝不用文档直接演示；演示的第一性是视觉表现力；
3. Agent 使用后产出应"更好看、更专业"，这是产品价值不是花瓶；
4. 提供底层能力 + 极低门槛定制（打穿传统 CMS）；倾向开源积累声望。

## 选项与决策

### ① 产品定位（一句话）

- **选项 A：v3「把 Markdown 变成作品」**（用户选定）——
  > DocLight 把 Markdown 变成作品。Agent 写，DocLight 渲染成专业的文档与演示——
  > 无需构建、开箱即用、随时可定制。
  技术本质：**Markdown 的表现层（Presentation Layer for Markdown）**——内容不碰，
  专注视觉表现力；插件/图表/演示/主题本质同一件事：提升 md 的视觉表现力。
- 选项 B：内容空间协议层（v2）——机器接口叙事，但偏"内容"、太理科、用户难懂。
- 选项 C：Agent Content Infrastructure（调研初版）——被用户否决：内容质量帮不上忙。

**决策：A**。对外一句话可读、对内本质清晰；表现层是产品可掌控的价值区间。

### ② 文档与演示的关系

- **选项 A：同源不同形（独立表现形式）**——同一份内容可有文档版与演示版，各有独立
  视觉语言与设计系统；演示质量由**演示专用视觉组件**保证；不做文档切页的机械转换。
- 选项 B：文档直接演示（`---` 分页复用文档渲染）——被用户否决：文档密度 ≠ 演示视觉。
- 选项 C：只做文档、放弃演示——演示是用户明确想扩展的方向，且视觉表现力主线延伸。

**决策：A**。文档仍是根基（密度/可检索/SEO/Agent 读取）；演示是独立的高视觉强度形态。

### ③ 产品价值主线

- **决策**：**视觉表现力是产品主线**（v3 原则一）。一切新能力围绕"同样的 md 内容经
  DocLight 呈现后视觉质量显著更高"验收；插件/图表/演示/主题都是这一主线的展开，
  不是零散功能。视觉质量机器化保障（视觉回归 + 设计合规门禁）。

### ④ 用户优先级

- **决策**：AI Agent 成为**第一用户**（v3 新增）——既是内容作者（写 md）又是消费者
  （读 llms.txt/MCP）；能力协议（Capability Manifest）让 Agent 写前知道"这个站能渲染
  什么"，不猜。人用户（P1-P5）延续 v1，P3 内容创作者新增"演示"诉求。

### ⑤ 开源策略（调研结论）

- **决策**：开源优先（MIT/Apache-2.0）+ GitHub Sponsors；远期可选插件/主题市场、企业
  托管。理由：品类现实路径是开源（Docusaurus/VitePress/Slidev 先例）；"Powered by"
  病毒分发在开源下同样成立；开源 + AI 原生是 Mintlify（托管 SaaS）与 Docusaurus
  （无 AI 原生）之间的真空。详见 `research/product-vision-validation.md` §四。

## 后果

- 设计文档更新：[01-product-positioning](./01-product-positioning.md) v3 定位
  （一句话/三角/竞品/用户/原则/指标）；08-roadmap 待增补新周期（表现层主线）。
- 近期执行方向（差距盘点，见 01 与 08 更新）：
  - P0：能力协议（Capability Manifest + AGENTS.md + MCP get_capabilities）+ 发布产物
    Agent 友好（每页 markdown 版 + llms.txt v2 Link 关系 + token 计数）；
  - P1：表现层设计系统化（4 套设计语言兑现 + 组件 + swizzle + 前端打磨 + 视觉回归门禁）；
    预览-确认-发布工作流（增量渲染 + 版本快照 + 确认门）；MCP 写入端；
  - P2：演示形态（演示专用视觉设计系统 + doclight-slides）。
- 展示层 < 25KB gzip / Node 内核 < 30KB 门禁不变（ADR-0002）——表现层能力以
  按需注入/插件形态提供，不进核心体积。

## 关联需求

- [01-product-positioning](../docs/tech-design/01-product-positioning.md)（v3 定位）
- [08-roadmap](../docs/tech-design/08-roadmap.md)（待增补：v1.0 收尾新周期）
- `research/product-vision-validation.md`（调研证据与前景验证）
- [12-development-standards](../docs/tech-design/12-development-standards.md)（加依赖纪律）
