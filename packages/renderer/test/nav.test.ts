import { describe, expect, it } from "vitest";
import { buildDocsJson, buildNavTree, type NavGroup, type NavNode } from "../src/nav.ts";

/** 展平为便于断言的路径序列（文件按序；目录输出 "dir/" 标记） */
function flatten(nodes: NavNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.type === "file") out.push(n.path);
    else {
      out.push(`${n.path}#`);
      out.push(...flatten(n.items));
    }
  }
  return out;
}

function files(nodes: NavNode[]): string[] {
  return nodes.filter((n) => n.type === "file").map((n) => (n as { path: string }).path);
}

describe("导航树（NAV-001）", () => {
  it("README 置顶 + 文件在前 + 字母序", () => {
    const tree = buildNavTree(["quickstart.md", "README.md", "intro.md", "guide/basic.md", "guide/advanced.md"]);
    expect(flatten(tree)).toEqual([
      "README.md",
      "intro.md",
      "quickstart.md",
      "guide/#",
      "guide/advanced.md",
      "guide/basic.md",
    ]);
  });

  it("数字前缀优先且升序，先于无前缀项", () => {
    const tree = buildNavTree(["about.md", "02-guide.md", "01-intro.md", "README.md"]);
    expect(files(tree)).toEqual(["README.md", "01-intro.md", "02-guide.md", "about.md"]);
  });

  it("index.md 与 README.md 同为置顶页（README 先于 index）", () => {
    const tree = buildNavTree(["index.md", "README.md", "intro.md"]);
    expect(files(tree)).toEqual(["README.md", "index.md", "intro.md"]);
  });

  it("目录分组 + 目录内 README 置顶 + index 指针", () => {
    const tree = buildNavTree(["README.md", "guide/advanced.md", "guide/README.md", "guide/basic.md"]);
    const guide = tree.find((n) => n.type === "group" && n.title === "guide") as NavGroup;
    expect(guide).toBeDefined();
    expect(guide.index).toBe("guide/README.md");
    expect(files(guide.items)).toEqual(["guide/README.md", "guide/advanced.md", "guide/basic.md"]);
  });

  it("嵌套目录", () => {
    const tree = buildNavTree(["a/top.md", "a/b/deep.md", "README.md"]);
    expect(flatten(tree)).toEqual(["README.md", "a/#", "a/top.md", "a/b/#", "a/b/deep.md"]);
  });

  it("空输入返回空树", () => {
    expect(buildNavTree([])).toEqual([]);
  });

  it("titles 映射覆盖默认标题（文件名主干）", () => {
    const tree = buildNavTree(["guide/quickstart.md"], { "guide/quickstart.md": "快速开始" });
    const guide = tree[0] as NavGroup;
    expect(guide.items[0]).toEqual({ type: "file", path: "guide/quickstart.md", title: "快速开始" });
    const defaultTree = buildNavTree(["guide/quickstart.md"]);
    expect((defaultTree[0] as NavGroup).items[0]).toMatchObject({ title: "quickstart" });
  });

  it("buildDocsJson 输出 version 1 + generatedAt + nav", () => {
    const json = buildDocsJson(["README.md", "intro.md"], { generatedAt: "2026-08-11T00:00:00.000Z" });
    expect(json.version).toBe(1);
    expect(json.generatedAt).toBe("2026-08-11T00:00:00.000Z");
    expect(files(json.nav)).toEqual(["README.md", "intro.md"]);
  });
});
