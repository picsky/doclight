/**
 * 事件总线（07 §7 插件通信用，PLUG-001）
 *
 * 轻量发布/订阅：模块与插件通过 on() 订阅、emit() 发布，解耦通信。
 * 纯逻辑无 DOM 依赖，可在 Node 中测试。
 * 设计原则（07 §7.1）：简单到 Agent 也能写——订阅返回退订函数（destroy 钩子友好）。
 */

export type EventHandler = (payload: unknown) => void;

/** 退订函数：调用即取消订阅（插件 destroy() 时调用） */
export type Unsubscribe = () => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  /** 订阅事件，返回退订函数 */
  on(event: string, handler: EventHandler): Unsubscribe {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  /** 取消订阅 */
  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  /** 发布事件：同步按订阅顺序调用；单个订阅者异常隔离，不中断其余订阅者 */
  emit(event: string, payload?: unknown): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch {
        /* 隔离单个订阅者的异常 */
      }
    }
  }

  /** 清空全部订阅 */
  clear(): void {
    this.handlers.clear();
  }
}

/** 全局单例（展示层内部与插件共用） */
export const bus = new EventBus();
