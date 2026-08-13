# 验收准则：SSG-001 静态导出（doclight build）/ SSG-002 vendor 基址决策 / PREVIEW-001 产物预览
# 对应设计：05-ssg-build §5.3（构建流程）/ §5.2.1（CLI 命令清单）+ 08-roadmap §Phase 3 SSG
# 实现位置：packages/cli/src/build.ts（SSG 构建器）+ site.ts（共享模板/scan/vendor 拷贝）+ preview.ts（产物预览）+ renderer linkSuffix + display DOCLIGHT_VENDOR_BASE/DOCLIGHT_SEARCH_INDEX

Feature: SSG 静态导出（零构建文档站 → SEO 就绪静态站点）
  同一渲染内核输出完整静态 HTML，任意静态托管零改写可部署；渐进式水合，内容先有、JS 增强交互。

  Scenario: SSG-001 doclight build 生成完整静态站点
    Given 一个含多篇 Markdown（含子目录）的 docs/ 目录
    When 运行 doclight build
    Then 每篇 .md 输出为同相对路径的 .html（根级 README/index 收敛为 index.html）
    And 首页 index.html 存在（无根级置顶页时回退首篇文档）
    And 页面含服务端直出的导航与内容（SEO 可读）
    And 站内链接为 .html 后缀（任意静态托管可访问）
    And 输出 search-index.json（运行时直接加载，不再构建）

  Scenario: SSG-002 产物自包含（vendor 拷贝 + 双形态全局覆盖）
    Given 构建产物目录
    Then display.js 与扩展 vendor（Prism/Mermaid/KaTeX + 字体）拷贝进产物
    And 页面内联 DOCLIGHT_VENDOR_BASE=/vendor/ 与 DOCLIGHT_SEARCH_INDEX=/search-index.json
    And __DOCLLIGHT_SSG__ 标记开启（渐进式水合）
    And 产物离线可运行（扩展按需从产物本地加载）

  Scenario: SSG-001 搜索索引预构建
    Given 构建后的产物
    When 打开搜索框
    Then 直接加载预构建 search-index.json（path 为 .html URL，点击可导航）

  Scenario: PREVIEW-001 doclight preview 预览构建产物
    Given 已构建的产物目录
    When 运行 doclight preview 并请求页面
    Then 首页与 .html 页面正常服务
    And 无扩展名 / .md 请求回退到对应 .html（兼容手工输入）
    And 路径穿越请求被拒绝（404）

  Scenario: SSG-001 渲染唯一性（dev 与 SSG 同一内核）
    Given 同一篇 Markdown
    When 分别经 dev server 与 doclight build 渲染
    Then 内容区 HTML 一致，仅链接后缀差异（dev=.md / SSG=.html）

  Scenario: SSG-001 子路径部署（--base，GitHub Pages 项目页等）
    Given 以 --base /docs 构建
    Then 导航绝对链接/首页自指/display.js/vendor/search-index 全部带 /docs 前缀
    And canonical 为 siteUrl + /docs + 页面路径
    And preview --base /docs 剥离前缀后命中产物

  Scenario: SSG-001 搜索索引版本内联（03 §3.8.5 持久化）
    Given 构建产物
    Then search-index.json 含内容哈希 version（docs 变化 → 版本变化）
    And 页面内联 window.DOCLIGHT_SEARCH_VERSION 供展示层 localStorage 缓存校验
