/**
 * 设计合规检查（VIS-001，11-default-themes §6 视觉验收机器化）
 *
 * 视觉质量靠机器化保障（不靠主观判断）——本模块把「设计合规」变成可断言的纯函数：
 * 1. 对比度 WCAG AA：text/text-strong/text-secondary ≥ 4.5（正文），primary/primary-hover ≥ 3（UI/大文本），
 *    muted ≥ 3（装饰性小字——注释/面包屑/时间戳，非交互正文）
 * 2. 8pt 网格：--space-* 全部为 4px 的倍数（间距节奏）
 * 3. 字号节奏：从 --font-size-base 起相邻标题字号比例 ≈ 1.25（模块化缩放，容差 ±0.08）
 *
 * 数据源：主题 CSS 文本（:root 亮色令牌 + [data-theme="dark"] 暗色令牌）。
 * 默认主题（site.ts 内联令牌）与内置 4 主题（themes/*.css）都过本门禁（vitest 断言 +
 * scripts/checks/visual.mjs 对 CSS 文件做同一断言，双保险）。
 * 零依赖：纯 CSS 字符串解析 + 数学计算。
 */

/** CSS 变量块解析结果：变量名（无 -- 前缀）→ 值 */
export interface TokenBlock {
  variables: Map<string, string>;
}

/** 从 CSS 文本中提取指定选择器的变量块（如 ":root" 或 '[data-theme="dark"]'） */
export function extractTokenBlock(css: string, selector: string): TokenBlock {
  const variables = new Map<string, string>();
  // 匹配 selector { ... }（块内只取 CSS 变量声明行）
  const blockRe = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\}`,
    "g"
  );
  for (const m of css.matchAll(blockRe)) {
    const body = m[1]!;
    for (const line of body.split(/[;\n]/)) {
      const varRe = /^\s*--([\w-]+)\s*:\s*(.+?)\s*$/.exec(line);
      if (varRe) variables.set(varRe[1]!, varRe[2]!);
    }
  }
  return { variables };
}

/** 解析 #rrggbb 或 #rgb 颜色 → [r,g,b]（0-255）；无效返回 null */
export function parseHexColor(value: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(value.trim());
  if (m) {
    const hex = m[1]!;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  const m3 = /^#([0-9a-fA-F]{3})$/.exec(value.trim());
  if (m3) {
    const hex = m3[1]!;
    return [parseInt(hex[0]! + hex[0], 16), parseInt(hex[1]! + hex[1], 16), parseInt(hex[2]! + hex[2], 16)];
  }
  return null;
}

/** sRGB 通道线性化（WCAG 相对亮度公式） */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 相对亮度（0-1） */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG 对比度（1-21；前景/背景同色为 1） */
export function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ComplianceRule {
  /** 令牌名（无 -- 前缀） */
  token: string;
  /** 与背景对比度的最低要求（正文 4.5 / UI 大文本 3） */
  minContrast: number;
  /** 规则说明（双读友好：失败时输出给 Agent/人） */
  note: string;
}

/** 标准合规规则集（对每套主题的亮/暗两套令牌分别断言） */
export const STANDARD_RULES: ComplianceRule[] = [
  { token: "color-text", minContrast: 4.5, note: "正文字色与背景对比 ≥ 4.5（WCAG AA）" },
  { token: "color-text-strong", minContrast: 4.5, note: "强调文字（标题）与背景对比 ≥ 4.5（WCAG AA）" },
  { token: "color-text-secondary", minContrast: 4.5, note: "次级正文与背景对比 ≥ 4.5（WCAG AA）" },
  { token: "color-text-muted", minContrast: 3, note: "装饰性小字（时间戳/面包屑）与背景对比 ≥ 3" },
  { token: "color-primary", minContrast: 3, note: "品牌色（链接 hover/高亮/按钮）与背景对比 ≥ 3（UI 组件）" },
  { token: "color-primary-hover", minContrast: 3, note: "品牌色 hover 态与背景对比 ≥ 3" },
];

export interface ComplianceIssue {
  theme: string;
  mode: "light" | "dark";
  token: string;
  expected: number;
  actual: number;
  note: string;
}

/**
 * 对比度合规检查：解析主题 CSS 的亮/暗两套令牌，对标准规则集逐条断言。
 * 主题结构自适应（VIS-001：modern 为暗色优先——:root 即暗色，[data-theme="light"] 覆盖亮色）：
 * - 含 [data-theme="dark"] 块 → 常规亮色优先（:root=亮，dark 块=暗）
 * - 仅含 [data-theme="light"] 块 → 暗色优先（:root=暗，light 块=亮）
 * - 均无 → 只有亮色（缺省主题，暗色沿用亮色令牌）
 * 缺失令牌 → 视为失败（诚实：不静默跳过）。返回问题列表（空 = 合规）。
 */
export function checkContrast(themeName: string, css: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const root = extractTokenBlock(css, ":root");
  const darkBlock = extractTokenBlock(css, '[data-theme="dark"]');
  const lightBlock = extractTokenBlock(css, '[data-theme="light"]');
  const hasDark = darkBlock.variables.size > 0;
  // 模式 → (该模式的 :root 基底, 覆盖块)
  const modes: Array<{ mode: "light" | "dark"; base: TokenBlock; overlay: TokenBlock }> = hasDark
    ? [
        { mode: "light", base: root, overlay: { variables: new Map() } },
        { mode: "dark", base: root, overlay: darkBlock },
      ]
    : [
        { mode: "dark", base: root, overlay: { variables: new Map() } },
        { mode: "light", base: root, overlay: lightBlock },
      ];
  for (const { mode, base, overlay } of modes) {
    const all = new Map<string, string>([...base.variables, ...overlay.variables]);
    const bgRaw = all.get("color-bg");
    const bg = bgRaw ? parseHexColor(bgRaw) : null;
    if (!bg) {
      issues.push({ theme: themeName, mode, token: "color-bg", expected: 0, actual: 0, note: `缺少背景令牌 --color-bg（无法计算对比度）` });
      continue;
    }
    for (const rule of STANDARD_RULES) {
      const raw = all.get(rule.token);
      const fg = raw ? parseHexColor(raw) : null;
      if (!fg) {
        issues.push({ theme: themeName, mode, token: rule.token, expected: rule.minContrast, actual: 0, note: `缺少令牌 --${rule.token}（${rule.note}）` });
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      if (ratio < rule.minContrast) {
        issues.push({ theme: themeName, mode, token: rule.token, expected: rule.minContrast, actual: Math.round(ratio * 100) / 100, note: rule.note });
      }
    }
  }
  return issues;
}

/**
 * 8pt 网格检查：--space-* 令牌全部为 4px 的倍数（间距节奏统一）。
 * 非 px 值（rem/em）跳过（相对单位由基准缩放，网格仍成立）。
 */
export function checkSpacingGrid(css: string): string[] {
  const problems: string[] = [];
  const { variables } = extractTokenBlock(css, ":root");
  for (const [name, value] of variables) {
    if (!name.startsWith("space-")) continue;
    const px = /^(\d+(?:\.\d+)?)px$/.exec(value.trim());
    if (px) {
      const v = parseFloat(px[1]!);
      if (v % 4 !== 0) problems.push(`--${name}: ${value} 不是 4px 网格的倍数（8pt 网格）`);
    }
  }
  return problems;
}

/**
 * 字号节奏检查：从 --font-size-base 起，相邻字号（lg→xl→2xl→3xl）比例 ≈ 1.25
 * （模块化缩放，容差 ±0.08）；xs/sm 为基础 UI 字号，不在正文节奏链上。
 * 主题覆盖层未定义任何 --font-size-* 时跳过（继承默认主题——默认主题已合规；
 * 部分覆盖合法，但一旦定义则整链校验，防半调色）。
 */
export function checkTypeScale(css: string): string[] {
  const problems: string[] = [];
  const { variables } = extractTokenBlock(css, ":root");
  const defined = [...variables.keys()].filter((k) => k.startsWith("font-size-"));
  if (defined.length === 0) return problems; // 继承默认主题（默认主题独立合规）
  const scale = ["base", "lg", "xl", "2xl", "3xl"];
  let prev: number | null = null;
  for (const step of scale) {
    const raw = variables.get(`font-size-${step}`);
    const rem = raw ? /^([\d.]+)rem$/.exec(raw.trim()) : null;
    if (!rem) {
      problems.push(`缺少 --font-size-${step}（rem 值，无法校验节奏）`);
      return problems;
    }
    const v = parseFloat(rem[1]!);
    if (prev !== null) {
      const ratio = v / prev;
      if (ratio < 1.17 || ratio > 1.33) {
        problems.push(`--font-size-${step} (${v}rem) 相对上一级比例 ${Math.round(ratio * 100) / 100}，偏离模块化缩放 1.25（±0.08）`);
      }
    }
    prev = v;
  }
  return problems;
}

/** 对主题 CSS 跑全套合规（对比度 + 网格 + 节奏），返回问题列表（空 = 全合规） */
export function checkThemeCompliance(themeName: string, css: string): ComplianceIssue[] {
  const issues = checkContrast(themeName, css);
  for (const p of checkSpacingGrid(css)) issues.push({ theme: themeName, mode: "light", token: "space", expected: 0, actual: 0, note: p });
  for (const p of checkTypeScale(css)) issues.push({ theme: themeName, mode: "light", token: "type-scale", expected: 0, actual: 0, note: p });
  return issues;
}
