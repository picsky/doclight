/**
 * 扩展语法渲染端到端（REND-002/003：真实浏览器 + 真实 vendor 库）
 *
 * 对应：specs/features/render-ext.feature（REND-002/003）+ 08-roadmap §Phase 2。
 * dev server 从 node_modules 服务 vendor（/__doclight/vendor/*），展示层懒加载
 * Prism/Mermaid/KaTeX 后增强。夹具含全部扩展语法（含 LLM 易生成的 Mermaid 错误语法，
 * 验证 REND-003「100% 不白屏」容错）。
 * PLUG-012：Mermaid 已迁移为官方插件——dev server 显式启用 @doclight/plugin-mermaid
 * （与内置时期行为一致；不启用时 mermaid 围栏按普通代码块渲染）。
 */
import { test, expect } from "@playwright/test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDevServer } from "../packages/cli/src/dev-server.ts";
import { createMermaidPlugin } from "../packages/cli/src/plugins-official/mermaid.ts";

const docsDir = mkdtempSync(join(tmpdir(), "doclight-ext-e2e-"));
let server: { url: string; port: number; close(): Promise<void> };

test.beforeAll(async () => {
  writeFileSync(
    join(docsDir, "README.md"),
    [
      "# 扩展语法演示",
      "",
      "## 代码高亮 + 复制",
      "",
      "```js",
      "function hello(name) {",
      "  return `hi ${name}`;",
      "}",
      "```",
      "",
      "## Mermaid 正常图表",
      "",
      "```mermaid",
      "graph TD",
      "  A[开始] --> B{判断}",
      "  B -->|是| C[结束]",
      "```",
      "",
      "## Mermaid 错误语法（LLM 生成场景）",
      "",
      "```mermaid",
      "graph TD this is invalid -> broken",
      "```",
      "",
      "## 自定义容器",
      "",
      ":::tip",
      "这是一个提示容器",
      ":::",
      "",
      ":::danger",
      "这是危险容器",
      ":::",
      "",
      "## 公式",
      "",
      "内联公式 $e^{i\\pi}+1=0$ 与块级公式：",
      "",
      "$$",
      "\\int_0^1 x^2 dx = \\frac{1}{3}",
      "$$",
    ].join("\n")
  );
  server = await startDevServer({ dir: docsDir, buildPlugins: [createMermaidPlugin()!] });
});

test.afterAll(async () => {
  await server?.close();
  rmSync(docsDir, { recursive: true, force: true });
});

test("代码高亮：Prism 懒加载后注入 token 高亮", async ({ page }) => {
  await page.goto(server.url);
  const code = page.locator("pre.doclight-code code.language-js");
  await expect(code).toBeVisible();
  await expect(code).toContainText("function hello");
  // Prism 高亮：code 内出现 token span（默认不注入任何 token 时为 0，需等待增强）
  await expect(code.locator(".token.function").first()).toBeVisible({ timeout: 15_000 });
});

test("代码块复制按钮可复制", async ({ page }) => {
  await page.goto(server.url);
  const pre = page.locator("pre.doclight-code").first();
  await pre.hover();
  const btn = pre.locator(".doclight-copy");
  await expect(btn).toBeVisible();
  // 剪贴板权限：chromium 支持，firefox/webkit 可能不支持该权限名——失败则走降级路径
  let clipboardOk = false;
  try {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    clipboardOk = true;
  } catch {
    /* 浏览器不支持该权限名（firefox/webkit）→ 验证降级反馈即可 */
  }
  await btn.click();
  // 复制反馈（无论 clipboard API 还是降级 execCommand 路径都触发）
  await expect(btn).toHaveClass(/copied/);
  if (clipboardOk) {
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("function hello");
  }
});

test("Mermaid 正常图表渲染为 SVG", async ({ page }) => {
  await page.goto(server.url);
  // 正常图表：渲染成功 → .doclight-mermaid-rendered 内含 svg
  const rendered = page.locator(".doclight-mermaid-rendered").first();
  await expect(rendered).toBeVisible({ timeout: 20_000 });
  await expect(rendered.locator("svg")).toBeVisible();
});

test("REND-003 Mermaid 容错：错误语法不白屏，保留源码 + 提示", async ({ page }) => {
  await page.goto(server.url);
  // 错误图表：出现容错提示，且源码 fallback 仍在（页面不白屏）
  const errNode = page.locator(".doclight-mermaid", { hasText: "graph TD this is invalid" });
  await expect(errNode.locator(".doclight-mermaid-error")).toBeVisible({ timeout: 20_000 });
  await expect(errNode.locator(".doclight-mermaid-error")).toContainText("渲染失败");
  // 源码可见（降级）
  await expect(errNode.locator(".doclight-mermaid-src")).toBeVisible();
});

test("自定义容器渲染（tip/danger + 内层内容）", async ({ page }) => {
  await page.goto(server.url);
  await expect(page.locator(".doclight-container.doclight-tip")).toContainText("提示容器");
  await expect(page.locator(".doclight-container.doclight-danger")).toContainText("危险容器");
});

test("KaTeX 公式渲染为数学排版", async ({ page }) => {
  await page.goto(server.url);
  // 内联 + 块级都渲染为 .katex（KaTeX 产物）
  await expect(page.locator(".doclight-katex-inline .katex")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".doclight-katex-block .katex-display")).toBeVisible();
});
