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

  return { copied, skipped, sidebar, destDocs };
}
