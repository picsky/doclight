import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishSite } from "../src/publish.ts";
import { spaceInit } from "../src/space.ts";
import { parseArgs } from "../src/index.ts";

let docsDir: string;
let spaceRoot: string;

beforeAll(() => {
  docsDir = mkdtempSync(join(tmpdir(), "doclight-publish-docs-"));
  writeFileSync(join(docsDir, "README.md"), "# 首页\n\n欢迎。\n\n[去入门](intro.md)");
  writeFileSync(join(docsDir, "intro.md"), "---\ntitle: 入门\n---\n\n# 入门内容");
  spaceRoot = mkdtempSync(join(tmpdir(), "doclight-publish-space-"));
});

afterAll(() => {
  rmSync(docsDir, { recursive: true, force: true });
  rmSync(spaceRoot, { recursive: true, force: true });
});

function tmpOut(): string {
  return mkdtempSync(join(tmpdir(), "doclight-publish-out-"));
}

describe("doclight publish 默认与 local（CLI-005，14 §4.3）", () => {
  it("无配置默认 → local bundle：file:// URL + 产物存在", async () => {
    const out = tmpOut();
    const result = await publishSite({ root: spaceRoot, dir: docsDir, outDir: out });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("local");
    expect(result.spaceName).toBe("local");
    expect(result.url?.startsWith("file://")).toBe(true);
    expect(result.file && existsSync(result.file)).toBe(true);
  });

  it("--to local 显式指定输出目录", async () => {
    const out = tmpOut();
    const result = await publishSite({ root: spaceRoot, dir: docsDir, to: "local", outDir: out });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("local");
    expect(result.file?.endsWith("doclight.html")).toBe(true);
    // bundle 内含内嵌数据块（CLI-002 单文件特征）
    const { readFileSync } = await import("node:fs");
    const html = readFileSync(result.file!, "utf8");
    expect(html).toContain("window.__DOCLLIGHT_BUNDLE__");
  });

  it("space init 后（active=local）→ publish 发布到 active 空间", async () => {
    spaceInit({ root: spaceRoot });
    const out = tmpOut();
    const result = await publishSite({ root: spaceRoot, dir: docsDir, outDir: out });
    expect(result.ok).toBe(true);
    expect(result.spaceName).toBe("local");
    expect(result.provider).toBe("local");
  });

  it("显式 --space 不存在 → 结构化错误（不静默回退）", async () => {
    const result = await publishSite({ root: spaceRoot, dir: docsDir, spaceName: "ghost" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("ghost");
  });
});

describe("doclight publish 到 git（CLI-005，gh-pages 推送）", () => {
  let remoteDir: string;
  let repoDir: string;

  beforeAll(() => {
    remoteDir = mkdtempSync(join(tmpdir(), "doclight-publish-remote-"));
    git(remoteDir, ["init", "--bare", "--initial-branch=main", "."]);
    repoDir = mkdtempSync(join(tmpdir(), "doclight-publish-repo-"));
    git(repoDir, ["init", "--initial-branch=main"]);
    git(repoDir, ["config", "user.email", "test@doclight.local"]);
    git(repoDir, ["config", "user.name", "DocLight Test"]);
    writeFileSync(join(repoDir, "README.md"), "# repo");
    git(repoDir, ["add", "-A"]);
    git(repoDir, ["commit", "-m", "init"]);
    git(repoDir, ["remote", "add", "origin", remoteDir]);
  });

  afterAll(() => {
    rmSync(remoteDir, { recursive: true, force: true });
    rmSync(repoDir, { recursive: true, force: true });
  });

  it("--to git：base 子路径构建 + 推送 gh-pages + 返回公网 URL", async () => {
    const out = tmpOut();
    const result = await publishSite({
      root: repoDir,
      dir: docsDir,
      to: "git",
      outDir: out,
      remoteUrl: "https://github.com/alice/my-docs.git",
    });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("git");
    expect(result.url).toBe("https://alice.github.io/my-docs/");
    // 远程 gh-pages 分支含产物 + .nojekyll
    const ls = git(remoteDir, ["ls-tree", "-r", "--name-only", "gh-pages"]);
    expect(ls).toContain("index.html");
    expect(ls).toContain(".nojekyll");
    // base 子路径：内部资源 URL 正确
    const { readFileSync } = await import("node:fs");
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('src="/my-docs/display.js"');
  });

  it("无 git 远程 → ok=false + 引导步骤（不伪造成功）", async () => {
    const result = await publishSite({
      root: repoDir,
      dir: docsDir,
      to: "git",
      remoteUrl: "https://gitlab.com/u/p.git", // 非 GitHub → 无项目页信息
      skipBuild: true,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.steps.length).toBeGreaterThan(0);
  });
});

describe("doclight publish 到 space（CLI-005，HTTP 协议）", () => {
  it("未配置端点 → ok=false + 引导（默认官方端点未开通，不发起请求）", async () => {
    const result = await publishSite({ root: spaceRoot, dir: docsDir, to: "space" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("端点");
    expect(result.steps.some((s) => s.includes("local / git"))).toBe(true);
  });

  it("--endpoint 指向本地 stub：POST /publish_site 返回 URL", async () => {
    let received: unknown = null;
    const server: Server = createServer((req, res) => {
      if (req.method === "POST" && req.url === "/api/publish_site") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          received = JSON.parse(body);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, url: "https://space.doclight.example/sites/abc" }));
        });
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "not found" }));
      }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    try {
      const out = tmpOut();
      const result = await publishSite({
        root: spaceRoot,
        dir: docsDir,
        to: "space",
        endpoint: `http://127.0.0.1:${port}/api`,
        outDir: out,
      });
      expect(result.ok).toBe(true);
      expect(result.provider).toBe("space");
      expect(result.url).toBe("https://space.doclight.example/sites/abc");
      // 端点收到的清单含站点元数据
      const manifest = received as { siteTitle: string; totalDocs: number; docs: unknown[] };
      expect(manifest.siteTitle).toBe("DocLight");
      expect(manifest.totalDocs).toBeGreaterThan(0);
      expect(Array.isArray(manifest.docs)).toBe(true);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it("端点不可达 → 结构化错误（不伪造成功）", async () => {
    const out = tmpOut();
    const result = await publishSite({
      root: spaceRoot,
      dir: docsDir,
      to: "space",
      endpoint: "http://127.0.0.1:1/api", // 必然连接失败端口
      outDir: out,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("不可达");
  });
});

describe("parseArgs 布尔 flag 解析（--json 不吞下一 flag）", () => {
  it("--json --to git 分别解析为布尔与值", () => {
    const opts = parseArgs(["--json", "--to", "git"]);
    expect(opts["json"]).toBe("true");
    expect(opts["to"]).toBe("git");
  });

  it("--key=value 与末尾无值 flag", () => {
    const opts = parseArgs(["--out-dir=x", "--json"]);
    expect(opts["out-dir"]).toBe("x");
    expect(opts["json"]).toBe("true");
  });
});

/** 执行 git 命令并断言成功（复用 deploy.test.ts 夹具模式） */
function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  expect(r.status, `git ${args.join(" ")} 失败：${r.stderr}`).toBe(0);
  return r.stdout.trim();
}
