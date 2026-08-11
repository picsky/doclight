# 14 · Agent 内容空间（Agent Content Space）

> 状态：✅ **核心应用场景**——这是 DocLight 产品发力的核心方向，不是愿景，而是应用场景本身
> 对应原则：原则零 Agent-First、无锁入、内容即 Markdown
> 上游依据：[research-report.md](../research-report.md)、[02-architecture](./02-architecture.md)、[06-ai-native](./06-ai-native.md)、[13-deployment-distribution](./13-deployment-distribution.md)

---

## 0. 一句话定位

**Agent 内容空间就是 DocLight 要打的应用场景：每个 Agent 用户都拥有一个「可被 Agent 自动发布内容的内容空间」。** 它以 Skill（默认）或 MCP（可选）接入 Agent 平台，让 AI 生产的内容自动沉淀、部署与共享——用户只需要对 Agent 说一句话。

```
「把这次对话整理成教程，发布到我的空间」
  → Agent 加载内容发布技能
  → 自动：整理 Markdown → 构建 → 部署
  → 内容出现在用户的文档站空间，分享一个 URL 即可
```

**为什么是核心方向**：Agent 已是内容生产主力，但 Agent 产出的内容沉淀与部署仍需手动——这个断点是所有 Agent 用户共有的、正在形成的刚需。DocLight 从引擎到部署分发的整套设计，最终都服务于这一个场景的落地。

---

## 1. 为什么（动机与市场）

### 1.1 断点：Agent 生产的内容没有「家」

现状：Agent 已是内容生产主力（研究、写作、报告、教程），但 Agent 产出的内容**沉淀与部署仍需手动**——生成、复制、构建、推送，这个环节是断的。**Agent 内容空间补齐的就是这个断点**：Agent 生产 → 自动发布 → 有家可归。

### 1.2 与传统内容空间的对比

| | 传统博客 / 语雀 / Notion | Agent 内容空间 |
|---|---|---|
| 内容生产方式 | 人写 | **Agent 生成（人审核）** |
| 发布方式 | 人手动发布 | **Agent 自动发布（一句话触发）** |
| 消费方式 | 人看 | **人看 + Agent 检索（llms.txt/MCP）** |
| 内容形态 | 文章 | 文档 / 教程 / 报告 / 知识库 / 课程 |

### 1.3 与 DocLight 的关系（不是新系统）

**Agent 内容空间 = DocLight 引擎的托管/部署形态 + 发布通道**：

- 用户空间 = 云端或自托管 `docs/` + 自动 build + 托管（产物：SSG 站 + llms.txt + 搜索）
- 底层就是 DocLight 三形态（dev / SSG / bundle）与部署分发的服务化
- **无锁入贯穿**：空间内容永远是纯 Markdown，可随时导出迁移

---

## 2. 接入体验：一句话启动（核心设计）

> 这是 Agent 内容空间给用户的第一印象，也是整个产品的杀手级体验：**其他工具要读教程、装环境、学命令；DocLight 复制一句话给 Agent，完事。**

### 2.1 用户旅程总览

```
① 我们发布「Agent 接入文档」（Agent 可执行指南）
     ↓  文档里藏着「魔法咒语」（含文档链接 + 授权提示）
② 用户把这句话复制给 Agent
     ↓
③ Agent 读文档 → 自动完成本地配置（装 CLI / 放 skill / 初始化）
     ↓
④ Agent 只问最少必要问题：部署空间（local / git / cloud）
     ↓
⑤ 日常使用：做完一份内容后
     a. Agent 主动提议「要发布吗？」
     b. 或用户斜杠命令 /publish
     ↓
⑥ Agent 自动 build + publish → 返回 URL / 分享卡片
```

### 2.2 接入文档（Agent 可执行指南）

- **一份「Agent 接入指南」**，逐步骤说明：安装 CLI、放置 Skill、初始化空间、验证方式
- 设计为**可执行指南**：每步含明确命令 + 验证输出（Agent 能无歧义自主完成）
- **接入文档本身用 DocLight 构建发布**——既是 Dogfooding（自举验证），又是活广告（"这份文档就是用 DocLight 做的"）
- 文档同时服务人与 Agent：人有可读版本，Agent 有可执行版本（结构化）

### 2.3 魔法咒语（一句话引导）

用户不需要学任何配置。发布一条「魔法咒语」模板，用户复制即用：

```
你是 DocLight 助手。请阅读 https://doclight.tech/agent-guide 完成 DocLight 接入：
1) 按指南完成安装与配置
2) 初始化我的内容空间（先问我要用哪个空间：本地 / GitHub / DocLight Cloud）
3) 完成后告诉我如何使用（内容放哪、如何发布）
当需要执行命令时请直接执行；如涉及安装/权限请求，请提示我允许。
```

**设计要点**：
- 咒语含文档链接（Agent 自主去读）+ 明确任务 + 授权提示
- 授权提示内置：「当 Agent 请求执行命令时请允许」——避免首次体验在授权处卡住
- 用户可完全不懂产品，也能完成接入

### 2.4 Agent 自动配置

Agent 读指南后自动完成：
1. 安装 CLI（如 `npm i -g doclight`）
2. 放置 Skill（`.claude/skills/doclight-publish/`）
3. 初始化空间（`doclight space init`，按用户选择）
4. 验证（`doclight publish --dry-run` 或构建自检）

**每步都有验证输出**，Agent 能确认配置成功再继续，失败即结构化反馈修复。

### 2.5 最少必要问题（可收敛到零）

接入时只问**最少必要问题**，两档可选：

| 模式 | 问什么 | 适合 |
|---|---|---|
| **极致模式** | 一个问题都不问，全默认（local + Minimal 主题） | 先跑起来，后续再 `space switch` |
| **正常模式** | 只问两个：① 部署空间（local/git/cloud）② 主题（4 选 1） | 想一步到位 |

默认推荐**正常模式**（两个问题已足够少），极致模式作为高级选项。

### 2.6 发布触发器（日常使用）

每做完一份内容，发布由两个入口触发：

| 触发 | 机制 | 说明 |
|---|---|---|
| **Agent 主动提议** | Agent 检测到内容完成 → 问「要发布吗？」 | 默认：**发布是向外动作，永远有用户确认这一环** |
| **用户斜杠命令** | `/publish`（`.claude/commands/publish.md`） | 用户明确叫停时的快捷入口「现在发布」 |

> **Skill vs Slash Command 分工**：Skill（doclight-publish）是 Agent 的能力（随时会用）；`/publish` 是用户触发的一次性动作。二者配合，发布控制权始终在用户。

### 2.7 发布确认与反馈

- 发布前用户确认（默认）；「自动发布」做成显式 opt-in 配置
- 发布后反馈：**空间 URL + 分享卡片**（OG 图，见 13）
- 失败：结构化错误 + 修复指引（Agent 可自修）

---

## 3. Space Provider 抽象层

### 3.1 核心思想：空间可插拔

**空间不是 DocLight 的私有服务，而是一个抽象目标**——用户可以选择任意空间实现，包括自建。这是无锁入原则的终极贯彻。

```
         Agent 内容发布入口
                  │
      ┌───────────▼───────────┐
      │   Space Provider 接口  │   ← 统一协议，空间可替换
      └───┬───────┬───────┬───┘
          │       │       │
┌─────────▼──┐ ┌──▼────┐ ┌▼───────────┐
│ 本地目录     │ │ Git    │ │ DocLight   │
│ (docs/ +    │ │ 托管   │ │ Space      │
│  bundle)    │ │(GH/Git)│ │ (我们的云,  │
│ 免费自用    │ │ 免费   │ │ 可选付费)   │
└────────────┘ └───────┘ └────────────┘
```

### 3.2 统一 Provider 接口

任何空间实现都提供以下五个动作（Agent 侧无感知）：

| 方法 | 说明 |
|---|---|
| `publish_doc(path, content, meta)` | 发布 / 更新一篇文档 |
| `publish_site(manifest)` | 整站更新 |
| `list_docs()` / `get_doc(path)` | 读取空间内容（避免重复、内容治理） |
| `delete_doc(path)` | 删除 / 归档 |
| `get_space_info()` | 空间状态 / 配额（付费计费基础） |

### 3.3 Provider 实现清单

| Provider | 实现方式 | 成本 | 适用 |
|---|---|---|---|
| **Local** | 本地目录 + bundle | 免费 | 自我使用、离线 |
| **Git** | GitHub Pages / Gitee Pages | 免费 | 开发者、开源 |
| **Cloud（DocLight Space）** | 云端空间 | 付费（可选） | 最省心、非开发者 |
| **Custom** | 插件扩展（WebDAV / 自有服务器 / 自托管） | 自定 | 自托管、企业 |

> Custom 可插件化：社区能写自己的空间适配器，生态开放。

### 3.4 切换与迁移（无锁入）

```
doclight space init            # 初始化 / 选择空间 provider
doclight space switch <name>   # 切换空间（内容可导出迁移）
doclight space status          # 查看状态 / 配额
```

- 内容是纯 Markdown，切换空间 = 导出 + 导入，无格式转换
- 用户可「先用自有空间，认可后再用 Cloud」——降低信任门槛

---

## 4. 发布通道设计：CLI 核心 + Skill 默认 + MCP 可选

### 4.1 为什么（MCP 偏重的取舍）

内容发布的本质是「内容 + 构建 + 落到某处」，核心是 **CLI 可完成的本地操作**，Agent 本身具备执行 CLI 的能力。为这类操作引入完整 MCP 协议栈（server 进程、schema、认证、传输）对个人用户是额外负担——**对内容发布，MCP 偏重**。

| 维度 | MCP | Skills |
|---|---|---|
| 本质 | 运行时协议（工具接入） | 上下文知识包（流程指导） |
| 运行 | 需 server | 无需 server |
| 配置 | 端点 + 认证 | 目录 / 一条指令 |
| 定位 | 系统 / 平台接入 | 人 / Agent 使用入口 |

### 4.2 架构分层

```
┌─────────────────────────────────────────────┐
│   doclight CLI（唯一事实来源，输出结构化 JSON） │
│   build / bundle / deploy / publish         │
└─────────────┬───────────────────┬───────────┘
              │                   │
     ┌────────▼────────┐   ┌──────▼────────────┐
     │  Skill（默认）    │   │  MCP（可选协议层）  │
     │  SKILL.md 教     │   │  薄封装 CLI        │
     │  Agent 用 CLI    │   │  跨平台 / 远程 / API│
     │  零 server       │   │  非默认路径        │
     └─────────────────┘   └───────────────────┘
```

**原则**：CLI 是唯一事实来源；Skill 与 MCP 都是它的薄封装，不重复实现逻辑。

### 4.3 CLI 发布命令（核心）

```bash
doclight publish                 # 发布当前内容到默认空间
doclight publish --to local      # 本地目录 + bundle
doclight publish --to git        # 构建 + 推送 Git Pages
doclight publish --to space      # 发布到 DocLight Space（远程）
doclight publish --to <custom>   # 自定义 provider
```

- 所有命令输出结构化 JSON（机器可读，Agent 友好）
- 远程发布（space）的认证 / 传输封装在 CLI 内部，Agent 无感知

### 4.4 Skill（默认入口）—— 内容发布技能

```
.claude/skills/doclight-publish/SKILL.md

---
name: doclight-publish
description: 把内容整理并发布到用户的 DocLight 内容空间
---

## 流程
1. 按 frontmatter 规范整理 Markdown（title/summary/tags）
2. 放入内容目录（docs/）
3. 运行 `doclight publish`（默认空间）
4. 验证产物与 URL，反馈结果
## 规范
- 内容为纯 Markdown，遵循 CommonMark + GFM
- 发布前检查 frontmatter 完整性
## 失败处理
- CLI 输出结构化 JSON，读取 error 字段定位修复
```

- 零 server、零配置，放进 `.claude/skills/` 即可
- 远程性封装在 CLI 内，Skill 不需理解远程细节

### 4.5 MCP（可选协议层）—— 薄封装 CLI

仅在以下场景提供 MCP server（`@doclight/mcp-publish`）：

| 场景 | 说明 |
|---|---|
| **跨平台标准化** | 任何 Agent 平台（非 Claude）开箱即用 |
| **云端 / 远程 Agent** | Agent 无本地 CLI 环境，走远程协议 |
| **Space 对外服务** | DocLight Space 作为公开 API 被调用 |
| **结构化回读** | list / get / 配额查询的稳定协议交互 |

MCP server 本质是 CLI 的协议外壳：工具 `publish_doc` / `publish_site` / `list_docs` 等，内部调用同一套 CLI 逻辑。

---

## 5. DocLight Space（可选付费 Provider）

### 5.1 定位

**DocLight Space 是最省心的默认 Provider，不是唯一的家。** 用户「想要省心 → 用 Space，想要掌控 → 用自托管」。

- 免费能力：本地 / Git provider 完整可用
- 付费能力：Cloud 空间（公网 URL、自定义域名、自动 build、存储与流量）

### 5.2 商业形态（对齐 research §7.5）

- **扁平定价**（$49-99/月封顶），按存储 / 域名 / 空间数收费
- **坚决不计量**（AI 调用不额外计费）——直接对冲 Mintlify 的计量惊吓
- 与「开源引擎 + 可选托管」双轨制一致

### 5.3 平台挤压对冲

若未来 Agent 平台自建内容空间，DocLight 的护城河是：
1. **开源引擎** + 无锁入（内容可随时迁走）
2. **开放的 Space 标准**（可插拔 provider，Agent 平台更可能接入标准而非自己做）
3. **自托管场景不可挤压**（local / git / custom provider 不依赖任何平台）

**只要 DocLight 是开放的 Space 标准 + 开源引擎，它就成为 Agent 内容的基础设施，而不是被某平台取代的中间层。**

---

## 6. 分阶段路径（核心方向的落地节奏）

| 阶段 | 做什么 | 验证什么 |
|---|---|---|
| **Phase 1-3** | 开源引擎做扎实（三形态 + 部署分发 + 读取 MCP 已就绪） | 引擎可用性 |
| **Phase 4（主战场）** | 实现本场景核心：`publish` CLI + `doclight-publish` Skill + 接入指南 + 魔法咒语；**Harness 课程站 dogfood** | Agent 自动发布是否顺滑、一句话接入是否成立 |
| **Phase 4+（可选）** | `@doclight/mcp-publish`（薄封装，供跨平台） | 协议需求是否真实存在 |
| **v1.0 后** | DocLight Space 托管版（注册 / 空间 / 域名 / 计费） | 付费意愿 |

> 本场景是产品发力方向，因此 **Phase 4 就是主战场**，不是可选项。先在开源引擎里把「内容写入 + 一句话接入」做出来并自用（dogfood），把应用场景从概念变成已验证的现实；Space 商业化在验证后自然展开。

---

## 7. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 需求未完全验证（Agent 自动发布是前沿但正在形成） | 中 | dogfood 先行（Harness 课程站）；小范围验证后再扩大投入 |
| Agent 平台自建内容空间 | 中 | 开放标准 + 开源引擎 + 自托管不可挤压（见 5.3） |
| 用户不愿为空间付费 | 中 | 免费 provider 完整可用；付费靠质量而非锁定 |
| 内容合规 / 滥用（公网内容） | 高 | 审核 / 滥用防护 / 删除机制（尤其国内）；付费服务即责任 |
| Skill 依赖具体平台 | 中 | Skill 是默认入口，MCP 保证跨平台兜底 |

---

## 8. 与其它文档的关系

| 文档 | 关系 |
|---|---|
| [02-architecture](./02-architecture.md) | 三形态是空间的技术基础 |
| [06-ai-native](./06-ai-native.md) | 「使用端」读取通道（llms.txt/MCP）；本文档补「写入端」 |
| [13-deployment-distribution](./13-deployment-distribution.md) | 部署分发的服务端形态；publish 是 deploy 的 Agent 化 |
| [01-product-positioning](./01-product-positioning.md) | 目标对齐（让内容被理解、被传播） |
| [12-development-standards](./12-development-standards.md) | Skill/MCP/CLI 开发遵循统一规范 |
