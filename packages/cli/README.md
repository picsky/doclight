# packages/cli — DocLight CLI

> 状态：Phase 0 占位（功能实现见 Phase 3）
> 对应设计：[05-ssg-build](../../docs/tech-design/05-ssg-build.md)、[13-deployment-distribution](../../docs/tech-design/13-deployment-distribution.md)

## 为什么存在（意图文档，12 §4.1）

CLI 是 DocLight 的**开发者入口**：`init` 初始化项目、`dev` 本地预览（原生 http + watch + SSE）、`build` SSG 静态导出、`bundle` 便携单文件、`deploy` 一键部署、`publish` Agent 内容发布。它复用 renderer 内核，不重复实现渲染。

**为什么独立成包**：CLI 只在构建/开发环境运行，不进浏览器也不进用户静态产物；依赖方向 cli 可依赖 renderer（12 §1.2）。

## 边界

- 构建工具为**原生 Node.js**，不引入 Vite/Rollup/esbuild（02 §2.3.4）
- 每个命令必须有稳定的退出码与 JSON 输出（反馈层，Agent 可消费）
