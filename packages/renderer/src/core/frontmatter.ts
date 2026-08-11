/**
 * Frontmatter 解析（03 §3.3.3）
 *
 * 支持 YAML 前导块：---\nkey: value\n---\n正文。
 * 只解析标量（字符串/数字/布尔/数组），不引入 YAML 解析依赖；
 * 未识别的字段原样保留为字符串，插件可后续读取。
 */

export interface Frontmatter {
  [key: string]: unknown;
}

export interface ParsedDoc {
  frontmatter: Frontmatter;
  /** 去除 frontmatter 块后的纯 Markdown 正文 */
  body: string;
}

/** 解析标量值：数组 / 布尔 / 数字 / 引号字符串 / 原样字符串 */
function parseValue(raw: string): unknown {
  const v = raw.trim();
  if (v.startsWith("[") && v.endsWith("]")) {
    return v
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter((s) => s.length > 0);
  }
  if (/^(true|false)$/i.test(v)) return /^true$/i.test(v);
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

export function parseFrontmatter(markdown: string): ParsedDoc {
  // 闭合 --- 前的换行可省略（支持空 frontmatter 块）；body 去掉紧跟的前导换行
  const m = /^---\r?\n([\s\S]*?)\r?\n?---\r?\n?/.exec(markdown);
  if (!m) return { frontmatter: {}, body: markdown };

  const block = m[0]!; // 正则已匹配，分组必存在
  const content = m[1]!;
  const frontmatter: Frontmatter = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue; // 跳过空行与注释
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    frontmatter[key] = parseValue(line.slice(idx + 1));
  }

  return { frontmatter, body: markdown.slice(block.length).replace(/^\r?\n/, "") };
}
