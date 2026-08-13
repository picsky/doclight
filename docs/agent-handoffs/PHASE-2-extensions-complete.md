# TASK: Phase 2 扩展语法渲染（REND-002 注册表 / REND-003 Mermaid 容错 / 代码高亮+复制 / 自定义容器 / KaTeX / REND-004 双读验证）（2026-08-13）

> 状态：✅ 全部完成并验证（`npm run verify` 6/6 全绿 + e2e 51/51 × chromium/firefox/webkit）
> 上游：08-roadmap §Phase 2 扩展语法渲染 + research-report §6.3 MVP（机会 7.5/10 差异化核心）
> **下一步：Phase 3（SSG 静态导出，SEO 刚需 + 搜索索引预构建；vendor 基址决策点见下）**
> 本文件是新会话第一入口；交接格式见 AGENT.md。用户将回来统一提交。

---

## 本次完成的四块

### 1. REND-002 扩展语法注册表（白名单式，差异化核心地基）

| 文件 | 内容 |
|---|---|
| `packages/renderer/src/extensions/types.ts` | ExtensionDef schema：id / classes（sanitize 白名单断言依据）/ markedExtensions / client（懒加载映射）/ degradation（降级策略） |
| `packages/renderer/src/extensions/registry.ts` | 默认白名单（code-block/mermaid/container/katex 四扩展全开）+ 查询 API（getExtensions/isEnabled/collectExtensionClasses/setExtensions 测试注入） |
| `packages/renderer/src/extensions/container.ts` | `:::tip/warning/danger/info` marked 块级扩展（白名单四类型，未知类型不识别；内层 this.lexer.blockTokens 手动解析） |
| `packages/renderer/src/extensions/katex.ts` | `$…$` 内联 + `$$…$$` 块级标记（价格误判防护：内容首尾非空白） |
| `packages/renderer/src/extensions/code.ts` | renderCodeBlock：mermaid 围栏分流 + 普通代码块 language-* 标记 |
| `packages/renderer/src/core/markdown.ts` | code renderer 接 renderCodeBlock + 从注册表挂载 marked 扩展 |
| `packages/renderer/src/core/link.ts` | 导出 escapeHtml（三处复用） |
| `specs/features/render-ext.feature` | REND-002/003/004 Gherkin 验收准则（spec:check 追溯） |

### 2. REND-003 Mermaid 容错渲染 + 代码高亮/复制 + KaTeX（展示层懒加载）

| 文件 | 内容 |
|---|---|
| `packages/display/src/extensions.ts` | 扩展增强器：复制按钮（零依赖同步）+ Prism 懒加载高亮 + Mermaid 容错（错误→保留源码+提示，100% 不白屏，主题同步）+ KaTeX 懒加载；vendor 按需 script/link 注入（去重）；routechange 后重新增强 |
| `packages/display/src/index.ts` | mount() 挂载 initExtensions |
| `packages/display/test/extensions.test.ts` | extractLanguage 纯函数单测 |

### 3. dev server vendor 端点 + 扩展样式

| 文件 | 内容 |
|---|---|
| `packages/cli/src/dev-server.ts` | `/__doclight/vendor/*` 端点（mermaid/prism/katex + KaTeX fonts 子路径，穿越防护）+ 扩展 CSS（容器/复制按钮/Prism token 亮暗配色/Mermaid fallback/KaTeX） |
| `packages/cli/package.json` | 新增依赖 mermaid / katex / prismjs（**dev server 运行时服务用，不进 bundle**） |
| `scripts/build-{display,renderer}.mjs` | `removeComments: true`（产物剥离注释，双读注释保留 .ts 源码；见体积门禁） |

### 4. REND-004 双读验证 + Dogfood + e2e

| 文件 | 内容 |
|---|---|
| `packages/renderer/test/extension.test.ts` | 22 例：注册表/代码块标记/Mermaid 围栏+含 `>` 源码保留/容器/KaTeX/价格防护/XSS/REND-004（render 纯函数 + 产物可读回扩展源码）+ Dogfood（真实交接文档渲染不报错） |
| `e2e/extensions.spec.ts` | 6 例 × 三浏览器：Prism token 高亮 / 复制按钮（跨浏览器剪贴板降级）/ Mermaid 正常→SVG / **Mermaid 错误→源码+提示不白屏** / 容器 / KaTeX |

## 验收状态（已实测）

- `npm run verify` → **VERIFIED ✓ 6/6**（lint/typecheck/test/size/contract/e2e）
- `npm run verify:e2e` → **51/51** × chromium/firefox/webkit（原 33 + 扩展 6 × 3 浏览器）
- 单测 **116/116**（原 95 + 扩展 21）；spec 追溯 **9/9**（新增 render-ext.feature）
- 体积门禁：展示层 **7.5KB** gzip（<25KB ✓）/ Node 内核 renderer 3.9KB + marked + dompurify 合计 **27.8KB**（<30KB ✓）

## 关键决策记录（换会话勿推翻）

1. **扩展内容承载铁律：不依赖 `data-*` 属性**。spike 实测 DOMPurify 对 data-* 放行受属性值内容影响——`data-diagram="graph TD; A-->B"`（含 `>`）被剥离，而 `data-tex="e^{iπ}"`、`data-lang="js"` 保留（行为不稳定）。因此 Mermaid/KaTeX 源码一律放**子元素/文本**（`<div class="doclight-mermaid"><pre class="doclight-mermaid-src"><code>` / `<span class="doclight-katex-inline">`），展示层读 `textContent` 还原。收益：sanitize 稳定 + 降级天然可见（不白屏）。
2. **vendor 三件套（Prism/Mermaid/KaTeX）不进展示层 bundle**：dev server 从**包级 node_modules**（`createRequire` 解析，pnpm workspace 不在根 node_modules——spike 实测 404）经 `/__doclight/vendor/*` 按需服务；展示层动态 script/link 注入。**SSG/bundle 形态需决策 vendor 基址**（`window.DOCLIGHT_VENDOR_BASE` 已留覆盖口，Phase 3 可定：拷贝到 dist/ 或 CDN）。
3. **marked 扩展的 childTokens 不会自动 tokenize 内层**：容器 tokenizer 必须手动 `this.lexer.blockTokens(text, [])`（spike 验证，否则 parseInline 死循环）。
4. **构建产物 `removeComments: true`**：双读注释保留在 .ts 源码，bundle 为运行时产物不带注释（否则 Node 内核超 30KB 预算——注释 gzip 3.4KB）。
5. **e2e 复制按钮跨浏览器**：firefox/webkit 不支持 `clipboard-read/write` 权限名，grantPermissions 需 try/catch，断言主路径用按钮 copied 反馈（降级 execCommand 也触发）。

## 遗留 / 下一步

| 项 | 说明 |
|---|---|
| **Phase 3（优先）** | SSG `doclight build` + bundle + 部署；**此时定 vendor 基址方案**（拷贝 dist/vendor 或 CDN），搜索索引预构建（可换回真实 MiniSearch） |
| 体验细节 | 专注模式/字号调节/打印样式/Powered by |
| 搜索索引持久化 | localStorage + 版本校验（03 §3.8.5） |
| doclight.json 配置系统 | 02 §2.5；扩展注册表预留 setExtensions 白名单裁剪口 |
| 无障碍收尾 | 键盘导航完整支持/focus ring/ARIA 全量 |
| 视觉回归 / 同构快照 | Phase 0 遗留；扩展渲染可加 dogfood 截图基线 |
| Mermaid 主题切换热更新 | 当前仅初始化时同步 data-theme；主题切换不重渲染图表（可后续加） |

## 建议提交拆分（用户统一提交时参考）

1. `feat(REND-002,003,004): 扩展语法渲染——注册表 + Mermaid 容错 + 高亮/复制/容器/KaTeX + 双读验证`（renderer extensions/ + display extensions.ts + dev-server vendor/CSS + cli deps + specs/render-ext.feature + 单测 + e2e + 交接）
2. `build: 产物 removeComments（体积门禁兜底，双读注释留 .ts 源码）`（build-display.mjs + build-renderer.mjs）

## 交接人

开发 Agent（本会话）。人类维护者回来后统一提交；提交前可跑一次 `npm run verify` 复核。
