import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../src/core/frontmatter.ts";

describe("frontmatter 解析（REND-001）", () => {
  it("解析标量字段", () => {
    const { frontmatter, body } = parseFrontmatter(
      "---\ntitle: 快速开始\nsummary: 5 分钟上手\n---\n\n# 正文"
    );
    expect(frontmatter.title).toBe("快速开始");
    expect(frontmatter.summary).toBe("5 分钟上手");
    expect(body).toBe("# 正文");
  });

  it("解析数组 / 数字 / 布尔 / 引号字符串", () => {
    const { frontmatter } = parseFrontmatter(
      "---\ntags: [入门, 安装]\ndifficulty: beginner\nwordCount: 1200\npublished: true\nquoted: \"带: 冒号的值\"\n---\n\n正文"
    );
    expect(frontmatter.tags).toEqual(["入门", "安装"]);
    expect(frontmatter.difficulty).toBe("beginner");
    expect(frontmatter.wordCount).toBe(1200);
    expect(frontmatter.published).toBe(true);
    expect(frontmatter.quoted).toBe("带: 冒号的值");
  });

  it("无 frontmatter 返回空对象与原文", () => {
    const { frontmatter, body } = parseFrontmatter("# 只有标题");
    expect(frontmatter).toEqual({});
    expect(body).toBe("# 只有标题");
  });

  it("空 frontmatter 块正常处理", () => {
    const { frontmatter, body } = parseFrontmatter("---\n---\n# 内容");
    expect(frontmatter).toEqual({});
    expect(body.trim()).toBe("# 内容");
  });

  it("跳过注释与空行", () => {
    const { frontmatter } = parseFrontmatter("---\n# 注释\n\nkey: value\n---\n");
    expect(frontmatter).toEqual({ key: "value" });
  });
});
