/**
 * 插槽管理器（PLUG-005，07 §7.4 浏览器端）
 *
 * 管理 11 个命名插槽（07 §7.4.2）。每个插槽在 DOM 中有对应标记元素
 * （data-doclight-slot="<name>"），插件通过 insertSlot/removeSlot 增删内容。
 *
 * 构建时（SSG/dev）：模板在对应位置插入 <template data-doclight-slot="..."> 占位，
 * 构建管线将插件 slotContent 注入其中。
 * 运行时（display）：本管理器在 DOM 就绪后查询标记元素，将插件动态内容注入。
 *
 * 路由切换后重新渲染动态插槽（函数型内容重新执行），静态内容保持不变。
 */

/** 插入的内容条目 */
interface SlotEntry {
  /** 内容来源标识（通常为插件名） */
  id: string;
  /** 内容：HTML 字符串 / DOM 元素 / 函数（每次路由切换重新执行） */
  content: string | HTMLElement | ((ctx: { path: string }) => string);
}

/** 11 个标准插槽名（与 core/plugin.ts SLOT_NAMES 保持一致） */
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

/** 验证插槽名是否合法 */
function isValidSlot(name: string): name is SlotName {
  return (SLOT_NAMES as readonly string[]).includes(name);
}

export class SlotManager {
  /** 插槽名 → 内容条目列表 */
  private slots = new Map<string, SlotEntry[]>();

  /** 插入内容到命名插槽 */
  insert(slotName: string, id: string, content: SlotEntry["content"]): void {
    if (!isValidSlot(slotName)) return; // 非法插槽名静默忽略（容错）
    let entries = this.slots.get(slotName);
    if (!entries) {
      entries = [];
      this.slots.set(slotName, entries);
    }
    // 同一 id 不重复插入（幂等性）
    if (entries.some((e) => e.id === id)) return;
    entries.push({ id, content });
  }

  /** 移除某 id 在某插槽的内容 */
  remove(slotName: string, id: string): void {
    const entries = this.slots.get(slotName);
    if (!entries) return;
    const filtered = entries.filter((e) => e.id !== id);
    if (filtered.length === 0) this.slots.delete(slotName);
    else this.slots.set(slotName, filtered);
  }

  /** 移除某 id 在全部插槽的内容（插件 destroy 时调用） */
  removeAll(id: string): void {
    for (const [name, entries] of this.slots) {
      const filtered = entries.filter((e) => e.id !== id);
      if (filtered.length === 0) this.slots.delete(name);
      else this.slots.set(name, filtered);
    }
  }

  /** 获取某插槽全部内容的 HTML 字符串（当前路径上下文） */
  renderHtml(slotName: string, ctx: { path: string }): string {
    const entries = this.slots.get(slotName);
    if (!entries || entries.length === 0) return "";
    return entries
      .map((e) => {
        if (typeof e.content === "function") return e.content(ctx);
        if (typeof e.content === "string") return e.content;
        // DOM 元素 → outerHTML
        return e.content.outerHTML;
      })
      .join("");
  }

  /** 将内容渲染到 DOM 插槽标记中（路由切换后调用，重渲染函数型内容）。
   *  head 插槽标记为 <template>（2026-08 head 结构修复：head 内不允许 span，
   *  模板是 head 合法内容）：模板内容惰性不渲染，动态内容作为兄弟节点插入文档。 */
  renderToDom(ctx: { path: string }): void {
    if (typeof document === "undefined") return; // Node 测试环境跳过
    for (const slotName of SLOT_NAMES) {
      const marker = document.querySelector<HTMLElement>(`[data-doclight-slot="${slotName}"]`);
      if (!marker) continue;
      const dynamic = this.renderHtml(slotName, ctx);
      if (marker.tagName === "TEMPLATE") {
        const prev = marker.nextElementSibling;
        if (prev?.hasAttribute?.("data-doclight-dynamic")) prev.remove();
        if (dynamic) {
          const wrapper = document.createElement("span");
          wrapper.setAttribute("data-doclight-dynamic", "");
          wrapper.innerHTML = dynamic;
          marker.after(wrapper);
        }
        continue;
      }
      // 保留构建时注入的静态内容（data-doclight-static 标记），追加动态内容
      // 清除旧的动态内容（data-doclight-dynamic 标记的容器）
      const oldDynamic = marker.querySelector<HTMLElement>("[data-doclight-dynamic]");
      if (oldDynamic) oldDynamic.remove();
      if (dynamic) {
        const wrapper = document.createElement("span");
        wrapper.setAttribute("data-doclight-dynamic", "");
        wrapper.innerHTML = dynamic;
        marker.appendChild(wrapper);
      }
    }
  }

  /** 清空全部插槽（测试用） */
  clear(): void {
    this.slots.clear();
  }

  /** 获取某插槽条目数（测试/调试用） */
  size(slotName: string): number {
    return this.slots.get(slotName)?.length ?? 0;
  }
}
