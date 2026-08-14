# TASK: Phase 6 并行——OSS-001 开源化（2026-08-13）

> 状态：✅ 完成（代码面；npm 注册与首次发布待用户账号）
> 上游：ADR-0004 §⑤（开源优先：MIT/Apache-2.0，Docusaurus/Slidev 先例）+ 08-roadmap OSS-001 + 用户决策
> （2026-08-14 确认：**MIT 许可证** + **doclight / @doclight/* 命名方案**）
> **本文件是 v1.0 收尾交接（Phase 0-6 全部完成；剩余仅外部决策项）**

---

## 本次完成清单

| 交付 | 说明 | 验证 |
|---|---|---|
| **LICENSE** | MIT 许可证（用户确认；Copyright DocLight contributors；可一行换 Apache-2.0） | `LICENSE` 文件 |
| **README 重写** | v3 定位「把 Markdown 变成作品」：项目是什么 / 快速开始（init→dev→build→publish→slides）/ 为什么是 v3 / 功能总览表 / 文档地图 / 开源贡献 / 架构速览 / 体积指标 / 状态 | `README.md`（新文件，原仓库无根 README） |
| **npm 命名落地** | 主包 **`doclight`**（CLI）+ **`@doclight/{renderer,core,display,mcp-server}`**；全仓引用更新（源码 import/注释/文档）+ pnpm lockfile 刷新；根包更名 doclight-workspace（让位主包名） | `npx vitest` 全绿（重命名后 import 解析验证）+ `pnpm install` 成功 |
| **发布元数据就绪** | 各包 `license: "MIT"` + `publishConfig.access: "public"`（scoped 包必需）；cli description 更新 v3 全命令；`private: true` **保留**——防误发布坏包（见下） | package.json × 6 |
| **CONTRIBUTING 更新** | 架构地图新包名 + verify 7 check（含 visual）+ 视觉改动须过 verify:visual 并附截图 | CONTRIBUTING.md |

## 关键决策与 spike 证据

1. **npm 命名**（用户决策）：主包 `doclight`（对外只有一个名字）+ 内部 scoped 包；根 workspace 更名
   `doclight-workspace`（private）避免与主包冲突。
2. **源码即发布不可行（spike 实测）**：Node 对 node_modules 内的 .ts **不剥离类型**
   （`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`，spike 于 `$TEMP/ts-nodemod-test` 复现）——
   工作区可用是因为 pnpm symlink 解析到真实路径（不在 node_modules 内）。因此**直接 npm publish 源码会产出坏包**。
3. **private:true 保留**：JS 构建管线完成前不放开（防误发布）；`publishConfig`/`license` 等元数据先行就位（惰性但诚实）。
4. **LICENSE 用 MIT**：品类先例（Docusaurus/Slidev）+ 用户确认；Apache-2.0 可随时替换（文件内容 + 各 package.json license 字段）。

## 遗留（npm 发布前置，需用户参与）

1. **JS 构建管线**（代码面下一步）：esbuild bundle 各包 → `dist/*.js` + cli `bin: { "doclight": "./dist/index.js" }` +
   `files: ["dist"]` + engines；构建后 `private:false` 放开。esbuild 已是 devDependency（vitest 依赖），零新依赖。
2. **npm 包名注册与首次发布**（需用户 npm 账号）：`npm login` → 按依赖序发布
   （@doclight/renderer → @doclight/core → @doclight/display → @doclight/mcp-server → doclight）。
3. **域名**（文档站/品牌用，用户决策）：当前 schema $id 引用 doclight.tech（占位）。

## 验证命令

```bash
npm run verify      # 7/7 全绿（重命名后全量回归）
npm run spec:check  # 50/50
```

## 一句话交接

> **v1.0 代码面全部完成（Phase 0-6）**：零构建文档站 + 演示 + AI 原生全套 + 开源就绪。
> 下一步唯一动作 = 用户注册 npm 包名 + 决定域名；随后可执行「JS 构建管线 → publish」两步即可对外发布。
