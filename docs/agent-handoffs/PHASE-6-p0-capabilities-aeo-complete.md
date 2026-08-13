# TASK: Phase 6 P0——能力协议（CAP-001）+ 发布产物 Agent 友好（AEO-001）（2026-08-13）

> 状态：✅ 完成（单测全绿；spec:check 含 CAP-001/AEO-001 追溯；verify 6/6 目标）
> 上游：ADR-0004（v3 定位「把 Markdown 变成作品」）+ 08-roadmap Phase 6 P0 + research/product-vision-validation.md §五
> **本文件是 Phase 6 第一棒交接**（P0 两条主线；P1/P2 见 CLAUDE.md「下一步」）

---

## 本次完成清单（需求 ID 可追溯）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **CAP-001 能力协议** | capabilities.json 生成器（扩展语法白名单 REND-002 + 插件能力 PluginDef.capabilities + frontmatter 约定 + Agent 端点 + MCP 工具清单；单一事实来源）+ 三形态一致（SSG 产物根 / dev `/capabilities.json` 实时计算 / bundle 产物目录）+ MCP `get_capabilities` 工具（注册表置首；产物缺失诚实降级 complete=false 不伪造）+ AGENTS.md 生成（`buildAgentsMd(manifest)` 与 capabilities.json 同源；`doclight init` 写入 + 本仓库根 AGENTS.md dogfood） | `packages/cli/src/capabilities.ts` + `packages/cli/src/agents.ts` + `packages/cli/src/{build,dev-server,bundle,init}.ts` + `packages/core/src/plugin.ts`（capabilities?: string[]）+ 官方插件 6 个声明 + `packages/mcp-server/src/{site,tools,http}.ts` | capabilities.test.ts 10 例 + agents.test.ts 3 例 + mcp tools/protocol/site 测试更新（get_capabilities 置首/降级）+ spec `specs/features/capabilities.feature` |
| **AEO-001 发布产物 Agent 友好** | 每页 markdown 版本（build 拷贝 .md 源文件进产物 + 每页 `<link rel="alternate" type="text/markdown">`，sitemap 不含 .md）+ llms.txt v2 Link 关系（每页 `<link rel="describedby" href=".../llms.txt">`，dev 不输出死链）+ token 计数（`tokens.ts` 启发式：CJK×0.75 + 非CJK词×1.3 上取整；docs.json 每篇 tokens + 头部 totalTokens / llms.txt 条目与头部 / llms-full.txt 头部 / 页面 `<meta name="doclight:tokens">`；`--base` 前缀正确） | `packages/cli/src/{tokens,llms,site,build}.ts` | tokens.test.ts 6 例 + aeo.test.ts 9 例 + spec `specs/features/aeo.feature` |

## 关键设计决策

1. **AGENTS.md 与 capabilities.json 同源**（CAP-001）：`buildAgentsMd(buildCapabilityManifest(...))`——机器形态与可读形态由同一 manifest 生成，杜绝两处漂移；capabilities.json 的插件段来自构建管线（`BuildPluginPipeline.listPlugins()` 新增），扩展段来自渲染内核注册表，MCP 工具来自 mcp-server 注册表——全部单一事实来源。
2. **PluginDef.capabilities 为纯增量契约**：只加不改（core/plugin.ts 新增可选字段），官方插件 6 个各声明能力（mermaid→["mermaid"] 等）；外部插件不声明则不出现在能力清单。
3. **MCP get_capabilities 置首**：写内容前的第一查；产物缺失时诚实降级（complete=false + 重建提示 + docs.json 可推导最小信息），延续决策⑬「不伪造」精神。
4. **describedby 仅 SSG 输出**：dev 不产出 llms.txt，输出死链是误导；markdown alternate 双形态输出（dev 本来就有 .md 路径）。
5. **token 估算诚实声明**：启发式非真实分词器（零依赖，不触加依赖红线）；估算方法与总量均写入产物（capabilities.json tokens.estimate + llms.txt 头部「启发式估算」标注）。
6. **.md 副本不干扰 SEO**：sitemap 不含 .md URL（不重复收录）；preview 静态服务自动兼容（.md 请求直接命中副本）。

## 体积门禁（无变化）

| 产物 | 门禁 | 实测 |
|---|---|---|
| 展示层 gzip | < 25KB | 10.4KB（本次零改动——全部能力在 CLI/MCP 侧） |
| Node 内核 | < 30KB | 27.8KB（capabilities 类型仅类型空间） |

**无新增运行时依赖**（tokens 纯函数；capabilities 引用既有 workspace 包）。

## 验证命令

```bash
npm run verify          # lint/typecheck/test/size/contract/e2e 全绿目标
npm run spec:check      # CAP-001 / AEO-001 追溯通过（44 + 新 ID）
# 手动验证：
doclight build          # dist-site/capabilities.json + 每页 .md 副本 + head 链接 + token 计数
doclight dev            # GET /capabilities.json
doclight bundle         # dist-bundle/capabilities.json
node packages/mcp-server/src/index.ts --site dist-site --port 3100  # get_capabilities 工具
```

## 遗留（Phase 6 后续）

- **P1 · VIS-001 表现层设计系统化**（4 套设计语言 + 组件 + swizzle + 视觉回归门禁）——当前最大短板
- **P1 · WORK-001 预览-确认-发布**（增量渲染 + 版本快照 + 确认门）
- **P1 · MCP-006 写入端**（write_doc/update_doc + 增量渲染联动）
- **P2 · DEMO-001 演示形态** + **并行 OSS-001 开源化**（LICENSE/README/npm 包名待用户决策）
- 可选增强：dev 形态输出 llms.txt/docs.json（与 SSG 同路径，当前 dev 仅在 /__doclight/ 下）；capabilities.json 供浏览器展示层消费（渲染能力 badge）
