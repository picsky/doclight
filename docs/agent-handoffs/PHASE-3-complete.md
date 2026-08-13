# TASK: Phase 3 剩余完成（SEO 全套 / doclight init / bundle / deploy / docsify 迁移 / 搜索持久化 / 子路径）（2026-08-13）

> 状态：✅ 完成（`npm run verify` 全绿 + 单元测试 159/159 + e2e 含新增 bundle file:// 三引擎）
> 上游：PHASE-3-ssg-complete（SSG 最小闭环）+ 05-ssg-build §5.4/§5.5/§5.3.4 + 13-deployment-distribution §2.1 + 08-roadmap Phase 3
> **下一步：Phase 4（AI 就绪：llms.txt / MCP / Agent 内容空间）** + 遗留项见文末
> 本文件是新会话第一入口；交接格式见 AGENT.md。用户将回来统一提交。

---

## 本次完成清单（需求 ID 可追溯，specs/features/{seo,cli}.feature）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **SEO-001** | 页面级 SEO：canonical / OG / Twitter Card / JSON-LD TechArticle / 面包屑（UI + BreadcrumbList） | `site.ts` renderPage `seo` 选项 | build.test SEO 用例 |
| **SEO-002** | 站点级 SEO：sitemap.xml / robots.txt / 每页 OG 卡片图（og/*.svg，Node 侧零浏览器） | `build.ts`（siteUrl 提供时生成） | build.test SEO 用例 |
| **CLI-001** | `doclight init`：doclight.json + 示例 docs/（README + guide/start）+ index.html，幂等 | `init.ts` | init.test.ts 3 例 |
| **CLI-002** | `doclight bundle`：单文件 doclight.html（pages/titles/nav/searchIndex 内嵌 + 展示层内联），file:// 三引擎可用 | `bundle.ts` + display router/search bundle 模式 | bundle.test.ts + e2e/bundle.spec.ts（file:// × 三浏览器） |
| **CLI-003** | `doclight deploy`：gh-pages 一键推送（自动 /<repo>/ base 构建 + .nojekyll）+ Cloudflare/Netlify 指引 | `deploy.ts` | deploy.test.ts（本地裸仓库实测推送链路） |
| **CLI-004** | `doclight migrate-docsify`：docsify 内容迁移 + _sidebar 解析报告，幂等 | `migrate.ts` | migrate.test.ts 3 例 |
| — | **`--base` 子路径部署**（GitHub Pages 项目页等） | build/site/preview/index | build.test base 用例 |
| — | **搜索索引持久化**（localStorage + 版本校验，03 §3.8.5） | display `search.ts`（searchCacheKey/read/write）+ buildSearchData 内容哈希 | display search.test 持久化 3 例 |
| — | **docsify 迁移指南**（获客第一触点） | `docs/migration-from-docsify.md` | 文档 |

## 关键实现细节

### SEO（siteUrl 驱动，缺省零回归）
- renderPage 新增 `seo` 选项：`canonicalPath/breadcrumb/wordCount/updatedAt/author/ogImage` + `siteUrl/base`。
- **所有 SEO 输出只在传 seo 时出现**——dev 与无 siteUrl 的 SSG 产物保持与最小闭环一致（既有 129 测试 + e2e 零回归的关键）。
- siteUrl 提供时才生成 sitemap/robots/og 目录（绝对 URL 前提）；JSON-LD + 面包屑则始终随 seo 渲染。
- JSON-LD 内嵌用 `safeJson`（`<` → `<`），防 frontmatter 文本逃逸 `</script>`。
- OG 卡片为 **SVG**（零依赖 Node 侧生成）；已知限制：部分平台不支持 SVG og:image（需光栅图），交接文末列为遗留。

### 子路径部署（--base）
- `normalizeBase`：""/"/" → ""（根部署）；"/docs/" → "/docs"。
- 影响所有产物内绝对 URL：导航链接/首页自指/display.js/vendor base/search-index/canonical。
- preview 支持 `--base`（剥离前缀匹配产物）；deploy 自动用 `/<repo>/` 作为 base 构建。

### bundle（形态③，05 §5.3.4）
- 单文件 = renderPage(form="bundle")：内联 `__DOCLLIGHT_BUNDLE__` 数据块 + 内联展示层（`<script type="module">`）。
- **hash 路由**（file:// 不能 pushState）：导航链接 `#/xxx`，router bundle 模式监听 hashchange 查内嵌 pages，不 fetch。
- 搜索：内嵌 searchIndex 直接构建（零网络）；结果链接 `#/path`。
- **vendor 决策**：bundle 不内联 Prism/Mermaid/KaTeX——扩展自动降级（源码可见 + 复制按钮，REND-003 容错），守住单文件与体积。内联 vendor 留待后续。
- TOC 锚点 `scrollIntoView` + replaceState 加 try/catch（file:// 兼容）。
- 实测：本仓库 docs（24 篇）→ 829KB doclight.html，Chromium/Firefox/WebKit file:// 全部正常（导航/搜索/主题，零 JS 错误）。

### deploy
- `publishGhPages`：git worktree（-b gh-pages / --detach 复用）→ 复制产物 + `.nojekyll` → add/commit → `push --force origin gh-pages`。
- 测试用**本地裸仓库**当远程，验证推送后 gh-pages 分支内容（真实 git 链路）。
- 非 GitHub 平台：检测 wrangler/netlify CLI，给出命令；未认证时输出结构化人工步骤（不伪造成功）。
- `deploySite` 支持 `repoRoot` 注入（默认 cwd）。

### CLI 自带展示层 bundle（自包含修正）
- `site.ts` 新增 `displayBundlePath()`：优先 `packages/cli/dist/display.js`（`npm run build` 由 build.mjs 拷贝，随包分发），回退 monorepo `cwd/dist/display.js`。
- 修正 smoke test 发现的缺陷：从**任意 cwd**（如 `doclight init` 的新项目）运行 build/bundle/dev 不再因找不到 `dist/display.js` 报错。
- `packages/cli/dist/` 已被 `.gitignore` 的 `dist/` 覆盖。

### 搜索持久化
- `buildSearchData` version 从常量 1 改为 **FNV-1a 内容哈希**（docs 变 → 版本变）。
- dev/SSG 页面内联 `window.DOCLIGHT_SEARCH_VERSION`；展示层首次打开读 localStorage（`doclight-search-idx-{version}`），命中免 fetch，否则 fetch 后写入。

## 配置系统（doclight.json）——契约扩展待批准 ⚠️

- `loadConfig`（config.ts）读取：契约 schema 已有 `title/description/docsDir/theme` + **宽松读取** `base/siteUrl/outputDir`。
- **未修改 `contracts/doclight.schema.json`**（AGENT.md 红线：schema 修改需显式批准）。`doclight init` 生成的 doclight.json 只含契约键。
- 如需把 base/siteUrl/outputDir 正式纳入 schema：改 `contracts/doclight.schema.json` properties（只加不改）并跑 `npm run verify:contract`。

## 验收状态

- `npm run verify`：lint 66/66 / typecheck 1/1 / test **159/159** / size 2/2 / contract 7/7 / spec **19/19**（新增 seo.feature + cli.feature）/ e2e（原 51 + 新增 bundle file:// ×3）
- 单测新增：build.test SEO/base/版本 5 例、init 3 例、bundle 2 例、deploy 5 例、migrate 3 例、display search 持久化 3 例、router bundlePageKey 3 例
- e2e 新增：`e2e/bundle.spec.ts`（file:// 内容直出 + hash 导航 + 内嵌搜索 + 主题，零网络断言）
- 构建实测：本仓库 docs（24 篇）→ dist-site（SSG + sitemap 25 条 + robots + og/*.svg）918ms；bundle 829KB 726ms

## 遗留 / 下一步

| 项 | 说明 |
|---|---|
| **Phase 4（优先）** | llms.txt / 语义 frontmatter / MCP Server / Agent 内容空间（08-roadmap） |
| `doclight.json` 契约扩展 | base/siteUrl/outputDir 入 schema（需用户批准，见上） |
| OG 卡片光栅化 | SVG → PNG（平台兼容），或服务端渲染 |
| bundle vendor 内联 | 若需 bundle 内扩展完整渲染，内联 vendor 并接受体积 |
| `doclight embed` / bundle 二维码 | 分发四触点剩余（13 §3.1/§5） |
| 同构快照 | dev vs SSG 内容区逐字节一致性（Phase 0 遗留） |
| doclight.json 导航自定义顺序 | CLI-004 报告建议用数字前缀；配置系统完成后可覆盖 |

## 建议提交拆分（用户统一提交时参考）

1. `feat(SEO-001,SEO-002): SSG SEO 全套——canonical/OG/Twitter/JSON-LD/面包屑 + sitemap/robots/OG 卡 + seo.feature`（含 site.ts renderPage seo 选项 + build.ts + 测试）
2. `feat: --base 子路径部署 + 搜索索引持久化（版本哈希 + localStorage）`（build/site/preview/display + ssg/search.feature）
3. `feat(CLI-001): doclight init 初始化新项目`（init.ts + 测试）
4. `feat(CLI-002): doclight bundle 单文件便携包（hash 路由 + 内嵌数据 + file:// 三引擎 e2e）`（bundle.ts + display router/search bundle 模式 + e2e/bundle.spec.ts）
5. `feat(CLI-003): doclight deploy 一键部署（gh-pages + 平台指引）`（deploy.ts + 测试）
6. `feat(CLI-004): docsify 迁移工具 + 迁移指南`（migrate.ts + docs/migration-from-docsify.md + 测试）
7. `docs: specs/README Phase 3 + cli.feature + 交接 PHASE-3-complete`

## 交接人

开发 Agent（本会话）。人类维护者回来后统一提交；提交前可跑一次 `npm run verify` 复核。
