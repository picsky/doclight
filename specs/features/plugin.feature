# 验收准则：插件系统（PLUG-001 ~ PLUG-013，07 §7 完整规格）

## PLUG-001 事件总线（Phase 1 已有）

Feature: 插件通信基础设施（事件总线 + 路由钩子）

  Scenario: 事件总线发布/订阅
    Given 一个事件总线实例
    When 订阅者 on() 订阅某事件，发布者 emit() 发布该事件
    Then 所有订阅者同步收到 payload
    And off() / 退订函数可取消订阅
    And 单个订阅者抛异常不影响其余订阅者

  Scenario: 路由 beforeEach 取消导航
    Given 一个 beforeEach 钩子返回 false
    When 用户点击站内链接
    Then 导航被取消（URL 与内容均不变化）

  Scenario: 路由 beforeEach 重定向
    Given 一个 beforeEach 钩子返回字符串 "/login.md"
    When 用户点击站内链接
    Then 导航重定向到 "/login.md"

  Scenario: 路由 afterEach 在导航完成后执行
    Given 注册了 afterEach 钩子
    When 导航成功完成
    Then 钩子收到 { from, to } 上下文
    And 总线发布 doclight:routechange 事件

## PLUG-003 插件类型与核心 API

Feature: 插件声明类型与插槽名常量

  Scenario: SLOT_NAMES 常量包含 11 个标准插槽
    Given doclight-core 导出的 SLOT_NAMES
    Then 数量为 11
    And 包含 head:start / head:end / sidebar:before / sidebar:after / topbar:before / topbar:after / content:before / content:after / toc:before / toc:after / footer

  Scenario: PluginDef 类型可承载完整插件声明
    Given 一个 PluginDef 对象
    When 声明 name / version / config / 8 个钩子 / slotContent
    Then TypeScript 编译通过

## PLUG-004 展示层插件管理器

Feature: 浏览器端插件注册与生命周期

  Scenario: use 注册 + 防重复
    Given 一个 PluginManager 实例
    When use() 注册同名插件两次
    Then registered 列表只含一个

  Scenario: initApp 调用各插件 init
    Given 注册了含 init 钩子的插件
    When initApp()
    Then init 被调用，收到 AppApi

  Scenario: notifyMount 调用各插件 onMount
    Given 已 initApp
    When notifyMount()
    Then 各插件 onMount 被调用

  Scenario: notifyRouteChange 返回 false 取消导航
    Given 某插件 onRouteChange 返回 false
    When notifyRouteChange("/blocked")
    Then 返回 false

  Scenario: notifyRouteChange 返回字符串重定向
    Given 某插件 onRouteChange 返回 "/login"
    When notifyRouteChange("/admin")
    Then 返回 "/login"

  Scenario: 单插件异常不中断其余
    Given 两个插件，第一个 onMount 抛异常
    When notifyMount()
    Then 第二个 onMount 仍被调用

  Scenario: remove 调用 destroy + 清除插槽
    Given 注册了含 destroy 的插件并插入了插槽内容
    When remove(name)
    Then destroy 被调用
    And 该插件的插槽内容被移除

  Scenario: destroy 清理全部
    Given 多个插件
    When destroy()
    Then 每个插件的 destroy 都被调用
    And registered 为空

## PLUG-005 插槽系统

Feature: 11 个命名插槽的增删查渲染

  Scenario: insert + renderHtml 拼接多插件内容
    Given 两个插件分别插入 "content:after"
    When renderHtml("content:after", ctx)
    Then 返回两段内容拼接

  Scenario: 同 id 不重复插入（幂等）
    Given 同一 id 连续插入两次
    When renderHtml
    Then 只含第一次的内容

  Scenario: remove 按 id 移除
    Given 插槽含 a/b 两条
    When remove(slot, "a")
    Then 只剩 b

  Scenario: removeAll 移除某 id 在全部插槽
    Given 某 id 在 head:end 和 footer 都有内容
    When removeAll(id)
    Then 两个插槽都为空

  Scenario: 函数型内容每次 renderHtml 重新执行
    Given 插槽含函数 (ctx) => `<span>${ctx.path}</span>`
    When renderHtml 两次，path 不同
    Then 分别返回对应 path 的 HTML

  Scenario: 非法插槽名静默忽略
    Given 调用 insert("nonexistent:slot", ...)
    When renderHtml("nonexistent:slot")
    Then 返回空字符串

## PLUG-006 构建管线钩子

Feature: Node 端构建时钩子执行

  Scenario: beforeRender 正向链
    Given 插件 A.beforeRender 替换 TODO，插件 B 替换 FIX
    When runBeforeRender("TODO and FIX", ctx)
    Then 返回 "[A-done] and [B-done]"（A 先 B 后）

  Scenario: afterRender 反向链
    Given 插件 A.afterRender 追加 <!--A-->，B 追加 <!--B-->
    When runAfterRender("<p>Hi</p>", ctx)
    Then 返回 "<p>Hi</p><!--B--><!--A-->"（B 先 A 后）

  Scenario: 单插件异常不中断管线
    Given 第一个插件 beforeRender 抛异常，第二个追加 "-ok"
    When runBeforeRender("input", ctx)
    Then 返回 "input-ok"

  Scenario: addSearchFields 合并多插件字段
    Given 两个插件分别返回 {tags} 和 {category}
    When collectSearchFields(doc)
    Then 返回合并后的对象

  Scenario: slotContent 合并多插件（含函数）
    Given 两个插件分别提供静态与函数型 slotContent
    When collectSlotContent(ctx)
    Then 返回合并后的 Record<string, string>

## PLUG-008 配置与契约

Feature: doclight.json plugins 数组

  Scenario: schema 收录 plugins 数组
    Given contracts/doclight.schema.json
    Then properties.plugins 存在
    And items 含 name / config / enabled

  Scenario: config.ts 宽松读取 plugins
    Given doclight.json 含 plugins: [{name:"giscus",config:{repo:"..."}}, "invalid", {config:{}}]
    When loadConfig()
    Then cfg.plugins 长度为 1
    And 第一项为 {name:"giscus", config:{repo:"..."}, enabled:true}
    And 非法项被过滤

## PLUG-009 CLI 集成

Feature: dev / build / bundle 三形态插件加载

  Scenario: renderPage 模板含 11 个 data-doclight-slot 标记
    Given 调用 renderPage({...})
    When 检查输出 HTML
    Then 包含 data-doclight-slot="head:start" / "head:end" / "sidebar:before" 等全部 11 个

  Scenario: dev server 渲染走 beforeRender → render → afterRender 管线
    Given 插件注入 beforeRender 替换占位符
    When dev server 处理文档请求
    Then 产物 HTML 含替换后的内容

  Scenario: SSG build 渲染走相同管线
    Given 插件注入 afterRender 包裹内容
    When buildSite()
    Then 产物 .html 含包裹后的内容

## PLUG-010 构建期文件产出钩子

Feature: onBuild 产出站点级构建文件（rss.xml / manifest.json / sw.js 等）

  Scenario: runOnBuild 合并各插件产出文件
    Given 插件 A.onBuild 返回 [{path:"a.xml",content:"<a/>"}]，插件 B 返回 [{path:"b.json",content:"{}"}]
    When runOnBuild(ctx)
    Then 返回两个文件（路径 + 内容完整）

  Scenario: 单插件 onBuild 异常不中断其余
    Given 第一个插件 onBuild 抛异常
    When runOnBuild(ctx)
    Then 其余插件的产出文件正常返回

  Scenario: 非法产出项过滤
    Given 插件 onBuild 返回 [{path:123}, null, {path:"ok.txt",content:"x"}]
    When runOnBuild(ctx)
    Then 仅返回 {path:"ok.txt",content:"x"}

  Scenario: build 将 onBuild 文件写入产物目录
    Given 插件 onBuild 返回 rss.xml
    When buildSite()
    Then 产物目录含 rss.xml
    And 越界路径（../ 跳出 outDir）被跳过

## PLUG-007 官方插件样例

Feature: 内置官方插件注册表与加载（giscus / plausible / rss / pwa / ai-chat / mermaid）

  Scenario: 官方插件注册表含 6 个插件
    Given doclight-cli 的 plugins-official 注册表
    Then 含 giscus / plausible / rss / pwa / ai-chat / mermaid
    And 短名与 @doclight/plugin-* 包名均可解析

  Scenario: 插件加载器解析内置插件名
    Given doclight.json plugins: [{name:"giscus", config:{repo:"owner/repo"}}]
    When loadPluginsSync()
    Then 返回 1 个 PluginDef（name="giscus"）

  Scenario: 未知插件跳过且不中断其余
    Given plugins 含 name:"nonexistent" 与 name:"plausible"（config 含 domain）
    When loadPluginsSync()
    Then 返回 plausible 的 PluginDef
    And skipped 含 nonexistent（含原因）

  Scenario: 配置缺必填项跳过
    Given plugins 含 name:"giscus" 但 config 无 repo
    When loadPluginsSync()
    Then 返回空列表
    And skipped 含 giscus（原因：配置无效）

  Scenario: 插件脚手架生成模板（plugin new）
    Given 执行 doclight plugin new my-chart
    Then 生成 plugin.js / README.md / plugin.test.js
    And plugin.js 含全部 9 个钩子骨架（删注释即启用）
    And README.md 含 doclight.json 配置片段
    And 非法插件名报错（大小写/路径穿越/非 ASCII）

  Scenario: 官方插件清单（plugin list）
    Given 执行 doclight plugin list
    Then 列出 6 个官方插件（giscus / plausible / rss / pwa / ai-chat / mermaid）
    And 每个插件含一句话简介

## PLUG-012 插件 vendor/styles 声明与 Mermaid 迁移

Feature: 重 vendor 扩展插件化（mermaid 从内置迁移）——PluginDef 声明构建期资源，三形态按需接线

  Scenario: PluginDef 支持 vendor 与 styles 声明
    Given 一个 PluginDef 对象声明 vendor:[{file,pkg,rel}] 与 styles 字符串
    Then TypeScript 编译通过
    And collectVendorFiles() 合并为 file → {pkg,rel} 映射（同名去重，首个命中胜出）
    And collectPluginStyles() 按注册顺序拼接 styles

  Scenario: mermaid 不再内置默认（迁移语义）
    Given 不配置 plugins 的文档站
    When 渲染含 ```mermaid 围栏的 Markdown
    Then 围栏按普通代码块渲染（language-mermaid，可高亮可复制）
    And 默认产物不含 vendor/mermaid.min.js

  Scenario: 启用 mermaid 插件后行为与内置时期一致
    Given doclight.json plugins:[{name:"mermaid"}]
    When buildSite()
    Then 围栏渲染为 .doclight-mermaid fallback（class 标记 + 源码子元素，sanitize 后源码保留）
    And 产物含运行时增强脚本（doclight.use 注册 init/onMount：懒加载渲染 + 错误降级提示，100% 不白屏）
    And 产物含插件 CSS（.doclight-mermaid 等，<style data-doclight-plugin-css>）
    And vendor/mermaid.min.js 拷贝进产物（按需）

  Scenario: dev server vendor 端点按需服务插件 vendor
    Given dev server 以启用 mermaid 插件启动
    When 请求 /__doclight/vendor/mermaid.min.js
    Then 返回 200（从 node_modules 提供）
    And 未启用插件时同路径返回 404（诚实降级）

  Scenario: bundle --inline-vendor 按需内联插件 vendor
    Given bundleSite({inlineVendor:true}) 且启用 mermaid 插件
    Then 产物含 data-doclight-vendor="mermaid.min.js" 内联标记
    And 未启用插件时 mermaid.min.js 不内联（默认不携带）

## PLUG-013 加载能力扩展（ESM-only 包 / TS 插件文件）

Feature: 加载器同步契约下支持 ESM 与 TypeScript 插件（Node 原生能力，零额外依赖）

  Scenario: ESM-only 插件包（node_modules type:module）
    Given node_modules 内一个 type:module 包，export default PluginDef
    When loadPluginsSync([{name:"<包名>"}], root)
    Then 返回 1 个 PluginDef（default 导出形态解析）
    And skipped 为空

  Scenario: .ts 插件文件（项目内相对路径，type stripping）
    Given 项目内 ./plugins/my-plugin.ts 文件 export default PluginDef
    When loadPluginsSync([{name:"./plugins/my-plugin.ts"}], root)
    Then 返回 1 个 PluginDef（name 取导出值）

  Scenario: .ts 插件热重载（require 缓存失效同 .js）
    Given .ts 插件文件内容 v1
    When 修改为 v2 后重新 loadPluginsSync
    Then 取到 v2

  Scenario: 顶层 await 的 ESM 插件诚实跳过
    Given 插件包含顶层 await（require 同步限制无法加载）
    When loadPluginsSync
    Then 插件进 skipped（fatal=true）
    And 原因含 top-level await 专属提示（不伪造成功，不中断其余插件）

  Scenario: 低版本 Node 的 ESM/TS 加载失败诚实降级
    Given Node < 23.6（无 require(esm) / TS strip 默认能力）
    When loadPluginsSync ESM/TS 插件
    Then 插件进 skipped（fatal=true，含原因）

## PLUG-011 插件热重载

Feature: dev 模式插件文件变更自动重载

  Scenario: pipeline.setPlugins 整体替换插件
    Given 管线已注册插件 A（beforeRender 追加 [A]）
    When setPlugins([B])
    Then 后续 beforeRender 只走 B（[A] 不再出现，无残留）
    And 其余钩子（extendMarked / onBuild 等）同样只来自新插件集

  Scenario: loadPluginsSync 清除 require 缓存
    Given 同一插件文件已 require 过（name 为 v1）
    When 文件内容变更为 v2 后再次 loadPluginsSync
    Then 取到 v2（缓存已失效）

  Scenario: dev server 监听插件文件变更推送重载
    Given dev server 以 pluginFiles + reloadPlugins 启动
    When 插件源文件内容变更
    Then 管线替换为最新插件
    And 页面产物反映新行为
    And SSE 推送 reload（浏览器整页刷新 = 运行时全清理）

  Scenario: 加载期错误保留旧管线
    Given 插件文件被写入语法错误
    When 热重载触发（reloadPlugins 返回 null）
    Then 管线保留旧插件集
    And 服务不中断（页面产物保持旧行为）
