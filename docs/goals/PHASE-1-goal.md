# 目标声明：Phase 1 —— Node 渲染内核 + dev server（M1 内核可用）

> 需求 ID 前缀：`REND`（渲染）/ `NAV`（导航）/ `DEV`（dev server）
> 上游：docs/tech-design/08-roadmap Phase 1、02-architecture §2.2、03-runtime-engine §3.1-3.3
> 状态：✅ 对齐点 A 已确认（2026-08-11）
> 决策：① Node 内核预算 20KB → **30KB**（ADR-0002 修订，实测 27.9KB）② dev server 放 **packages/cli/** ③ 展示层骨架 **最简可用**
> 流程：15-development-process §2（目标声明 → 对齐点 A → 拆解）

---

## 1. 背景（为什么现在做）

Phase 0 已交付 Agent 自迭代环境（`npm run verify` 全绿，CI 修复转绿）。当前所有包均为占位代码（renderer 的 `render()` 返回空串）。项目距离「可用的文档站」还差最关键的一块：**渲染内核**。

三形态架构（dev / SSG / bundle）的全部产物都复用 Node 渲染内核（02 §2.1），浏览器展示层不接触原始 Markdown。因此内核是 Phase 1 的**单一事实来源**，先做内核、再长功能（08 总体策略）。本阶段交付后，`doclight dev` 即可在本机跑起一个可浏览的文档站 —— 项目从「空骨架」迈入「可用」。

## 2. 目标（完成什么，可衡量、机器可验证）

- **Node 渲染内核**（`packages/renderer/`）：
  - `marked` 集成 + GFM（表格 / 任务列表 / 删除线）✅
  - `DOMPurify` sanitize（XSS 防护，**强制**）✅，通过安全测试集（script / javascript: / 事件属性 / HTML 实体绕过）
  - 自定义 renderer：标题锚点注入、相对链接修正（站内/外部区分）、图片路径修正、代码块处理、表格包裹容器
  - frontmatter 提取与解析（title/summary/tags/date 等）
  - 导航树生成（docs.json，文件夹分组 + 数字前缀排序，03 §3.4）
- **dev server**（`packages/cli/` 或独立模块）：
  - Node 原生 HTTP 服务器 + path 路由（HTML5 history fallback）
  - 文件变更监听 + SSE 推送（热重载，不刷新整页）
  - 首屏直出（Node 渲染 → 返回完整 HTML）
- **展示层骨架**（`packages/display/`）：产物内联 JS/CSS、基础路由、事件总线、工具函数（不渲染 Markdown）
- **体积门禁**：Node 内核 gzip < 30KB（含 marked + DOMPurify，ADR-0002 修订）；展示层 < 25KB

## 3. 非目标（明确不做，防 scope 蔓延）

- ❌ 搜索（Phase 2）
- ❌ 代码高亮 / mermaid / 复制按钮（Phase 2）
- ❌ SSG `doclight build` / bundle（Phase 3）——本阶段 dev server 是唯一产物形态
- ❌ 完整主题系统与 4 套设计语言（Phase 1 只做亮/暗基础切换与设计令牌骨架，完整主题在 Phase 5/11 文档）
- ❌ TOC 导轨、阅读进度条、移动端侧边栏等交互细节（可留 Phase 2）——若时间允许只做最基础的导航渲染
- ❌ SEO、sitemap、llms.txt（Phase 3/4）
- ❌ npm 发布、域名（待用户决策）

## 4. 受益者（给谁用，解决什么问题）

- **人（写作/维护者）**：`doclight dev` 一条命令启动本地文档站，边写 Markdown 边看效果，热重载即时反馈
- **Agent（使用端）**：通过 MCP/llms.txt 消费文档（本阶段打内核基础）
- **开发 Agent（本项目）**：获得第一个真实产品代码与测试基座，后续 Phase 2-4 全部在此之上长功能

## 5. 验收（DoD 清单，可执行命令验证，不含人工确认）

1. `npm run verify` → VERIFIED ✓（含新增 renderer 单测）
2. `npm run spec:check` → ✓（REND / NAV / DEV 需求 ID 已在源码/测试中引用）
3. **安全测试集全绿**：恶意 Markdown（`<script>` / `javascript:` 链接 / `onerror` 属性 / 实体绕过）经 `render()` 输出中不含可执行内容（CI 常驻用例）
4. **渲染内核单测**：GFM 表格/任务列表/删除线、frontmatter、标题锚点、链接/图片路径修正均有断言
5. **导航树单测**：docs.json 生成符合 03 §3.4 排序规则（数字前缀、README 置顶、文件夹分组）
6. **体积门禁**：renderer 产物 gzip < 25KB（size check 中 renderer 条目取消注释启用，ADR-0002）
7. **dev server 冒烟**：`doclight dev` 启动后可访问首页（HTTP 200），修改 Markdown 触发 SSE 通知
8. `node --test`（或既有 vitest）无泄漏、退出码 0

## 6. 风险（可能失败的点与应对）

| 风险 | 应对 |
|---|---|
| marked 扩展性不足（自定义 renderer 不满足） | **先做 spike 验证**（本阶段第一步）；不足则换 markdown-it（+16KB，需重估 20KB 预算） |
| DOMPurify 在 Node 侧需要 DOM（jsdom 体积/性能） | spike 验证 jsdom 集成方案；确认 DOM 环境选型（jsdom vs 轻量替代）并计入内核预算 |
| 体积超 20KB 门禁（marked + dompurify + 内核逻辑） | spike 实测 gzip；必要时裁剪 marked 功能 / 只引入所需部分 |
| 热重载 SSE 在复杂目录下不稳 | 冒烟测试覆盖；先保证「改文件→推事件→浏览器刷新该页」基本链路 |
| scope 蔓延（顺手做搜索/高亮） | 以非目标清单为界，超界即报对齐点 |

---

## 6.5 spike 验证结论（2026-08-11 已实测，先验证后设计）

> 环境：`.spike/`（marked v18.0.9 + dompurify + jsdom），脚本 `marked-extensibility.mjs`

| 验证点 | 结果 | 对实现的影响 |
|---|---|---|
| GFM（表格/任务列表/删除线） | ✅ 内置全支持 | 无需额外插件 |
| 自定义 renderer | ✅ 可用，但**须用 marked v18 token 对象 API**（`heading({tokens,depth})`、`link({href,tokens})`、`table(token)` 带 `token.header/rows/align`） | **03-runtime-engine §3.3.2 的字符串签名示例已过时**，实现前需同步修订该文档 |
| 表格包裹 | ✅ 修正后输出正确 | 实现按 `token.header/rows` 迭代单元格 |
| DOMPurify Node 集成 | ✅ jsdom + `DOMPurify(window)` 全清 script/javascript:/onerror/iframe | 安全层可行 |
| **linkedom 替代 jsdom** | ❌ **sanitize 静默失效**（`<script>`/`javascript:` 残留） | **必须用 jsdom**，不可用轻量 DOM 替代（安全红线） |
| gzip 体积 | ⚠️ **marked 12.8KB（未压缩 UMD 13.2KB）+ dompurify.min 10.6KB ≈ 24KB，已超 20KB 预算**（未含自有逻辑 ~5KB） | **预算需决策**：见下方待确认点 4 |

**结论**：marked 扩展性够用，**无需换 markdown-it**；渲染管线按 03 文档结构实现，但 renderer 签名按 v18 实际 API。jsdom 为服务端运行依赖（不进浏览器产物，不计 gzip，但增加安装体积与启动时间）。

## 待对齐点 A 确认的要点

1. 本阶段范围（上表非目标）是否合理？尤其：**展示层骨架做到什么程度**（最简可用 vs 含基础导航渲染）？
2. 优先验证 `doclight dev` 可用（项目从骨架迈入可用），还是优先内核 API 完备？
3. dev server 放 `packages/cli/`（Phase 3 的 dev 命令）还是独立 `packages/dev-server/`？
4. **Node 内核体积预算**：~~实测超 20KB 硬门禁~~ → ✅ **已决策：上调至 30KB**（2026-08-11，人确认；REND-001 实测 27.9KB 后从 25KB 再修订至 30KB）。理由：内核是服务端/构建时产物，**不进浏览器**；压缩 marked 需引入构建工具链（违反 02 §2.3.4）。落地：更新 02/08/12 文档 + `size.mjs` BUDGETS + ADR-0002 修订。
