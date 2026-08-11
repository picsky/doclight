# packages/renderer — Node 渲染内核

> 状态：✅ REND-001 渲染管线已实现（marked + DOMPurify + frontmatter，见 `src/core/`）
> 对应设计：[02-architecture §2.2.1](./tech-design/02-architecture.md) / [03-runtime-engine §3.3](./tech-design/03-runtime-engine.md)

## 为什么存在（意图文档，12 §4.1）

这是 DocLight 的**单一事实来源**。渲染只在这里发生一次：Markdown → HTML、sanitize（DOMPurify）、导航树、搜索索引、llms.txt、主题模板。dev / SSG / bundle 三形态产物全部复用本内核输出，浏览器展示层**不接触原始 Markdown**。

**为什么必须这样**：file:// 下浏览器无法动态读取本地文件（实测仅 Firefox 允许），且 marked 默认不 sanitize（XSS 实测）。把渲染 + 消毒收敛到 Node 侧，一次解决 file:// 死穴、XSS 单点防护、三形态输出一致性。

## 边界

- 本包只做**纯数据变换**（Markdown/元数据 → HTML/JSON），不做 I/O、不做 HTTP、不做文件监听
- `core/` 子目录（体积/安全敏感）受到保护，修改需显式批准（12 §5.2）
- 依赖方向：renderer 不依赖 cli；公共类型放 `packages/core`

## 体积预算

Node 内核 gzip < 30KB（ADR-0002 修订；实测 marked ~13KB + DOMPurify ~11KB + 逻辑 ~4KB = 27.9KB），`npm run verify:size` 硬门禁。
