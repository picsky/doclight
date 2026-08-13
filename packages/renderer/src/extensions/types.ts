/**
 * REND-002 扩展语法注册表 —— 白名单式 ExtensionDef schema
 *
 * 设计依据（08-roadmap §Phase 2 扩展语法渲染 + research-report §6.3 MVP）：
 * - 白名单式：扩展默认全开、逐个声明，不引入 MDX/JSX（与零构建约束冲突，ADR-0002）
 * - 每扩展声明：标记 class / marked 扩展 / 客户端懒加载映射 / 降级策略
 * - 内容承载铁律（spike 实测，2026-08-13）：**不依赖 data-* 属性**。DOMPurify 对
 *   data-* 的放行受属性值内容影响（Mermaid 源码含 `>` 时被剥离），因此扩展内容一律
 *   「class 标记 + 子元素/文本承载」——既是 sanitize 稳定的白名单标记，又天然满足
 *   降级策略（未加载/渲染失败时内容源码可见，不白屏）。
 *
 * 双读友好（REND-004）：所有扩展只在「渲染产物」层做标记与增强，原始 .md 源文件
 * 不动，llms.txt/MCP 视角的纯 markdown 原稿始终可消费。
 */
import type { TokenizerAndRendererExtension } from "marked";

/** 客户端懒加载映射：展示层 extensions.ts 据此按需注入 vendor 资源（守 <25KB gzip 门禁） */
export interface ClientDependency {
  /** vendor 脚本（相对站点根；dev server 从 /__doclight/vendor/* 提供，SSG/bundle 形态可覆盖 base） */
  scripts?: string[];
  /** vendor 样式（同上） */
  styles?: string[];
  /** 增强类型：展示层据此分派 */
  enhance: "code" | "mermaid" | "katex" | "none";
}

/** 扩展定义（注册表主键 = id） */
export interface ExtensionDef {
  /** 注册表主键（specs 追溯：REND-002） */
  id: string;
  /** 人类可读名（Agent/人双读） */
  title: string;
  /** 该扩展渲染产物使用的 class 标记（sanitize 白名单断言的依据） */
  classes: string[];
  /** Node 侧渲染：marked 扩展（tokenizer+renderer）；无 JS 注入需求的扩展（如纯 CSS 容器）可缺省 */
  markedExtensions?: TokenizerAndRendererExtension[];
  /** 客户端懒加载映射（无 JS 增强的扩展可缺省） */
  client?: ClientDependency;
  /** 降级策略（实现层面保证，此处文档化供 Agent/人双读） */
  degradation: string;
}
