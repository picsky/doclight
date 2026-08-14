# 验收准则：WORK-001 预览-确认-发布（08-roadmap Phase 6 P1；research §五 工作流层）
# 实现位置：packages/cli/src/snapshot.ts（版本快照与回滚）+ publish.ts（发布前自动快照）
#          + index.ts（publish --preview 预览态 / TTY 确认门 / rollback 命令）+ dev-server.ts（增量渲染缓存）

Feature: 预览-确认-发布工作流（WORK-001）
  Agent 写入先进预览态，人确认后才发布；发布前自动快照，出错/后悔可一键回滚——
  对齐行业验证（Mutable "The CMS for AI agents"：Agent 沙箱写入 → 人审查 → 一键发布）。

  Scenario: WORK-001 发布前自动快照
    Given 内容源 docs/ 有若干文档
    When 运行 doclight publish
    Then .doclight/snapshots/<id>/ 生成快照（manifest.json + content/ 全文复制）
    And PublishResult 含 snapshot（id/createdAt/files/bytes）
    And 内容未变化时重复发布不产生新快照（内容哈希幂等去重）
    Given --no-snapshot
    Then 不生成快照（显式关闭）

  Scenario: WORK-001 回滚
    Given 发布后内容源被修改（误删/误改）
    When 运行 doclight rollback <id>
    Then 内容源恢复为快照状态（清空 → 复制回）
    And rollback --list 列出全部快照（新 → 旧，含时间/文件数/大小）
    And 快照不存在/ID 非法 → 结构化错误（不碰内容源）

  Scenario: WORK-001 publish --preview 预览态（不发布）
    Given 运行 doclight publish --preview
    Then 构建产物并启动预览服务器（返回 url；mode=preview）
    And 不执行任何发布动作（无推送/无端点请求）

  Scenario: WORK-001 确认门
    Given TTY 交互模式运行 doclight publish（无 --yes）
    Then 发布前提示 y/N 确认，N 取消（不发布）
    Given 非 TTY（Agent/CI 自动化）或 --yes
    Then 直接执行（自动化场景的「先确认」由 doclight-publish Skill 流程保证）

  Scenario: WORK-001 dev 增量渲染（只重渲染变更文档）
    Given dev server 运行中，某文档已请求过一次
    Then 源文件未变时再次请求走渲染缓存（mtime+字节数 键，不重渲染）
    When 修改该文档
    Then 缓存失效，下次请求返回新内容（热重载语义不变）
