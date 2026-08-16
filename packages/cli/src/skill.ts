/**
 * doclight skill —— Agent 技能自动安装（AGENT-001，14 §2.3 内容空间接入）
 *
 * 场景：DocLight 的 Agent 技能（SKILL.md 规范：.claude/skills/<name>/SKILL.md +
 * /publish 斜杠命令 .claude/commands/publish.md）随 CLI 分发（构建时复制进
 * packages/cli/dist/skills + dist/commands，与 themes 同模式），一条命令装进
 * 目标 Agent 的技能目录——默认 Claude Code 用户级 ~/.claude：
 *
 *   doclight skill install              → ~/.claude/skills/<name>/ + ~/.claude/commands/publish.md
 *   doclight skill install --target <root>   指定 Agent 配置根目录（skills/ + commands/ 为子目录）
 *   doclight skill install --force      覆盖已存在且内容不同的技能（默认跳过，不静默覆盖用户定制）
 *   doclight skill install --dry-run    只列计划不写入（Agent 先行确认）
 *   doclight skill install --json       结构化输出（Agent 直接解析）
 *   doclight skill list                 列出可安装技能与目标安装状态
 *
 * 设计（决策⑪ 同源：CLI 是唯一事实来源）：技能文件 = 权威源，命令只做「解析 +
 * 复制 + 校验 + 幂等报告」，不生成、不修改技能内容。
 * 诚实原则（决策⑬ 同源）：SKILL.md 缺 frontmatter（name/description）→ 跳过并
 * 报告错误，不伪造成功；失败不中断其余技能安装。
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** SKILL.md frontmatter 元数据（name / description 必含） */
export interface SkillMeta {
  name: string;
  description: string;
}

/** 单个技能（或命令）的安装状态（skill list 用） */
export interface SkillInfo extends SkillMeta {
  /** 是否已安装到目标 */
  installed: boolean;
  /** 源 SKILL.md / 命令文件路径 */
  sourcePath: string;
  /** 目标路径 */
  targetPath: string;
}

/** 安装计划动作（planSkillInstall 输出，纯函数可单测） */
export interface SkillPlanAction {
  /** skill = SKILL.md 技能；command = 斜杠命令 */
  type: "skill" | "command";
  name: string;
  kind: "install" | "overwrite" | "skip" | "invalid";
  reason?: string;
  source: string;
  target: string;
}

/** 安装结果（双读友好：installed/skipped/errors + steps） */
export interface SkillInstallResult {
  ok: boolean;
  sourceRoot: string;
  targetRoot: string;
  installed: string[];
  skipped: Array<{ name: string; reason: string }>;
  errors: Array<{ name: string; reason: string }>;
  steps: string[];
}

/** 技能资源定位结果（dist 形态 / 源码形态） */
export interface SkillSource {
  /** 技能目录（含 <name>/SKILL.md 子目录） */
  skills?: string;
  /** 命令目录（含 publish.md 等） */
  commands?: string;
}

/* ================= 源解析 ================= */

/**
 * 定位技能权威源（AGENT-001）：
 * 1. dist 形态：<CLI 模块目录>/skills + <CLI 模块目录>/commands（npm 全局安装，
 *    build-cli.mjs 已把 .claude/skills + .claude/commands 复制进 dist，与 themes 同模式）
 * 2. 源码形态：从模块目录向上找 <根>/.claude/skills + <根>/.claude/commands（本仓库 dogfood）
 * 两者任一缺失则该侧为空（如旧产物无 commands，仍可装技能）。找不到 → 全空，调用方报错。
 */
export function resolveSource(moduleUrl: string): SkillSource {
  const moduleDir = dirname(fileURLToPath(moduleUrl));
  const distSkills = join(moduleDir, "skills");
  const distCommands = join(moduleDir, "commands");
  const hasDist = existsSync(distSkills) || existsSync(distCommands);
  if (hasDist) {
    return {
      skills: existsSync(distSkills) ? distSkills : undefined,
      commands: existsSync(distCommands) ? distCommands : undefined,
    };
  }
  let dir = moduleDir;
  while (dir !== dirname(dir)) {
    const claude = join(dir, ".claude");
    const s = join(claude, "skills");
    const c = join(claude, "commands");
    if (existsSync(s) || existsSync(c)) {
      return {
        skills: existsSync(s) ? s : undefined,
        commands: existsSync(c) ? c : undefined,
      };
    }
    // 仓库边界：见到 .git 即停止向上——防止从无关目录逃逸进用户主目录 ~/.claude
    // （把用户已安装的技能误当 DocLight 权威源）
    if (existsSync(join(dir, ".git"))) return {};
    dir = dirname(dir);
  }
  return {};
}

/* ================= 元数据解析与校验 ================= */

/**
 * 解析 SKILL.md frontmatter（name/description）。非法（缺 frontmatter 或 name）→ null，
 * 安装时跳过并报告——诚实原则，不伪造成功。
 */
export function parseSkillMeta(skillDir: string): SkillMeta | null {
  const file = join(skillDir, "SKILL.md");
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  const m = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/.exec(text);
  if (!m) return null;
  const fm = m[1] ?? "";
  const name = /(?:^|\n)\s*name\s*:\s*"?([^"\n]+)"?\s*(?:\n|$)/.exec(fm)?.[1]?.trim();
  const description = /(?:^|\n)\s*description\s*:\s*(.+?)\s*(?:\n|$)/.exec(fm)?.[1]?.trim();
  if (!name) return null;
  return { name, description: description ?? "" };
}

/* ================= 安装计划（纯函数） ================= */

/** 目标根目录（默认 ~/.claude：skills/ + commands/ 为子目录，Claude Code 布局） */
export function defaultTargetRoot(): string {
  return join(homedir(), ".claude");
}

/**
 * 计算安装计划（纯函数，可 Node 单测）。
 * 每个技能/命令一条动作：目标不存在 → install；已存在且内容相同 → skip（幂等）；
 * 已存在且内容不同 → force ? overwrite : skip（默认不静默覆盖用户定制）。
 * 技能缺合法 frontmatter → invalid（跳过 + 报错）。
 */
export function planSkillInstall(source: SkillSource, targetRoot: string, force: boolean): SkillPlanAction[] {
  const actions: SkillPlanAction[] = [];
  const same = (a: string, b: string): boolean => {
    try {
      return readFileSync(a, "utf8") === readFileSync(b, "utf8");
    } catch {
      return false;
    }
  };
  const planItem = (type: "skill" | "command", name: string, sourceFile: string): void => {
    const sub = type === "skill" ? "skills" : "commands";
    // 技能目标 = <target>/skills/<name>/SKILL.md（与 sourceFile 同形状，dirname 即技能目录）；
    // 命令目标 = <target>/commands/<name>.md
    const targetFile = type === "skill" ? join(targetRoot, sub, name, "SKILL.md") : join(targetRoot, sub, name);
    if (!existsSync(sourceFile)) return;
    if (type === "skill" && !parseSkillMeta(dirname(sourceFile))) {
      actions.push({ type, name, kind: "invalid", reason: "SKILL.md 缺合法 frontmatter（name/description）", source: sourceFile, target: targetFile });
      return;
    }
    if (!existsSync(targetFile)) {
      actions.push({ type, name, kind: "install", source: sourceFile, target: targetFile });
    } else if (same(sourceFile, targetFile)) {
      actions.push({ type, name, kind: "skip", reason: "已安装且内容相同", source: sourceFile, target: targetFile });
    } else {
      actions.push(
        force
          ? { type, name, kind: "overwrite", reason: "--force 覆盖", source: sourceFile, target: targetFile }
          : { type, name, kind: "skip", reason: "已存在且内容不同（--force 覆盖）", source: sourceFile, target: targetFile },
      );
    }
  };

  for (const skillName of source.skills ? readdirSync(source.skills, { withFileTypes: true }) : []) {
    if (!skillName.isDirectory()) continue;
    const dir = join(source.skills!, skillName.name);
    if (!existsSync(join(dir, "SKILL.md"))) continue; // 技能目录必须含 SKILL.md（无则视为非技能目录，跳过不报错）
    planItem("skill", skillName.name, join(dir, "SKILL.md"));
  }
  for (const cmd of source.commands ? readdirSync(source.commands) : []) {
    if (!cmd.endsWith(".md")) continue;
    planItem("command", cmd, join(source.commands!, cmd));
  }
  return actions;
}

/* ================= 执行安装 ================= */

export interface SkillInstallOptions {
  /** 显式指定源（缺省按模块位置解析） */
  source?: SkillSource;
  /** 目标 Agent 配置根目录（缺省 ~/.claude） */
  targetRoot?: string;
  /** 覆盖已存在且内容不同的文件 */
  force?: boolean;
  /** 只列计划不写入 */
  dryRun?: boolean;
  /** 源解析基准（dist/skills 或 .claude/skills 相对此模块定位；index.ts 传 import.meta.url） */
  moduleUrl: string;
}

/** 执行技能安装（幂等 + 诚实：缺 frontmatter / 写失败记入 errors，不中断其余） */
export function skillInstall(options: SkillInstallOptions): SkillInstallResult {
  const source = options.source ?? resolveSource(options.moduleUrl);
  if (!source.skills && !source.commands) {
    return {
      ok: false,
      sourceRoot: "(未找到)",
      targetRoot: options.targetRoot ?? defaultTargetRoot(),
      installed: [],
      skipped: [],
      errors: [{ name: "source", reason: "找不到 DocLight 技能资源（dist/skills 或 .claude/skills）——请确认 CLI 安装完整" }],
      steps: ["检查: packages/cli/dist/skills/ 或仓库根 .claude/skills/ 是否存在", "修复: 重新运行 npm run build（build-cli 会把技能复制进 dist）"],
    };
  }
  const targetRoot = options.targetRoot ?? defaultTargetRoot();
  const actions = planSkillInstall(source, targetRoot, options.force ?? false);
  const installed: string[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const errors: Array<{ name: string; reason: string }> = [];

  for (const a of actions) {
    if (a.kind === "invalid") {
      errors.push({ name: a.name, reason: a.reason ?? "SKILL.md 缺合法 frontmatter" });
      continue;
    }
    if (a.kind === "skip") {
      skipped.push({ name: a.name, reason: a.reason ?? "已存在" });
      continue;
    }
    if (options.dryRun) {
      installed.push(`${a.kind === "overwrite" ? "覆盖" : "安装"} ${a.name}`);
      continue;
    }
    try {
      mkdirSync(dirname(a.target), { recursive: true });
      // 技能目录整体复制（SKILL.md + 未来资产），命令为单文件复制
      if (a.type === "skill") {
        cpSync(dirname(a.source), dirname(a.target), { recursive: true, force: true });
      } else {
        cpSync(a.source, a.target, { force: true });
      }
      installed.push(a.name);
    } catch (err) {
      errors.push({ name: a.name, reason: `写入失败：${(err as Error).message}` });
    }
  }

  const steps = [
    `源: ${source.skills ?? "(无技能)"}${source.commands ? ` + ${source.commands}` : ""}`,
    `目标: ${targetRoot}（skills/ + commands/）`,
    options.dryRun ? "dry-run：仅列出计划，未写入任何文件" : `已安装 ${installed.length} 项，跳过 ${skipped.length} 项，错误 ${errors.length} 项`,
    "验证: doclight skill list",
  ];
  return { ok: errors.length === 0, sourceRoot: source.skills ?? source.commands ?? "(未找到)", targetRoot, installed, skipped, errors, steps };
}

/* ================= 列表 ================= */

/** 列出可安装技能与目标安装状态（skill list） */
export function skillList(options: { source?: SkillSource; targetRoot?: string; moduleUrl: string }): SkillInfo[] {
  const source = options.source ?? resolveSource(options.moduleUrl);
  const targetRoot = options.targetRoot ?? defaultTargetRoot();
  const out: SkillInfo[] = [];
  for (const skillName of source.skills ? readdirSync(source.skills, { withFileTypes: true }) : []) {
    if (!skillName.isDirectory()) continue;
    const dir = join(source.skills!, skillName.name);
    if (!existsSync(join(dir, "SKILL.md"))) continue; // 技能目录必须含 SKILL.md（与 planSkillInstall 同规则，无则忽略）
    const meta = parseSkillMeta(dir);
    const targetPath = join(targetRoot, "skills", skillName.name, "SKILL.md");
    out.push({
      name: meta?.name ?? skillName.name,
      description: meta?.description ?? "（SKILL.md 缺 frontmatter）",
      installed: existsSync(targetPath),
      sourcePath: join(dir, "SKILL.md"),
      targetPath,
    });
  }
  if (source.commands) {
    for (const cmd of readdirSync(source.commands)) {
      if (!cmd.endsWith(".md")) continue;
      const targetPath = join(targetRoot, "commands", cmd);
      out.push({
        name: cmd,
        description: "斜杠命令（/publish 等）",
        installed: existsSync(targetPath),
        sourcePath: join(source.commands!, cmd),
        targetPath,
      });
    }
  }
  return out;
}
