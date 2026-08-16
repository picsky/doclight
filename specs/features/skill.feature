# 验收准则：Agent 技能自动安装（AGENT-001，14 §2.3 内容空间接入 + skill CLI）

## AGENT-001 技能自动安装（doclight skill install / list）

Feature: Agent 技能安装——DocLight 的 SKILL.md 技能随 CLI 分发，一条命令装进目标 Agent 技能目录
  Scenario: 安装到默认 Claude Code 用户级目录
    Given 运行 doclight skill install
    When 技能源存在（dist/skills 或 .claude/skills）
    Then 每个合法技能复制到 ~/.claude/skills/<name>/SKILL.md
    And /publish 斜杠命令复制到 ~/.claude/commands/publish.md

  Scenario: 幂等安装（重复执行不覆盖）
    Given 技能已安装且内容相同
    When 再次运行 doclight skill install
    Then 跳过并报告「已安装且内容相同」
    And 不覆盖已有文件

  Scenario: 覆盖策略（--force）
    Given 目标已存在内容不同的同名技能
    When 运行 doclight skill install
    Then 默认跳过（不静默覆盖用户定制）
    And 带 --force 时覆盖

  Scenario: 诚实降级（缺 frontmatter 的技能）
    Given 某技能 SKILL.md 缺合法 frontmatter（name/description）
    When 运行 doclight skill install
    Then 该技能跳过并计入 errors（不伪造成功）
    And 其余技能与命令正常安装

  Scenario: dry-run 与结构化输出
    When 运行 doclight skill install --dry-run
    Then 只列出安装计划，不写入任何文件
    And 带 --json 时输出可解析的 { ok, installed, skipped, errors, steps }
