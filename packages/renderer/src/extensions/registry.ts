/**
 * REND-002 扩展语法注册表 —— 白名单式注册与查询
 *
 * 零配置引擎：默认扩展全开（DEFAULT_EXTENSIONS）；未来 doclight.json 配置系统
 * （02 §2.5）可在 render 选项里裁剪（preferRegistries 扩展点）。
 * 渲染管线（markdown.ts）从这里挂载 marked 扩展；展示层（extensions.ts）从这里
 * 读取懒加载映射；单测从这里断言 sanitize 白名单。
 *
 * PLUG-012（mermaid 迁移）：Mermaid 不再内置默认——重 vendor 依赖（mermaid.min.js）
 * 的扩展按需启用，由 @doclight/plugin-mermaid 官方插件提供（extendMarked 围栏 +
 * 运行时容错渲染 + vendor/styles 声明）。默认白名单仅保留零/轻依赖扩展。
 */
import type { ExtensionDef } from "./types.ts";
import { containerExtension } from "./container.ts";
import { katexInlineExtension, katexBlockExtension } from "./katex.ts";
import { tabsExtension } from "./tabs.ts";
import { stepsExtension } from "./steps.ts";

/** 默认启用的扩展白名单（新增扩展在此登记，同时补 specs/features 与单测） */
export const DEFAULT_EXTENSIONS: ExtensionDef[] = [
  {
    id: "code-block",
    title: "代码高亮 + 复制按钮",
    classes: ["doclight-code"],
    client: { scripts: ["prism.min.js"], enhance: "code" },
    degradation: "无 Prism 时保留纯代码块（可读 + 可复制）",
  },
  {
    id: "container",
    title: "自定义容器（:::tip / :::warning / :::danger / :::info）",
    classes: ["doclight-container", "doclight-tip", "doclight-warning", "doclight-danger", "doclight-info"],
    markedExtensions: [containerExtension],
    client: { enhance: "none" },
    degradation: "纯 CSS 标记（dev server 样式），无 JS 依赖，降级为普通 div",
  },
  {
    id: "tabs",
    title: "Tabs 容器（:::tabs / :::tab，跨组联动）",
    classes: ["tabs", "tab-bar", "tab-btn", "tab-panel"],
    markedExtensions: [tabsExtension],
    client: { enhance: "none" },
    degradation: "纯 CSS 标记：首面板直出可见，无 JS 时其余面板隐藏",
  },
  {
    id: "steps",
    title: "步骤容器（:::steps，编号 + 连线）",
    classes: ["steps", "step-title"],
    markedExtensions: [stepsExtension],
    client: { enhance: "none" },
    degradation: "纯 CSS 标记（计数器 + 连线），无 JS 依赖，降级为有序列表",
  },
  {
    id: "katex",
    title: "KaTeX 公式（$...$ / $$...$$）",
    classes: ["doclight-katex-inline", "doclight-katex-block"],
    markedExtensions: [katexInlineExtension, katexBlockExtension],
    client: { scripts: ["katex.min.js"], styles: ["katex.min.css"], enhance: "katex" },
    degradation: "未加载 KaTeX → TeX 源码可见（降级为可读文本）",
  },
];

/** 当前启用扩展（默认全开；测试可注入自定义白名单） */
let enabled: ExtensionDef[] = [...DEFAULT_EXTENSIONS];

/** 覆盖启用白名单（测试用；默认零配置全开，勿在运行时调用） */
export function setExtensions(exts: ExtensionDef[]): void {
  enabled = [...exts];
}

export function getExtensions(): ExtensionDef[] {
  return [...enabled];
}

export function getExtension(id: string): ExtensionDef | undefined {
  return enabled.find((e) => e.id === id);
}

export function isEnabled(id: string): boolean {
  return getExtension(id) !== undefined;
}

/** 汇聚全部启用扩展的 class 标记（sanitize 白名单断言 / 审计依据） */
export function collectExtensionClasses(): string[] {
  const out = new Set<string>();
  for (const ext of enabled) for (const c of ext.classes) out.add(c);
  return [...out];
}
