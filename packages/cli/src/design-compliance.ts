/**
 * 设计合规检查（VIS-001 + 设计对齐 2026-08-16：令牌体系迁移自 --color-* 为宪法令牌）
 *
 * 视觉质量靠机器化保障（不靠主观判断）——本模块把「设计合规」变成可断言的纯函数。
 * 令牌体系与断言标准以 docs/design-new/DESIGN.md（项目设计第一文档）§3 为唯一事实来源：
 * 1. 对比度：正文 --text ≥ 7（WCAG AAA，宪法 §3.1）、--text-2 / --text-3 ≥ 4.5（AA），
 *    --accent / --accent-hover ≥ 3（UI 组件），--accent-ink（正文链接）≥ 4.5
 * 2. 代码语法色（--syn-*）与 --code-bg ≥ 3（语法可读性下限；rgba 底色与模式底色混合后计算）
 * 3. 语义状态色（--success/--warning/--error）与页面底色 ≥ 3（WCAG 1.4.11 图形元素——
 *    宪法：语义色仅用于状态指示，以「对勾图标 + 文字」形式出现，颜色只作辅助）
 * 4. 8pt 网格：--space-* 全部为 4px 的倍数（宪法 §3.3）
 * 5. 字号节奏：--font-size-* 全部命中宪法 §3.2 批准类型阶（一旦定义则整链校验，防半调色）
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

/** 解析 #rrggbb / #rgb / rgba() 颜色 → [r,g,b]（0-255）；rgba 与背景混合（玻璃底色）。
 *  无效返回 null。 */
export function parseColorWithBg(value: string, bg: [number, number, number]): [number, number, number] | null {
  const hex = parseHexColor(value);
  if (hex) return hex;
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(value.trim());
  if (m) {
    const [r, g, b] = [+m[1]!, +m[2]!, +m[3]!];
    const a = m[4] !== undefined ? parseFloat(m[4]!) : 1;
    return [
      Math.round(r * a + bg[0] * (1 - a)),
      Math.round(g * a + bg[1] * (1 - a)),
      Math.round(b * a + bg[2] * (1 - a)),
    ];
  }
  return null;
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
  /** 令牌缺失时的回退令牌（如 color-link → color-primary；无则视为缺失失败） */
  fallback?: string;
  /** 与背景对比度的最低要求（正文 4.5 / UI 大文本 3） */
  minContrast: number;
  /** 规则说明（双读友好：失败时输出给 Agent/人） */
  note: string;
}

/** 标准合规规则集（对每套主题的亮/暗两套令牌分别断言；设计对齐：宪法 §3 令牌体系） */
export const STANDARD_RULES: ComplianceRule[] = [
  { token: "text", minContrast: 7, note: "正文字色与背景对比 ≥ 7（WCAG AAA，宪法 §3.1）" },
  { token: "text-2", minContrast: 4.5, note: "次级正文与背景对比 ≥ 4.5（WCAG AA）" },
  { token: "text-3", minContrast: 4.5, note: "辅助文字（面包屑/元信息/目录）与背景对比 ≥ 4.5（WCAG AA）" },
  { token: "accent", minContrast: 3, note: "强调色（激活/焦点/状态）与背景对比 ≥ 3（UI 组件）" },
  { token: "accent-hover", minContrast: 3, note: "强调色 hover 态与背景对比 ≥ 3" },
  { token: "accent-ink", minContrast: 4.5, note: "正文链接色与背景对比 ≥ 4.5（WCAG AA）" },
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
    const bgRaw = all.get("bg");
    const bg = bgRaw ? parseColorWithBg(bgRaw, [255, 255, 255]) : null;
    if (!bg) {
      issues.push({ theme: themeName, mode, token: "bg", expected: 0, actual: 0, note: `缺少背景令牌 --bg（无法计算对比度）` });
      continue;
    }
    for (const rule of STANDARD_RULES) {
      // 2026-08：链接色规则支持回退（未定义 --color-link 时按 --color-primary 检查）
      const raw = all.get(rule.token) ?? (rule.fallback ? all.get(rule.fallback) : undefined);
      const fg = raw ? parseColorWithBg(raw, bg) : null;
      if (!fg) {
        issues.push({ theme: themeName, mode, token: rule.token, expected: rule.minContrast, actual: 0, note: `缺少令牌 --${rule.token}${rule.fallback ? `（回退 --${rule.fallback} 也没有）` : ""}（${rule.note}）` });
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
 * 代码语法色对比度（2026-08 新增；设计对齐 2026-08-16：令牌 --syn-*，宪法 §3.1）：
 * --syn-* 与 --code-bg ≥ 3（语法可读性下限）。code-bg 可为 rgba：与模式底色混合后计算。
 * 未定义任何 --syn-* 时跳过（继承默认）。
 */
export function checkCodeTokens(themeName: string, css: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const root = extractTokenBlock(css, ":root");
  const darkBlock = extractTokenBlock(css, '[data-theme="dark"]');
  const lightBlock = extractTokenBlock(css, '[data-theme="light"]');
  const hasDark = darkBlock.variables.size > 0;
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
    const bgRaw = all.get("code-bg");
    const pageBgRaw = all.get("bg");
    const pageBg: [number, number, number] = pageBgRaw
      ? (parseColorWithBg(pageBgRaw, [255, 255, 255]) ?? [255, 255, 255])
      : [255, 255, 255];
    const bg = bgRaw ? parseColorWithBg(bgRaw, pageBg) : null;
    if (!bg) continue; // 未定义代码区底色（继承默认）——默认主题独立断言
    const tokenNames = [...all.keys()].filter((k) => k.startsWith("syn-"));
    if (tokenNames.length === 0) continue;
    for (const name of tokenNames) {
      const fg = parseColorWithBg(all.get(name)!, bg);
      if (!fg) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio < 3) {
        issues.push({ theme: themeName, mode, token: name, expected: 3, actual: Math.round(ratio * 100) / 100, note: `代码语法色 --${name} 与代码区底色对比 ≥ 3（语法可读性下限）` });
      }
    }
  }
  return issues;
}

/**
 * 语义状态色对比度（设计对齐 2026-08-16：宪法 §3.1——语义色仅三枚且只用于状态指示，
 * 以「对勾图标 + 文字」形式出现，颜色只作辅助；此处断言状态色与页面底色 ≥ 3
 * （WCAG 1.4.11 图形元素——状态圆点/对勾的可见性下限））。
 */
export function checkStatusColors(themeName: string, css: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const root = extractTokenBlock(css, ":root");
  const darkBlock = extractTokenBlock(css, '[data-theme="dark"]');
  const lightBlock = extractTokenBlock(css, '[data-theme="light"]');
  const hasDark = darkBlock.variables.size > 0;
  const modes: Array<{ mode: "light" | "dark"; base: TokenBlock; overlay: TokenBlock }> = hasDark
    ? [
        { mode: "light", base: root, overlay: { variables: new Map() } },
        { mode: "dark", base: root, overlay: darkBlock },
      ]
    : [
        { mode: "dark", base: root, overlay: { variables: new Map() } },
        { mode: "light", base: root, overlay: lightBlock },
      ];
  const SEMANTIC = ["success", "warning", "error"] as const;
  for (const { mode, base, overlay } of modes) {
    const all = new Map<string, string>([...base.variables, ...overlay.variables]);
    const bgRaw = all.get("bg");
    const bg: [number, number, number] = bgRaw ? (parseColorWithBg(bgRaw, [255, 255, 255]) ?? [255, 255, 255]) : [255, 255, 255];
    for (const token of SEMANTIC) {
      const raw = all.get(token);
      const color = raw ? parseColorWithBg(raw, bg) : null;
      if (!color) continue; // 缺失回退默认（默认主题独立断言）
      const ratio = contrastRatio(color, bg);
      if (ratio < 3) {
        issues.push({ theme: themeName, mode, token, expected: 3, actual: Math.round(ratio * 100) / 100, note: `语义状态色 --${token} 与页面底色对比 ≥ 3（WCAG 1.4.11 图形元素）` });
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
 * 字号节奏检查（设计对齐 2026-08-16：宪法 §3.2 类型阶——全产品只允许批准档位）：
 * --font-size-* 一旦定义则整链校验：全部命中批准档位（xs 12 / sm 13 / base 15.5 /
 * lg 18 / xl 21 / 2xl 26 / 3xl 34 px，rem 值容差 ±0.005），防半调色与自定义档位。
 * 完全未定义则跳过（继承已合规的默认主题）。
 */
const APPROVED_TYPE_SCALE: Record<string, number> = {
  xs: 0.75, // 12px
  sm: 0.8125, // 13px
  base: 0.969, // 15.5px
  lg: 1.125, // 18px（引言）
  xl: 1.3125, // 21px（H2）
  "2xl": 1.625, // 26px
  "3xl": 2.125, // 34px（H1）
};
export function checkTypeScale(css: string): string[] {
  const problems: string[] = [];
  const { variables } = extractTokenBlock(css, ":root");
  const defined = [...variables.keys()].filter((k) => k.startsWith("font-size-"));
  if (defined.length === 0) return problems; // 继承默认主题（默认主题独立合规）
  for (const step of Object.keys(APPROVED_TYPE_SCALE)) {
    const raw = variables.get(`font-size-${step}`);
    const rem = raw ? /^([\d.]+)rem$/.exec(raw.trim()) : null;
    if (!rem) {
      problems.push(`缺少 --font-size-${step}（整链校验：宪法 §3.2 类型阶必须完整）`);
      continue;
    }
    const v = parseFloat(rem[1]!);
    if (Math.abs(v - APPROVED_TYPE_SCALE[step]!) > 0.005) {
      problems.push(`--font-size-${step} (${v}rem) 偏离宪法 §3.2 批准档位 ${APPROVED_TYPE_SCALE[step]}rem`);
    }
  }
  for (const name of defined) {
    const step = name.replace(/^font-size-/, "");
    if (!(step in APPROVED_TYPE_SCALE)) problems.push(`--${name} 不在宪法 §3.2 批准类型阶内（禁止自定义档位）`);
  }
  return problems;
}

/** 对主题 CSS 跑全套合规（对比度 + 代码色 + 状态色 + 网格 + 节奏），返回问题列表（空 = 全合规） */
export function checkThemeCompliance(themeName: string, css: string): ComplianceIssue[] {
  const issues = checkContrast(themeName, css);
  issues.push(...checkCodeTokens(themeName, css));
  issues.push(...checkStatusColors(themeName, css));
  for (const p of checkSpacingGrid(css)) issues.push({ theme: themeName, mode: "light", token: "space", expected: 0, actual: 0, note: p });
  for (const p of checkTypeScale(css)) issues.push({ theme: themeName, mode: "light", token: "type-scale", expected: 0, actual: 0, note: p });
  return issues;
}
