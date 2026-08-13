---
name: phase5-plugin-ecosystem-done
description: Phase 5 插件系统+生态全量完成（PLUG-003~011/MIG-001/002/THEME-002 已提交 a272f4c），关键架构决策与下一步
---

# Phase 5 插件系统 + 生态 已全部完成（2026-08-13，提交 a272f4c）

verify 6/6（单测 354/354 + e2e 54/54）+ spec:check 41/41。

**关键架构决策（换会话勿推翻）**：
1. **extendMarked 用 MarkedExtender 收集器**（非 marked 实例）——渲染内核每次新建 Marked 实例，插件扩展经 collectMarkedExtensions → extraMarkedExtensions 统一挂载；兼容 use()/返回数组四种形态
2. **插件加载器诚实原则**：解析失败进 skipped（含原因+fatal 标记），不伪造成功；fatal=加载期错误（文件缺失/语法错误），热重载据此保留旧管线
3. **官方插件 = 构建时插槽注入为主**（giscus/plausible/ai-chat 零运行时钩子；rss/pwa 走 onBuild）；密钥不进页面（ai-chat 代理端点模式）
4. **主题 = CSS 变量覆盖层**（THEME-001 令牌即接口；default 零注入，minimal/warm 内置）
5. **bundle 插件边界**：插槽注入壳层单实例，路由切换不重渲染（已文档化）
6. **热重载 = setPlugins 替换 + 浏览器整页刷新全清理**（reloadPlugins 返回 null 保留旧管线）

**遗留（v1.0 收尾）**：plugin-mermaid 从内置迁移 / ESM+TS 插件加载（需异步 import）/ 插件运行时配置自动注册 / 云端 Space 托管 / npm 包名+域名（待用户决策）

**下一步**：v1.0 收尾批次；先读 `docs/agent-handoffs/PHASE-5-remaining-complete.md`
