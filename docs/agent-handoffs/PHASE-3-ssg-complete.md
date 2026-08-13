# TASK: Phase 3 SSG 最小闭环（SSG-001 doclight build / SSG-002 vendor 基址决策 / PREVIEW-001 preview）（2026-08-13）

> 状态：✅ 完成并验证（`npm run verify` 6/6 全绿 + e2e 51/51 × 三浏览器 + cli build/preview 单测 + renderer linkSuffix 单测）
> 上游：08-roadmap §Phase 3 SSG + 05-ssg-build §5.3 构建流程
> **下一步：✅ 已完成（2026-08-13）——Phase 3 剩余全部落地（SEO 全套 / init / bundle / deploy / docsify 迁移 / 搜索持久化 / --base），见 [PHASE-3-complete.md](./PHASE-3-complete.md)；再下一步 = Phase 4（AI 就绪）**
> 本文件是新会话第一入口；交接格式见 AGENT.md。用户将回来统一提交。

---

## 本次完成的三块 + 跨层配套

### 1. SSG-001 `doclight build`（静态导出主链路）

| 文件 | 内容 |
|---|---|
| `packages/cli/src/build.ts` | buildSite()：扫描→导航树→逐篇渲染（linkSuffix=".html"）→首页收敛（根级 README/index → index.html，无则回退首篇）→search-index.json 预构建（path 为 .html）→静态资源拷贝→display.js 拷贝→vendor 拷贝；outDir 清空重建 |
| `packages/cli/src/site.ts` | 共享模块：walkMd / escapeHtml / mimeFor / renderNav（linkSuffix 参数）/ renderPage（dev/ssg 双形态）/ buildSearchData（pathSuffix 参数）/ nodeModulesBase / VENDOR_FILES / copyVendor（SSG-002） |
| `packages/renderer/src/core/markdown.ts` + `index.ts` | render 新增 `linkSuffix` 选项：SSG 站内 .md 链接转 .html，dev 缺省保持 .md（锚点/外部/图片/非 .md 链接不误伤） |
| `packages/cli/src/index.ts` | 命令接线：dev / build / preview；通用 parseArgs（--key value / --key=value） |
| `specs/features/ssg.feature` | SSG-001 / SSG-002 / PREVIEW-001 Gherkin 验收准则 |

**产物 URL 约定（关键决策）**：每篇 .md → 同相对路径 .html（`guide/foo.md` → `guide/foo.html`），根级 README/index → `index.html`。任意静态托管零改写即可部署；display router fetch `.html` 原样命中。

### 2. SSG-002 vendor 基址决策（拍板：拷贝 dist/vendor，自包含 + 离线可用）

- dev server 保留 node_modules 按需服务（`/__doclight/vendor/*`，不动）；**SSG 由 build 拷贝 Prism/Mermaid/KaTeX + KaTeX 字体进产物 `/vendor/`**，页面内联 `window.DOCLIGHT_VENDOR_BASE="/vendor/"` + `window.DOCLIGHT_SEARCH_INDEX="/search-index.json"` + `window.__DOCLLIGHT_SSG__=true`
- 否决 CDN：破坏跨浏览器离线卖点 + 依赖外部可用性（05 §5.1.2 形态②「任意静态托管 + 首屏更快」）
- `display/src/extensions.ts` 已预留 `DOCLIGHT_VENDOR_BASE`（直接生效，无改动）；`search.ts` 新增同模式 `DOCLIGHT_SEARCH_INDEX` 全局覆盖

### 3. PREVIEW-001 `doclight preview` + 展示层配套

| 文件 | 内容 |
|---|---|
| `packages/cli/src/preview.ts` | 静态服务器：/ → index.html；无扩展名 / .md 请求回退 .html；穿越防护 |
| `packages/display/src/router.ts` | highlightActive 归一 `.md` 与 `.html` 后缀（dev/SSG 双形态导航高亮） |
| `packages/display/src/search.ts` | `DOCLIGHT_SEARCH_INDEX` 全局覆盖（SSG 指向 /search-index.json） |

### 4. dev server 重构（抽取共享模块，行为不变）

`dev-server.ts` 的 walkMd/renderNav/renderPage/escapeHtml/MIME/buildSearchIndex 全部迁移到 `site.ts`（buildSearchIndex → buildSearchData），dev server 改从 site.ts 导入；**9 个既有 dev-server 测试全部原样通过**（回归零破坏）。

## 验收状态（已实测）

- `npm run verify` → **VERIFIED ✓ 6/6**（lint/typecheck/test/size/contract/e2e）
- 单测新增：cli `build.test.ts` 8 例（.html 输出/首页收敛回退/渐进式水合标记/链接后缀/搜索索引/静态资源/vendor 拷贝/preview 服务/穿越防护）+ renderer `linkSuffix` 1 例；spec 追溯 **10/10**（新增 ssg.feature）
- **浏览器实测（Playwright chromium）**：SSG 产物上 SPA 导航 + 导航高亮 active + 搜索（预构建索引点击导航）+ 代码块高亮（Prism 从 `/vendor/prism.min.js` 懒加载）+ 复制按钮 + 主题切换全部正常，零 JS 错误
- 构建实测：本仓库 docs/（23 篇）→ 24 页 1.1s，产物 6MB（大头为 vendor：mermaid/katex/字体）

## 关键决策记录（换会话勿推翻）

1. **SSG vendor 基址 = 拷贝 dist/vendor（自包含）**，页面 `DOCLIGHT_VENDOR_BASE="/vendor/"`；`display` 不改默认值，SSG 页内联覆盖，bundle 形态（Phase 3 后续）再定（可内联）。
2. **SSG URL 约定 = .html 后缀**（非目录 / 非 .md）：任意静态托管零改写。dev 保持 .md（既有 e2e 断言 .md URL 不破坏）。渲染唯一性（05 §5.3.3）靠同一 render 内核保证，仅链接后缀经 `linkSuffix` 切换。
3. **buildSearchData pathSuffix**：SSG 搜索索引 path 直接存 .html（display 搜索结果 href 直接可用）；dev 存 .md 不变。
4. **输出目录默认 `dist-site/`**（非 05 §5.2.1 的 `dist`——本仓库根 dist/ 已是构建产物 display.js/renderer.js，冲突；已 gitignore）。此为仓库内局部偏差，npm 包形态再议。
5. **display.js 必须是最新构建产物**：SSG 拷贝的是 `dist/display.js`，改展示层源码后需先 `npm run build` 再 `doclight build`（本次踩坑：陈旧 bundle 导致 SSG 导航高亮不生效，root cause = bundle 未含 router.ts `.html` 归一）。
6. **拼接式构建命名冲突**：display 所有 src 合一作用域，新增具名函数不得与其他文件重名（search.ts 的 winGlobal 与 extensions.ts 撞名，已改为内联）。

## 遗留 / 下一步

| 项 | 说明 |
|---|---|
| **SEO 全套（优先）** | sitemap.xml / robots.txt / OG + Twitter Card / JSON-LD / canonical / 面包屑 / OG 卡片图（05 §5.4） |
| **`doclight init`** | 生成 doclight.json + 示例 docs/ + index.html（05 §5.2.1） |
| **bundle 便携包** | `doclight bundle` 单文件 file:// 三引擎验证（05 §5.3.4）；vendor 需内联或相对路径决策 |
| **deploy 一键部署** | GitHub Pages / Cloudflare / Netlify 自动检测（05 §5.5） |
| **docsify 迁移** | 迁移指南 + 基本迁移工具（获客第一触点，已前移） |
| **搜索索引持久化** | localStorage + 版本校验（03 §3.8.5） |
| **同构快照** | dev vs SSG 内容区一致性快照测试（05 §5.3.3 剩余保证，Phase 0 遗留） |
| **子路径部署** | 当前 SSG 用根相对 URL（/display.js、/search-index.json），GitHub Pages 项目页需 `--base` 选项（后续） |

## 建议提交拆分（用户统一提交时参考）

1. `refactor: 抽取 cli 共享模块 site.ts（dev/SSG 双形态 renderPage/scan/search 数据）+ dev server 改用共享实现`（纯重构，既有测试原样通过）
2. `feat(SSG-001,SSG-002,PREVIEW-001): Phase 3 SSG 最小闭环——doclight build 静态导出 + vendor 拷贝 + preview + 搜索索引预构建 + 单测 + ssg.feature + 交接`

## 交接人

开发 Agent（本会话）。人类维护者回来后统一提交；提交前可跑一次 `npm run verify` 复核。
