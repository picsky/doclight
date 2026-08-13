# TASK: Phase 4 遗留补强——MCP 流式/插件模式 + embed 分发 + 同构快照（2026-08-13）

> 状态：✅ 完成（`npm run verify` 6/6 全绿 × 3 连跑 + spec:check 30/30）
> 上游：08-roadmap Phase 4 遗留 + 13-deployment-distribution §3.1（分发四触点③）+ Phase 0 同构快照 + PHASE-4-complete/PHASE-4-content-space-complete 交接文末「遗留」
> **下一步 = Phase 5 插件系统 + 生态**；本批次为「路径 A 无需用户决策项」，见 CLAUDE.md 遗留
> 本文件是新会话第一入口（与 PHASE-4-complete / PHASE-4-content-space-complete 同属 Phase 4）

---

## 本次完成清单（需求 ID 可追溯，specs/features/{ai,cli,isomorphic}.feature）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **MCP-004** | HTTP SSE 流式：POST /mcp Accept: text/event-stream → SSE 帧响应；GET /mcp → 长连接流（心跳保活）；well-known 标 streamable-http | `packages/mcp-server/src/http.ts` | http.test.ts 8 例（+2 SSE） |
| **MCP-005** | 插件模式：`doclight dev --mcp` 同端口挂载 /mcp + /.well-known/mcp；SiteData 懒构建快照（首请求构建、文件变更置脏重建）；capabilitiesAtRoot=false 不抢站点首页 | `packages/cli/src/dev-server.ts` + index.ts + cli package.json（workspace 依赖 doclight-mcp-server） | dev-server.test.ts 13 例（+4） |
| **CLI-007** | `doclight embed`：生成 snippet.js（从自身 script src 推导站点基址 + 响应式 iframe，同源高度自适应/异源降级 minHeight）+ 可复制 iframe 片段（13 §3.1 分发四触点③） | `packages/cli/src/embed.ts` + index.ts | embed.test.ts 4 例 |
| **SNAP-001** | 同构快照：dev/SSG/bundle 三形态对同一 docs 渲染内容一致（仅链接后缀归一，决策⑤）；Phase 0 遗留闭环 | `packages/cli/test/isomorphic.test.ts` + specs/features/isomorphic.feature | isomorphic.test.ts 3 例 |

## 关键实现细节

### MCP-004 SSE 流式
- `mcpHttpHandler(site, server, opts)` 从独立服务抽出为**可挂载 handler**（返回 `(req,res)=>Promise<boolean>`），`startHttpServer` 与 dev server 复用（单一事实来源）。
- POST 响应按 Accept 分流：含 `text/event-stream` → `event: message` + `data: {json}` 帧（单响应后关闭）；否则 JSON。
- GET /mcp 长连接：`text/event-stream` + `: connected` + 15s 心跳注释帧；只读服务无主动通知（客户端兼容握手用）。well-known 增 `transports: ["streamable-http"]`。

### MCP-005 插件模式
- `doclight dev --mcp`：首次 MCP 请求才 `buildSite` 到 `mkdtemp(doclight-mcp-dev-*)`（不拖慢 dev 启动）；文件变更（既有 watcher 的 onFsChange）置 `mcpDirty`，下次请求重建。
- 挂载点：dev server handleRequest 中、docs 路由之前；`capabilitiesAtRoot:false` 让 GET / 仍服务站点首页（/health 提供能力页）。
- 端口/生命周期：与 dev server 同端口、close 时清理临时目录。cli 新增 workspace 依赖 `doclight-mcp-server`（零外部依赖，守「加依赖」红线）。

### CLI-007 embed
- `embedSnippet()` 纯函数生成 snippet.js（可单测）：正则定位自身 `<script src="...snippet.js">` → 推导站点基址 → 注入响应式 iframe（width 100% + minHeight 480 + 同源按内容高度撑开）。基址不硬编码 → 站点搬迁/换域名不失效。
- `embedSite()`：构建（skipBuild 可复用产物）→ 写 `outDir/snippet.js` + 返回 iframe 片段（--site-url 时绝对地址，缺省相对占位不伪造）。

### SNAP-001 同构快照
- 同一 docs 夹具 → buildSite（SSG）/ bundleSite（bundle）/ dev server 三形态 → 抽取 `<article>` 内容区（bundle 为内嵌 pages 原始内容）→ 归一 `href` 后缀（.md/.html → 无）→ 逐页断言相等。
- bundle 数据提取：以 `</script>` 作锚点（渲染后代码块转义 `<`，JSON 内无字面 `</script>`）。
- 验证内容要素：表格 / 强调 / 行内代码 / 代码块全部渲染进内容区。

## 测试稳定性修复（重要，勿回退）

**问题**：新增 4 个重负载测试（dev-server MCP 懒构建 / 同构双 dev server / embed / MCP SSE 长连接）后，
`npm run verify` 在默认并行下**偶发 6 个既有测试失败**（build/deploy/publish 的 git+构建用例），
错误为 vitest `STACK_TRACE_ERROR`（超时哨兵）；串行（maxWorkers=1）100% 通过，确认是并行资源争用。

**修复**：`vitest.config.ts` 设 `maxWorkers: 2` + `testTimeout: 20000`（注释说明原因）。
实测 3 连跑 `npm run verify` 全绿。**CI/换机器若资源更紧张，可进一步调低 maxWorkers；勿直接改回默认并行**。
（排查弯路记录：`node scripts/checks/test.mjs` 只导出 run() 不自执行——直接跑它什么都不做，
读到的是 verify 写的陈旧报告，勿再用它单独验证。）

## 端到端实测（CLI 冒烟）

```
doclight dev --mcp → GET /.well-known/mcp（totalDocs 4 + 6 工具）→ POST /mcp tools/list
doclight embed --dir docs --out-dir <tmp> → dist-site/snippet.js + iframe 片段
单测：mcp http 8 + dev-server 13 + embed 4 + isomorphic 3 = 新增 28（255/255 全绿）
```

## 遗留问题（含需用户决策项，见 CLAUDE.md 遗留）

- **云端 DocLight Space 托管**（v1.0 后，publish --to space 完整落点，协议客户端就绪）
- **doclight.json 契约扩展**（build.llmsTxt/base/siteUrl/outputDir 入 schema，**需用户批准**）
- OG 卡片光栅化（SVG→PNG，需光栅化依赖——触碰「加依赖需审批」红线）
- bundle vendor 内联（体积取舍待定）；bundle 二维码（QR 需依赖或手写）
- 体验细节（专注模式/字号/打印/Powered by，触碰视觉基线锁定）
- npm 包名注册与域名（**待用户决策**）

## 验证命令

```bash
npm run verify          # 6/6 全绿（255/255 + e2e 54/54 + size + contract）
npm run spec:check      # 30/30（MCP-004/005、CLI-007、SNAP-001 追溯通过）
# CLI 手动验证：
node packages/cli/src/index.ts dev --mcp
node packages/cli/src/index.ts embed --dir docs --out-dir dist-site --site-url https://docs.example.com
```
