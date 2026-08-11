/**
 * doclight-renderer 入口（Phase 0 占位）
 *
 * 设计目标见 README.md：Node 渲染内核，三形态共享的单一事实来源。
 * 功能实现（Markdown 渲染 / sanitize / 导航 / 索引）在 Phase 1 落地。
 * 此处先导出包级标识，供 monorepo 与契约测试验证结构。
 */
export const rendererVersion = "0.1.0";

export interface RenderOptions {
  /** 是否为 SSG/构建产物形态（影响相对链接与输出格式） */
  ssg?: boolean;
}

export function render(_markdown: string, _options: RenderOptions = {}): string {
  // Phase 1 实现：marked + DOMPurify 渲染管线
  return "";
}
