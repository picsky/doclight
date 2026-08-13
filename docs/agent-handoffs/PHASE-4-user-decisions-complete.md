# TASK: Phase 4 用户决策批次（契约扩展 + 分发四触点剩余 + 体验细节）（2026-08-13）

> 状态：✅ 完成（`npm run verify` 全绿，单测 **264/264** + e2e 54/54 + spec:check 30/30）
> 上游：08-roadmap Phase 4 遗留 + 13-deployment-distribution + 用户决策（A 契约扩展 + C1-C4 全做）
> **下一步 = Phase 5 插件系统 + 生态**，见 08-roadmap
> 本文件是新会话第一入口（与 PHASE-4-leftovers-complete / PHASE-4-content-space-complete / PHASE-4-complete 同属 Phase 4）

---

## 本次完成清单（需求 ID 可追溯，specs/features/*.feature）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **CONTRACT-001** | doclight.json 契约扩展：base/siteUrl/outputDir + build.llmsTxt.{priority,exclude} 入 schema；只加不改，additionalProperties:false 保留 | `contracts/doclight.schema.json` + `packages/cli/test/config.test.ts` | config.test.ts 3 例（schema 键 + 宽松读取对齐） |
| **SEO-003** | OG 卡片 PNG 栅格化：@resvg/resvg-js 渲染 1200×630 OG 卡为 PNG（og/*.png）；og:image 指向 PNG（微信/微博兼容）；SVG 保留作为降级 | `packages/cli/src/build.ts`（rasterizePng helper） + `packages/cli/test/build.test.ts` | build.test.ts 更新（断言 PNG 存在 + og:image 指向 png + PNG 魔数 89504e47） |
| **CLI-008** | bundle 下载二维码：`doclight bundle --qr <url>` 生成 bundle-qr.png（分发四触点④）；qrcode 库纯 JS，无原生依赖 | `packages/cli/src/bundle.ts` + `packages/cli/src/qrcode.d.ts`（类型声明） + `packages/cli/test/bundle.test.ts` | bundle.test.ts +1 例（PNG 魔数） |
| **CLI-009** | bundle vendor 内联：`doclight bundle --inline-vendor` opt-in，Prism/Mermaid/KaTeX JS+CSS 内联进单文件（file:// 下扩展可用）；默认不内联保持体积小 | `packages/cli/src/bundle.ts`（inlineVendorHtml helper） + `packages/cli/src/site.ts`（renderPage extraHead 注入点） + `packages/display/src/extensions.ts`（loadScript/loadStyle 跳过已内联全局） + `packages/cli/test/bundle.test.ts` | bundle.test.ts +1 例（默认不内联 + opt-in 内联 + data-doclight-vendor 标记） |
| **UX-001** | 体验细节：专注模式（隐藏侧栏/TOC 聚焦内容）+ 字号调节（3 档步进 0.875/1/1.125/1.25）+ 打印样式（隐藏导航控件）+ Powered by 标记（默认开，一行关闭）；全部 localStorage 持久化 | `packages/display/src/ux.ts`（纯函数 + initUx 接线） + `packages/display/src/index.ts`（mount 调用 initUx） + `packages/cli/src/site.ts`（CSS + 按钮 + footer） + `packages/display/test/ux.test.ts` | ux.test.ts 3 例（stepFontScale 步进/夹值 + nextFocusState toggle） |

## 关键实现细节

### CONTRACT-001 契约扩展
- schema 从 4 键扩展到 8 键（title/description/docsDir/theme + base/siteUrl/outputDir/build）
- `build` 对象含 `llmsTxt.priority`（Record<level, string[]>）+ `llmsTxt.exclude`（string[]）
- config.ts 已宽松读取这些键（Phase 3/4 遗留），现在 schema 追上实现
- 测试：config.test.ts 验证 schema 键存在 + 宽松读取对齐

### SEO-003 OG PNG 栅格化
- @resvg/resvg-js 预编译二进制，CLI 构建期依赖（不影响运行时体积）
- `rasterizePng(svg: string): Buffer | null`：失败返回 null（降级保留 SVG，不阻断构建）
- ogImage 从 `.svg` 改为 `.png`（微信/微博等平台不认 SVG，PNG 更兼容）
- 测试：断言 PNG 文件存在 + og:image meta 指向 .png + PNG 魔数 89504e47

### CLI-008 bundle 二维码
- qrcode 库纯 JS，无原生依赖（@types/qrcode 不存在，手写 `qrcode.d.ts` 类型声明）
- `bundleSite` 改为 async（qrcode.toFile 返回 Promise），波及所有调用方（index.ts/publish.ts/tests）
- `--qr <url>` 生成 `bundle-qr.png`（480×480，margin 2）
- 测试：断言 qrFile 存在 + PNG 魔数

### CLI-009 bundle vendor 内联
- opt-in `--inline-vendor`（默认不内联保持体积小，扩展走 REND-003 容错降级）
- `inlineVendorHtml()`：读取 VENDOR_FILES（Prism/Mermaid/KaTeX）从 node_modules，生成 `<style>` + `<script>` 块（CSS 先于 JS）
- renderPage 加 `extraHead?: string` 选项，注入到 `</style>` 后 `</head>` 前
- display extensions.ts：`loadScript`/`loadStyle` 跳过已内联全局（检查 `window.Prism`/`window.mermaid`/`window.katex` + `style[data-doclight-vendor]`）
- 测试：默认不内联（无 data-doclight-vendor）+ opt-in 内联（4 个标记存在 + CSS 在 JS 前）

### UX-001 体验细节
- **专注模式**：`#focus-toggle` 按钮 → toggle `body.focus-mode` → CSS 隐藏 sidebar/toc + 内容加宽（max-width 840px）；aria-pressed + localStorage 持久化
- **字号调节**：`#font-dec`/`#font-inc` 按钮 → `html { font-size: <scale>% }`（设计令牌全为 rem，联动缩放）；3 档步进（0.875/1/1.125/1.25），`stepFontScale` 纯函数可单测
- **打印样式**：`@media print` CSS 隐藏 topbar/sidebar/toc/powered-by，内容全宽纯文本
- **Powered by**：footer 标记（默认显示），`#powered-by-close` 按钮隐藏 + localStorage 持久化（尊重自托管数据洁癖）
- 测试：ux.test.ts 纯函数（stepFontScale 步进/夹值 + nextFocusState toggle）

## 依赖变更

新增 2 个 CLI 构建期依赖（不影响运行时体积，展示层仍 <25KB gzip）：
- **@resvg/resvg-js** ^2.6.2：SVG→PNG 光栅化（预编译二进制，支持 win/mac/linux）
- **qrcode** ^1.5.4：二维码生成（纯 JS，无原生依赖）

类型声明：`packages/cli/src/qrcode.d.ts`（qrcode 无官方 @types）

## 端到端实测

```
npm run verify          # 6/6 全绿（lint/typecheck/test 264/264/size/contract/e2e 54/54）
npm run spec:check      # 30/30 追溯通过（CONTRACT-001/SEO-003/CLI-008/CLI-009/UX-001 全部在 .feature + packages/*）

CLI 冒烟：
  doclight build --site-url https://docs.example.com
    → dist-site/og/index.png + og/index.svg（PNG 1200×630，魔数 89504e47）
    → index.html og:image 指向 /og/index.png

  doclight bundle --qr https://doclight.tech
    → dist-bundle/doclight.html + bundle-qr.png（480×480）

  doclight bundle --inline-vendor
    → dist-bundle/doclight.html 内联 Prism/Mermaid/KaTeX（data-doclight-vendor 标记）
    → file:// 打开后扩展可用（无需网络）

  doclight dev
    → 顶栏新增 ⛶（专注模式）+ A−/A+（字号调节）按钮
    → 底部 Powered by DocLight 标记（× 按钮关闭，刷新后仍隐藏）
    → Ctrl+P 打印预览：隐藏导航/控件，内容全宽
```

## 遗留问题（Phase 4 完成后的长期项）

- **云端 DocLight Space 托管**（publish --to space 完整落点，协议客户端就绪 + 引导路径，v1.0 后）
- **npm 包名注册 + 域名**（待用户决策：`doclight` 包名可用 E404；@doclight scope 已被另一 Doclight 项目占用部分包名）
- **链接 hover 预览**（roadmap 遗留，非本次范围）
- **无障碍增强**（键盘导航/Focus ring/ARIA 标签，roadmap 遗留）

## 验证命令

```bash
npm run verify          # 全绿（含 e2e，需本机/CI 已装 Playwright 浏览器）
npm run spec:check      # 30/30 追溯通过
# CLI 手动验证：
node packages/cli/src/index.ts build --dir docs --out-dir dist-site --site-url https://docs.example.com
node packages/cli/src/index.ts bundle --dir docs --out-dir dist-bundle --qr https://doclight.tech --inline-vendor
```
