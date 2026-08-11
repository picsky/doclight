import { describe, expect, it } from "vitest";
import { SUPPORTED_FORMS } from "../src/index.ts";
import type { DocLightConfig } from "../src/index.ts";

describe("doclight-core 公共类型与常量（Phase 0）", () => {
  it("三形态产物常量完整且有序", () => {
    expect(SUPPORTED_FORMS).toEqual(["dev", "ssg", "bundle"]);
  });

  it("DocLightConfig 类型可承载最小配置", () => {
    const config: DocLightConfig = { title: "test", theme: "minimal" };
    expect(config.title).toBe("test");
  });
});
