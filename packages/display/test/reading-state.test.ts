/**
 * DP-003 阅读状态感测试（Phase 7，18-design-polish §3.3）：
 * 相对时间文案 / 完成度文案 / 继续阅读文案 / meta 阅读时长解析 / 位置键归一 / TOC 已读集合。
 */
import { describe, expect, it } from "vitest";
import { parseReadingTime, readStatusText, readingKey, relativeTimeText, resumeText } from "../src/reading.ts";
import { readTocVisited, tocReadKey } from "../src/toc.ts";

describe("DP-003 阅读状态感（纯函数）", () => {
  it("relativeTimeText：分钟/小时/天/超 30 天", () => {
    const now = new Date("2026-08-16T12:00:00Z");
    expect(relativeTimeText("2026-08-16T11:59:30Z", now)).toBe("刚刚更新");
    expect(relativeTimeText("2026-08-16T11:40:00Z", now)).toBe("20 分钟前更新");
    expect(relativeTimeText("2026-08-16T07:00:00Z", now)).toBe("5 小时前更新");
    expect(relativeTimeText("2026-08-13T12:00:00Z", now)).toBe("3 天前更新");
    expect(relativeTimeText("2026-05-01T00:00:00Z", now)).toBe(""); // 超 30 天保留绝对日期
    expect(relativeTimeText("invalid", now)).toBe("");
    expect(relativeTimeText("2026-09-01T00:00:00Z", now)).toBe(""); // 未来时间不显示相对
  });

  it("readStatusText：剩余 ≥1 分钟才显示「约剩」", () => {
    expect(readStatusText(50, 8)).toBe("已读 50% · 约剩 4 分钟");
    expect(readStatusText(95, 8)).toBe("已读 95%");
    expect(readStatusText(120, 8)).toBe("已读 100%");
    expect(readStatusText(-5, 8)).toBe("已读 0% · 约剩 8 分钟");
    expect(readStatusText(0, 0)).toBe("已读 0%");
  });

  it("resumeText / parseReadingTime", () => {
    expect(resumeText(62)).toBe("继续阅读 · 上次读到 62%");
    expect(resumeText(150)).toBe("继续阅读 · 上次读到 100%");
    expect(parseReadingTime("最后更新于 2026 年 8 月 16 日·约 4 分钟阅读·123 字")).toBe(4);
    expect(parseReadingTime("没有时长信息")).toBe(0);
  });

  it("readingKey：路径归一（查询/锚点剥离、根归一）", () => {
    expect(readingKey("/guide/start.html#sec")).toBe("doclight-pos-/guide/start.html");
    expect(readingKey("/guide/start?q=1")).toBe("doclight-pos-/guide/start");
    expect(readingKey("/")).toBe("doclight-pos-/");
    expect(readingKey("")).toBe("doclight-pos-/");
  });

  it("tocReadKey / readTocVisited：持久化集合解析 + 异常降级", () => {
    expect(tocReadKey("/guide/a")).toBe("doclight-toc-read-/guide/a");
    const storage = {
      getItem(k: string) {
        return k === "k-good" ? JSON.stringify(["a", "b"]) : k === "k-bad" ? "{not json" : null;
      },
    };
    expect([...readTocVisited(storage, "k-good")]).toEqual(["a", "b"]);
    expect(readTocVisited(storage, "k-bad").size).toBe(0);
    expect(readTocVisited(storage, "k-none").size).toBe(0);
  });
});
