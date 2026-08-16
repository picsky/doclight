/**
 * 图片错误降级测试（2026-08）
 *
 * node 环境（vitest environment: node，无 jsdom）下测纯函数 imageErrorHint；
 * DOM 接线（capture 阶段 document 级 error 监听 + replaceWith 占位）为薄层，
 * 由构建产物 class 断言与 e2e 浏览器矩阵覆盖。
 */
import { describe, expect, it } from "vitest";
import { imageErrorHint } from "../src/image.ts";

describe("imageErrorHint（图片失败占位提示文本）", () => {
  it("有 alt → 提示含 alt（读者可见失败对象）", () => {
    expect(imageErrorHint("图 1：基础组件生命周期")).toBe("图片加载失败：图 1：基础组件生命周期");
  });

  it("无 alt → 通用提示", () => {
    expect(imageErrorHint("")).toBe("图片加载失败");
  });
});
