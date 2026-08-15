/**
 * 展示层插件管理器（PLUG-004，07 §7.2-7.3 浏览器端）
 *
 * 管理插件的注册、生命周期钩子调用、卸载。与事件总线 + 路由钩子 + 插槽系统集成。
 *
 * 生命周期（07 §7.2；2026-08 H1 修复后——onRouteChange 是路由前置守卫，
 * 返回 false 取消 / 返回字符串重定向，onMount 在内容注入完成后）：
 *   register(plugin) → init(app) → [onRouteChange(path) → onMount(app)]* → destroy()
 *
 * 插件通过 doclight.use() 注册（07 §7.5）。支持三种形式：
 * - 函数：等同于 beforeRender 钩子（简写形式，展示层不支持构建时钩子，忽略）
 * - 对象：完整 PluginDef（name + hooks）
 * - 工厂函数返回值：带 config 的 PluginDef
 *
 * 与现有系统集成：
 * - 路由钩子：注册 beforeEach（onRouteChange 返回 false 取消导航）
 * - 事件总线：mount 完成后 emit("doclight:plugin:ready")，路由变化 emit("doclight:routechange")
 * - 插槽：init 时插件可调用 insertSlot 注入内容，路由变化后重新渲染动态插槽
 *
 * 体积门禁（ADR-0002）：本模块 < 2KB gzip，不进 vendor（纯逻辑无外部依赖）。
 */
import { bus, type Unsubscribe } from "./event-bus.ts";
import { SlotManager } from "./slots.ts";
import type { AppApi, PluginDef } from "../../core/src/plugin.ts";

export interface PluginManagerOptions {
  /** 路由导航函数（注入 router.navigate） */
  navigate?: (url: string, replace?: boolean) => Promise<void>;
  /** 获取当前路径 */
  currentPath?: () => string;
  /** 获取当前页 frontmatter */
  currentFrontmatter?: () => Record<string, unknown>;
  /** 注册路由前置守卫（mount 时注入 router.beforeEach——
   *  2026-08 H1 修复：onRouteChange 取消/重定向契约真正接入导航决策链） */
  registerRouteGuard?: (guard: (path: string) => boolean | string | void) => void;
}

/**
 * PLUG-014 运行时配置自动注册：按窗口注入的插件配置注册浏览器端钩子
 * （doclight.json plugins → 构建时注入 window.DOCLIGHT_PLUGIN_CONFIGS →
 * 页面脚本挂 window.DOCLIGHT_PLUGINS 定义表 → 本函数接线 init/onMount）。
 *
 * 规则：
 * - enabled:false 跳过；无运行时定义（外部 npm 插件包——构建时钩子已生效）静默跳过；
 * - 定义表命中则 use({ ...def, name, config })，doclight.json 显式 config 覆盖插件默认；
 * - 返回实际注册的插件名（调试/测试用）。
 * 纯函数（无 DOM/全局依赖），可单测。
 */
export function registerConfiguredPlugins(
  configs: Array<{ name: string; config?: Record<string, unknown>; enabled?: boolean }> | undefined,
  defs: Record<string, PluginDef> | undefined,
  use: (plugin: PluginDef) => void
): string[] {
  const registered: string[] = [];
  if (!Array.isArray(configs)) return registered;
  for (const cfg of configs) {
    if (cfg.enabled === false || !cfg.name) continue;
    const def = defs?.[cfg.name];
    if (!def) continue;
    use({ ...def, name: cfg.name, config: cfg.config ?? def.config });
    registered.push(cfg.name);
  }
  return registered;
}

export class PluginManager {
  private plugins: PluginDef[] = [];
  private appApi: AppApi | null = null;
  private slotManager: SlotManager;
  private routeUnsub: Unsubscribe | null = null;
  private opts: PluginManagerOptions;

  constructor(opts: PluginManagerOptions = {}) {
    this.opts = opts;
    this.slotManager = new SlotManager();
  }

  /** 注入运行时依赖（mount 时调用；可重复调用合并 opts——替换早期 ["opts"] 私有越界写入） */
  configure(opts: PluginManagerOptions): void {
    this.opts = { ...this.opts, ...opts };
  }

  /** 注册插件（07 §7.5 doclight.use()） */
  use(plugin: PluginDef): void {
    if (this.plugins.some((p) => p.name === plugin.name)) return; // 防重复
    this.plugins.push(plugin);
    // 已初始化则立即调用 init
    if (this.appApi && plugin.init) {
      try {
        plugin.init(this.appApi);
      } catch {
        /* 单插件 init 异常不中断其余 */
      }
    }
  }

  /** 卸载插件（调用 destroy + 清除插槽） */
  remove(name: string): void {
    const idx = this.plugins.findIndex((p) => p.name === name);
    if (idx < 0) return;
    const plugin = this.plugins[idx]!;
    try {
      plugin.destroy?.();
    } catch {
      /* 清理异常不中断 */
    }
    this.slotManager.removeAll(name);
    this.plugins.splice(idx, 1);
  }

  /** 初始化：构建 AppApi + 注册路由守卫 + 调用各插件 init */
  initApp(): AppApi {
    const api: AppApi = {
      insertSlot: (slotName: string, content: string | HTMLElement | ((ctx: { path: string }) => string)) => {
        // 无插件名上下文时以 "anonymous" 为 id
        this.slotManager.insert(slotName, "anonymous", content);
      },
      removeSlot: (slotName: string) => {
        this.slotManager.remove(slotName, "anonymous");
      },
      navigate: (url, replace) => (this.opts.navigate ? this.opts.navigate(url, replace) : Promise.resolve()),
      currentPath: () => (this.opts.currentPath ? this.opts.currentPath() : "/"),
      currentFrontmatter: () => (this.opts.currentFrontmatter ? this.opts.currentFrontmatter() : {}),
      on: (event, handler) => bus.on(event, handler),
      emit: (event, payload) => bus.emit(event, payload),
    };
    this.appApi = api;

    // 2026-08 H1 修复：onRouteChange 契约接入路由 beforeEach 决策链——
    // 返回 false 取消导航 / 返回字符串重定向（此前事件在 pushState 后发出、返回值被丢弃，
    // 插件永远无法取消/重定向）
    this.opts.registerRouteGuard?.((path: string) => this.notifyRouteChange(path));

    // 调用各插件 init
    for (const plugin of this.plugins) {
      if (plugin.init) {
        try {
          plugin.init(api);
        } catch {
          /* 单插件异常隔离 */
        }
      }
    }

    return api;
  }

  /** 为指定插件提供带名插槽 API（插件可通过此获取带自身名的 insert/remove） */
  pluginSlotApi(pluginName: string): Pick<AppApi, "insertSlot" | "removeSlot"> {
    return {
      insertSlot: (slotName: string, content: string | HTMLElement | ((ctx: { path: string }) => string)) => {
        this.slotManager.insert(slotName, pluginName, content);
      },
      removeSlot: (slotName: string) => {
        this.slotManager.remove(slotName, pluginName);
      },
    };
  }

  /** 页面挂载完成通知（router 初次加载 / SPA 导航后调用） */
  notifyMount(): void {
    if (!this.appApi) return;
    for (const plugin of this.plugins) {
      try {
        plugin.onMount?.(this.appApi);
      } catch {
        /* 单插件异常隔离 */
      }
    }
    // 重新渲染动态插槽
    this.slotManager.renderToDom({ path: this.opts.currentPath?.() ?? "/" });
  }

  /** 路由变化通知（router beforeEach 链中调用） */
  notifyRouteChange(path: string): boolean | string | void {
    if (!this.appApi) return;
    for (const plugin of this.plugins) {
      const result = plugin.onRouteChange?.(path, this.appApi);
      if (result === false) return false; // 取消导航
      if (typeof result === "string") return result; // 重定向
    }
  }

  /** 订阅路由变化事件（bus 集成，mount 后调用一次）。
   *  2026-08 H1 修复：onRouteChange 已由路由 beforeEach 决策链执行（可取消/重定向），
   *  此处只做导航完成后的副作用——插槽重渲染 + onMount（新页面内容已注入）。 */
  subscribeRouteChange(): void {
    this.routeUnsub = bus.on("doclight:routechange", (payload) => {
      const ctx = payload as { to?: string } | undefined;
      if (ctx?.to) {
        // 路由变化后重新渲染动态插槽
        this.slotManager.renderToDom({ path: ctx.to });
        // 通知各插件 onMount（新页面内容已注入）
        for (const plugin of this.plugins) {
          try {
            plugin.onMount?.(this.appApi!);
          } catch {
            /* 单插件异常隔离 */
          }
        }
      }
    });
  }

  /** 销毁全部插件 + 清理订阅 */
  destroy(): void {
    this.routeUnsub?.();
    this.routeUnsub = null;
    for (const plugin of this.plugins) {
      try {
        plugin.destroy?.();
      } catch {
        /* 清理异常不中断 */
      }
    }
    this.plugins = [];
    this.slotManager.clear();
    this.appApi = null;
  }

  /** 获取插槽管理器（供 mount 函数集成） */
  get slotMgr(): SlotManager {
    return this.slotManager;
  }

  /** 获取已注册插件列表（调试/测试用） */
  get registered(): readonly PluginDef[] {
    return this.plugins;
  }
}
