import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  convertGitBookBlocks,
  convertMkDocsAdmonitions,
  migrateDocsify,
  migrateGitBook,
  migrateMkDocs,
  parseMkdocsConfig,
  parseMkdocsNav,
  parseSidebar,
} from "../src/migrate.ts";

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

describe("convertMkDocsAdmonitions（MkDocs admonition → DocLight 容器）", () => {
  it("映射常见类型并剥离 4 空格缩进", () => {
    const { text, converted, collapsed } = convertMkDocsAdmonitions(
      ["!!! note", "    这是提示内容", "", "!!! warning \"小心\"", "    危险内容", "!!! danger", "    错误内容"].join("\n")
    );
    expect(converted).toBe(3);
    expect(collapsed).toBe(0);
    expect(text).toContain(":::info\n这是提示内容\n:::");
    expect(text).toContain(":::warning\n小心\n\n危险内容\n:::");
    expect(text).toContain(":::danger\n错误内容\n:::");
  });

  it("折叠 admonition（???）降级为普通容器并计数", () => {
    const { text, collapsed } = convertMkDocsAdmonitions("??? note\n    折叠内容");
    expect(collapsed).toBe(1);
    expect(text).toContain(":::info\n折叠内容\n:::");
  });

  it("未映射类型原样保留（不硬转未知语法）", () => {
    const { text, converted } = convertMkDocsAdmonitions("!!! exotic-kind\n    x");
    expect(converted).toBe(0);
    expect(text).toContain("!!! exotic-kind");
  });
});

describe("parseMkdocsConfig / parseMkdocsNav（mkdocs.yml 解析）", () => {
  it("解析 docs_dir 与 site_name（缺省值）", () => {
    expect(parseMkdocsConfig("site_name: My Docs\ndocs_dir: content")).toEqual({ docsDir: "content", siteName: "My Docs" });
    expect(parseMkdocsConfig("theme: material")).toEqual({ docsDir: "docs", siteName: undefined });
  });

  it("解析 nav 列表为有序路径", () => {
    const yaml = ["nav:", "  - Home: index.md", "  - Guide:", "      - Start: guide/start.md", "      - FAQ: guide/faq.md"].join("\n");
    expect(parseMkdocsNav(yaml)).toEqual(["index.md", "guide/start.md", "guide/faq.md"]);
  });
});

describe("migrateMkDocs（MkDocs → DocLight）", () => {
  it("复制 docs/ 并转换 admonition，报告 site_name 建议", () => {
    const src = mkdtempSync(join(tmpdir(), "doclight-mkdocs-"));
    mkdirSync(join(src, "docs"), { recursive: true });
    writeFileSync(join(src, "mkdocs.yml"), "site_name: MK 文档\nnav:\n  - Home: index.md");
    writeFileSync(join(src, "docs", "index.md"), "!!! tip\n    提示内容");
    const dest = mkdtempSync(join(tmpdir(), "doclight-mkdocs-dest-"));

    const result = migrateMkDocs({ sourceDir: src, destDir: dest });
    expect(result.copied).toEqual(["index.md"]);
    expect(result.sidebar).toEqual(["index.md"]);
    expect(readFileSync(join(dest, "docs", "index.md"), "utf8")).toContain(":::tip\n提示内容\n:::");
    expect(result.notes.join("\n")).toContain("MK 文档");
    expect(result.notes.join("\n")).toContain("已转换 1 个 admonition");
    rmSync(src, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  });
});

describe("convertGitBookBlocks（GitBook hint/code → DocLight 语法）", () => {
  it("转换 hint 与 code 块", () => {
    const src = [
      "{% hint style=\"info\" %}",
      "信息内容",
      "{% endhint %}",
      "",
      "{% code title=\"hello.js\" %}",
      "console.log(1);",
      "{% endcode %}",
    ].join("\n");
    const { text, hints, codeBlocks } = convertGitBookBlocks(src);
    expect(hints).toBe(1);
    expect(codeBlocks).toBe(1);
    expect(text).toContain(":::info\n信息内容\n:::");
    expect(text).toContain("``` js\nconsole.log(1);\n```");
  });

  it("未映射 hint style 原样保留", () => {
    const { text, hints } = convertGitBookBlocks("{% hint style=\"exotic\" %}\nx\n{% endhint %}");
    expect(hints).toBe(0);
    expect(text).toContain("{% hint style=\"exotic\" %}");
  });
});

describe("migrateGitBook（GitBook → DocLight）", () => {
  it("解析 SUMMARY.md 导航 + 转换 hint + 跳过 SUMMARY.md", () => {
    const src = mkdtempSync(join(tmpdir(), "doclight-gitbook-"));
    writeFileSync(join(src, "SUMMARY.md"), "# Summary\n* [Intro](README.md)\n* [Guide](guide.md)");
    writeFileSync(join(src, "README.md"), "{% hint style=\"tip\" %}\n小提示\n{% endhint %}");
    writeFileSync(join(src, "guide.md"), "# 指南");
    const dest = mkdtempSync(join(tmpdir(), "doclight-gitbook-dest-"));

    const result = migrateGitBook({ sourceDir: src, destDir: dest });
    expect(result.copied.sort()).toEqual(["README.md", "guide.md"]);
    expect(result.skipped).toContain("SUMMARY.md");
    expect(result.sidebar).toEqual(["README.md", "guide.md"]);
    expect(readFileSync(join(dest, "docs", "README.md"), "utf8")).toContain(":::tip\n小提示\n:::");
    expect(result.notes.join("\n")).toContain("已转换 1 个 {% hint %} 块");
    rmSync(src, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  });
});
