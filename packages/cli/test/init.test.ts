import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initProject } from "../src/init.ts";

function tmpRoot(): string {
  return mkdtempSync(join(tmpdir(), "doclight-init-"));
}

describe("doclight init（CLI-001，05 §5.2.1）", () => {
  it("生成最小骨架：doclight.json + 示例 docs/（README + guide/start）+ index.html", () => {
    const root = tmpRoot();
    const result = initProject({ dir: root, title: "我的文档站", description: "示例描述" });
    expect(result.created.sort()).toEqual(["doclight.json", "docs/README.md", "docs/guide/start.md", "index.html"]);
    expect(result.skipped).toEqual([]);

    const cfg = JSON.parse(readFileSync(join(root, "doclight.json"), "utf8")) as Record<string, unknown>;
    expect(cfg.title).toBe("我的文档站");
    expect(cfg.description).toBe("示例描述");
    expect(cfg.docsDir).toBe("docs");

    expect(readFileSync(join(root, "docs", "README.md"), "utf8")).toContain("欢迎使用 DocLight");
    expect(readFileSync(join(root, "docs", "guide", "start.md"), "utf8")).toContain("入门指南");
    const entry = readFileSync(join(root, "index.html"), "utf8");
    expect(entry).toContain("<title>我的文档站</title>");
    expect(entry).toContain("doclight dev");
    rmSync(root, { recursive: true, force: true });
  });

  it("幂等：已存在文件跳过不覆盖；--force 覆盖", () => {
    const root = tmpRoot();
    const first = initProject({ dir: root, title: "A" });
    expect(first.created).toHaveLength(4);
    // 二次 init：全部跳过
    const second = initProject({ dir: root, title: "B" });
    expect(second.created).toEqual([]);
    expect(second.skipped).toHaveLength(4);
    // doclight.json 仍是 A（未覆盖）
    expect(JSON.parse(readFileSync(join(root, "doclight.json"), "utf8")).title).toBe("A");
    // --force 覆盖
    const third = initProject({ dir: root, title: "C", force: true });
    expect(third.created).toHaveLength(4);
    expect(JSON.parse(readFileSync(join(root, "doclight.json"), "utf8")).title).toBe("C");
    rmSync(root, { recursive: true, force: true });
  });

  it("目标路径已有自定义文档时不被删除/覆盖（只补缺）", () => {
    const root = tmpRoot();
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "custom.md"), "# 已有文档");
    const result = initProject({ dir: root, title: "T" });
    expect(result.created).toContain("docs/README.md");
    expect(result.skipped).toEqual([]); // custom.md 非骨架文件，init 不触碰
    expect(readFileSync(join(root, "docs", "custom.md"), "utf8")).toBe("# 已有文档");
    rmSync(root, { recursive: true, force: true });
  });
});
