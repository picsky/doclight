/**
 * token 估算测试（AEO-001，packages/cli/src/tokens.ts）
 */
import { describe, expect, it } from "vitest";
import { estimateTokens, totalTokens } from "../src/tokens.ts";

describe("estimateTokens（AEO-001 token 计数启发式）", () => {
  it("英文文本按词估算（~1.3 token/词，上取整）", () => {
    // "hello world" = 2 词 → ceil(2.6) = 3
    expect(estimateTokens("hello world")).toBe(3);
  });

  it("中文文本按字估算（0.75 token/字，上取整）", () => {
    // 4 个中文字 → ceil(3) = 3
    expect(estimateTokens("中文测试")).toBe(3);
  });

  it("中英混合累加", () => {
    // 2 中文字（1.5）+ 1 英文词（1.3）→ ceil(2.8) = 3
    expect(estimateTokens("中文 doclight")).toBe(3);
  });

  it("空文本至少 1（避免误导为零成本）", () => {
    expect(estimateTokens("")).toBe(1);
    expect(estimateTokens("   ")).toBe(1);
  });

  it("代码块同样计入（含标点符号稀释在词数里）", () => {
    const code = "const x = 1;\nfunction add(a, b) { return a + b; }";
    expect(estimateTokens(code)).toBeGreaterThan(1);
  });

  it("totalTokens 累加多篇", () => {
    expect(totalTokens(["hello", "world"])).toBe(4); // 2 + 2
    expect(totalTokens([])).toBe(0);
    expect(totalTokens(["中文", undefined])).toBe(2); // 2 字 → ceil(1.5) = 2
  });
});
