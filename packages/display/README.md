# packages/display — 浏览器展示层

> 状态：Phase 0 占位（功能实现见 Phase 1）
> 对应设计：[02-architecture §2.2.2](./tech-design/02-architecture.md)

## 为什么存在（意图文档，12 §4.1）

这是用户实际看到/交互的部分：路由（path + hash 双模式）、导航、TOC、搜索、主题切换、插件 onMount。它**只渲染内核输出的 HTML，不接触原始 Markdown**。

**为什么必须这样**：让展示层保持轻量（< 25KB gzip），并把安全负担（sanitize）留在 Node 侧。展示层零安全责任、零 Markdown 解析依赖，是「三形态架构」得以成立的另一半。

## 边界

- 展示层源码在 `packages/display/src`，构建产物输出到 `dist/`（任意形态入口）
- 禁止引入大型框架（React/Vue 类）与重型依赖（12 §1.5），加依赖走审批
- 浏览器目标：Chrome/Edge/Firefox/Safari 最近两个主要版本（ES2020+）

## 体积预算

展示层 gzip < 25KB（core ~5KB + ui ~13KB + search ~7-15KB 按需 + plugin ~2KB），`npm run verify:size` 硬门禁。
