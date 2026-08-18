import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { startDevServer, type DevServer } from "../src/dev-server.ts";

let docsDir: string;
let dev: DevServer;

beforeAll(async () => {
  docsDir = mkdtempSync(join(tmpdir(), "doclight-dev-"));
  mkdirSync(join(docsDir, "guide"), { recursive: true });
  mkdirSync(join(docsDir, "assets"), { recursive: true });
  writeFileSync(join(docsDir, "README.md"), "# 首页\n\n欢迎来到测试站。");
  writeFileSync(join(docsDir, "intro.md"), "---\ntitle: 入门\n---\n\n# 入门内容");
  writeFileSync(join(docsDir, "guide", "quickstart.md"), "# 快速开始\n\n<script>alert('XSS')</script> 正文");
  writeFileSync(join(docsDir, "guide", "basic.md"), "# 基础");
  writeFileSync(join(docsDir, "assets", "logo.txt"), "not-an-image");
  dev = await startDevServer({ dir: docsDir, port: 0 });
});

afterAll(async () => {
  await dev.close();
  rmSync(docsDir, { recursive: true, force: true });
});

describe("dev server（DEV-001）", () => {
  it("首页返回完整 HTML（首屏直出）+ 导航", async () => {
    const res = await fetch(dev.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("欢迎来到测试站"); // README 内容直出
    expect(body).toContain('href="/guide/quickstart.md"'); // 服务端渲染导航（side-item）
  });

  it("文档页按路径渲染且 sanitize 生效（DEV-001）", async () => {
    const res = await fetch(`${dev.url}guide/quickstart.md`);
    expect(res.status).toBe(200);
    const body = await res.text();
    // 仅断言内容区（<article>）——页面 shell 自带受控内联 SSE 脚本
    const article = body.slice(body.indexOf("<article"), body.indexOf("</article>"));
    expect(article).toContain("快速开始");
    expect(article).not.toContain("<script");
    expect(article).not.toContain("alert(");
    expect(article).not.toContain("XSS");
  });

  it("不带 .md 后缀的路径也能解析", async () => {
    const res = await fetch(`${dev.url}guide/quickstart`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("快速开始");
  });

  it("frontmatter title 作为页面标题", async () => {
    const res = await fetch(`${dev.url}intro.md`);
    const body = await res.text();
    expect(body).toContain("<title>入门 · DocLight</title>");
  });

  it("docs.json 返回导航数据", async () => {
    const res = await fetch(`${dev.url}__doclight/docs.json`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { version: number; nav: Array<{ title: string; items?: unknown[] }> };
    expect(json.version).toBe(1);
    expect(json.nav.some((n) => n.title === "guide")).toBe(true);
  });

  it("路径穿越被拒绝（404）", async () => {
    const res = await fetch(`${dev.url}../package.json`);
    expect(res.status).toBe(404);
  });

  // 2026-08 安全审计后：非法 %XX 序列（URIError）应优雅返回 404 而非 500 挂起
  it("非法 URL 编码（%zz）被拒绝（404，不 crash）", async () => {
    const res = await fetch(`${dev.url}guide/%zz.md`);
    expect(res.status).toBe(404);
  });

  it("不存在的文档返回 404", async () => {
    const res = await fetch(`${dev.url}nope.md`);
    expect(res.status).toBe(404);
  });

  it("静态资源（非 md）正常服务", async () => {
    const res = await fetch(`${dev.url}assets/logo.txt`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("not-an-image");
  });

  it("SSE 端点返回 text/event-stream", async () => {
    await new Promise<void>((done, reject) => {
      const req = httpRequest(`${dev.url}__doclight/events`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toContain("text/event-stream");
        res.destroy(); // 不读完整流，只验头部
        done();
      });
      req.on("error", reject);
      req.end();
    });
  });

  // 2026-08 review P0-3：loopback 监听下的 Host 头校验（DNS rebinding 防御）
  it("Host 头为外部域名（DNS rebinding 形态）→ 403", async () => {
    await new Promise<void>((done, reject) => {
      const req = httpRequest(
        `${dev.url}guide/quickstart.md`,
        { headers: { Host: "evil.example.com" } },
        (res) => {
          expect(res.statusCode).toBe(403);
          res.resume();
          done();
        },
      );
      req.on("error", reject);
      req.end();
    });
  });

  // 2026-08 review P0-6：查询串不破坏端点匹配（?v= 缓存穿透场景）
  it("端点与文档路径带查询串仍正常服务（?v=1）", async () => {
    const jsonRes = await fetch(`${dev.url}__doclight/docs.json?v=1`);
    expect(jsonRes.status).toBe(200);
    const docRes = await fetch(`${dev.url}guide/quickstart.md?v=1`);
    expect(docRes.status).toBe(200);
    const vendorRes = await fetch(`${dev.url}__doclight/vendor/prism.min.js?v=1`);
    expect(vendorRes.status).toBe(200); // node_modules 存在即可命中（CI 已 pnpm install）
  });
});

describe("dev server MCP 插件模式（MCP-005，dev --mcp）", () => {
  let mcpDev: DevServer;

  beforeAll(async () => {
    // mcpToken 固定 + mcpTokenFile null：避免测试写盘到 process.cwd()/.doclight
    mcpDev = await startDevServer({ dir: docsDir, port: 0, mcp: true, mcpToken: "test-token", mcpTokenFile: null });
  });

  afterAll(async () => {
    await mcpDev.close();
  });

  it("GET /.well-known/mcp → 发现端点（站点快照数据）", async () => {
    const res = await fetch(`${mcpDev.url}.well-known/mcp`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; endpoint: string; totalDocs: number; tools: Array<{ name: string }> };
    expect(body.name).toBe("doclight-mcp");
    expect(body.endpoint).toBe("/mcp");
    expect(body.totalDocs).toBe(4); // README + intro + guide/* 2
    expect(body.tools.map((t) => t.name)).toContain("search_docs");
  });

  it("POST /mcp tools/call search_docs → 针对 dev 快照检索", async () => {
    const res = await fetch(`${mcpDev.url}mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_docs", arguments: { query: "快速开始" } } }),
    });
    const body = (await res.json()) as { result: { content: Array<{ text: string }> } };
    const parsed = JSON.parse(body.result.content[0]!.text) as { results: Array<{ path: string }> };
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0]!.path).toContain("quickstart");
  });

  it("站点首页不被 MCP 抢占（capabilitiesAtRoot=false，GET / 仍服务站点）", async () => {
    const res = await fetch(mcpDev.url);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("欢迎来到测试站");
  });

  it("GET /health → MCP 能力页", async () => {
    const res = await fetch(`${mcpDev.url}health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("doclight-mcp");
  });
});

/* ---- 2026-08 review P0-4：MCP 快照惰性构建（普通请求不触发 buildSite/loadSite） ---- */
describe("dev server MCP 快照惰性构建（P0-4）", () => {
  let lazyDev: DevServer;
  const mcpTempDirs = (): Set<string> =>
    new Set(readdirSync(tmpdir()).filter((d) => d.startsWith("doclight-mcp-dev-")));

  beforeAll(async () => {
    lazyDev = await startDevServer({ dir: docsDir, port: 0, mcp: true, mcpToken: "t", mcpTokenFile: null });
  });
  afterAll(async () => {
    await lazyDev.close();
  });

  it("普通文档/静态请求不创建 MCP 快照目录（不触发 buildSite）", async () => {
    const before = mcpTempDirs();
    const res = await fetch(`${lazyDev.url}guide/quickstart.md`);
    expect(res.status).toBe(200);
    await fetch(`${lazyDev.url}__doclight/docs.json`);
    expect(mcpTempDirs().size).toBe(before.size); // 无新增快照目录
  });

  it("首个 MCP 请求才创建快照（目录数 +1），后续 MCP 请求复用（不 +1）", async () => {
    const before = mcpTempDirs();
    const r1 = await fetch(`${lazyDev.url}.well-known/mcp`);
    expect(r1.status).toBe(200);
    expect(mcpTempDirs().size).toBe(before.size + 1);
    const r2 = await fetch(`${lazyDev.url}health`);
    expect(r2.status).toBe(200);
    expect(mcpTempDirs().size).toBe(before.size + 1); // 复用同一快照
  });
});
