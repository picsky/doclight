# TASK: Phase 6 P1·2——WORK-001 预览-确认-发布 + MCP-006 写入端（2026-08-13）

> 状态：✅ 完成（verify 7/7 全绿目标；spec:check 48/48；单测 442/442）
> 上游：ADR-0004（v3 定位）+ 08-roadmap Phase 6 P1 + research §五（工作流层：Agent 写入先进预览态，
> 人确认后才发布；Mutable "The CMS for AI agents" 模式）+ 14-agent-content-space（CLI 唯一事实来源）
> **本文件是 Phase 6 P1 第二棒交接**（VIS-001 见 PHASE-6-p1-vis-complete；P2 见 CLAUDE.md「下一步」）

---

## 本次完成清单（需求 ID 可追溯）

| 需求 ID | 交付 | 文件 | 验证 |
|---|---|---|---|
| **WORK-001 发布前自动快照** | `takeSnapshot/listSnapshots/rollbackSnapshot`：`.doclight/snapshots/<id>/`（manifest.json + content/ 全文复制；id = 时间戳 + 内容哈希，**同内容幂等去重**；`--no-snapshot` 显式关闭；快照失败 → 发布中止，内容安全优先）；publish 结果携带 snapshot（id/files/bytes） | `packages/cli/src/snapshot.ts` + `publish.ts` | snapshot.test.ts 8 例（快照/幂等/变化/错误 + publish 集成） |
| **WORK-001 回滚** | `doclight rollback <id>`（清空内容源 → 复制回快照；ID 白名单 `[\w-]+` 防穿越；快照缺失/损坏 → 结构化错误不碰内容源）/ `rollback --list`（新→旧，时间/文件数/大小）| index.ts + snapshot.ts | snapshot.test.ts（回滚恢复/安全校验）+ rollback --json |
| **WORK-001 publish --preview / 确认门** | `publish --preview` = 构建 + 预览服务（不发布，mode:"preview" 结构化输出）；TTY 交互 y/N 确认门（`--yes` 跳过；非 TTY/`--json` 直行——自动化先确认由 doclight-publish Skill 保证）；Skill 升级四步流程（整理→预览→发布→验证） | index.ts + `.claude/skills/doclight-publish/SKILL.md` | publish.test.ts 回归 + work.feature spec |
| **WORK-001 dev 增量渲染** | 渲染缓存（路径 + mtime + 字节数 键）：未变更文档缓存直出；文件变更/插件热重载（PLUG-011）时整体失效——只重渲染被请求的变更文档 | `packages/cli/src/dev-server.ts` | dev-cache.test.ts 3 例（spy render 调用数：重复请求不增 / 变更后新内容 / 插件替换失效） |
| **MCP-006 写入端** | write_doc/update_doc/delete_doc：`--write-dir <docs>` 启停（loadSite 第二参）；`.md` 白名单 + `..`/绝对路径/越界全拒；update/delete 不存在 → 报错不静默；writeDir 未配置 → 可读错误（不伪造写能力）；dev --mcp 写入 → watcher 置脏 → 下次 MCP 请求增量重建（**写入触发增量重渲染联动**）；工具注册表十件套 | `packages/mcp-server/src/{tools,site,index}.ts` + `packages/cli/src/dev-server.ts` | tools.test.ts 25 例（启停/闭环/路径安全）+ protocol/site 测试更新 + ai.feature 十工具契约 |

## 关键设计决策

1. **快照幂等 = 内容哈希去重**：id 含内容哈希，同内容重复发布不产生垃圾快照（列表保持干净）；
   快照是纯文件复制（零 git 依赖——内容空间可能不是 git 仓库）。
2. **快照失败 → 发布中止**（内容安全优先）：源目录缺失时发布直接中止并给出可读错误，
   延续「无伪造成功」决策族；`--no-snapshot` 是显式逃生口。
3. **确认门双通道**：TTY 交互 = y/N 硬门禁；非 TTY（Agent/CI）= 直行——自动化场景的「先确认」
   由 Skill 流程保证（对外动作先问人），CLI 不阻断自动化（不破坏既有 Agent 工作流）。
4. **预览态复用 build/preview**（CLI 唯一事实来源）：`publish --preview` = 构建 + 预览服务，
   不新造发布路径；输出 mode:"preview" 结构化结果。
5. **增量渲染 = mtime 键缓存**：dev 按请求渲染已是单文档粒度；缓存消除重复渲染成本；
   插件管线替换（PLUG-011 热重载）同步失效缓存——旧管线产物不得继续直出。
6. **MCP 写入端独立于读取端**：写工具目标 = 内容源（docs/），读取仍只服务产物站点（决策⑩不破）；
   `--write-dir` 未配置时工具可见但返回可读错误（能力诚实，Agent 不会误以为能写）。

## 体积门禁（无变化）

| 产物 | 门禁 | 实测 |
|---|---|---|
| 展示层 gzip | < 25KB | 10.4KB（本次零改动——快照/写入全在 CLI/MCP 侧） |
| Node 内核 | < 30KB | 27.8KB |

**无新增运行时依赖**（snapshot 用 node:crypto；MCP 写入用 node:fs）。

## 验证命令

```bash
npm run verify          # 7/7 全绿
npm run spec:check      # 48/48（WORK-001 / MCP-006 追溯）
# 手动验证：
doclight publish --preview        # 预览态（构建 + 预览服务，不发布）
doclight publish --json           # 发布（自动快照，读 snapshot.id）
doclight rollback --list          # 快照列表
doclight rollback <id>            # 一键回滚
node packages/mcp-server/src/index.ts --site dist-site --write-dir docs --port 3100  # MCP 写入端
```

## 遗留（Phase 6 后续）

- **P2 · DEMO-001 演示形态**（演示专用视觉设计系统 + `doclight slides` + doclight-slides Skill）——下一步
- **并行 OSS-001 开源化**（LICENSE/README 重写/npm 包名注册——npm 包名与域名待用户决策）
- 可选增强：快照保留策略（N 份上限/自动清理）；`publish --preview` 输出画廊链接（--themes 已支持）；
  MCP 写入端 HTTP 模式（当前 stdio/dev 模式写入）
