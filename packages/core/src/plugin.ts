/**
 * 插件系统类型定义（PLUG-003，07 §7 完整规格）
 *
 * 双上下文插件架构：
 * - 构建时钩子（beforeRender / afterRender / extendMarked / addSearchFields）：Node 端运行，
 *   影响 SSG/dev 产物。CLI 构建管线按注册顺序调用。
 * - 运行时钩子（init / onMount / onRouteChange / destroy）：浏览器端运行，
 *   由展示层插件管理器在对应生命周期节点调用。
 * - 插槽（slots）：双上下文均可填充。构建时注入 HTML 模板，运行时操作 DOM。
 *
 * 设计原则（07 §7.1）：简单到 Agent 也能写——插件 = 声明对象，无基类、无注册回调。
 */

/** 插件声明（对象形式，07 §7.5.2） */
export interface PluginDef {
  /** 插件名（唯一标识，npm 包名或简写，如 "giscus" / "@doclight/plugin-giscus"） */
  name: string;
  /** 语义版本 */
  version?: string;
  /** 插件配置（用户传入的 options，插件内部消费） */
  config?: Record<string, unknown>;
  /** 构建期 vendor 资源声明（PLUG-012：按需服务/拷贝/内联——dev 端点按需服务、SSG 按需拷贝、bundle --inline-vendor 按需内联，守体积门禁） */
  vendor?: PluginVendorFile[];
  /** 插件 CSS（注入页面 <style data-doclight-plugin-css>；空缺省） */
  styles?: string;

  /* ===== 构建时钩子（Node 端） ===== */

  /** Markdown 渲染前变换（正向链：A → B → marked 渲染） */
  beforeRender?: (md: string, ctx: RenderContext) => string;
  /** HTML 渲染后变换（反向链：marked → B.afterRender → A.afterRender） */
  afterRender?: (html: string, ctx: RenderContext) => string;
  /** 扩展 marked 解析器（注入 tokenizer/renderer）。参数为收集器（use() 与 marked.use 同形状调用）；也可直接返回扩展数组。 */
  extendMarked?: (marked: MarkedExtender) => void | unknown[];
  /** 扩展搜索索引字段（每篇文档调用一次，返回额外键值对） */
  addSearchFields?: (doc: SearchDoc) => Record<string, string>;
  /** 构建完成后产出额外文件（PLUG-010：rss.xml / manifest.json / sw.js 等；返回 BuildFile[] 相对 outDir，build 写入产物） */
  onBuild?: (ctx: BuildContext) => void | BuildFile[];

  /* ===== 运行时钩子（浏览器端） ===== */

  /** 初始化（app 实例就绪后调用一次） */
  init?: (app: AppApi) => void;
  /** 页面挂载后（每次路由切换内容注入完成） */
  onMount?: (app: AppApi) => void;
  /** 路由变化（返回 false 可取消导航，返回字符串可重定向） */
  onRouteChange?: (path: string, app: AppApi) => boolean | string | void;

  /** 卸载清理（释放资源、移除事件） */
  destroy?: () => void;

  /* ===== 插槽内容 ===== */

  /** 构建时插槽内容（静态 HTML 注入模板） */
  slotContent?: Record<string, string | ((ctx: RenderContext) => string)>;
}

/** 渲染上下文（beforeRender / afterRender / slotContent 回调共享） */
export interface RenderContext {
  /** 文档相对路径（如 "guide/quickstart.md"） */
  path: string;
  /** 文档标题（frontmatter.title 或文件名主干） */
  title: string;
  /** frontmatter 数据 */
  frontmatter: Record<string, unknown>;
  /** 标题大纲 */
  headings: Array<{ level: number; id: string; text: string }>;
  /** 是否首次渲染（dev server 首次 / SSG 构建） */
  isFirstRender: boolean;
  /** 子路径基址（SSG 形态如 "/docs"，dev 为空；PLUG-007 官方插件用：pwa 等需拼资产绝对路径） */
  base?: string;
  /** 站点绝对 URL（可能为空；rss 等需绝对 URL 的插件据此降级） */
  siteUrl?: string;
}

/** 构建产物文件（PLUG-010 onBuild 钩子返回项） */
export interface BuildFile {
  /** 相对 outDir 的产物路径（如 "rss.xml" / "manifest.json" / "sw.js"） */
  path: string;
  /** 文件内容（文本） */
  content: string;
}

/** 构建期文档元数据（onBuild ctx.docs 项，PLUG-010） */
export interface BuildDocMeta {
  /** 产物路径（如 "guide/quickstart.html"） */
  path: string;
  /** 文档标题 */
  title: string;
  /** 摘要（可能为空） */
  summary?: string;
  /** 更新时间（ISO 字符串，可能为空） */
  updatedAt?: string;
  /** 字数 */
  wordCount?: number;
}

/** 构建上下文（PLUG-010 onBuild 钩子参数：所有文档渲染完成后调用一次） */
export interface BuildContext {
  /** 构建输出目录（绝对路径） */
  outDir: string;
  /** 站点标题 */
  siteTitle: string;
  /** 子路径基址（归一化，如 "/docs" 或 ""） */
  base: string;
  /** 站点绝对 URL（未配置时为空） */
  siteUrl?: string;
  /** 全部文档元数据（产物路径 + 标题等，供 rss / sitemap 扩展等插件消费） */
  docs: BuildDocMeta[];
}

/** 搜索文档对象（addSearchFields 钩子参数） */
export interface SearchDoc {
  /** 文档路径（产物 URL） */
  path: string;
  /** 文档标题 */
  title: string;
  /** 纯文本内容（已剥标签） */
  text: string;
  /** 标题列表 */
  headings: string[];
  /** frontmatter 数据 */
  frontmatter: Record<string, unknown>;
}

/** 展示层 App API（运行时钩子收到的实例，07 §7.3.1） */
export interface AppApi {
  /** 插入内容到命名插槽（HTML 字符串 / DOM 元素 / 函数——函数在每次路由切换后重新执行） */
  insertSlot(slotName: string, content: string | HTMLElement | ((ctx: { path: string }) => string)): void;
  /** 移除某插件在某插槽的内容 */
  removeSlot(slotName: string): void;
  /** 主动导航到站内 URL */
  navigate(url: string, replace?: boolean): Promise<void>;
  /** 获取当前路径 */
  currentPath(): string;
  /** 读取文档 frontmatter（当前页） */
  currentFrontmatter(): Record<string, unknown>;
  /** 事件总线订阅 */
  on(event: string, handler: (payload: unknown) => void): () => void;
  /** 事件总线发布 */
  emit(event: string, payload?: unknown): void;
}

/** 11 个标准插槽名（07 §7.4.2） */
export const SLOT_NAMES = [
  "head:start",
  "head:end",
  "sidebar:before",
  "sidebar:after",
  "topbar:before",
  "topbar:after",
  "content:before",
  "content:after",
  "toc:before",
  "toc:after",
  "footer",
] as const;

export type SlotName = (typeof SLOT_NAMES)[number];

/** 插件配置（doclight.json plugins 数组项） */
export interface PluginConfig {
  /** 插件名或包名 */
  name: string;
  /** 插件选项（传给插件工厂函数） */
  config?: Record<string, unknown>;
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

/** 插件构建期 vendor 资源声明（PLUG-012：mermaid 等重 vendor 扩展按需启用，不进默认产物） */
export interface PluginVendorFile {
  /** vendor 文件名（vendor 端点路径尾段，如 "mermaid.min.js"） */
  file: string;
  /** npm 包名（node_modules 定位，dev server 从包内读取） */
  pkg: string;
  /** 包内相对路径（如 "dist/mermaid.min.js"） */
  rel: string;
}

/**
 * marked 扩展收集器（extendMarked 钩子参数）
 *
 * 设计（PLUG-006 接线修复，2026-08-13）：渲染内核每次调用新建 Marked 实例（markdown.ts），
 * 构建管线无法在渲染前持有实例供插件原地扩展。因此 extendMarked 收到的不是 marked 实例，
 * 而是本收集器——use() 与 marked.use() 同形状调用，扩展数组由管线收集后统一挂载。
 * core 包零依赖：不 import marked 类型，参数保持 unknown。
 */
export interface MarkedExtender {
  /** 注册 marked 扩展（兼容 marked.use({extensions:[...]}) / 传单个扩展 / 传数组三种形态） */
  use(extension: unknown): void;
}
