# TASK: Phase 4 剩余完成——Agent 内容空间（publish CLI / Skill / space / 接入指南）（2026-08-13）

> 状态：✅ 完成（`npm run verify` 全绿 + spec:check 全过 + CLI 端到端 + dogfood 实测）
> 上游：08-roadmap Phase 4「内容写入与接入体验」+ 14-agent-content-space §3/§4
> 读取端交接：见 `PHASE-4-complete.md`（LLMS-001/FRONT-001/MCP-001~003）
> **下一步：Phase 5 插件系统 + 生态**；遗留项见文末
> 本文件是新会话第一入口（与 PHASE-4-complete.md 同属 Phase 4）。

---

## 本次完成清单（需求 ID 可追溯，specs/features/space.feature）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **CLI-005** | `doclight publish`：发布到 local（bundle→file://）/ git（SSG build+gh-pages 推送→公网 URL）/ space（POST 站点清单→端点 URL）；`--json` 结构化输出；无伪造成功（无远程/无端点/网络失败 → 引导） | `packages/cli/src/publish.ts` + index.ts | publish.test.ts 11 例 + CLI 端到端 |
| **CLI-006** | `doclight space init / switch / status`：`.doclight/space.json` 空间配置（version/active/spaces），默认 local 幂等，损坏容错 | `packages/cli/src/space.ts` + index.ts | space.test.ts 10 例 |
| — | `doclight-publish` Skill | `.claude/skills/doclight-publish/SKILL.md` | 注册加载正常 |
| — | `/publish` 斜杠命令 | `.claude/commands/publish.md` | 存在 + 引用 Skill |
| — | Agent 接入指南（可执行 + 魔法咒语） | `docs/agent-guide.md` | dogfood：被 DocLight 自身构建发布 |
| — | 布尔 flag 解析修正（`--json --to git` 不再吞掉下个 flag） | `index.ts` parseArgs | parseArgs 单测 2 例 |

## 关键实现细节

### Space Provider 抽象（CLI-006，14 §3）
- 配置存 `.doclight/space.json`（**不入 doclight.json 契约 schema**——空间是运行时状态，且避开「schema 修改需批准」红线）。
- 三 provider：local（bundle 产物目录，默认 dist-bundle）/ git（remoteUrl+branch=gh-pages，缺省自动探测 origin）/ space（endpoint+token）。
- **space 不预填官方端点**：托管未开通（v1.0 后），预填会误导「已配好」；留空 → status/publish 走引导（可指向自建兼容 Space API）。
- 幂等：同名空间重复 init 仅切换 active；配置损坏 → 视为未初始化（不崩栈）。
- git 远程解析复用 deploy.ts 的 `gitRemote`/`ghPagesInfo`（单一事实来源）。

### publish 分发（CLI-005，14 §4.3）
- 目标解析优先级：`--space <名>`（必须已注册，否则结构化错误）> `--to <provider>`（优先已注册的同 provider 空间，否则合成临时项）> active 空间 > 全默认 local。
- **local**：复用 `bundleSite`（CLI-002）→ file:// URL（离线单文件，可双击分发）。
- **git**：复用 `deploySite`（CLI-003）→ 自动 /<repo>/ base 构建 + 推 gh-pages → 公网 URL。
- **space**：复用 `buildSite` → 读产物 docs.json 组装 `SiteManifest`（siteTitle/siteUrl/totalDocs/docs）→ POST `{endpoint}/publish_site`（Bearer token 可选，15s 超时）→ 端点返回 URL。默认官方端点未开通 → 引导不请求。
- 所有结果 `PublishResult`（ok/provider/spaceName/url/file/steps/error/build/ms），`--json` 纯 JSON 输出（Agent 读 error/steps 字段自修）。

### 接入体验（14 §2）
- **Skill = Agent 能力默认入口**（三步：整理 Markdown→`doclight publish --json`→验证反馈）；**`/publish` = 用户触发入口**（发布控制权始终在用户）。对外动作铁律：发布前确认。
- 接入指南 `docs/agent-guide.md`：魔法咒语模板（含文档链接+任务+授权提示）+ 每步命令+验证输出 + 失败处理表；自身在 docs/ 被 DocLight 构建发布（dogfooding 自举验证）。

## 端到端实测（dogfood）

```
本仓库 docs/（27 篇）→ doclight publish --to local → 769ms 产出 doclight.html（file://）
临时项目：space init（默认 local）→ space status --json（active/provider/spaces）
         → publish --json（ok:true, url:file://...dist-bundle/doclight.html）
CLI 冒烟：space init / space status --json / publish --json 全部可用
单测：space.test.ts 10 例 + publish.test.ts 11 例 + parseArgs 2 例（21 新增）
```

## 遗留问题（Phase 4 完成后的长期项）

- `doclight.json` 契约扩展（build.llmsTxt/base/siteUrl/outputDir 入 schema，需用户批准——config.ts 已宽松读取）
- **云端 DocLight Space 托管**（publish --to space 的完整落点；当前协议客户端就绪 + 引导路径，v1.0 后开通）
- MCP 插件模式（嵌入 dev server）+ HTTP 流式；OG 卡片光栅化；bundle vendor 内联；`doclight embed` / bundle 二维码（分发四触点剩余）
- 同构快照（Phase 0 遗留）；体验细节（专注模式/字号/打印/Powered by）；npm 包名注册与域名（待用户决策）

## 验证命令

```bash
npm run verify          # 全绿（含 lint/typecheck/test/size/contract/e2e）
npm run spec:check      # CLI-005/CLI-006 追溯通过
# CLI 手动验证：
node packages/cli/src/index.ts space init --json
node packages/cli/src/index.ts space status --json
node packages/cli/src/index.ts publish --json
```
