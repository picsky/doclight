# 验收准则：CLI-005 doclight publish / CLI-006 doclight space（Agent 内容空间写入端）
# 对应设计：14-agent-content-space §3（Space Provider 抽象）+ §4（发布通道设计）+ 08-roadmap Phase 4 剩余
# 实现位置：packages/cli/src/{space,publish}.ts + index.ts（--json 结构化输出）
# 前置：读取端已就绪（LLMS-001 llms.txt / FRONT-001 语义 frontmatter / MCP-001~003）——publish 复用 build 产物

Feature: Agent 内容空间写入端（doclight publish / doclight space）
  内容是纯 Markdown，发布 = 构建 + 落到某处（local / git / space）。CLI 是唯一事实来源，
  所有命令输出结构化 JSON（Agent 友好，错误含可修复指引），无伪造成功（14 §4.3 原则）。

  Scenario: CLI-006 doclight space init 初始化空间
    Given 一个空项目目录（无 .doclight/space.json）
    When 运行 doclight space init
    Then 生成 .doclight/space.json（version/active/spaces 齐备）
    And 默认空间为 local（provider=local，产物目录 dist-bundle）
    And 重复运行幂等（已存在空间不重复，激活项不变）
    When 运行 doclight space init --provider git --remote <url>
    Then 注册 git 空间（remoteUrl/branch=gh-pages）并设为 active
    When 运行 doclight space init --provider space
    Then 注册 space 空间（endpoint 缺省官方端点），无端点不伪造成功

  Scenario: CLI-006 doclight space switch / status
    Given 已初始化两个空间（local / git）
    When 运行 doclight space switch git
    Then active 切换为 git（.doclight/space.json 持久化）
    And 切换不存在空间返回结构化错误（可读，不崩栈）
    When 运行 doclight space status
    Then 返回结构化状态（active/provider/url 或引导步骤，Agent 可读）

  Scenario: CLI-005 doclight publish 发布到 local
    Given 一个含 Markdown 的 docs/ 目录
    When 运行 doclight publish --to local
    Then 输出单文件便携包（dist-bundle/doclight.html）
    And 返回 file:// URL 与文件路径（结构化 JSON，ok=true）

  Scenario: CLI-005 doclight publish 发布到 git（gh-pages）
    Given 一个含 GitHub 远程的 git 仓库
    When 运行 doclight publish --to git
    Then 以 /<repo>/ 为 base 构建 + 推送 gh-pages 分支
    And 返回公网 URL（https://<user>.github.io/<repo>/）
    Given 无 GitHub 远程
    Then 输出引导步骤（不伪造成功，ok=false）

  Scenario: CLI-005 doclight publish 发布到 space（HTTP 协议）
    Given 已配置 space 端点
    When 运行 doclight publish --to space --endpoint <url>
    Then POST {endpoint}/publish_site 站点清单（docs.json 元数据 + 站点摘要）
    And 返回端点响应中的 URL
    Given 未配置端点或端点不可达
    Then 结构化错误 + 修复指引（不伪造成功）

  Scenario: CLI-005 doclight publish 默认空间与 --json
    Given 已初始化空间且 active=local
    When 运行 doclight publish（不带 --to）
    Then 发布到 active 空间（local）
    When 运行 doclight publish --json
    Then 输出纯 JSON（无额外人类文本，可直接被 Agent 解析）
