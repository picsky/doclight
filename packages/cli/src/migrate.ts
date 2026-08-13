/**
 * docsify → DocLight 迁移工具（CLI-004，08-roadmap Phase 3「获客第一触点」）
 *
 * 基本自动迁移：把 docsify 站点内容目录复制为 DocLight docs/ 约定结构。
 * - 复制全部 .md（保持目录结构；README.md 每级保留——DocLight 视为置顶页/首页）
 * - 跳过 docsify 专属文件：_sidebar.md / _navbar.md / index.html（DocLight 自动导航替代）
 * - 解析 _sidebar.md 得到 docsify 自定义顺序（报告输出；不自动改文件名避免破坏链接）
 * - DocLight 导航排序约定：README/index 置顶 → 数字前缀 → 字母序；需自定义顺序时用
 *   数字前缀（如 01-、02-）或在 doclight.json 配置导航（后续）。
 *
 * 零依赖：纯 fs 复制 + 文本解析。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface MigrateOptions {
  /** docsify 站点根目录（含 _sidebar.md 或 Markdown 内容） */
  sourceDir: string;
  /** 目标 DocLight 项目根（doclight.json 所在层级），默认当前目录 */
  destDir?: string;
  /** 输出文档目录（相对 destDir），默认 "docs" */
  docsRel?: string;
}

export interface MigrateResult {
  /** 复制的 .md 相对路径（相对 destDocs） */
  copied: string[];
  /** 跳过的 docsify 专属文件 */
  skipped: string[];
  /** _sidebar.md 解析出的导航顺序（仅报告用） */
  sidebar: string[];
  /** 输出文档目录绝对路径 */
  destDocs: string;
  /** 内容转换备注（admonition/hint 转换数等，双读友好） */
  notes: string[];
}

/** 纯函数：解析 docsify _sidebar.md 为链接路径有序列表（去重、保序） */
export function parseSidebar(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/-?\s*\[[^\]]*\]\(([^)]+)\)/g)) {
    const p = m[1]!.trim().split("#")[0]!.trim();
    if (p && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

/** 递归收集 .md 相对路径（正斜杠） */
function walkMd(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      out.push(...walkMd(full, rel));
    } else if (entry.endsWith(".md")) {
      out.push(rel);
    }
  }
  return out;
}

const DOCSIFY_ONLY = new Set(["_sidebar.md", "_navbar.md", "_coverpage.md"]);

/** 执行迁移（供命令与测试复用）。不覆盖已存在的目标文件（幂等）。 */
export function migrateDocsify(options: MigrateOptions): MigrateResult {
  const source = resolve(options.sourceDir);
  const destDocs = resolve(options.destDir ?? ".", options.docsRel ?? "docs");
  mkdirSync(destDocs, { recursive: true });

  const sidebarPath = join(source, "_sidebar.md");
  const sidebar = existsSync(sidebarPath) ? parseSidebar(readFileSync(sidebarPath, "utf8")) : [];
  const allMd = walkMd(source).sort();
  // _sidebar 引用的文件优先复制（其余按字母序补齐，保证内容不丢）
  const ordered = [...new Set([...sidebar.filter((p) => allMd.includes(p)), ...allMd])];

  const copied: string[] = [];
  const skipped: string[] = [];
  for (const rel of ordered) {
    const full = join(source, rel);
    if (!statSync(full).isFile()) continue;
    // docsify 专属文件：复制但标记跳过内容（_sidebar 由自动导航替代）
    const base = rel.split("/").pop()!;
    if (DOCSIFY_ONLY.has(base)) {
      skipped.push(rel);
      continue;
    }
    const dest = join(destDocs, rel);
    mkdirSync(dirname(dest), { recursive: true });
    const content = readFileSync(full, "utf8");
    if (!existsSync(dest)) {
      writeFileSync(dest, content);
      copied.push(rel);
    } else {
      skipped.push(rel); // 已存在：不覆盖（幂等）
    }
  }

  return { copied, skipped, sidebar, destDocs, notes: [] };
}

/* ================= MkDocs 迁移（MIG-001，Phase 5 迁移工具，08-roadmap） ================= */

/** MkDocs admonition → DocLight 容器映射（!!! note → :::info 等） */
const MKDOCS_ADMONITION_MAP: Record<string, string> = {
  note: "info",
  info: "info",
  abstract: "info",
  summary: "info",
  tldr: "info",
  todo: "info",
  question: "info",
  help: "info",
  faq: "info",
  tip: "tip",
  hint: "tip",
  important: "tip",
  success: "tip",
  check: "tip",
  done: "tip",
  example: "tip",
  warning: "warning",
  caution: "warning",
  attention: "warning",
  danger: "danger",
  error: "danger",
  failure: "danger",
  fail: "danger",
  missing: "danger",
  bug: "danger",
};

/**
 * 纯函数：转换 MkDocs admonition（!!! / ??? 前缀 + 4 空格缩进）为 DocLight 容器。
 * - !!! note "标题" → :::info + 标题行；??? 折叠块 → 普通容器（DocLight 无折叠容器，降级）
 * - 未映射类型原样保留（诚实：不硬转未知语法）
 * 返回 { text, converted, collapsed }。
 */
export function convertMkDocsAdmonitions(text: string): { text: string; converted: number; collapsed: number } {
  let converted = 0;
  let collapsed = 0;
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const match = /^([!?]{3})\s+([\w-]+)\s*(?:"([^"]*)")?\s*$/.exec(line);
    if (!match) {
      out.push(line);
      i++;
      continue;
    }
    const [, prefix, kindRaw, title] = match.map((v) => v) as [string, string, string, string | undefined];
    const kind = MKDOCS_ADMONITION_MAP[kindRaw.toLowerCase()];
    if (!kind) {
      out.push(line);
      i++;
      continue;
    }
    if (prefix === "???") collapsed++;
    // 收集 4 空格缩进内容块
    const body: string[] = [];
    i++;
    while (i < lines.length && (/^\s{4}/.test(lines[i]!) || lines[i]!.trim() === "")) {
      body.push(lines[i]!.replace(/^\s{4}/, ""));
      i++;
    }
    // 去首尾空行
    while (body.length && body[0]!.trim() === "") body.shift();
    while (body.length && body[body.length - 1]!.trim() === "") body.pop();
    out.push(`:::${kind}`);
    if (title) out.push(title);
    if (title && body.length) out.push("");
    out.push(...body);
    out.push(":::");
    converted++;
  }
  return { text: out.join("\n"), converted, collapsed };
}

/** 纯函数：解析 mkdocs.yml nav（- Label: path 形态）为有序路径列表（仅报告用，宽松容错） */
export function parseMkdocsNav(yaml: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of yaml.split(/\r?\n/)) {
    const m = /^\s*-?\s*(?:["']?[^:"']+["']?|"[^"]+")\s*:\s*([^\s#]+\.md)/.exec(line);
    if (!m) continue;
    const p = m[1]!.trim();
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

/** 解析 mkdocs.yml 的 docs_dir（缺省 "docs"）与 site_name（宽松） */
export function parseMkdocsConfig(yaml: string): { docsDir: string; siteName?: string } {
  const docsDir = /^\s*docs_dir\s*:\s*["']?([^"'\s#]+)/m.exec(yaml)?.[1] ?? "docs";
  const siteName = /^\s*site_name\s*:\s*["']?([^"'\n]+?)["']?\s*$/m.exec(yaml)?.[1]?.trim();
  return { docsDir, siteName };
}

/** MkDocs → DocLight 迁移：复制 .md（含 admonition 转换）+ 解析 mkdocs.yml */
export function migrateMkDocs(options: MigrateOptions): MigrateResult {
  const source = resolve(options.sourceDir);
  const destDocs = resolve(options.destDir ?? ".", options.docsRel ?? "docs");
  mkdirSync(destDocs, { recursive: true });

  const mkdocsPath = join(source, "mkdocs.yml");
  const config = existsSync(mkdocsPath) ? parseMkdocsConfig(readFileSync(mkdocsPath, "utf8")) : { docsDir: "docs" };
  const docsSource = resolve(source, config.docsDir);
  const nav = existsSync(mkdocsPath) ? parseMkdocsNav(readFileSync(mkdocsPath, "utf8")) : [];

  const allMd = existsSync(docsSource) ? walkMd(docsSource).sort() : [];
  const ordered = [...new Set([...nav.filter((p) => allMd.includes(p)), ...allMd])];

  const copied: string[] = [];
  const skipped: string[] = [];
  const notes: string[] = [];
  let convertedTotal = 0;
  let collapsedTotal = 0;
  for (const rel of ordered) {
    const full = join(docsSource, rel);
    if (!statSync(full).isFile()) continue;
    const dest = join(destDocs, rel);
    mkdirSync(dirname(dest), { recursive: true });
    if (existsSync(dest)) {
      skipped.push(rel);
      continue;
    }
    const { text, converted, collapsed } = convertMkDocsAdmonitions(readFileSync(full, "utf8"));
    writeFileSync(dest, text);
    copied.push(rel);
    convertedTotal += converted;
    collapsedTotal += collapsed;
  }
  if (config.siteName) notes.push(`mkdocs.yml site_name「${config.siteName}」→ 建议写入 doclight.json title`);
  if (convertedTotal) notes.push(`已转换 ${convertedTotal} 个 admonition 为 DocLight 容器（:::info 等）`);
  if (collapsedTotal) notes.push(`${collapsedTotal} 个折叠 admonition（???）已降级为普通容器（DocLight 无折叠容器）`);
  if (!existsSync(mkdocsPath)) notes.push("未找到 mkdocs.yml（按 docs/ 目录直接复制）");

  return { copied, skipped, sidebar: nav, destDocs, notes };
}

/* ================= GitBook 迁移（MIG-002，Phase 5 迁移工具，08-roadmap） ================= */

/** GitBook hint style → DocLight 容器映射 */
const GITBOOK_HINT_MAP: Record<string, string> = {
  info: "info",
  tip: "tip",
  success: "tip",
  warning: "warning",
  danger: "danger",
};

/**
 * 纯函数：转换 GitBook hint / code 块为 DocLight 语法。
 * - {% hint style="info" %} … {% endhint %} → :::info … :::
 * - {% code title="x.js" %} → ```js（语言取扩展名）
 * - tabs / api-method 等无法干净转换的标签原样保留（诚实，不硬转）
 */
export function convertGitBookBlocks(text: string): { text: string; hints: number; codeBlocks: number } {
  let hints = 0;
  let codeBlocks = 0;
  const out = text
    .replace(/\{%\s*hint\s+style="(\w+)"\s*%\}\n?([\s\S]*?)\{%\s*endhint\s*%\}/g, (_all, style: string, body: string) => {
      const kind = GITBOOK_HINT_MAP[style.toLowerCase()];
      if (!kind) return _all;
      hints++;
      return `:::${kind}\n${body.trim()}\n:::`;
    })
    .replace(/\{%\s*code\s*(?:title="([^"]+)")?\s*%\}\n?([\s\S]*?)\{%\s*endcode\s*%\}/g, (_all, title: string | undefined, body: string) => {
      codeBlocks++;
      const ext = title?.match(/\.([\w+-]+)$/)?.[1];
      const lang = ext ? ` ${ext}` : "";
      return `\`\`\`${lang}\n${body.trim()}\n\`\`\``;
    });
  return { text: out, hints, codeBlocks };
}

/** GitBook → DocLight 迁移：解析 SUMMARY.md + 复制 .md（含 hint/code 转换） */
export function migrateGitBook(options: MigrateOptions): MigrateResult {
  const source = resolve(options.sourceDir);
  const destDocs = resolve(options.destDir ?? ".", options.docsRel ?? "docs");
  mkdirSync(destDocs, { recursive: true });

  const summaryPath = join(source, "SUMMARY.md");
  const nav = existsSync(summaryPath) ? parseSidebar(readFileSync(summaryPath, "utf8")) : [];
  const allMd = walkMd(source).sort();
  const ordered = [...new Set([...nav.filter((p) => allMd.includes(p)), ...allMd])];

  const copied: string[] = [];
  const skipped: string[] = [];
  const notes: string[] = [];
  let hintsTotal = 0;
  let codeTotal = 0;
  for (const rel of ordered) {
    const full = join(source, rel);
    if (!statSync(full).isFile()) continue;
    const base = rel.split("/").pop()!;
    if (base === "SUMMARY.md") {
      skipped.push(rel);
      continue;
    }
    const dest = join(destDocs, rel);
    mkdirSync(dirname(dest), { recursive: true });
    if (existsSync(dest)) {
      skipped.push(rel);
      continue;
    }
    const { text, hints, codeBlocks } = convertGitBookBlocks(readFileSync(full, "utf8"));
    writeFileSync(dest, text);
    copied.push(rel);
    hintsTotal += hints;
    codeTotal += codeBlocks;
  }
  if (hintsTotal) notes.push(`已转换 ${hintsTotal} 个 {% hint %} 块为 DocLight 容器`);
  if (codeTotal) notes.push(`已转换 ${codeTotal} 个 {% code %} 块为代码围栏`);
  if (!existsSync(summaryPath)) notes.push("未找到 SUMMARY.md（按目录直接复制全部 .md）");

  return { copied, skipped, sidebar: nav, destDocs, notes };
}
