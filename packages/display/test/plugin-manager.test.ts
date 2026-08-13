/**
 * 插件管理器测试（PLUG-004，07 §7.2 浏览器端纯逻辑）
 *
 * 覆盖：use/register/remove、init 生命周期、notifyMount/notifyRouteChange、destroy
 * 无 DOM 依赖（路由钩子 / 事件总线均为纯逻辑对象）。
 */
import { describe, expect, it, vi } from "vitest";
import { PluginManager } from "../src/plugin-manager.ts";
import type { PluginDef } from "../../core/src/plugin.ts";

describe("PluginManager（PLUG-004 展示层插件管理）", () => {
  it("use 注册 + registered 列表", () => {
    const mgr = new PluginManager();
    const p: PluginDef = { name: "test-plugin", version: "1.0.0" };
    mgr.use(p);
    expect(mgr.registered).toEqual([p]);
  });

  it("use 防重复（同名插件只注册一次）", () => {
    const mgr = new PluginManager();
    const p: PluginDef = { name: "dup" };
    mgr.use(p);
    mgr.use(p);
    expect(mgr.registered.length).toBe(1);
  });

  it("remove 卸载插件 + 调用 destroy", () => {
    const mgr = new PluginManager();
    const destroy = vi.fn();
    mgr.use({ name: "removable", destroy });
    mgr.remove("removable");
    expect(destroy).toHaveBeenCalled();
    expect(mgr.registered.length).toBe(0);
  });

  it("initApp 调用各插件 init + 返回 AppApi", () => {
    const mgr = new PluginManager();
    const initFn = vi.fn();
    mgr.use({ name: "init-test", init: initFn });
    const api = mgr.initApp();
    expect(initFn).toHaveBeenCalledWith(api);
    expect(typeof api.navigate).toBe("function");
    expect(typeof api.insertSlot).toBe("function");
    expect(typeof api.on).toBe("function");
  });

  it("延迟注册的插件：initApp 后立即调用 init", () => {
    const mgr = new PluginManager();
    mgr.initApp(); // 先初始化
    const initFn = vi.fn();
    mgr.use({ name: "late", init: initFn });
    expect(initFn).toHaveBeenCalled();
  });

  it("notifyMount 调用各插件 onMount", () => {
    const mgr = new PluginManager();
    const mountFn = vi.fn();
    mgr.use({ name: "m", onMount: mountFn });
    mgr.initApp();
    mgr.notifyMount();
    expect(mountFn).toHaveBeenCalled();
  });

  it("notifyRouteChange 返回 false 取消导航", () => {
    const mgr = new PluginManager();
    mgr.use({ name: "blocker", onRouteChange: () => false });
    mgr.initApp();
    expect(mgr.notifyRouteChange("/blocked")).toBe(false);
  });

  it("notifyRouteChange 返回字符串重定向", () => {
    const mgr = new PluginManager();
    mgr.use({ name: "redirect", onRouteChange: () => "/login" });
    mgr.initApp();
    expect(mgr.notifyRouteChange("/admin")).toBe("/login");
  });

  it("单插件异常不中断其余", () => {
    const mgr = new PluginManager();
    const goodMount = vi.fn();
    mgr.use({ name: "bad", onMount: () => { throw new Error("boom"); } });
    mgr.use({ name: "good", onMount: goodMount });
    mgr.initApp();
    mgr.notifyMount();
    expect(goodMount).toHaveBeenCalled();
  });

  it("destroy 清理全部插件 + 调用各插件 destroy", () => {
    const mgr = new PluginManager();
    const d1 = vi.fn();
    const d2 = vi.fn();
    mgr.use({ name: "a", destroy: d1 });
    mgr.use({ name: "b", destroy: d2 });
    mgr.initApp();
    mgr.destroy();
    expect(d1).toHaveBeenCalled();
    expect(d2).toHaveBeenCalled();
    expect(mgr.registered.length).toBe(0);
  });

  it("pluginSlotApi 提供带名插槽操作", () => {
    const mgr = new PluginManager();
    const api = mgr.pluginSlotApi("my-plugin");
    api.insertSlot("footer", "<div>footer content</div>");
    expect(mgr.slotMgr.renderHtml("footer", { path: "/" })).toBe("<div>footer content</div>");
    api.removeSlot("footer");
    expect(mgr.slotMgr.renderHtml("footer", { path: "/" })).toBe("");
  });
});
