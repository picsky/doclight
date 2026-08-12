# TASK: verify:e2e 门禁 + Phase 1 收尾 + Phase 2 搜索（2026-08-12）

> 状态：✅ 全部完成并验证（`npm run verify` 6/6 全绿 + 浏览器端到端 33/33 × chromium/firefox/webkit）
> 上游：08-roadmap Phase 1 收尾项 + Phase 2；03-runtime-engine §3.2/§3.5/§3.6/§3.7
> **下一步：Phase 2 剩余体验项（代码高亮/复制/自定义容器等）或进 Phase 3（SSG）**
> 本文件是新会话第一入口；交接格式见 AGENT.md。用户将回来统一提交（本会话未提交）。

---

## 本次完成的三块

### 1. verify:e2e 纳入全量门禁（锁质量，PHASE-1-complete 建议 #1）

| 文件 | 内容 |
|---|---|
| `e2e/display.spec.ts` | 展示层端到端（Playwright 正式测试，替代 `.spike/display-integration.mjs`）：主题/SPA 导航/前进后退/移动端侧边栏 + **TOC 4 例** + **搜索 3 例**；dev server 直接 `startDevServer()`（Playwright esbuild 转译 TS），docs 夹具临时目录 beforeAll/afterAll 自清理 |
| `scripts/checks/e2e.mjs` | 标准 check：`playwright test` → 解析 `artifacts/e2e/results.json` → 标准 payload（双格式输出） |
| `scripts/verify.mjs` / `package.json` / `playwright.config.ts` | CHECKS 追加 `e2e`；`verify:e2e` 脚本；timeout 30s→60s、workers=3（降三浏览器并行 CPU 争抢引发的 WebKit 超时 flake） |
| `.github/workflows/ci.yml` | 新增 `npx playwright install --with-deps chromium firefox webkit` 步骤 |

### 2. Phase 1 收尾（TOC-001 + THEME-001 + PLUG-001/002）

| 需求 | 文件 | 内容 |
|---|---|---|
| **TOC-001** | `packages/display/src/toc.ts` + 测试 + `e2e` | 标题提取（h2/h3，parseHeadings 纯函数）/ PC 右侧导轨（指示点 + hover 展开面板）/ 移动端底部面板（FAB + sheet）/ IntersectionObserver 滚动高亮 / 点击平滑跳转 + 锚点更新；路由变化自动重建（订阅总线 `doclight:routechange`） |
| **THEME-001** | `packages/cli/src/dev-server.ts` CSS | 完整设计令牌（03 §3.6.1：品牌色/8 级灰阶/语义色/字体栈/字号/行高/间距/布局/圆角/阴影/过渡）+ 暗色覆盖（§3.6.2）+ 阅读排版（04 §4.2/4.3/4.4）+ prefers-reduced-motion |
| **PLUG-001** | `packages/display/src/event-bus.ts` + 测试 | 轻量发布/订阅：on/off/emit/clear，on 返回退订函数（插件 destroy 友好），单订阅者异常隔离 |
| **PLUG-002** | `packages/display/src/router.ts`（扩展）+ 测试 | beforeEach（false 取消 / 字符串重定向）/ afterEach（导航后执行）；导航成功向总线发 `doclight:routechange`；initRouter 返回 `{ beforeEach, afterEach, navigate }` |

### 3. Phase 2 搜索（SRCH-001）

| 文件 | 内容 |
|---|---|
| `packages/display/src/search.ts` + 测试 | 检索内核（纯函数可测）：tokenize（拉丁按词 + CJK 单字/二元组）/ buildIndex（倒排索引，字段权重 title4>headings2>path1=text1）/ search（得分排序 + 命中摘要）/ highlight（<mark> 高亮）；Cmd/Ctrl+K + 顶栏按钮 + `/` 快捷键；键盘导航（↑↓/Enter/Esc）；最近搜索（localStorage，≤5）；100ms 防抖；索引懒加载（首开才 fetch） |
| `packages/cli/src/dev-server.ts` | `/__doclight/search-index.json` 端点（懒构建：渲染内核输出 → 剥标签纯文本；frontmatter.title 或文件名主干；文件变更失效重建） |

**决策记录（换会话勿推翻）**：**未集成真实 MiniSearch**（roadmap 原案）。原因：展示层零外部依赖 + 拼接式构建（build-display.mjs 无裸包名解析）+ <25KB 门禁；已以 **MiniSearch 同形状 API**（字段权重 / search→{id,score,terms}）自研落地，**Phase 3 构建工具链允许打包时一处文件替换为真实 MiniSearch**（03 §3.5.4）。

## 验收状态（已实测）

- `npm run verify` → **VERIFIED ✓ 6/6**（lint/typecheck/test/size/contract/e2e；连续两轮稳定）
- `npm run verify:e2e` → **33/33** × chromium/firefox/webkit（含 TOC 4 + 搜索 3 新用例）
- 体积门禁：展示层 **9.8KB gzip**（<25KB ✓）/ Node 内核 5.7KB（<30KB ✓）
- 单测 **95/95**；spec 追溯 **8/8**（TOC-001/THEME-001/PLUG-001/PLUG-002/SRCH-001 均已登记 .feature 并在 packages 引用）

### WebKit flake 处理记录（勿再改回）

本机 WebKit 在 3 浏览器并行负载下偶发超时（不同用例随机：SPA 导航断言 / 搜索开合；隔离 4.8s vs 满载 19.8s+；chromium/firefox 稳定）。已三重稳定化（`playwright.config.ts`）：
1. `timeout: 60_000`（测试预算，原 30s）
2. `expect: { timeout: 20_000 }`（断言预算，默认 5s 满载 WebKit 下误报）
3. `retries: 2`（无条件，与 CI 一致）——确定性回归 3 次仍失败（不放过真 bug），瞬时抖动被吸收
若后续 WebKit 在本机持续拖慢 verify，可考虑将 WebKit 抽为独立 `verify:browser-matrix`（默认门禁 chromium+firefox）。

## 关键约定（换会话勿推翻）

- 需求 ID 前缀沿用 specs/README：TOC / THEME / PLUG（事件总线+路由钩子按设计文档归插件基础）/ SRCH
- 展示层新模块延续「纯函数可 Node 测试、DOM 集中在 init 函数」结构；vitest 环境为 node（无 DOM）
- TOC 导轨仅桌面（>1024px），移动端用 FAB+底部面板（03 §3.7）；搜索框由展示层注入 DOM、样式在 dev-server 壳
- e2e 新用例先本地 `npx playwright test` 调试（三浏览器），再走 `npm run verify:e2e`
- Playwright 浏览器已本机安装；CI 走 `playwright install --with-deps`

## 遗留 / 下一步

| 项 | 说明 |
|---|---|
| **Phase 2 剩余体验项** | 代码高亮（Prism）、代码块复制、自定义容器（:::tip）、链接 hover 预览、专注模式、字号调节、打印样式、Powered by DocLight |
| Phase 2 无障碍收尾 | 键盘导航完整支持、focus ring、ARIA 标签（已有部分） |
| 搜索索引持久化 | localStorage + 版本校验（03 §3.8.5，当前未做；SSG 预构建 search-index.json 待 Phase 3） |
| **Phase 3** | SSG `doclight build` + bundle + 部署（渲染内核/展示层已复用就绪）；此时换回真实 MiniSearch 的窗口 |
| doclight.json 配置系统 | 02 §2.5（title/theme/nav），dev server 现用默认值 |
| 视觉回归 / 同构快照 / 浏览器矩阵 | verify:e2e 已覆盖三浏览器展示层；visual/isomorphic 仍为 Phase 0 遗留 |

## 建议提交拆分（用户统一提交时参考）

1. `feat(DEV): verify:e2e 展示层端到端纳入 verify 门禁`（e2e/ + scripts/checks/e2e.mjs + verify.mjs + package.json + playwright.config + ci.yml）
2. `feat(TOC-001,THEME-001,PLUG-001,PLUG-002): Phase 1 收尾——TOC/事件总线/路由钩子/完整主题令牌`（display 模块 + dev-server 壳 + specs/features/{toc,theme,plugin}.feature）
3. `feat(SRCH-001): 内置搜索——Cmd/Ctrl+K 检索框 + 中文 bigram 检索内核`（search.ts + dev-server 索引端点 + specs/features/search.feature）

## 交接人

开发 Agent（本会话）。人类维护者回来后统一提交；提交前可跑一次 `npm run verify` 复核。
