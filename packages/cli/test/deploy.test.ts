import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deployGuide, deploySite, ghPagesInfo, gitRemote, publishGhPages } from "../src/deploy.ts";

/** 执行 git 命令并断言成功 */
function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  expect(r.status, `git ${args.join(" ")} 失败：${r.stderr}`).toBe(0);
  return r.stdout.trim();
}

let remoteDir: string;
let repoDir: string;
let docsDir: string;
let outDir: string;

beforeAll(() => {
  // 本地裸仓库充当「GitHub 远程」
  remoteDir = mkdtempSync(join(tmpdir(), "doclight-deploy-remote-"));
  git(remoteDir, ["init", "--bare", "--initial-branch=main", "."]);

  // 工作仓库：初始提交 + origin 指向裸仓库
  repoDir = mkdtempSync(join(tmpdir(), "doclight-deploy-repo-"));
  git(repoDir, ["init", "--initial-branch=main"]);
  git(repoDir, ["config", "user.email", "test@doclight.local"]);
  git(repoDir, ["config", "user.name", "DocLight Test"]);
  writeFileSync(join(repoDir, "README.md"), "# repo");
  git(repoDir, ["add", "-A"]);
  git(repoDir, ["commit", "-m", "init"]);
  git(repoDir, ["remote", "add", "origin", remoteDir]);

  // 文档夹具
  docsDir = mkdtempSync(join(tmpdir(), "doclight-deploy-docs-"));
  writeFileSync(join(docsDir, "README.md"), "# 首页\n\n欢迎");
  outDir = mkdtempSync(join(tmpdir(), "doclight-deploy-out-"));
});

afterAll(() => {
  for (const d of [remoteDir, repoDir, docsDir, outDir]) rmSync(d, { recursive: true, force: true });
});

describe("ghPagesInfo（CLI-003，13 §2.1 远程解析）", () => {
  it("解析 https 与 ssh 两种 GitHub 远程格式", () => {
    expect(ghPagesInfo("https://github.com/alice/my-docs.git")).toEqual({
      user: "alice",
      repo: "my-docs",
      base: "/my-docs",
      url: "https://alice.github.io/my-docs/",
    });
    expect(ghPagesInfo("git@github.com:bob/docs.git")).toEqual({ user: "bob", repo: "docs", base: "/docs", url: "https://bob.github.io/docs/" });
    expect(ghPagesInfo("ssh://git@github.com:22/car/doc.git")).toEqual({ user: "car", repo: "doc", base: "/doc", url: "https://car.github.io/doc/" });
  });

  it("非 GitHub 远程返回 null", () => {
    expect(ghPagesInfo("https://gitlab.com/u/p.git")).toBeNull();
    expect(ghPagesInfo("https://example.com/x.git")).toBeNull();
  });
});

describe("gitRemote + publishGhPages（CLI-003 推送链路）", () => {
  it("gitRemote 读取 origin", () => {
    expect(gitRemote(repoDir)).toBe(remoteDir);
  });

  it("publishGhPages 把产物推为 gh-pages 分支，远程可读", () => {
    // 直接把产物文件写入 outDir（跳过 build/display 依赖，聚焦推送链路）
    writeFileSync(join(outDir, "index.html"), "<!DOCTYPE html><html><body>deployed</body></html>");
    writeFileSync(join(outDir, ".nojekyll"), "");

    const result = publishGhPages(repoDir, outDir, { user: "u", repo: "r", base: "/r", url: "https://u.github.io/r/" });
    expect(result.ok, result.output).toBe(true);

    // 从裸远程验证 gh-pages 分支包含产物
    const ls = git(remoteDir, ["ls-tree", "-r", "--name-only", "gh-pages"]);
    expect(ls).toContain("index.html");
    expect(ls).toContain(".nojekyll");
  });
});

describe("deploySite（CLI-003 端到端）", () => {
  it("gh-pages：构建（base=子路径）+ 推送 + 返回 URL", () => {
    const result = deploySite({
      repoRoot: repoDir,
      dir: docsDir,
      outDir,
      remoteUrl: "https://github.com/alice/my-docs.git",
    });
    expect(result.platform).toBe("gh-pages");
    expect(result.published).toBe(true);
    expect(result.url).toBe("https://alice.github.io/my-docs/");
    expect(result.build).toBeDefined();

    // 构建带 base 前缀（项目页 /my-docs/）：导航/资源 URL 正确
    const index = readFileSync(join(outDir, "index.html"), "utf8");
    expect(index).toContain('src="/my-docs/display.js"');
  });

  it("非 GitHub 平台输出人工指引", () => {
    const cf = deploySite({ repoRoot: repoDir, platform: "cloudflare-pages", skipBuild: true });
    expect(cf.published).toBe(false);
    expect(cf.steps.some((s) => s.includes("wrangler"))).toBe(true);

    const netlify = deploySite({ repoRoot: repoDir, platform: "netlify", skipBuild: true });
    expect(netlify.published).toBe(false);
    expect(netlify.steps.some((s) => s.includes("netlify"))).toBe(true);
  });

  it("无 GitHub 远程时输出引导步骤", () => {
    const result = deploySite({ repoRoot: repoDir, platform: "gh-pages", remoteUrl: "https://gitlab.com/u/p.git", skipBuild: true });
    expect(result.published).toBe(false);
    expect(result.steps.some((s) => s.includes("git remote add origin"))).toBe(true);
  });
});

describe("deployGuide（CLI-003 逃生通道）", () => {
  it("三个平台均有可执行步骤", () => {
    expect(deployGuide("gh-pages").length).toBeGreaterThan(0);
    expect(deployGuide("cloudflare-pages").some((s) => s.includes("wrangler pages deploy"))).toBe(true);
    expect(deployGuide("netlify").some((s) => s.includes("netlify deploy"))).toBe(true);
  });
});
