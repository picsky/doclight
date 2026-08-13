/**
 * @doclight/plugin-mermaid 端到端（PLUG-012 迁移回归）
 *
 * 验证 doclight.json plugins → 加载器 → buildSite 全链路：
 * - 启用 mermaid：围栏 fallback 结构（服务端直出）+ 运行时脚本 + 插件 CSS + vendor 按需拷贝
 * - 不启用：mermaid.min.js 不拷贝、围栏按普通代码块渲染（默认行为迁移）
 */
import { describe, expect, it } from "vitest";
import { loadConfiguredPlugins } from "../src/plugin-loader.ts";
import { buildSite } from "../src/build.ts";
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("PLUG-012 mermaid 迁移端到端", () => {
  it("doclight.json plugins:[mermaid] → build 全链路（启用与默认降级双向断言）", () => {
    const root = join(tmpdir(), `doclight-mermaid-e2e-${Date.now()}`);
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "README.md"), "# Mermaid 演示\n\n```mermaid\ngraph TD\n  A-->B\n```\n");
    writeFileSync(join(root, "doclight.json"), JSON.stringify({ title: "Mermaid 测试站", plugins: [{ name: "mermaid" }] }));

    const plugins = loadConfiguredPlugins(join(root, "docs"), root);
    expect(plugins.map((p) => p.name)).toEqual(["mermaid"]);
    const r = buildSite({ dir: join(root, "docs"), outDir: join(root, "out"), title: "Mermaid 测试站", buildPlugins: plugins });
    const html = readFileSync(join(root, "out", "index.html"), "utf8");

    // 围栏 fallback 结构（服务端直出）
    expect(html).toContain('class="doclight-mermaid"');
    expect(html).toContain("doclight-mermaid-src");
    // 运行时脚本 + 插件 CSS
    expect(html).toContain("window.doclight.use");
    expect(html).toContain("data-doclight-plugin-css");
    expect(html).toContain(".doclight-mermaid-error");
    // vendor 按需：mermaid.min.js 拷贝、prism 照旧
    expect(existsSync(join(root, "out", "vendor", "mermaid.min.js"))).toBe(true);
    expect(existsSync(join(root, "out", "vendor", "prism.min.js"))).toBe(true);
    expect(r.pages).toBe(1);

    // 反向验证：不启用插件时 mermaid.min.js 不拷贝、围栏是普通代码块
    const root2 = join(tmpdir(), `doclight-plain-e2e-${Date.now()}`);
    mkdirSync(join(root2, "docs"), { recursive: true });
    writeFileSync(join(root2, "docs", "README.md"), "```mermaid\ngraph TD\n```\n");
    buildSite({ dir: join(root2, "docs"), outDir: join(root2, "out"), title: "Plain" });
    const plain = readFileSync(join(root2, "out", "index.html"), "utf8");
    expect(plain).not.toContain("doclight-mermaid");
    expect(plain).toContain('class="language-mermaid"');
    expect(existsSync(join(root2, "out", "vendor", "mermaid.min.js"))).toBe(false);

    rmSync(root, { recursive: true, force: true });
    rmSync(root2, { recursive: true, force: true });
  });
});
