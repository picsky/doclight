/**
 * 同构快照（SNAP-001，Phase 0 遗留）：三形态渲染一致性。
 *
 * 设计依据（08-roadmap 风险表「三形态产物不一致」）：渲染唯一在 Node 内核（renderer），
 * dev / SSG / bundle 三形态都应产出相同的内容 HTML。差异仅允许在链接后缀
 * （决策⑤：dev 保持 .md、SSG/bundle 转 .html）与页面外壳（导航/标题），内容区必须一致。
 *
 * 验证方法：同一 docs 夹具 → 三形态各自渲染 → 抽取内容区（<article> 内）→
 * 归一链接后缀（.md/.html → 无扩展）→ 断言三形态逐页相等。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "../src/build.ts";
import { bundleSite } from "../src/bundle.ts";
import { startDevServer } from "../src/dev-server.ts";

let docsDir: string;
let buildOut: string;
let bundleOut: string;

/** 从完整页面 HTML 抽取内容区（<article> 内）；bundle 内嵌内容无 <article> 则原样返回 */
function extractContent(pageHtml: string): string {
  const start = pageHtml.indexOf("<article>");
  if (start === -1) return pageHtml;
  return pageHtml.slice(start + "<article>".length, pageHtml.indexOf("</article>"));
}

/** 归一链接后缀：href="x.md"/href="x.html" → href="x"（dev 与 SSG/bundle 的唯一允许差异，决策⑤） */
function normalize(h: string): string {
  return h.replace(/href="([^"#]+?)\.(?:md|html)"/g, 'href="$1"');
}

/** 从 bundle 文件提取内嵌页面数据（window.__DOCLLIGHT_BUNDLE__ = {...}; 以 </script> 收尾）。
 *  用 </script> 作锚点：渲染后的代码块会转义 <，JSON 字符串内不会出现字面 </script>。 */
function bundlePages(bundleHtml: string): Record<string, string> {
  const m = /window\.__DOCLLIGHT_BUNDLE__\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/.exec(bundleHtml);
  if (!m) throw new Error("bundle 缺少内嵌数据块");
  return (JSON.parse(m[1]!) as { pages: Record<string, string> }).pages;
}

beforeAll(async () => {
  docsDir = mkdtempSync(join(tmpdir(), "doclight-iso-docs-"));
  mkdirSync(join(docsDir, "guide"), { recursive: true });
  writeFileSync(
    join(docsDir, "README.md"),
    [
      "---",
      "title: 首页",
      "---",
      "",
      "# 首页标题",
      "",
      "欢迎段落，含**加粗**与 `行内代码`。",
      "",
      "[去入门](guide/quickstart.md)",
      "",
      "| 列A | 列B |",
      "|---|---|",
      "| 1 | 2 |",
      "",
      "```ts",
      "const x = { a: 1 };",
      "console.log(x)",
      "```",
      "",
    ].join("\n")
  );
  writeFileSync(
    join(docsDir, "guide", "quickstart.md"),
    [
      "---",
      "title: 快速开始",
      "tags: [入门]",
      "---",
      "",
      "# 快速开始",
      "",
      "三步上手：[返回首页](../README.md) 或 [基础](basic.md)。",
      "",
      "## 小节",
      "",
      "- 列表项一",
      "- 列表项二",
      "",
      "```bash",
      "doclight build",
      "```",
      "",
    ].join("\n")
  );
  writeFileSync(join(docsDir, "guide", "basic.md"), "# 基础\n\n基础内容。");
  buildOut = mkdtempSync(join(tmpdir(), "doclight-iso-build-"));
  bundleOut = mkdtempSync(join(tmpdir(), "doclight-iso-bundle-"));
  buildSite({ dir: docsDir, outDir: buildOut });
  await bundleSite({ dir: docsDir, outDir: bundleOut });
});

afterAll(() => {
  for (const d of [docsDir, buildOut, bundleOut]) rmSync(d, { recursive: true, force: true });
});

describe("同构快照（SNAP-001：dev / SSG / bundle 三形态内容一致）", () => {
  it("首页内容三形态一致", async () => {
    // SSG
    const buildIndex = normalize(extractContent(readFileSync(join(buildOut, "index.html"), "utf8")));
    // bundle
    const bundleIndex = normalize(bundlePages(readFileSync(join(bundleOut, "doclight.html"), "utf8"))["/"] ?? "");
    // dev
    const dev = await startDevServer({ dir: docsDir, port: 0 });
    try {
      const devIndex = normalize(extractContent(await (await fetch(dev.url)).text()));
      expect(devIndex).toBe(bundleIndex);
      expect(devIndex).toBe(buildIndex);
    } finally {
      await dev.close();
    }
  });

  it("子页内容三形态一致（含相对链接 + 列表 + 代码块）", async () => {
    const buildQuick = normalize(extractContent(readFileSync(join(buildOut, "guide", "quickstart.html"), "utf8")));
    const bundleQuick = normalize(bundlePages(readFileSync(join(bundleOut, "doclight.html"), "utf8"))["/guide/quickstart.html"] ?? "");
    const dev = await startDevServer({ dir: docsDir, port: 0 });
    try {
      const devQuick = normalize(extractContent(await (await fetch(`${dev.url}guide/quickstart`)).text()));
      expect(devQuick).toBe(bundleQuick);
      expect(devQuick).toBe(buildQuick);
    } finally {
      await dev.close();
    }
  });

  it("内容结构要素齐全（表格/代码/强调渲染进三形态内容区）", async () => {
    const buildIndex = extractContent(readFileSync(join(buildOut, "index.html"), "utf8"));
    expect(buildIndex).toContain("<table>");
    expect(buildIndex).toContain("<strong>");
    expect(buildIndex).toContain("<code>");
    expect(buildIndex).toContain("const x");
  });
});
