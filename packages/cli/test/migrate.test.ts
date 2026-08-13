import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateDocsify, parseSidebar } from "../src/migrate.ts";

function tmpDocsify(): string {
  const d = mkdtempSync(join(tmpdir(), "doclight-migrate-"));
  mkdirSync(join(d, "guide"), { recursive: true });
  return d;
}

describe("parseSidebar（CLI-004 docsify _sidebar 解析）", () => {
  it("提取有序链接路径，去重保序", () => {
    const text = [
      "- [快速开始](guide/quickstart.md)",
      "- 指南",
      "  - [安装](guide/install.md)",
      "- [FAQ](faq.md)",
      "- [重复](faq.md)",
    ].join("\n");
    expect(parseSidebar(text)).toEqual(["guide/quickstart.md", "guide/install.md", "faq.md"]);
  });

  it("忽略锚点片段与空项", () => {
    expect(parseSidebar("- [a](a.md#section)\n- 纯文本组\n")).toEqual(["a.md"]);
  });
});

describe("migrateDocsify（CLI-004 基本迁移）", () => {
  it("复制 .md 保持结构，跳过 docsify 专属文件", () => {
    const src = tmpDocsify();
    writeFileSync(join(src, "README.md"), "# 首页");
    writeFileSync(join(src, "guide", "quickstart.md"), "# 快速开始");
    writeFileSync(join(src, "_sidebar.md"), "- [快速开始](guide/quickstart.md)");
    writeFileSync(join(src, "_navbar.md"), "- [GitHub](https://github.com)");
    writeFileSync(join(src, "index.html"), "<html>docsify</html>");
    const dest = mkdtempSync(join(tmpdir(), "doclight-migrate-dest-"));

    const result = migrateDocsify({ sourceDir: src, destDir: dest, docsRel: "docs" });

    expect(result.copied.sort()).toEqual(["README.md", "guide/quickstart.md"]);
    expect(result.skipped).toContain("_sidebar.md");
    expect(result.skipped).toContain("_navbar.md");
    expect(result.sidebar).toEqual(["guide/quickstart.md"]);
    expect(readFileSync(join(dest, "docs", "guide", "quickstart.md"), "utf8")).toBe("# 快速开始");
    expect(existsSync(join(dest, "docs", "_sidebar.md"))).toBe(false);
    expect(existsSync(join(dest, "docs", "index.html"))).toBe(false);
    rmSync(src, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  });

  it("幂等：目标已存在文件不覆盖", () => {
    const src = tmpDocsify();
    writeFileSync(join(src, "README.md"), "# v1");
    const dest = mkdtempSync(join(tmpdir(), "doclight-migrate-dest2-"));
    migrateDocsify({ sourceDir: src, destDir: dest });
    // 修改源后二次迁移：目标仍是 v1（幂等不覆盖）
    writeFileSync(join(src, "README.md"), "# v2");
    const second = migrateDocsify({ sourceDir: src, destDir: dest });
    expect(second.copied).toEqual([]);
    expect(readFileSync(join(dest, "docs", "README.md"), "utf8")).toBe("# v1");
    rmSync(src, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  });
});
