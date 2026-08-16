/**
 * 导航树生成（03 §3.4，NAV-001）
 *
 * 纯数据变换（renderer 边界：不做 I/O）：输入文件路径列表（如目录扫描结果），
 * 输出嵌套导航树 / docs.json。目录扫描（I/O）由调用方（cli/dev server）完成。
 *
 * 排序规则（03 §3.4.1）：
 * 1. README.md / index.md 置顶（README 先于 index）
 * 2. 数字前缀优先（01-intro 在 02-guide 前，且先于无数字前缀项）
 * 3. 其余按字母序（localeCompare zh 友好）
 * 4. 文件在前、目录（分组）在后
 * 5. 目录含 README/index 时，其 title 可链接到该页（index 指针）
 */

export interface NavFile {
  type: "file";
  /** 站点内文档路径，如 "guide/quickstart.md" */
  path: string;
  title: string;
}

export interface NavGroup {
  type: "group";
  /** 目录名 */
  title: string;
  /** 目录相对路径（含尾部 /），如 "guide/" */
  path: string;
  /** 目录下置顶页（README/index.md）的路径，有则 title 可链接 */
  index?: string;
  items: NavNode[];
}

export type NavNode = NavFile | NavGroup;

export interface DocsJson {
  version: 1;
  generatedAt: string;
  nav: NavNode[];
}

/** 取文件名主干作为默认标题（如 "guide/quickstart.md" → "quickstart"） */
function stem(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.replace(/\.md$/, "");
}

/** 置顶优先级：README=2、index=1、其他=0 */
function indexRank(path: string): number {
  const base = path.slice(path.lastIndexOf("/") + 1);
  if (/^readme\.md$/i.test(base)) return 2;
  if (/^index\.md$/i.test(base)) return 1;
  return 0;
}

/** 前导数字；无则 null（数字前缀优先规则用） */
function leadingNumber(name: string): number | null {
  const m = /^(\d+)/.exec(name);
  return m ? Number(m[1]) : null;
}

/** 排序：置顶页（README>index）→ 数字前缀 → 字母序 */
function compareTitles(a: string, b: string): number {
  const ra = indexRank(a);
  const rb = indexRank(b);
  if (ra !== rb) return rb - ra;
  const aNum = leadingNumber(a);
  const bNum = leadingNumber(b);
  if (aNum !== null && bNum !== null) return aNum - bNum;
  if (aNum !== null) return -1; // 有数字前缀的项先排
  if (bNum !== null) return 1;
  return a.localeCompare(b, "zh-CN");
}

interface NodeAcc {
  name: string; // 段名（文件名或目录名），用于排序
  file?: { path: string; title: string };
  group?: { path: string; children: Map<string, NodeAcc> };
}

/** 文件在前、目录在后；同类内按 compareTitles */
function sortAccs(accs: NodeAcc[]): NodeAcc[] {
  return [...accs].sort((a, b) => {
    const aKind = a.file ? 0 : 1;
    const bKind = b.file ? 0 : 1;
    if (aKind !== bKind) return aKind - bKind;
    return compareTitles(a.name, b.name);
  });
}

/**
 * 构建导航树。
 * @param files 相对文档路径列表（正斜杠分隔），如 ["README.md", "guide/basic.md"]
 * @param titles 可选：路径 → 标题（调用方可从 frontmatter 提取；缺省用文件名主干）
 */
export function buildNavTree(files: string[], titles?: Record<string, string>): NavNode[] {
  const root: Map<string, NodeAcc> = new Map();

  for (const file of files) {
    const segments = file.split("/").filter(Boolean);
    if (segments.length === 0) continue;
    let level = root;
    let prefix = ""; // 当前目录前缀（累积），用于 group.path
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      const isLast = i === segments.length - 1;
      if (isLast) {
        level.set(seg, { name: seg, file: { path: file, title: titles?.[file] ?? stem(file) } });
      } else {
        const dirPath = prefix + seg + "/";
        let existing = level.get(seg);
        if (!existing?.group) {
          existing = { name: seg, group: { path: dirPath, children: new Map() } };
          level.set(seg, existing);
        }
        prefix = dirPath;
        level = existing.group!.children;
      }
    }
  }

  const toNode = (acc: NodeAcc): NavNode => {
    if (acc.file) return { type: "file", path: acc.file.path, title: acc.file.title };
    const group = acc.group!;
    const items = sortAccs([...group.children.values()]);
    // index 指针：排序后（README/index 置顶）首个置顶文件。2026-08 由遍历时逐级
    // 设置改为 toNode 计算——嵌套目录的 README 不再污染父组 index（此前实测 bug：
    // 语法/测试/README.md 误设 语法.index，侧边栏出现重复/错位条目）
    const index = items.find((c) => c.file && indexRank(c.file.path) > 0)?.file?.path;
    return {
      type: "group",
      title: acc.name,
      path: group.path,
      index,
      items: items.map(toNode),
    };
  };

  return sortAccs([...root.values()]).map(toNode);
}

/** 生成 docs.json（03 §3.4.3）。generatedAt 由调用方注入（可测性），缺省取当前时间。 */
export function buildDocsJson(files: string[], options: { titles?: Record<string, string>; generatedAt?: string } = {}): DocsJson {
  return {
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    nav: buildNavTree(files, options.titles),
  };
}
