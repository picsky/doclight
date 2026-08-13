# 验收准则：SEO-001 页面级 SEO meta / SEO-002 站点级 SEO 文件（05-ssg-build §5.4）
# 实现位置：packages/cli/src/site.ts（renderPage seo 选项）+ build.ts（og/sitemap/robots 生成）

Feature: SEO 全套（SSG 产物可被搜索引擎收录与社交分享）
  SEO 是 SSG 相对 dev 的核心差异：每页有独立可收录 URL + 结构化数据 + 分享卡片。

  Scenario: SEO-001 每页输出 canonical / Open Graph / Twitter Card / JSON-LD / 面包屑
    Given 以 --site-url 构建（绝对 URL 前提满足）
    Then 每页含 <link rel="canonical">（siteUrl + base + 页面路径）
    And 含 og:url / og:title / og:type=article / og:description / og:image
    And 含 twitter:card / twitter:title / twitter:description / twitter:image
    And 含 application/ld+json TechArticle（headline / description / wordCount / dateModified）
    And 含 BreadcrumbList 结构化数据与可见面包屑 UI（首页 → 分组链 → 当前页）

  Scenario: SEO-002 生成 sitemap.xml / robots.txt / OG 卡片图
    Given 以 --site-url 构建
    Then 生成 sitemap.xml（全部页面 <loc> + <lastmod>，首页为站点根）
    And 生成 robots.txt（User-agent: * / Allow: / + Sitemap 指向）
    And 每页生成 OG 卡片图（og/*.svg，Node 侧无浏览器依赖）

  Scenario: 无 --site-url 时不输出绝对链接 SEO 文件
    Given 构建未提供 siteUrl
    Then 不生成 sitemap.xml / robots.txt / og/ 目录
    And 页面无 canonical / og:url（绝对 URL 前提缺失）
