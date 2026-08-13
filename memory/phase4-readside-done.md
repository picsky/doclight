---
name: phase4-done
description: DocLight Phase 4（读取端 llms.txt/MCP + 内容空间写入端 + 遗留补强）已全部完成并提交，下一步=Phase 5 插件系统
metadata:
  type: project
---

DocLight（零构建文档站引擎）Phase 4 已于 2026-08-13 全部完成并提交（读取端 `562f709` + 写入端 `33f54ce` + 遗留补强 `dadf027`，`npm run verify` 6/6 全绿 ×3，单测 255/255，spec:check 30/30）。

**读取端**：LLMS-001（build 自动生成 llms.txt 智能分级 + llms-full.txt 按 `## 路径：<path>` 分节）、FRONT-001（`packages/renderer/src/analyze.ts` 语义 frontmatter）、docs.json 增强、MCP-001/002/003（`packages/mcp-server/` 零依赖 spec 化 2025-06-18，stdio + HTTP + /.well-known/mcp 发现，**只服务 dist-site 产物**）。

**内容空间写入端**：CLI-005 `doclight publish`（local bundle→file:// / git gh-pages→公网 URL / space 站点清单 POST→端点 URL；`--json` 结构化输出、无伪造成功）+ CLI-006 `doclight space`（init/switch/status，`.doclight/space.json` 可插拔 provider）+ `doclight-publish` Skill + `/publish` 命令 + 接入指南（`docs/agent-guide.md` 魔法咒语）。

**遗留补强（路径 A 无需决策项）**：MCP-004 HTTP SSE 流式（`mcpHttpHandler` 可挂载）+ MCP-005 插件模式（`doclight dev --mcp` 同端口，懒构建快照）+ CLI-007 `doclight embed`（snippet.js 自推导基址 + iframe 片段，分发四触点③）+ SNAP-001 同构快照（dev/SSG/bundle 三形态内容一致）。

**测试稳定性（重要，勿回退）**：新增重负载测试后默认并行偶发 worker 崩溃（STACK_TRACE_ERROR 超时哨兵，串行全过）。`vitest.config.ts` 已设 `maxWorkers: 2` + `testTimeout: 20000`。另注意 `node scripts/checks/test.mjs` 只导出 run() 不自执行——直接跑它读到的是 verify 的陈旧报告，勿用其单独验证。

**下一步 = Phase 5 插件系统 + 生态**，见 08-roadmap。遗留含：云端 DocLight Space 托管（v1.0 后，协议客户端就绪 + 引导路径）、doclight.json 契约扩展（build.llmsTxt/base/siteUrl/outputDir 入 schema，需用户批准）、OG 栅格化/bundle 二维码（需依赖）、npm 包名与域名（待用户决策）。

**Why**: 换会话需要知道进度与下一步；交接文档在 docs/agent-handoffs/（PHASE-4-leftovers-complete.md 补强 + PHASE-4-content-space-complete.md 写入端 + PHASE-4-complete.md 读取端），不在记忆里重复。
**How to apply**: 新会话开工前读 PHASE-4-leftovers-complete.md；涉及 doclight.json schema 扩展需用户批准；相关 [[doclight-mcp-constraints]]
