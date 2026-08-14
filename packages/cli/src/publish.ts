/**
 * doclight publish —— 发布到内容空间（14-agent-content-space §4.3，CLI-005）
 *
 * 「发布 = 构建 + 落到某处」：对三种 provider 复用既有能力，不新造轮子——
 * - local：bundle 单文件便携包（CLI-002 复用）→ file:// URL（离线自用/分发）
 * - git：SSG 构建（CLI-003 deploy 复用，自动 /<repo>/ base）→ 推送 gh-pages → 公网 URL
 * - space：SSG 构建 → POST 站点清单到 Space API 端点 → 端点返回 URL（协议公开，可自建兼容服务）
 *
 * 原则（14 §4.2 CLI 是唯一事实来源 + 无伪造成功）：
 * - 所有结果结构化（PublishResult，index.ts 负责 --json 序列化，Agent 直接消费）
 * - 无远程 / 无端点 / 网络失败 → ok=false + 可读错误与修复步骤，绝不假装成功
 * - 远程认证与传输封装在 CLI 内部，Skill/Agent 无需理解 provider 细节
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BuildResult } from "./build.ts";
import { buildSite } from "./build.ts";
import { bundleSite, type BundleOptions } from "./bundle.ts";
import { deploySite } from "./deploy.ts";
import { loadConfiguredPlugins } from "./plugin-loader.ts";
import { takeSnapshot, type SnapshotInfo } from "./snapshot.ts";
import {
  DEFAULT_SPACE_ENDPOINT,
  DEFAULT_SPACE_NAME,
  loadSpaceConfig,
  type SpaceEntry,
  type SpaceProvider,
} from "./space.ts";

export interface PublishOptions {
  /** 项目根（.doclight/space.json 所在），默认 process.cwd() */
  root?: string;
  /** 文档根目录（转交 build/bundle） */
  dir?: string;
  /** 目标 provider：local / git / space（缺省用 active 空间） */
  to?: SpaceProvider;
  /** 指定目标空间名（.doclight/space.json 中已注册的空间） */
  spaceName?: string;
  /** 构建输出目录（默认随 provider） */
  outDir?: string;
  /** 站点标题 */
  title?: string;
  /** 覆盖 git 远程地址 */
  remoteUrl?: string;
  /** 覆盖 space API 端点 */
  endpoint?: string;
  /** space 访问令牌（可选） */
  token?: string;
  /** 跳过构建（复用既有产物，git/space 测试用） */
  skipBuild?: boolean;
  /** WORK-001：发布前自动快照（默认 true；--no-snapshot 关闭） */
  snapshot?: boolean;
}

export interface PublishResult {
  /** 是否完成发布（false = 需要人工步骤或修复） */
  ok: boolean;
  provider: SpaceProvider;
  spaceName: string;
  /** 可访问入口：file://（local）/ https://（git）/ 端点返回（space） */
  url?: string;
  /** local 产物文件完整路径 */
  file?: string;
  /** 人工步骤 / 修复指引（ok=false 时的逃生通道） */
  steps: string[];
  /** 失败可读消息（Agent 读 error 字段定位修复） */
  error?: string;
  /** 构建统计（skipBuild 时为空） */
  build?: BuildResult;
  /** WORK-001：本次发布前自动拍摄的内容快照（--no-snapshot 时为空） */
  snapshot?: SnapshotInfo;
  /** 耗时（ms） */
  ms: number;
}

/** 解析后的发布目标（空间配置项或按 provider 合成的临时项） */
interface PublishTarget {
  provider: SpaceProvider;
  spaceName: string;
  entry: SpaceEntry;
}

/** 合成 provider 的默认配置项（未注册空间时的兜底，如 --to git 但未 init） */
function ephemeralEntry(provider: SpaceProvider, options: PublishOptions): SpaceEntry {
  const entry: SpaceEntry = { provider, label: "", createdAt: new Date().toISOString() };
  if (provider === "local") entry.outputDir = options.outDir ?? "dist-bundle";
  if (provider === "git") {
    entry.remoteUrl = options.remoteUrl;
    entry.branch = "gh-pages";
  }
  if (provider === "space") {
    entry.endpoint = options.endpoint ?? DEFAULT_SPACE_ENDPOINT;
    if (options.token) entry.token = options.token;
  }
  return entry;
}

/** 解析发布目标：spaceName > 配置中按 provider 查找 > active 空间 > 全默认 local */
function resolveTarget(options: PublishOptions): PublishTarget | { error: string } {
  const root = resolve(options.root ?? ".");
  const cfg = loadSpaceConfig(root);

  // 显式空间名：必须已注册（不存在 → 结构化错误，不静默回退）
  if (options.spaceName) {
    const entry = cfg?.spaces[options.spaceName];
    if (entry) return { provider: entry.provider, spaceName: options.spaceName, entry };
    return { error: `空间 "${options.spaceName}" 不存在（运行 doclight space init 注册，或 doclight space status 查看）` };
  }

  // 显式 provider：优先用已注册的同 provider 空间，否则合成临时项
  if (options.to) {
    const named = cfg ? Object.entries(cfg.spaces).find(([, e]) => e.provider === options.to) : undefined;
    if (named) return { provider: options.to, spaceName: named[0], entry: named[1] };
    return { provider: options.to, spaceName: options.to, entry: ephemeralEntry(options.to, options) };
  }

  // 默认：active 空间；无配置 → local
  if (cfg && cfg.spaces[cfg.active]) {
    const entry = cfg.spaces[cfg.active]!;
    return { provider: entry.provider, spaceName: cfg.active, entry };
  }
  return { provider: "local", spaceName: DEFAULT_SPACE_NAME, entry: ephemeralEntry("local", options) };
}

/** 发布到 local：bundle 单文件 → file:// URL（离线自用/分发，14 §3.3） */
async function publishLocal(target: PublishTarget, options: PublishOptions, start: number): Promise<PublishResult> {
  const bundleOpts: BundleOptions = {
    dir: options.dir,
    outDir: target.entry.outputDir ?? options.outDir ?? "dist-bundle",
    title: options.title,
    // PLUG-009 接线：doclight.json plugins 随构建管线流动（与 runBundle 同源）
    buildPlugins: loadConfiguredPlugins(options.dir ?? "docs", resolve(options.root ?? ".")),
  };
  const result = await bundleSite(bundleOpts);
  const url = `file://${result.file.replace(/\\/g, "/")}`;
  return {
    ok: true,
    provider: "local",
    spaceName: target.spaceName,
    url,
    file: result.file,
    steps: ["本地空间无需额外步骤；file:// 离线可用，可双击或发给任何人"],
    ms: Date.now() - start,
  };
}

/** 发布到 git：SSG 构建（自动 /<repo>/ base）+ 推送 gh-pages → 公网 URL（复用 CLI-003） */
function publishGit(target: PublishTarget, options: PublishOptions, start: number): PublishResult {
  const remote = options.remoteUrl ?? target.entry.remoteUrl;
  const deploy = deploySite({
    repoRoot: resolve(options.root ?? "."),
    dir: options.dir,
    outDir: options.outDir,
    title: options.title,
    platform: "gh-pages",
    remoteUrl: remote,
    skipBuild: options.skipBuild,
  });
  if (deploy.published && deploy.url) {
    return {
      ok: true,
      provider: "git",
      spaceName: target.spaceName,
      url: deploy.url,
      steps: [`已发布：${deploy.url}`],
      build: deploy.build,
      ms: Date.now() - start,
    };
  }
  return {
    ok: false,
    provider: "git",
    spaceName: target.spaceName,
    steps: deploy.steps,
    error: deploy.steps.find((s) => s.includes("失败")) ?? "git 发布未能自动完成，见 steps",
    build: deploy.build,
    ms: Date.now() - start,
  };
}

/** 站点发布清单（Space API 协议：端点 POST /publish_site 接收此结构） */
export interface SiteManifest {
  siteTitle: string;
  siteUrl: string | null;
  totalDocs: number;
  docs: unknown[];
}

/** 读取构建产物中的站点清单（docs.json 元数据，Space API 的发布载荷） */
export function buildManifest(outDir: string): SiteManifest | null {
  try {
    const docs = JSON.parse(readFileSync(resolve(outDir, "docs.json"), "utf8")) as {
      siteTitle: string;
      siteUrl: string | null;
      totalDocs: number;
      docs: unknown[];
    };
    return { siteTitle: docs.siteTitle, siteUrl: docs.siteUrl ?? null, totalDocs: docs.totalDocs, docs: docs.docs };
  } catch {
    return null;
  }
}

/** 发布到 space：POST 站点清单到端点（协议公开，可自建兼容服务）。无端点/不可达 → 引导。 */
async function publishSpace(target: PublishTarget, options: PublishOptions, start: number): Promise<PublishResult> {
  const endpoint = options.endpoint ?? target.entry.endpoint ?? DEFAULT_SPACE_ENDPOINT;
  // 默认官方端点 = 托管未开通的诚实信号：不发起注定失败的请求，直接给引导
  const explicit = Boolean(options.endpoint) || (target.entry.endpoint !== undefined && target.entry.endpoint !== DEFAULT_SPACE_ENDPOINT);

  if (!explicit) {
    return {
      ok: false,
      provider: "space",
      spaceName: target.spaceName,
      steps: [
        "DocLight Space 托管尚未开通（Phase 4 读取端已完成；云端写入在 v1.0 后）。",
        "可选路径：",
        "1. doclight publish --to space --endpoint <自建兼容 API 地址>",
        "2. 或改用免费可用的 local / git provider",
      ],
      error: "未配置 Space 端点（默认官方端点尚未开通托管）",
      ms: Date.now() - start,
    };
  }

  // 构建 SSG（space 需要整站元数据：docs.json / llms.txt 随产物）
  const outDir = resolve(options.outDir ?? "dist-site");
  // PLUG-009 接线：doclight.json plugins 随构建管线流动（与 runBuild 同源）
  const buildPlugins = options.skipBuild ? [] : loadConfiguredPlugins(options.dir ?? "docs", resolve(options.root ?? "."));
  const build = options.skipBuild ? undefined : buildSite({ dir: options.dir, outDir, title: options.title, buildPlugins });

  // 未构建出 docs.json → 无法生成清单
  if (!options.skipBuild && !build) {
    return {
      ok: false,
      provider: "space",
      spaceName: target.spaceName,
      steps: ["doclight build 失败，无法生成站点清单"],
      error: "构建失败",
      ms: Date.now() - start,
    };
  }
  const manifest = buildManifest(outDir);
  if (!manifest) {
    return {
      ok: false,
      provider: "space",
      spaceName: target.spaceName,
      steps: ["先运行 doclight build 生成 dist-site/docs.json，或检查 --out-dir"],
      error: "产物缺少 docs.json（站点清单）",
      build,
      ms: Date.now() - start,
    };
  }

  try {
    const token = options.token ?? target.entry.token;
    const res = await fetch(`${endpoint.replace(/\/+$/, "")}/publish_site`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(manifest),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
    if (res.ok && body.ok !== false && body.url) {
      return {
        ok: true,
        provider: "space",
        spaceName: target.spaceName,
        url: body.url,
        steps: [`已发布：${body.url}`],
        build,
        ms: Date.now() - start,
      };
    }
    return {
      ok: false,
      provider: "space",
      spaceName: target.spaceName,
      steps: [`端点返回异常（HTTP ${res.status}）：${body.error ?? res.statusText}`, `检查端点 ${endpoint} 是否为兼容的 Space API`],
      error: body.error ?? `HTTP ${res.status}`,
      build,
      ms: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      provider: "space",
      spaceName: target.spaceName,
      steps: [`无法连接 Space 端点 ${endpoint}`, "1. 检查端点地址与网络；2. 或改用 local / git provider"],
      error: `端点不可达：${(err as Error).message}`,
      build,
      ms: Date.now() - start,
    };
  }
}

/**
 * 执行发布（供命令与测试复用）：解析目标 → 发布前自动快照（WORK-001，可回滚）→
 * 按 provider 分发 → 结构化结果。默认路径：active 空间（无配置 → local bundle）。
 */
export async function publishSite(options: PublishOptions = {}): Promise<PublishResult> {
  const start = Date.now();
  const target = resolveTarget(options);
  if ("error" in target) {
    return { ok: false, provider: "local", spaceName: options.spaceName ?? DEFAULT_SPACE_NAME, steps: [target.error], error: target.error, ms: Date.now() - start };
  }
  // WORK-001：发布前对内容源自动快照（--no-snapshot 关闭；快照失败不阻断发布，但写入结果提示）
  let snapshot: SnapshotInfo | undefined;
  if (options.snapshot !== false) {
    const snap = takeSnapshot(resolve(options.root ?? "."), options.dir ?? "docs");
    if ("error" in snap) {
      return {
        ok: false,
        provider: target.provider,
        spaceName: target.spaceName,
        steps: [snap.error, "快照失败 → 发布中止（内容安全优先；--no-snapshot 可强制跳过）"],
        error: snap.error,
        ms: Date.now() - start,
      };
    }
    snapshot = snap;
  }
  if (target.provider === "local") {
    const r = await publishLocal(target, options, start);
    return { ...r, snapshot };
  }
  if (target.provider === "git") {
    const r = publishGit(target, options, start);
    return { ...r, snapshot };
  }
  const r = await publishSpace(target, options, start);
  return { ...r, snapshot };
}
