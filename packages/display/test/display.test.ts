import { describe, expect, it } from "vitest";
import { displayVersion } from "../src/index.ts";

describe("@doclight/display 结构占位（Phase 0）", () => {
  it("导出包版本号", () => {
    expect(displayVersion).toBe("0.1.0");
  });
});
