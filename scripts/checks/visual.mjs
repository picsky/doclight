// visual check（VIS-001，11-default-themes §6 视觉验收机器化 + 10 §2.1 验证矩阵）
// 两部分硬门禁（全部零依赖、纯静态、无浏览器）：
// 1) 设计合规：默认主题 + 4 套内置主题（themes/*.css）过 checkThemeCompliance——
//    对比度 WCAG AA（text ≥4.5 / primary ≥3）/ 8pt 间距网格 / 1.25 字号节奏
// 2) 主题画廊产物：buildGallery 构建到 artifacts/visual/gallery/（4×2 面板 + 索引），
//    校验文件数 + 体积预算（画廊是可选分发产物，不占页面重量预算）
// 截图回归（像素级）独立于本 check：npm run verify:visual（Playwright，基线人工锁定）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkResult } from "../lib/report.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Node ≥ 23.6 原生类型剥离：直接复用 CLI 的 TS 实现（单一事实来源，不复制逻辑）
const { checkThemeCompliance } = await import("../../packages/cli/src/design-compliance.ts");
const { DEFAULT_THEME_CSS } = await import("../../packages/cli/src/site.ts");
const { buildGallery } = await import("../../packages/cli/src/gallery.ts");

const BUILTIN_THEMES = ["minimal", "serif", "modern", "warm"];

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

  return mkResult("visual", "视觉合规（设计合规 + 主题画廊产物）", total, failures);
}
