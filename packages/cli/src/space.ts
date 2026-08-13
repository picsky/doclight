/**
 * doclight space —— 空间管理（14-agent-content-space §3，CLI-006）
 *
 * 「Agent 内容空间」的可插拔 provider 抽象：空间是发布目标（local / git / space），
 * 不绑定 DocLight 私有服务。本文档管理空间配置（.doclight/space.json），
 * 提供 init（初始化/注册空间）/ switch（切换 active）/ status（查看状态）三动作。
 *
 * 设计要点（14 §3.4 无锁入）：
 * - 空间配置独立于 doclight.json（不入契约 schema，避免触碰受保护契约文件；
 *   且空间是运行时状态而非站点配置，本就该分离）。
 * - 零依赖：仅 node:fs/path；git 远程探测复用 deploy.ts 的 gitRemote（只读 shell 调用）。
 * - 所有命令返回结构化结果对象（Agent 可直接消费；index.ts 负责 --json 序列化）。
 * - 不伪造成功：git 无远程 / space 无端点时返回引导步骤，调用方决定是否 ok。
 *
 * 配置形态（.doclight/space.json）：
 *   { "version": 1, "active": "local",
 *     "spaces": { "local": { provider, label, createdAt, outputDir? },
 *                 "git":   { provider, label, createdAt, remoteUrl?, branch? },
 *                 "space": { provider, label, createdAt, endpoint?, token? } } }
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gitRemote } from "./deploy.ts";

export type SpaceProvider = "local" | "git" | "space";

export interface SpaceEntry {
  provider: SpaceProvider;
  label: string;
  createdAt: string;
  /** local：发布产物目录（默认 dist-bundle，bundle 单文件所在） */
  outputDir?: string;
  /** git：远程地址（gh-pages 推送目标） */
  remoteUrl?: string;
  /** git：目标分支（默认 gh-pages） */
  branch?: string;
  /** space：DocLight Space API 端点（缺省官方端点 doclight.dev） */
  endpoint?: string;
  /** space：访问令牌（可选） */
  token?: string;
}

export interface SpaceConfig {
  version: number;
  active: string;
  spaces: Record<string, SpaceEntry>;
}

export interface SpaceInitOptions {
  /** 项目根目录，默认当前目录 */
  root?: string;
  /** provider：local / git / space，默认 local */
  provider?: SpaceProvider;
  /** 空间名（默认取 provider 名：local / git / space） */
  name?: string;
  /** 友好标签（缺省按 provider 生成） */
  label?: string;
  /** local：发布产物目录（默认 dist-bundle） */
  outputDir?: string;
  /** git：远程地址（缺省自动探测 origin） */
  remoteUrl?: string;
  /** git：目标分支（默认 gh-pages） */
  branch?: string;
  /** space：API 端点（缺省官方端点） */
  endpoint?: string;
  /** space：访问令牌（可选） */
  token?: string;
}

export interface SpaceInitResult {
  root: string;
  /** 本次 init 后完整的空间配置 */
  config: SpaceConfig;
  /** 是否新建了配置文件（false = 追加/幂等） */
  created: boolean;
  /** 新增并激活的空间名 */
  space: string;
  /** git/space 可直接得到的访问入口（否则 undefined） */
  url?: string;
  /** 引导步骤（git 无远程 / space 无端点时的逃生通道） */
  steps: string[];
}

export interface SpaceSwitchResult {
  root: string;
  active: string;
  ok: boolean;
  error?: string;
}

export interface SpaceStatusResult {
  root: string;
  /** 是否已初始化（无 .doclight/space.json = false） */
  initialized: boolean;
  active?: string;
  provider?: SpaceProvider;
  label?: string;
  url?: string;
  /** 各空间简要状态（Agent 可读） */
  spaces: Array<{ name: string; provider: SpaceProvider; label: string; active: boolean; url?: string; steps: string[] }>;
}

export const SPACE_CONFIG_VERSION = 1;
/** DocLight Space 官方端点（Phase 4 尚未开通托管，端点可指向自建/兼容实现） */
export const DEFAULT_SPACE_ENDPOINT = "https://space.doclight.dev/api";
/** 默认空间名（无配置时 publish 的兜底目标） */
export const DEFAULT_SPACE_NAME = "local";

/** 空间配置文件路径（.doclight/space.json，相对项目根） */
export function spaceConfigFile(root: string): string {
  return join(resolve(root), ".doclight", "space.json");
}

/** 读取空间配置；不存在/损坏返回 null（调用方走默认） */
export function loadSpaceConfig(root: string): SpaceConfig | null {
  const file = spaceConfigFile(root);
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as SpaceConfig;
    if (raw && typeof raw === "object" && typeof raw.active === "string" && raw.spaces && typeof raw.spaces === "object") {
      return raw;
    }
  } catch {
    /* 配置损坏：视为未初始化，不崩栈 */
  }
  return null;
}

/** 写入空间配置（幂等创建父目录） */
export function saveSpaceConfig(root: string, cfg: SpaceConfig): void {
  const file = spaceConfigFile(root);
  mkdirSync(join(resolve(root), ".doclight"), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
}

/** 生成默认标签（双读：人可读 + Agent 可辨） */
function defaultLabel(provider: SpaceProvider): string {
  if (provider === "local") return "本地空间（bundle 单文件）";
  if (provider === "git") return "Git 托管（GitHub Pages）";
  return "DocLight Space（远程云端）";
}

/** git 远程 → GitHub 项目页 URL（复用 deploy 解析；非 GitHub 返回 null） */
function entryUrl(entry: SpaceEntry): string | undefined {
  if (entry.provider === "local") return undefined;
  if (entry.provider === "git" && entry.remoteUrl) {
    // 与 deploy.ts 同一解析函数，返回项目页 URL
    const m = /github\.com(?::\d+)?[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/.exec(entry.remoteUrl.trim());
    if (m) return `https://${m[1]}.github.io/${m[2]}/`;
    return undefined;
  }
  if (entry.provider === "space" && entry.endpoint) return entry.endpoint.replace(/\/api$/, "");
  return undefined;
}

/** 某空间的引导/检查步骤（不伪造成功：本地空间无需步骤） */
function entrySteps(entry: SpaceEntry): string[] {
  if (entry.provider === "local") return [];
  if (entry.provider === "git") {
    if (!entry.remoteUrl) {
      return [
        "未检测到 git 远程。可任选其一：",
        "1. doclight space init --provider git --remote git@github.com:<user>/<repo>.git",
        "2. 或先 git remote add origin <url> 后再 doclight space init --provider git",
      ];
    }
    return [];
  }
  if (!entry.endpoint) {
    return [
      "未配置 Space 端点。DocLight Space 托管尚未开通（Phase 4 读取端已完成，写入端云端在 v1.0 后）：",
      "1. 可指向自建/兼容 Space API 服务：doclight space init --provider space --endpoint <url>",
      "2. 或先使用 local / git provider（免费、完整可用）",
    ];
  }
  return [];
}

/** 执行 space init：初始化或注册空间并设为 active（幂等）。 */
export function spaceInit(options: SpaceInitOptions = {}): SpaceInitResult {
  const root = resolve(options.root ?? ".");
  const provider: SpaceProvider = options.provider ?? "local";
  const name = options.name ?? provider;
  const existing = loadSpaceConfig(root);
  const config: SpaceConfig = existing ?? { version: SPACE_CONFIG_VERSION, active: "", spaces: {} };

  // 幂等：同名空间已存在 → 仅切换 active，不覆盖已有配置
  const created = existing === null;
  let entry: SpaceEntry;
  if (config.spaces[name]) {
    entry = config.spaces[name]!;
  } else {
    entry = {
      provider,
      label: options.label ?? defaultLabel(provider),
      createdAt: new Date().toISOString(),
    };
    if (provider === "local") entry.outputDir = options.outputDir ?? "dist-bundle";
    if (provider === "git") {
      // 远程缺省自动探测 origin；探测不到不阻塞（entrySteps 给出引导）
      entry.remoteUrl = options.remoteUrl ?? gitRemote(root) ?? undefined;
      entry.branch = options.branch ?? "gh-pages";
    }
    if (provider === "space") {
      // 托管未开通（Phase 4 写入端云端在 v1.0 后）：不预填官方端点，否则误导「已配好」。
      // 端点留空 → status/publish 走引导（可指向自建兼容 Space API）。
      if (options.endpoint) entry.endpoint = options.endpoint;
      if (options.token) entry.token = options.token;
    }
    config.spaces[name] = entry;
  }
  config.active = name;
  saveSpaceConfig(root, config);

  const steps = entrySteps(entry);
  return { root, config, created, space: name, url: entryUrl(entry), steps };
}

/** 执行 space switch：切换 active 空间。不存在返回 ok=false + 可读错误。 */
export function spaceSwitch(root: string, name: string): SpaceSwitchResult {
  const config = loadSpaceConfig(root);
  const resolved = resolve(root);
  if (!config || !config.spaces[name]) {
    return { root: resolved, active: name, ok: false, error: `空间 "${name}" 不存在（先运行 doclight space init）` };
  }
  config.active = name;
  saveSpaceConfig(resolved, config);
  return { root: resolved, active: name, ok: true };
}

/** 执行 space status：返回结构化状态（未初始化也返回可读结果，不抛错）。 */
export function spaceStatus(root: string): SpaceStatusResult {
  const resolved = resolve(root);
  const config = loadSpaceConfig(resolved);
  if (!config) {
    return {
      root: resolved,
      initialized: false,
      spaces: [{ name: DEFAULT_SPACE_NAME, provider: "local", label: defaultLabel("local"), active: true, steps: [] }],
    };
  }
  const activeEntry = config.spaces[config.active];
  const spaces = Object.entries(config.spaces).map(([name, entry]) => ({
    name,
    provider: entry.provider,
    label: entry.label,
    active: name === config.active,
    url: entryUrl(entry),
    steps: entrySteps(entry),
  }));
  return {
    root: resolved,
    initialized: true,
    active: config.active,
    provider: activeEntry?.provider,
    label: activeEntry?.label,
    url: activeEntry ? entryUrl(activeEntry) : undefined,
    spaces,
  };
}
