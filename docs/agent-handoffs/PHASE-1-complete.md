# TASK: Phase 1 主体完成交接（Node 渲染内核 + dev server + 展示层骨架）

> 状态：✅ 主体完成（2026-08-12）——M1 内核可用
> 上游：docs/tech-design/08-roadmap Phase 1、docs/goals/PHASE-1-goal.md（对齐点 A 已确认）
> **下一步：Phase 1 遗留收尾（TOC/事件总线等）或直接进 Phase 2（搜索）**

> 本文件是换会话的第一入口。开工前：先跑 `npm run verify` 确认从全绿基线出发。

---

## 已完成（Phase 1 主体交付物）

| 需求 | 内容 | 提交 |
|---|---|---|
| **REND-001** | Node 渲染内核：`packages/renderer/src/core/`（markdown.ts v18 token renderer / sanitize.ts DOMPurify+jsdom / frontmatter.ts / link.ts）+ `render()` 全管线 + 安全测试集（script/javascript:/onerror/iframe/svg/实体绕过/标签变形/表格注入 10 项全过） | `db4f06b` |
| **NAV-001** | 导航树：`packages/renderer/src/nav.ts` `buildNavTree/buildDocsJson`（README>index 置顶、数字前缀、字母序、文件前目录后、index 指针；纯函数不做 I/O） | `b4784d5` |
| **DEV-001** | dev server：`packages/cli/src/dev-server.ts`（原生 http + path 路由 + 首屏直出 + SSE 热重载 + docs.json 端点 + 静态资源 + 路径穿越防护）；`doclight dev` 一条命令启动（Node 22.6+/23.6+ 原生 TS 剥离） | `4bf8583` |
| **展示层骨架** | `packages/display/src/`：theme.ts / router.ts（SPA）/ sidebar.ts / index.ts（自挂载）；dev server 页面壳集成（顶栏/防闪烁/暗色令牌/移动端） | `1448e32` |
| 构建 | `build-renderer.mjs`（→ `packages/renderer/dist/renderer.js`）+ `build-display.mjs` 升级（递归+剥离 import → `dist/display.js`） | `a426a93` / `1448e32` |
| 预算 | **ADR-0002** 修订：Node 内核 20→25→**30KB**（实测 27.9KB：marked 12.8+dompurify 10.6+逻辑 4.0；压缩需构建工具链违反 02 §2.3.4） | `d6a4277`/`a426a93` |

## 验收状态（已实测）

- `npm run verify` → **VERIFIED ✓**（lint/typecheck/test/size/contract 5/5）；`spec:check` ✓（REND-001/NAV-001/DEV-001 追溯闭环）
- `doclight dev` 冒烟：首页 200 完整 HTML 直出、docs.json、404 均正常
- **浏览器端到端**（`.spike/display-integration.mjs`，Playwright **8/8 通过**）：主题切换+持久化、SPA 导航（注入/URL/无整页刷新）、前进后退、移动端侧边栏
- 体积门禁：展示层 gzip 2.85KB / Node 内核 27.9KB，均过

## 关键决策与约定（换会话勿推翻）

- **源码相对导入用 `.ts` 扩展名**（Node 原生 TS 类型剥离要求；tsconfig 已设 allowImportingTsExtensions）
- renderer 只做**纯数据变换**，I/O（目录扫描/HTTP/文件监听）在 cli 层
- marked.use({ renderer }) 必须用**对象字面量**（自有可枚举 key）；类实例/私有字段会被静默忽略
- DOMPurify Node 侧**必须 jsdom**（linkedom 实测 sanitize 静默失效，安全红线）；jsdom 是服务端运行依赖，不进产物
- DOMPurify 默认剥离 `target`/`loading`，sanitize 配置已 `ADD_ATTR` 放行（外部链接强制 rel=noopener）
- Node 内核 < 30KB / 展示层 < 25KB 硬门禁（ADR-0002 修订）；加依赖走审批
- 需求 ID 前缀：REND/NAV/DEV 已登记（specs/README.md），规格在 `specs/features/{render,nav,dev}.feature`

## 遗留（Phase 1 剩余 + 原 Phase 0 遗留）

| 项 | 依赖 | 说明 |
|---|---|---|
| TOC 系统 / 事件总线 / 路由钩子 / 完整主题令牌 | 展示层已就位 | 对齐点 A 定为「最简骨架」，TOC 导轨等留 Phase 2 |
| `doclight.json` 配置系统 | — | 02 §2.5，CLI 配置读取（title/theme/nav），dev server 现用默认值 |
| CLI bin/发布接线 | 用户决策 | `doclight` npm 包名、`doclight dev` 全局命令安装（Phase 3 CLI 框架） |
| 搜索 / 代码高亮 / Mermaid | Phase 2 | 08-roadmap Phase 2 |
| SSG `doclight build` / bundle | Phase 3 | 渲染内核已复用就绪 |
| 视觉回归基线 / 同构快照 / 浏览器矩阵 | **现在可解锁**（依赖的展示层已存在） | 原 Phase 0 遗留，见 10 §2.1 验证矩阵，建议 Phase 2 前补 browser-matrix 基础 |
| Golden Master / 评审 Agent 逻辑 | 模型接入 | review.mjs 仍为契约占位 |

## 下一步建议

1. **优先：浏览器矩阵 / 展示层 e2e 纳入 verify**（`.spike/display-integration.mjs` 已证明可行，抽为正式 check `verify:e2e`，CI 装浏览器）——锁住展示层质量，防后续改动回归
2. Phase 1 收尾项（TOC 系统 + 事件总线 + 路由钩子 + 完整主题令牌）可拆 REND-xxx/THEME-xxx 任务
3. 或直接进 **Phase 2（搜索 + 体验）**：MiniSearch 集成 + Cmd+K 搜索框（需求前缀 `SRCH` 已登记）
4. 每任务：实现 + 测试 + `npm run verify` + 提交引用需求 ID；视觉改动附截图

## 交接人

开发 Agent（本会话）。人类维护者确认 Phase 1 主体完成。
