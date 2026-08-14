// visual check（VIS-001 + DEMO-001，11-default-themes §6 视觉验收机器化 + 10 §2.1 验证矩阵）
// 三部分硬门禁（全部零依赖、纯静态、无浏览器）：
// 1) 设计合规：默认主题 + 4 套内置主题（themes/*.css）过 checkThemeCompliance——
//    对比度 WCAG AA（text ≥4.5 / primary ≥3）/ 8pt 间距网格 / 1.25 字号节奏
// 2) 主题画廊产物：buildGallery 构建到 artifacts/visual/gallery/（4×2 面板 + 索引），
//    校验文件数 + 体积预算（画廊是可选分发产物，不占页面重量预算）
// 3) 演示形态产物（DEMO-001）：buildSlidesHtml 构建示例演示到 artifacts/visual/slides-demo.html，
//    校验自包含 + 体积预算（截图回归基线来源）
// 截图回归（像素级）独立于本 check：npm run verify:visual（Playwright，基线人工锁定）。
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkResult } from "../lib/report.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Node ≥ 23.6 原生类型剥离：直接复用 CLI 的 TS 实现（单一事实来源，不复制逻辑）
const { checkThemeCompliance } = await import("../../packages/cli/src/design-compliance.ts");
const { DEFAULT_THEME_CSS } = await import("../../packages/cli/src/site.ts");
const { buildGallery } = await import("../../packages/cli/src/gallery.ts");
const { buildSlidesHtml } = await import("../../packages/cli/src/slides.ts");

const BUILTIN_THEMES = ["minimal", "serif", "modern", "warm"];

/** 演示示例（DEMO-001 截图回归基线内容：封面/章节/内容/结束 4 布局） */
const SLIDES_DEMO_MD = `---
title: DocLight 演示
author: DocLight 团队
date: 2026-08-14
---

# 把 Markdown 变成作品

Agent 写，DocLight 渲染成专业的文档与演示。

---

<!-- layout: section -->

# 为什么是演示

---

<!-- layout: content -->

## 同源不同形

- 每页一个观点
- 少文字、强视觉
- 逐页叙事

\`\`\`ts
const hello = (name: string) => \`Hello, \${name}!\`;
\`\`\`

---

<!-- layout: end -->

# 谢谢
`;

export function run() {
  const failures = [];
  let total = 0;

  // 1) 设计合规（默认主题 = Minimal 设计语言 + 4 套内置主题）
  const subjects = [
    { name: "default", css: DEFAULT_THEME_CSS },
    ...BUILTIN_THEMES.map((t) => ({
      name: t,
      css: readFileSync(join(root, "packages", "cli", "src", "themes", `${t}.css`), "utf8"),
    })),
  ];
  for (const s of subjects) {
    total++;
    const issues = checkThemeCompliance(s.name, s.css);
    if (issues.length) {
      failures.push({
        id: `compliance:${s.name}`,
        message: `${issues.length} 项设计不合规（11 §6 机器化验收）`,
        evidence: issues
          .map((i) => `  ${i.mode} · --${i.token}: 期望 ≥${i.expected} 实测 ${i.actual} —— ${i.note}`)
          .join("\n"),
      });
    }
  }

  // 2) 主题画廊产物（视觉回归基线来源 + 可部署分发）
  total++;
  try {
    const out = join(root, "artifacts", "visual", "gallery");
    const res = buildGallery({ outDir: out, siteTitle: "DocLight" });
    const expected = 1 + BUILTIN_THEMES.length * 2; // 索引 + 4 主题 × 亮/暗
    if (res.files.length !== expected) {
      failures.push({ id: "gallery", message: `画廊文件数 ${res.files.length} ≠ 期望 ${expected}` });
    }
    // 体积预算：可选分发产物，阈值防失控膨胀（每面板 ≈ 25KB）
    if (res.bytes > 400 * 1024) {
      failures.push({ id: "gallery-size", message: `画廊总字节 ${res.bytes} 超预算 400KB`, evidence: res.files.join("\n") });
    }
  } catch (err) {
    failures.push({ id: "gallery", message: `画廊构建失败：${err.message}` });
  }

  // 3) 演示形态产物（DEMO-001：自包含单文件 + 体积预算）
  total++;
  try {
    const html = buildSlidesHtml(SLIDES_DEMO_MD, { theme: "dark", author: "DocLight 团队" });
    const out = join(root, "artifacts", "visual", "slides-demo.html");
    writeFileSync(out, html, "utf8");
    const bytes = Buffer.byteLength(html, "utf8");
    if (!html.includes("id=\"slide-stage\"") || !html.includes("addEventListener('keydown'")) {
      failures.push({ id: "slides", message: "演示产物缺少壳层（导航 JS/舞台结构）" });
    }
    if (bytes > 100 * 1024) {
      failures.push({ id: "slides-size", message: `演示产物 ${bytes}B 超预算 100KB` });
    }
  } catch (err) {
    failures.push({ id: "slides", message: `演示构建失败：${err.message}` });
  }

  return mkResult("visual", "视觉合规（设计合规 + 画廊产物 + 演示产物）", total, failures);
}
