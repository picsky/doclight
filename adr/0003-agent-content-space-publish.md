# ADR-0003: Agent 内容空间写入端——publish/space 设计与无伪造成功

> 状态：✅ 已接受（2026-08-13，Phase 4 内容空间写入端）
> 日期：2026-08-13
> 决策者：开发 Agent（+ 人类维护者对齐点 A 确认）
> 触发：Phase 4 剩余「内容写入与接入体验」落地（08-roadmap + 14-agent-content-space）

---

## 背景

Phase 4 读取端（llms.txt / 语义 frontmatter / MCP）完成后，「Agent 内容空间」还差写入半边：
`doclight publish`（发布到 local/git/space）+ `doclight space`（空间管理）+ Skill + 接入指南。
设计文档 14 §3/§4 定义了 Space Provider 抽象（可插拔）与「CLI 是唯一事实来源」的分层，但落地有几处需要拍板。

## 选项与决策

### ① 空间配置放哪（14 §3.4）

- **选项 A：`.doclight/space.json`（独立文件）** —— 空间是**运行时状态**（激活项、provider 配置），非站点配置；
  独立文件不入 `doclight.json` 契约 schema，避开「schema 修改需显式批准」红线（AGENT.md）。
- 选项 B：并入 `doclight.json` 的 `space` 键 —— 需扩展契约 schema（受保护文件），且混淆「配置」与「状态」。

**决策：A**。`.doclight/space.json`（version/active/spaces），`space init/switch/status` 管理，损坏容错。

### ② publish 如何实现（14 §4.2）

- **选项 A：publish 复用既有能力** —— local 复用 `bundleSite`（CLI-002）、git 复用 `deploySite`（CLI-003）、
  space 复用 `buildSite` + 读产物 docs.json 组装清单。Skill/`/publish` 只教 Agent 用 CLI，不重复实现。
- 选项 B：publish 重写各 provider 逻辑 —— 重复代码、双份真相。

**决策：A**。单一事实来源（14 §4.2「Skill 与 MCP 都是它的薄封装，不重复实现逻辑」）。

### ③ space（云端）托管未开通怎么办

- **选项 A：不预填官方端点 + 无端点即引导** —— `space init --provider space` 端点留空（预填会误导「已配好」）；
  `publish --to space` 无显式端点 → 结构化引导（指向自建兼容 Space API 或改用 local/git），**不发起注定失败的请求**。
- 选项 B：预填官方端点并尝试请求 —— 会卡在超时/连接失败，且暗示「官方托管已开通」（实际 v1.0 后）。

**决策：A**。延续 13 §2.1 / deploy 的「无伪造成功」原则：平台未就绪就输出步骤，绝不假装成功。

### ④ 输出形态

- **决策**：publish/space 全部支持 `--json`（结构化结果对象，Agent 直接消费；错误含 `error`+`steps` 可自修），
  人可读为默认。为支持 `--json` 修正了 index.ts `parseArgs` 的布尔 flag 解析（`--json --to git` 不再吞掉下个 flag）。
- **决策**：发布是**向外动作**，Skill 与 `/publish` 命令均内置「先确认目标空间/用户确认」铁律（14 §2.6）。

## 后果

- 新文件：`packages/cli/src/{space,publish}.ts`；新增命令 `publish`/`space`；`.claude/skills/doclight-publish/`、
  `.claude/commands/publish.md`、`docs/agent-guide.md`（接入指南 + 魔法咒语）。
- spec：`specs/features/space.feature`（CLI-005/CLI-006）。
- 云端 DocLight Space 托管未实现：协议客户端（POST `/publish_site` 站点清单）就绪 + 引导路径，v1.0 后开通即用。
- 空间配置独立于 doclight.json：未来若想把 space 并入契约 schema，需另走审批（当前不触碰受保护文件）。

## 关联需求

- [14-agent-content-space](../docs/tech-design/14-agent-content-space.md) §2/§3/§4
- [08-roadmap](../docs/tech-design/08-roadmap.md) Phase 4「内容写入与接入体验」
- [13-deployment-distribution](../docs/tech-design/13-deployment-distribution.md) §2.1（无伪造成功）
- [12-development-standards](../docs/tech-design/12-development-standards.md) §1.4（加依赖纪律——本决策零新依赖）
- 交接：`docs/agent-handoffs/PHASE-4-content-space-complete.md`
