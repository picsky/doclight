import { describe, expect, it, vi } from "vitest";
import { bundlePageKey, isInternalLink, navTargetPath, resolveBeforeHooks, type BeforeHook } from "../src/router.ts";

describe("路由内部链接判定（展示层最简骨架）", () => {
  const base = "http://localhost:3000/";

  it("站内相对链接为内部", () => {
    expect(isInternalLink("/guide/quickstart.md", base)).toBe(true);
    expect(isInternalLink("guide/quickstart.md", base)).toBe(true);
    expect(isInternalLink("/", base)).toBe(true);
  });

  it("外部链接 / 锚点 / 协议非内部", () => {
    expect(isInternalLink("https://example.com", base)).toBe(false);
    expect(isInternalLink("//example.com/x", base)).toBe(false);
    expect(isInternalLink("#section", base)).toBe(false);
    expect(isInternalLink("mailto:a@b.com", base)).toBe(false);
    expect(isInternalLink("javascript:alert(1)", base)).toBe(false);
  });

  it("空值安全", () => {
    expect(isInternalLink(null, base)).toBe(false);
    expect(isInternalLink(undefined, base)).toBe(false);
    expect(isInternalLink("", base)).toBe(false);
  });
});

describe("路由钩子决策（PLUG-002，03 §3.2.4）", () => {
  const ctx = { from: "/a.md", to: "/b.md", replace: false };

  it("全部钩子不返回 → continue", () => {
    const hooks: BeforeHook[] = [() => {}, () => undefined];
    expect(resolveBeforeHooks(hooks, ctx)).toEqual({ action: "continue" });
  });

  it("任一钩子返回 false → cancel（取消导航）", () => {
    const hooks: BeforeHook[] = [() => undefined, () => false, () => undefined];
    expect(resolveBeforeHooks(hooks, ctx)).toEqual({ action: "cancel" });
  });

  it("钩子返回字符串 → redirect 到目标路径", () => {
    const hooks: BeforeHook[] = [() => "/login.md"];
    expect(resolveBeforeHooks(hooks, ctx)).toEqual({ action: "redirect", to: "/login.md" });
  });

  it("cancel 优先于后续 redirect（短路）", () => {
    const hooks: BeforeHook[] = [() => false, () => "/login.md"];
    expect(resolveBeforeHooks(hooks, ctx)).toEqual({ action: "cancel" });
  });

  it("钩子按注册顺序执行", () => {
    const order: number[] = [];
    const hooks: BeforeHook[] = [
      () => {
        order.push(1);
      },
      () => {
        order.push(2);
      },
      () => {
        order.push(3);
      },
    ];
    resolveBeforeHooks(hooks, ctx);
    expect(order).toEqual([1, 2, 3]);
  });

  it("无钩子时直接 continue", () => {
    expect(resolveBeforeHooks([], ctx)).toEqual({ action: "continue" });
  });

  it("钩子可读取路由上下文", () => {
    const spy = vi.fn(() => undefined);
    resolveBeforeHooks([spy], ctx);
    expect(spy).toHaveBeenCalledWith(ctx);
  });
});

describe("navTargetPath（2026-08 中文路径激活态修复：百分号解码 + base 剥离 + 归一）", () => {
  const base = "http://localhost:3000/";

  it("百分号编码 URL 与解码 data-path 归一一致（中文目录）", () => {
    // URL.pathname 为编码形态（/%E8%AF%AD%E6%B3%95/...），data-path 为解码形态（语法/...）
    expect(navTargetPath("/%E8%AF%AD%E6%B3%95/mermaid.md", base, "")).toBe("语法/mermaid");
    // 浏览器 URL 构造器对非 ASCII 自动编码，两种输入必须收敛到同一目标
    expect(navTargetPath("/语法/mermaid.md", base, "")).toBe("语法/mermaid");
  });

  it("dev .md / SSG .html 后缀归一", () => {
    expect(navTargetPath("/guide/start.md", base, "")).toBe("guide/start");
    expect(navTargetPath("/guide/start.html", base, "")).toBe("guide/start");
    expect(navTargetPath("/guide/start.html?q=1#sec", base, "")).toBe("guide/start");
  });

  it("子路径部署（--base）：剥 DOCLIGHT_BASE 前缀", () => {
    expect(navTargetPath("/repo/%E8%AF%AD%E6%B3%95/a.md", "http://x/repo/", "/repo")).toBe("语法/a");
  });

  it("bundle hash 路由（#/路径，.html）", () => {
    expect(navTargetPath("http://localhost:3000/#/%E8%AF%AD%E6%B3%95/a.html", base, "")).toBe("语法/a");
  });

  it("根 / 空路径收敛为首页", () => {
    expect(navTargetPath("/", base, "")).toBe("/");
    expect(navTargetPath("", base, "")).toBe("/");
    expect(navTargetPath("#/", base, "")).toBe("/");
  });

  it("异常 URL 安全回退到首页", () => {
    expect(navTargetPath("http://[", base, "")).toBe("/"); // 非法 URL 解析抛错 → "/"
  });
});

describe("bundle 形态内嵌数据键归一（CLI-002，05 §5.3.4 hash 路由）", () => {
  it("hash / 路径归一为带前导斜杠的页面键", () => {
    expect(bundlePageKey("#/guide/start.html")).toBe("/guide/start.html");
    expect(bundlePageKey("/guide/start.html")).toBe("/guide/start.html");
    expect(bundlePageKey("guide/start.html")).toBe("/guide/start.html");
  });

  it("空 / 根路径收敛为首页", () => {
    expect(bundlePageKey("")).toBe("/");
    expect(bundlePageKey("#")).toBe("/");
    expect(bundlePageKey("/")).toBe("/");
    expect(bundlePageKey("#/")).toBe("/");
  });

  it("剥离查询串", () => {
    expect(bundlePageKey("/guide/start.html?q=1")).toBe("/guide/start.html");
    expect(bundlePageKey("#/guide/start.html?q=1")).toBe("/guide/start.html");
  });

  it("TOC 锚点（非 #/ 前缀）不当作页面键冲突处理", () => {
    expect(bundlePageKey("#安装")).toBe("/安装"); // 无对应页面 → 查不到即不导航
  });
});
