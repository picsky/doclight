/**
 * doclight deploy —— 一键部署（05-ssg-build §5.5 + 13-deployment-distribution §2.1，CLI-003）
 *
 * 零依赖实现（只 shell 调 git）：构建 → 平台适配 → 返回可用 URL。
 * - gh-pages（核心）：git worktree 创建/更新 gh-pages 分支 → force push → 返回
 *   https://<user>.github.io/<repo>/。项目页自动以 /<repo>/ 为 base 构建（子路径部署，
 *   见 build --base），内部链接/资源 URL 全部正确。
 * - cloudflare-pages / netlify：检测对应 CLI（wrangler / netlify），给出上传命令；
 *   未登录/未安装时输出人工指引（不阻塞：结构化错误 + 步骤）。
 *
 * 原则（13 §2.1）：deploy 是 build 的延伸，不引入新概念；默认路径零配置可用。
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildSite, type BuildResult } from "./build.ts";

export type DeployPlatform = "gh-pages" | "cloudflare-pages" | "netlify";

export interface DeployOptions {
  /** 文档根目录（转交 buildSite） */
  dir?: string;
  /** 构建输出目录（默认 ./dist-site） */
  outDir?: string;
  /** 站点标题 */
  title?: string;
  /** 目标平台；缺省自动检测（有 GitHub 远程 → gh-pages） */
  platform?: DeployPlatform;
  /** 覆盖 git 远程地址自动检测 */
  remoteUrl?: string;
  /** 跳过构建（复用既有产物） */
  skipBuild?: boolean;
  /** git 仓库根目录（默认 process.cwd()；测试注入用） */
  repoRoot?: string;
}

export interface DeployResult {
  platform: DeployPlatform;
  /** 部署成功后可直接访问的 URL */
  url?: string;
  /** 构建统计（skipBuild 时为空） */
  build?: BuildResult;
  /** 人工操作步骤（平台无 CLI/未认证时输出指引） */
  steps: string[];
  /** 是否已完成推送（false = 需要人工步骤） */
  published: boolean;
}

/** 纯函数：GitHub 远程 URL → 项目页信息（user/repo/base/url）。非 GitHub 返回 null。 */
export function ghPagesInfo(remoteUrl: string): { user: string; repo: string; base: string; url: string } | null {
  // 支持 https://github.com/u/r.git / git@github.com:u/r.git / ssh://git@github.com:22/u/r.git
  const m = /github\.com(?::\d+)?[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/.exec(remoteUrl.trim());
  if (!m) return null;
  const user = m[1]!;
  const repo = m[2]!;
  return { user, repo, base: `/${repo}`, url: `https://${user}.github.io/${repo}/` };
}

/** 读取 git 远程 origin URL（无远程/非 git 仓库返回 null） */
export function gitRemote(repoRoot: string): string | null {
  const r = spawnSync("git", ["remote", "get-url", "origin"], { cwd: repoRoot, encoding: "utf8" });
  if (r.status !== 0) return null;
  const url = r.stdout.trim();
  return url || null;
}

/** 纯函数：平台 → 人工部署指引（无 CLI/未认证时的逃生通道） */
export function deployGuide(platform: DeployPlatform): string[] {
  if (platform === "gh-pages") {
    return [
      "1. 确保已 git push 到 GitHub 仓库",
      "2. doclight build && git push origin gh-pages 或本命令直接推送",
      "3. GitHub 仓库 Settings → Pages → Branch: gh-pages，保存后即可访问",
    ];
  }
  if (platform === "cloudflare-pages") {
    return [
      "1. 安装并登录 Wrangler：npm i -g wrangler && wrangler login",
      "2. 创建项目：wrangler pages project create <name>",
      "3. 上传产物：wrangler pages deploy dist-site --project-name <name>",
    ];
  }
  return [
    "1. 安装并登录 Netlify CLI：npm i -g netlify-cli && netlify login",
    "2. 部署：netlify deploy --dir dist-site --prod",
    "3. 或到 app.netlify.com 拖拽 dist-site 目录上传",
  ];
}

/** 检测平台 CLI 是否可用（wrangler / netlify） */
function cliAvailable(cmd: string): boolean {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { encoding: "utf8" });
  return r.status === 0;
}

/** 把 outDir 产物推送为 gh-pages 分支（git worktree，零依赖）。成功返回 push 输出。 */
export function publishGhPages(
  repoRoot: string,
  outDir: string,
  _info: { user: string; repo: string; base: string; url: string }
): { ok: boolean; output: string } {
  const tmp = mkdtempSync(join(repoRoot, ".doclight-gh-pages-"));
  try {
    // 复用已有 gh-pages 分支（worktree add --detach 检出到临时目录），否则 -b 新建
    const branchExists = spawnSync("git", ["rev-parse", "--verify", "gh-pages"], { cwd: repoRoot }).status === 0;
    const add = spawnSync(
      "git",
      branchExists ? ["worktree", "add", "--detach", tmp, "gh-pages"] : ["worktree", "add", "-b", "gh-pages", tmp],
      { cwd: repoRoot, encoding: "utf8" }
    );
    if (add.status !== 0) return { ok: false, output: `worktree 创建失败：${add.stderr.trim()}` };

    // 清空 worktree 后复制构建产物（.nojekyll：GitHub Pages 不跑 Jekyll，保留 _ 前缀文件）
    for (const name of ["index.html", "display.js", "search-index.json", "sitemap.xml", "robots.txt", "vendor", "og"]) {
      rmSync(join(tmp, name), { recursive: true, force: true });
    }
    cpSync(outDir, tmp, { recursive: true });
    writeNoJekyll(join(tmp, ".nojekyll"));

    const addAll = spawnSync("git", ["add", "-A"], { cwd: tmp, encoding: "utf8" });
    if (addAll.status !== 0) return { ok: false, output: `git add 失败：${addAll.stderr.trim()}` };
    const commit = spawnSync("git", ["commit", "-m", "docs: deploy via doclight"], { cwd: tmp, encoding: "utf8" });
    if (commit.status !== 0 && !/nothing to commit/.test(commit.stdout)) {
      return { ok: false, output: `git commit 失败：${commit.stderr.trim() || commit.stdout}` };
    }
    const push = spawnSync("git", ["push", "--force", "origin", "gh-pages"], { cwd: repoRoot, encoding: "utf8" });
    return { ok: push.status === 0, output: (push.stdout || push.stderr || "").trim() };
  } finally {
    spawnSync("git", ["worktree", "remove", "--force", tmp], { cwd: repoRoot, encoding: "utf8" });
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** .nojekyll 文件（GitHub Pages 跳过 Jekyll 处理，保留下划线/点开头文件） */
function writeNoJekyll(path: string): void {
  writeFileSync(path, "");
}

/** 执行部署（供命令与测试复用）。默认路径：检测远程 → 构建（base=项目子路径）→ 推送。 */
export function deploySite(options: DeployOptions = {}): DeployResult {
  const repoRoot = options.repoRoot ?? process.cwd();
  const remote = options.remoteUrl ?? gitRemote(repoRoot);

  // 平台检测：gh-pages 为默认路径（GitHub 远程自动适配）；其余需显式 --platform
  const platform: DeployPlatform = options.platform ?? "gh-pages";
  const info = remote ? ghPagesInfo(remote) : null;
  if (info && platform === "gh-pages") {
    // 项目页：以 /<repo>/ 为子路径构建，内部链接/资源 URL 全部正确
    const outDir = resolve(options.outDir ?? "dist-site");
    const build = options.skipBuild
      ? undefined
      : buildSite({ dir: options.dir, outDir, title: options.title, base: info.base, siteUrl: `https://${info.user}.github.io` });
    const publish = publishGhPages(repoRoot, outDir, info);
    if (!publish.ok) {
      return { platform, steps: [...deployGuide(platform), "", `git 推送失败：${publish.output}`], published: false, build };
    }
    return { platform, url: info.url, steps: [`已发布：${info.url}`], published: true, build };
  }

  // 非 GitHub：按平台给出命令或指引
  if (platform === "cloudflare-pages" && cliAvailable("wrangler")) {
    const outDir = resolve(options.outDir ?? "dist-site");
    if (!options.skipBuild) buildSite({ dir: options.dir, outDir, title: options.title });
    return {
      platform,
      steps: [
        "运行以下命令完成上传（需先 wrangler login 并创建项目）：",
        `wrangler pages deploy ${outDir} --project-name <name>`,
      ],
      published: false,
    };
  }
  if (platform === "netlify" && cliAvailable("netlify")) {
    const outDir = resolve(options.outDir ?? "dist-site");
    if (!options.skipBuild) buildSite({ dir: options.dir, outDir, title: options.title });
    return {
      platform,
      steps: [`netlify deploy --dir ${outDir} --prod`, "或到 app.netlify.com 拖拽上传"],
      published: false,
    };
  }
  if (platform === "gh-pages" && !info) {
    return {
      platform,
      steps: [
        "未检测到 GitHub 远程（git remote get-url origin 为空）。",
        "1. 先创建仓库并添加远程：git remote add origin git@github.com:<user>/<repo>.git",
        "2. 或运行 doclight init 后重试",
      ],
      published: false,
    };
  }
  return { platform, steps: deployGuide(platform), published: false };
}
