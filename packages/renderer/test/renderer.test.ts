import { describe, expect, it } from "vitest";
import { render, rendererVersion } from "../src/index.ts";

describe("doclight-renderer 结构占位（Phase 0）", () => {
  it("导出包版本号", () => {
    expect(rendererVersion).toBe("0.1.0");
  });

  it("render 占位返回空字符串（Phase 1 实现渲染管线）", () => {
    expect(render("# hello")).toBe("");
  });
});
