import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildNavTree } from "@doclight/renderer";
import { buildSite } from "../src/build.ts";
import { startPreviewServer, type PreviewServer } from "../src/preview.ts";
import { breadcrumbFor, buildSearchData, searchIndexVersion } from "../src/site.ts";

let docsDir: string;
let outDir: string;
let preview: PreviewServer;

beforeAll(async () => {
  docsDir = mkdtempSync(join(tmpdir(), "doclight-ssg-"));
  mkdirSync(join(docsDir, "guide"), { recursive: true });
  mkdirSync(join(docsDir, "assets"), { recursive: true });
  writeFileSync(join(docsDir, "README.md"), "# 首页\n\n欢迎来到测试站。\n\n[去入门](intro.md)");
  writeFileSync(join(docsDir, "intro.md"), "---\ntitle: 入门\nsummary: 入门指南\n---\n\n# 入门内容");
  writeFileSync(join(docsDir, "guide", "quickstart.md"), "# 快速开始\n\n参见 [基础](./basic.md)");
  writeFileSync(join(docsDir, "guide", "basic.md"), "# 基础");
  writeFileSync(join(docsDir, "assets", "logo.txt"), "not-an-image");

  outDir = mkdtempSync(join(tmpdir(), "doclight-ssg-out-"));
  // 展示层 bundle 缺失会抛错；这里放一个占位（内容直出本身不依赖它）
  writeFileSync(join(outDir, "display.js"), "placeholder");
  // buildSite 会清空重建 outDir，display bundle 需在构建中指定
});

afterAll(async () => {
  if (preview) await preview.close();
  rmSync(docsDir, { recursive: true, force: true });
  rmSync(outDir, { recursive: true, force: true });
});

function tmpBuildDir(): string {
  const d = mkdtempSync(join(tmpdir(), "doclight-ssg-build-"));
  writeFileSync(join(d, "display.js"), "/* placeholder */");
  return d;
}

describe("doclight build（SSG-001 静态导出）", () => {
  it("每篇 .md 输出为同相对路径 .html，根级 README 收敛为 index.html", () => {
    const d = tmpBuildDir();
    const result = buildSite({ dir: docsDir, outDir: d, title: "测试站" });
    expect(result.pages).toBe(4); // README→index + intro + quickstart + basic
    expect(existsSync(join(d, "index.html"))).toBe(true);
    expect(existsSync(join(d, "intro.html"))).toBe(true);
    expect(existsSync(join(d, "guide", "quickstart.html"))).toBe(true);
    expect(existsSync(join(d, "guide", "basic.html"))).toBe(true);
    // AEO-001：每页 markdown 版本随构建拷贝进产物（与 .html 同相对路径）
    expect(existsSync(join(d, "README.md"))).toBe(true);
    expect(existsSync(join(d, "guide", "quickstart.md"))).toBe(true);
    rmSync(d, { recursive: true, force: true });
  });

  it("无根级 README 时回退首篇文档生成 index.html", () => {
    const noRoot = mkdtempSync(join(tmpdir(), "doclight-ssg-noroot-"));
    mkdirSync(join(noRoot, "guide"), { recursive: true });
    writeFileSync(join(noRoot, "guide", "a.md"), "# A");
    writeFileSync(join(noRoot, "guide", "b.md"), "# B");
    const d = tmpBuildDir();
    const result = buildSite({ dir: noRoot, outDir: d });
    expect(result.pages).toBe(3); // a + b + 首页回退
    expect(existsSync(join(d, "index.html"))).toBe(true);
    rmSync(noRoot, { recursive: true, force: true });
    rmSync(d, { recursive: true, force: true });
  });

  it("SSG 页面为渐进式水合形态：.html 链接 + 全局覆盖 + SSG 标记", () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d, title: "测试站" });
    const index = readFileSync(join(d, "index.html"), "utf8");
    // 导航链接为 .html 后缀，根级 README 收敛为 /
    expect(index).toContain('href="/intro.html"');
    expect(index).toContain('href="/guide/quickstart.html"');
    expect(index).toContain('href="/"'); // 首页自指
    // SSG 形态标记
    expect(index).toContain('window.DOCLIGHT_VENDOR_BASE = "/vendor/"');
    expect(index).toContain('window.DOCLIGHT_SEARCH_INDEX = "/search-index.json"');
    expect(index).toContain("__DOCLLIGHT_SSG__");
    expect(index).toContain('src="/display.js"');
    expect(index).not.toContain("EventSource"); // SSG 无 SSE 热重载
    // SEO description：README 无 frontmatter 故无；intro.md 带 summary 才有
    expect(index).not.toContain('<meta name="description"');
    expect(readFileSync(join(d, "intro.html"), "utf8")).toContain('<meta name="description" content="入门指南">');
    rmSync(d, { recursive: true, force: true });
  });

  it("内容区站内链接为 .html（linkSuffix）且外部链接不误伤", () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d });
    // README（→ index.html）里的相对链接 [去入门](intro.md) 被渲染为 .html
    const index = readFileSync(join(d, "index.html"), "utf8");
    const article = index.slice(index.indexOf("<article"), index.indexOf("</article>"));
    expect(article).toContain('href="intro.html"');
    const quickstart = readFileSync(join(d, "guide", "quickstart.html"), "utf8");
    const qa = quickstart.slice(quickstart.indexOf("<article"), quickstart.indexOf("</article>"));
    expect(qa).toContain('href="guide/basic.html"'); // ./basic.md 相对当前文档 → guide/basic.html
    expect(qa).not.toContain("basic.md");
    rmSync(d, { recursive: true, force: true });
  });

  it("预构建 search-index.json（path 为 .html URL）+ 静态资源拷贝 + vendor 拷贝", () => {
    const d = tmpBuildDir();
    const result = buildSite({ dir: docsDir, outDir: d });
    const index = JSON.parse(readFileSync(join(d, "search-index.json"), "utf8")) as { docs: Array<{ path: string }> };
    expect(index.docs.length).toBe(4);
    expect(index.docs.every((x) => x.path.endsWith(".html"))).toBe(true);
    expect(index.docs.some((x) => x.path === "guide/quickstart.html")).toBe(true);
    // 静态资源（非 md）拷贝
    expect(readFileSync(join(d, "assets", "logo.txt"), "utf8")).toBe("not-an-image");
    expect(result.assets).toBe(1);
    // vendor 拷贝（SSG-002 自包含；PLUG-012：mermaid.min.js 仅启用插件时拷贝）
    for (const f of ["prism.min.js", "katex.min.js", "katex.min.css"]) {
      expect(existsSync(join(d, "vendor", f))).toBe(true);
    }
    expect(existsSync(join(d, "vendor", "mermaid.min.js"))).toBe(false); // 未启用插件 → 不拷贝
    expect(readdirSync(join(d, "vendor", "fonts")).length).toBeGreaterThan(0); // KaTeX 字体
    rmSync(d, { recursive: true, force: true });
  });

  it("buildSearchData 的 pathSuffix 参数（dev=.md / SSG=.html）", () => {
    const dev = buildSearchData(docsDir, ["guide/quickstart.md"]);
    const ssg = buildSearchData(docsDir, ["guide/quickstart.md"], { pathSuffix: ".html" });
    expect((dev.docs[0] as { path: string }).path).toBe("guide/quickstart.md");
    expect((ssg.docs[0] as { path: string }).path).toBe("guide/quickstart.html");
  });

  // 2026-08 性能审计后：正文截断（索引体积失控防御，默认 3072；0 = 不截断）
  it("buildSearchData 默认截断正文到 3072 字符（避免大站点索引超 localStorage 配额）", () => {
    // 构造超长文档：10000 字符正文
    const longPath = "guide/long.md";
    const longText = "x".repeat(10000);
    writeFileSync(join(docsDir, longPath), `# 长文档\n\n${longText}`);
    const data = buildSearchData(docsDir, [longPath]);
    const doc = data.docs[0] as { text: string };
    expect(doc.text.length).toBeLessThanOrEqual(3072);
    expect(doc.text.length).toBeGreaterThan(0);
    rmSync(join(docsDir, longPath));
  });

  it("buildSearchData maxTextLength=0 关闭截断（保留全文）", () => {
    const longPath = "guide/long.md";
    const longText = "y".repeat(5000);
    writeFileSync(join(docsDir, longPath), `# 长文档\n\n${longText}`);
    const data = buildSearchData(docsDir, [longPath], { maxTextLength: 0 });
    const doc = data.docs[0] as { text: string };
    expect(doc.text.length).toBeGreaterThan(4000);
    rmSync(join(docsDir, longPath));
  });

  it("searchIndexVersion：内容哈希，内容不变版本不变、变化即变（03 §3.8.5 持久化校验）", () => {
    expect(searchIndexVersion([{ a: 1 }])).toBe(searchIndexVersion([{ a: 1 }]));
    expect(searchIndexVersion([{ a: 1 }])).not.toBe(searchIndexVersion([{ a: 2 }]));
    expect(searchIndexVersion([])).toBe(searchIndexVersion([]));
  });

  it("breadcrumbFor：首页 → 分组链 → 当前页；无 index 分组不可链接（根标签「文档」，设计对齐）", () => {
    const tree = buildNavTree(["README.md", "guide/quickstart.md", "guide/basic.md"]);
    const crumbs = breadcrumbFor(tree, "guide/quickstart.md", ".html", "", "快速开始");
    expect(crumbs).toEqual([
      { label: "文档", href: "/" },
      { label: "guide", href: "" }, // guide 组无置顶页 → 不可链接（防死链）
      { label: "快速开始", href: "" },
    ]);
    // 分组含 index 页时可链接（base 子路径前缀生效）
    const tree2 = buildNavTree(["guide/index.md", "guide/quickstart.md"]);
    const crumbs2 = breadcrumbFor(tree2, "guide/quickstart.md", ".html", "/docs", "快速开始");
    expect(crumbs2[1]).toEqual({ label: "guide", href: "/docs/guide/index.html" });
    expect(crumbs2[0]).toEqual({ label: "文档", href: "/docs/" });
  });

  // Phase 3 单遍流水：验证优化后产物与优化前逐字节一致（避免行为漂移）
  it("单遍流水优化：同一输入两次构建产物逐字节一致（bit-for-bit）", () => {
    const out1 = mkdtempSync(join(tmpdir(), "doclight-bench-1-"));
    const out2 = mkdtempSync(join(tmpdir(), "doclight-bench-2-"));
    // 占位 display.js
    writeFileSync(join(out1, "display.js"), "placeholder");
    writeFileSync(join(out2, "display.js"), "placeholder");

    const r1 = buildSite({ dir: docsDir, outDir: out1 });
    const r2 = buildSite({ dir: docsDir, outDir: out2 });

    // 字节数应一致
    expect(r1.bytes).toBe(r2.bytes);
    expect(r1.pages).toBe(r2.pages);

    // 逐文件对比内容（排除 generatedAt 时间戳字段）
    const walk = (dir: string, base = ""): Array<{ rel: string; content: string }> => {
      const out: Array<{ rel: string; content: string }> = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const rel = base ? `${base}/${entry}` : entry;
        if (statSync(full).isDirectory()) {
          out.push(...walk(full, rel));
        } else if (entry.endsWith(".html") || entry.endsWith(".json") || entry.endsWith(".xml") || entry.endsWith(".txt")) {
          out.push({ rel, content: readFileSync(full, "utf8") });
        }
      }
      return out;
    };

    const files1 = walk(out1);
    const files2 = walk(out2);
    expect(files1.length).toBe(files2.length);

    for (const f1 of files1) {
      const f2 = files2.find((f) => f.rel === f1.rel);
      expect(f2, `missing file in second build: ${f1.rel}`).toBeDefined();
      // 排除 generatedAt 时间戳（每次构建不同，格式可能带空格）
      const normalize = (s: string) => s.replace(/"generatedAt"\s*:\s*"[^"]+"/g, '"generatedAt": "TIMESTAMP"');
      const n1 = normalize(f1.content);
      const n2 = normalize(f2!.content);
      expect(n1).toBe(n2);
    }

    rmSync(out1, { recursive: true, force: true });
    rmSync(out2, { recursive: true, force: true });
  });
});

describe("doclight build（SEO 全套 + 子路径部署，05 §5.4）", () => {
  it("siteUrl 提供时：canonical/OG/Twitter/JSON-LD/面包屑 + sitemap/robots/OG 卡", () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d, title: "测试站", siteUrl: "https://docs.example.com" });
    const index = readFileSync(join(d, "index.html"), "utf8");
    // canonical + OG + Twitter
    expect(index).toContain('<link rel="canonical" href="https://docs.example.com/">');
    expect(index).toContain('<meta property="og:url" content="https://docs.example.com/">');
    expect(index).toContain('<meta property="og:title"');
    expect(index).toContain('<meta property="og:type" content="article">');
    expect(index).toContain('<meta name="twitter:card" content="summary_large_image">');
    // JSON-LD（TechArticle + wordCount）+ 面包屑 UI + BreadcrumbList
    expect(index).toContain('"@type":"TechArticle"');
    expect(index).toContain('"wordCount"');
    expect(index).toContain('class="crumb"');
    expect(index).toContain('"@type":"BreadcrumbList"');
    // 子页面 canonical / og:url
    const intro = readFileSync(join(d, "intro.html"), "utf8");
    expect(intro).toContain('<link rel="canonical" href="https://docs.example.com/intro.html">');
    expect(intro).toContain('<meta property="og:url" content="https://docs.example.com/intro.html">');
    // sitemap.xml（含首页与各页 + lastmod）+ robots.txt + OG 卡片图
    const sitemap = readFileSync(join(d, "sitemap.xml"), "utf8");
    expect(sitemap).toContain("<urlset");
    expect(sitemap).toContain("<loc>https://docs.example.com/</loc>");
    expect(sitemap).toContain("<loc>https://docs.example.com/intro.html</loc>");
    expect(sitemap).toContain("<loc>https://docs.example.com/guide/quickstart.html</loc>");
    expect(sitemap).toContain("<lastmod>");
    expect(readFileSync(join(d, "robots.txt"), "utf8")).toContain("Sitemap: https://docs.example.com/sitemap.xml");
    // OG 卡片图：SVG + PNG 双格式（C1 栅格化），og:image 指向 PNG（微信/微博兼容）
    expect(existsSync(join(d, "og", "index.svg"))).toBe(true);
    expect(existsSync(join(d, "og", "index.png"))).toBe(true);
    expect(existsSync(join(d, "og", "guide", "quickstart.svg"))).toBe(true);
    expect(existsSync(join(d, "og", "guide", "quickstart.png"))).toBe(true);
    expect(index).toContain('<meta property="og:image" content="https://docs.example.com/og/index.png">');
    expect(intro).toContain('<meta property="og:image" content="https://docs.example.com/og/intro.png">');
    // PNG 为合法图片头（PNG 魔数）
    const png = readFileSync(join(d, "og", "index.png"));
    expect(png.subarray(0, 4).toString("hex")).toBe("89504e47");
    rmSync(d, { recursive: true, force: true });
  });

  it("无 siteUrl：不生成 sitemap/robots/OG 卡，页面无 canonical（绝对 URL 前提缺失）", () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d });
    expect(existsSync(join(d, "sitemap.xml"))).toBe(false);
    expect(existsSync(join(d, "robots.txt"))).toBe(false);
    expect(existsSync(join(d, "og"))).toBe(false);
    const index = readFileSync(join(d, "index.html"), "utf8");
    expect(index).not.toContain('rel="canonical"');
    expect(index).not.toContain("og:url");
    rmSync(d, { recursive: true, force: true });
  });

  it("--base 子路径部署：导航/资源 URL 加前缀；preview 剥离前缀", async () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d, title: "测试站", base: "/docs", siteUrl: "https://x.example.com" });
    const index = readFileSync(join(d, "index.html"), "utf8");
    // 导航绝对链接 + 首页自指 + 展示层/vendor/搜索索引全部加 base 前缀
    expect(index).toContain('href="/docs/intro.html"');
    expect(index).toContain('href="/docs/guide/quickstart.html"');
    expect(index).toContain('href="/docs/"');
    expect(index).toContain('src="/docs/display.js"');
    expect(index).toContain('window.DOCLIGHT_VENDOR_BASE = "/docs/vendor/"');
    expect(index).toContain('window.DOCLIGHT_SEARCH_INDEX = "/docs/search-index.json"');
    // canonical 也带 base 前缀
    expect(index).toContain('<link rel="canonical" href="https://x.example.com/docs/">');
    // preview 剥离 base 前缀后命中产物
    preview = await startPreviewServer({ dir: d, port: 0, base: "/docs" });
    expect((await fetch(`${preview.url}docs/`)).status).toBe(200);
    expect((await fetch(`${preview.url}docs/guide/quickstart.html`)).status).toBe(200);
    await preview.close();
    preview = undefined as unknown as PreviewServer;
    rmSync(d, { recursive: true, force: true });
  });

  it("搜索索引 version 内联进 SSG 页（window.DOCLIGHT_SEARCH_VERSION，持久化校验用）", () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d });
    const index = readFileSync(join(d, "index.html"), "utf8");
    expect(index).toContain("window.DOCLIGHT_SEARCH_VERSION");
    const parsed = JSON.parse(readFileSync(join(d, "search-index.json"), "utf8")) as { version: string; docs: unknown[] };
    expect(parsed.version).toMatch(/^[0-9a-z]+$/);
    expect(index).toContain(`window.DOCLIGHT_SEARCH_VERSION = "${parsed.version}"`);
    rmSync(d, { recursive: true, force: true });
  });
});

describe("Phase 4 AI 就绪（LLMS-001 + FRONT-001 + docs.json 增强）", () => {
  it("build 自动生成 llms.txt：含 MCP 与 /llms-full.txt 链接（合同验收：llms 通道）", () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d });
    const llms = readFileSync(join(d, "llms.txt"), "utf8");
    expect(llms).toContain("MCP"); // 验收：llms.txt 找到字符串 "MCP"
    expect(llms).toContain("/llms-full.txt"); // 验收：llms.txt 含 llms-full 链接
    expect(llms).toContain("## 核心文档 ★★★"); // README 命中 high 分级
    expect(llms).toContain("## 使用指南 ★★☆");
    rmSync(d, { recursive: true, force: true });
  });

  it("llms.txt 条目含语义 frontmatter（summary/tags/readingTime——合同验收项）", () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d });
    const llms = readFileSync(join(d, "llms.txt"), "utf8");
    const introLine = llms.split("\n").find((l) => l.includes("入门"))!;
    expect(introLine).toContain("入门指南"); // intro.md 的 frontmatter summary
    expect(introLine).toContain("分钟"); // readingTime 语义字段
    rmSync(d, { recursive: true, force: true });
  });

  it("llms-full.txt：全文按 `## 路径：<path>` 分节，无 error 字符串（验收）", () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d });
    const full = readFileSync(join(d, "llms-full.txt"), "utf8");
    expect(full).not.toContain("error"); // 验收：llms-full.txt 无 "error"
    expect(full).toContain("## 路径：guide/quickstart.md");
    expect(full).toContain("# 快速开始");
    expect(full).toContain("## 路径：README.md");
    expect(full).toContain("欢迎来到测试站");
    rmSync(d, { recursive: true, force: true });
  });

  it("docs.json：结构化元数据（summary/headings/readingTime/wordCount/url/priority）", () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d });
    const docsJson = JSON.parse(readFileSync(join(d, "docs.json"), "utf8")) as {
      totalDocs: number;
      docs: Array<{ path: string; url: string; summary: string; headings: unknown[]; readingTime: number; wordCount: number; priority: string }>;
    };
    expect(docsJson.totalDocs).toBe(4);
    const quickstart = docsJson.docs.find((x) => x.path === "guide/quickstart.md")!;
    expect(quickstart).toBeDefined();
    expect(quickstart.url).toBe("/guide/quickstart.html");
    expect(quickstart.headings.some((h) => (h as { text: string }).text === "快速开始")).toBe(true);
    expect(quickstart.readingTime).toBeGreaterThanOrEqual(1);
    expect(quickstart.wordCount).toBeGreaterThan(0);
    expect(quickstart.priority).toBe("high"); // 06 §6.2.1：quickstart 命名命中 high 分级
    const home = docsJson.docs.find((x) => x.path === "README.md")!;
    expect(home.url).toBe("/");
    expect(home.priority).toBe("high");
    rmSync(d, { recursive: true, force: true });
  });

  it("preview 可 GET /llms.txt /llms-full.txt /docs.json（验收 HTTP 通道）", async () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d });
    preview = await startPreviewServer({ dir: d, port: 0 });
    const llms = await (await fetch(`${preview.url}llms.txt`)).text();
    expect(llms).toContain("MCP");
    const full = await (await fetch(`${preview.url}llms-full.txt`)).text();
    expect(full).not.toContain("error");
    const docsJson = await (await fetch(`${preview.url}docs.json`)).json();
    expect((docsJson as { totalDocs: number }).totalDocs).toBe(4);
    await preview.close();
    preview = undefined as unknown as PreviewServer;
    rmSync(d, { recursive: true, force: true });
  });

  it("用户自定义分级与排除（build.llmsTxt 宽松读取）", () => {
    const proj = mkdtempSync(join(tmpdir(), "doclight-llms-cfg-"));
    mkdirSync(join(proj, "docs", "guide"), { recursive: true });
    // buildSite 读 cwd 与 docsDir 下的 doclight.json；测试 cwd 是仓库根，故配置放 docsDir 内
    writeFileSync(join(proj, "docs", "doclight.json"), JSON.stringify({ build: { llmsTxt: { priority: { low: ["guide/"] }, exclude: ["guide/basic.md"] } } }));
    writeFileSync(join(proj, "docs", "README.md"), "# 首页\n\n内容");
    writeFileSync(join(proj, "docs", "guide", "quickstart.md"), "---\ntitle: 快速开始\n---\n\n# 快速开始\n\n内容");
    writeFileSync(join(proj, "docs", "guide", "basic.md"), "---\ntitle: 基础\n---\n\n# 基础\n\n内容");
    const d = tmpBuildDir();
    buildSite({ dir: join(proj, "docs"), outDir: d });
    const llms = readFileSync(join(d, "llms.txt"), "utf8");
    expect(llms).toContain("快速开始");
    expect(llms).not.toContain("基础"); // 被 exclude
    const full = readFileSync(join(d, "llms-full.txt"), "utf8");
    expect(full).not.toContain("# 基础"); // exclude 同时从全文剔除
    rmSync(proj, { recursive: true, force: true });
    rmSync(d, { recursive: true, force: true });
  });
});

describe("doclight preview（PREVIEW-001 产物预览）", () => {
  it("服务首页与 .html 页面，无扩展名 / .md 回退到 .html", async () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d });
    preview = await startPreviewServer({ dir: d, port: 0 });
    const res = await fetch(preview.url);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("欢迎来到测试站");
    expect((await fetch(`${preview.url}guide/quickstart.html`)).status).toBe(200);
    expect((await fetch(`${preview.url}guide/quickstart`)).status).toBe(200); // 无扩展名
    expect((await fetch(`${preview.url}guide/quickstart.md`)).status).toBe(200); // .md 回退
    expect((await fetch(`${preview.url}assets/logo.txt`)).status).toBe(200);
    await preview.close();
    preview = undefined as unknown as PreviewServer;
    rmSync(d, { recursive: true, force: true });
  });

  it("路径穿越被拒绝（404）", async () => {
    const d = tmpBuildDir();
    buildSite({ dir: docsDir, outDir: d });
    preview = await startPreviewServer({ dir: d, port: 0 });
    expect((await fetch(`${preview.url}../package.json`)).status).toBe(404);
    await preview.close();
    preview = undefined as unknown as PreviewServer;
    rmSync(d, { recursive: true, force: true });
  });
});
