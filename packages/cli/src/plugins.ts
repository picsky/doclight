/**
 * 构建管线插件集成（PLUG-006，07 §7.3 Node 端）
 *
 * 管理构建时钩子的执行：beforeRender（正向链）→ marked 渲染 → afterRender（反向链）。
 * 同时收集 addSearchFields、slotContent 与 extendMarked 扩展（collectMarkedExtensions）。
 *
 * 设计：BuildPluginPipeline 接收 PluginDef[]，提供：
 * - runBeforeRender(md, ctx) → string（正向链式变换）
 * - runAfterRender(html, ctx) → string（反向链式变换）
 * - collectMarkedExtensions() → unknown[]（收集各插件 marked 扩展，供渲染内核挂载）
 * - collectSearchFields(doc) → Record<string, string>（合并各插件字段）
 * - collectSlotContent(ctx) → Record<string, string>（合并各插件插槽内容）
 *
 * 纯函数 + 状态无关：可在 Node 测试中直接断言。
 */
import type {
  BuildContext,
  BuildFile,
  MarkedExtender,
  PluginDef,
  PluginVendorFile,
  RenderContext,
  SearchDoc,
} from "../../core/src/plugin.ts";

export class BuildPluginPipeline {
  constructor(private plugins: PluginDef[] = []) {}

  /**
   * 热重载（PLUG-011）：整体替换插件列表。
   * dev 插件文件变更后重新解析 → 替换——旧插件不再参与任何钩子（完整清理，
   * 无残留引用）；运行时侧由浏览器整页刷新完成全清理（SSE reload）。
   */
  setPlugins(plugins: PluginDef[]): void {
    this.plugins = plugins;
  }

  /** 当前管线中的插件定义（CAP-001：capabilities.json 的 plugins 段数据源） */
  listPlugins(): PluginDef[] {
    return [...this.plugins];
  }

  /** 正向链：beforeRender（A → B → marked） */
  runBeforeRender(md: string, ctx: RenderContext): string {
    let result = md;
    for (const p of this.plugins) {
      if (p.beforeRender) {
        try {
          result = p.beforeRender(result, ctx);
        } catch {
          /* 单插件异常不中断管线 */
        }
      }
    }
    return result;
  }

  /** 反向链：afterRender（marked → B → A） */
  runAfterRender(html: string, ctx: RenderContext): string {
    let result = html;
    for (let i = this.plugins.length - 1; i >= 0; i--) {
      const p = this.plugins[i]!;
      if (p.afterRender) {
        try {
          result = p.afterRender(result, ctx);
        } catch {
          /* 单插件异常不中断管线 */
        }
      }
    }
    return result;
  }

  /**
   * 收集各插件的 marked 扩展（PLUG-006 接线修复）
   *
   * 渲染内核每次调用新建 Marked 实例（markdown.ts），插件无法在渲染前原地扩展实例，
   * 因此 extendMarked 收到 MarkedExtender 收集器：use() 注册的扩展在此收拢，
   * 返回数组供 render(extraMarkedExtensions) 统一挂载——每个插件贡献一个扩展数组。
   * 支持三种注册形态（向后兼容）：
   * - marked.use({ extensions: [...] }) 同形状
   * - use(单个扩展) / use(扩展数组)
   * - 钩子直接 return 扩展数组
   */
  collectMarkedExtensions(): unknown[] {
    const collected: unknown[] = [];
    for (const p of this.plugins) {
      if (!p.extendMarked) continue;
      const perPlugin: unknown[] = [];
      const collector: MarkedExtender = {
        use(extension: unknown): void {
          if (Array.isArray(extension)) {
            perPlugin.push(...extension);
          } else if (extension && typeof extension === "object" && "extensions" in (extension as Record<string, unknown>)) {
            const exts = (extension as { extensions?: unknown }).extensions;
            if (Array.isArray(exts)) perPlugin.push(...exts);
          } else if (extension) {
            perPlugin.push(extension);
          }
        },
      };
      try {
        const returned = p.extendMarked(collector);
        if (Array.isArray(returned)) perPlugin.push(...returned);
      } catch {
        /* 单插件异常不中断 */
      }
      if (perPlugin.length) collected.push(perPlugin);
    }
    return collected;
  }

  /** 收集搜索字段（合并各插件 addSearchFields 返回值） */
  collectSearchFields(doc: SearchDoc): Record<string, string> {
    const merged: Record<string, string> = {};
    for (const p of this.plugins) {
      if (p.addSearchFields) {
        try {
          const fields = p.addSearchFields(doc);
          if (fields && typeof fields === "object") {
            for (const [k, v] of Object.entries(fields)) {
              if (typeof v === "string") merged[k] = v;
            }
          }
        } catch {
          /* 单插件异常不中断 */
        }
      }
    }
    return merged;
  }

  /**
   * 收集插件 vendor 资源声明（PLUG-012 按需策略）。
   * 合并各插件 vendor 数组为 file → {pkg, rel} 映射（按文件名去重，首个命中胜出），
   * 供 dev server 端点 / SSG copyVendor / bundle --inline-vendor 三形态按需接线。
   */
  collectVendorFiles(): Record<string, PluginVendorFile> {
    const merged: Record<string, PluginVendorFile> = {};
    for (const p of this.plugins) {
      for (const v of p.vendor ?? []) {
        if (v && typeof v.file === "string" && typeof v.pkg === "string" && typeof v.rel === "string" && !(v.file in merged)) {
          merged[v.file] = v;
        }
      }
    }
    return merged;
  }

  /** 收集插件 CSS（合并各插件 styles 字符串，按注册顺序拼接；renderPage 注入 <style data-doclight-plugin-css>） */
  collectPluginStyles(): string {
    const parts: string[] = [];
    for (const p of this.plugins) {
      if (typeof p.styles === "string" && p.styles.trim()) parts.push(p.styles);
    }
    return parts.join("\n");
  }

  /** 收集构建时插槽内容（合并各插件 slotContent） */
  collectSlotContent(ctx: RenderContext): Record<string, string> {
    const merged: Record<string, string> = {};
    for (const p of this.plugins) {
      if (p.slotContent) {
        for (const [slot, content] of Object.entries(p.slotContent)) {
          const html = typeof content === "function" ? content(ctx) : content;
          if (html) {
            merged[slot] = (merged[slot] ?? "") + html;
          }
        }
      }
    }
    return merged;
  }

  /** 当前插件数量 */
  get size(): number {
    return this.plugins.length;
  }

  /**
   * 执行构建期文件产出钩子（PLUG-010）
   *
   * 所有文档渲染完成后调用一次：各插件 onBuild 返回 BuildFile[]（相对 outDir 的
   * 路径 + 内容），合并后由 build 写入产物目录——rss.xml / manifest.json / sw.js
   * 等站点级产物的唯一通道。非法项（非对象/缺 path 或 content）过滤，单插件异常不中断。
   */
  runOnBuild(ctx: BuildContext): BuildFile[] {
    const merged: BuildFile[] = [];
    for (const p of this.plugins) {
      if (!p.onBuild) continue;
      try {
        const files = p.onBuild(ctx);
        if (Array.isArray(files)) {
          for (const f of files) {
            if (f && typeof f === "object" && typeof f.path === "string" && typeof f.content === "string") {
              merged.push({ path: f.path, content: f.content });
            }
          }
        }
      } catch {
        /* 单插件异常不中断 */
      }
    }
    return merged;
  }
}
