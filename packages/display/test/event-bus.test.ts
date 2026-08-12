import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../src/event-bus.ts";

describe("事件总线（PLUG-001，插件通信用）", () => {
  it("订阅与发布：按订阅顺序同步调用", () => {
    const bus = new EventBus();
    const calls: number[] = [];
    bus.on("e", () => calls.push(1));
    bus.on("e", () => calls.push(2));
    bus.emit("e");
    expect(calls).toEqual([1, 2]);
  });

  it("emit 携带 payload", () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on("e", fn);
    bus.emit("e", { from: "/a", to: "/b" });
    expect(fn).toHaveBeenCalledWith({ from: "/a", to: "/b" });
  });

  it("未订阅的事件发布无副作用", () => {
    const bus = new EventBus();
    expect(() => bus.emit("nothing")).not.toThrow();
  });

  it("off 取消订阅后不再触发", () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on("e", fn);
    bus.off("e", fn);
    bus.emit("e");
    expect(fn).not.toHaveBeenCalled();
  });

  it("on 返回退订函数（插件 destroy 钩子友好）", () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const off = bus.on("e", fn);
    off();
    bus.emit("e");
    expect(fn).not.toHaveBeenCalled();
  });

  it("单个订阅者异常不影响其他订阅者（隔离）", () => {
    const bus = new EventBus();
    const good = vi.fn();
    bus.on("e", () => {
      throw new Error("boom");
    });
    bus.on("e", good);
    expect(() => bus.emit("e")).not.toThrow();
    expect(good).toHaveBeenCalled();
  });

  it("clear 清空全部订阅", () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on("e", fn);
    bus.clear();
    bus.emit("e");
    expect(fn).not.toHaveBeenCalled();
  });
});
