/**
 * doclight build —— SSG 静态导出（05-ssg-build §5.3，SSG-001 + SEO 全套 §5.4）
 *
 * 三形态架构形态②：同一渲染内核（doclight-renderer）输出完整静态站点。
 * 渐进式水合（05 §5.3.2）：内容纯静态 HTML（SEO 可读），展示层 JS 接管交互。
 *
 * 构建步骤（05 §5.3.1）：
 *   1. 扫描 docs/ → 文档树（buildNavTree）
 *   2. 逐文档渲染（frontmatter → marked → sanitize，linkSuffix=".html"）
 *   3. 生成首页 index.html（根级 README/index）
 *   4. 预构建搜索索引 search-index.json（pathSuffix=".html"，运行时直接加载；version=内容哈希）
 *   5. SEO 页面 meta（SEO-001，05 §5.4）：canonical / OG / Twitter Card / JSON-LD / 面包屑（每页）
 *   6. SEO 站点文件（SEO-002）：siteUrl 提供时生成 OG 卡片图（og/*.svg）+ sitemap.xml + robots.txt
 *   7. 拷贝静态资源（非 .md 文件原样保留目录结构）
 *   8. 拷贝展示层 bundle（dist/display.js）→ display.js
 *   9. 拷贝扩展 vendor（Prism/Mermaid/KaTeX + 字体）→ vendor/（SSG-002 基址决策）
 *
 * 产物 URL 约定：每篇 .md → 同相对路径 .html（如 guide/foo.md → guide/foo.html），
 * 任意静态托管零改写即可部署；根级 README/index.md → index.html（首页 /）。
 * 子路径部署（GitHub Pages 项目页等）：--base "/docs" 时产物内绝对 URL 全部加前缀。
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildNavTree, render } from "doclight-renderer";
import { loadConfig } from "./config.ts";
import {
  breadcrumbFor,
  buildSearchData,
  copyVendor,
  countWords,
  displayBundlePath,
  isRootIndex,
  normalizeBase,
  ogCardSvg,
  renderNav,
  renderPage,
  walkMd,
  type SeoOptions,
} from "./site.ts";

export interface BuildOptions {
  /** 文档根目录（含 .md 与静态资源），默认 ./docs */
  dir?: string;
  /** 输出目录，默认 ./dist-site（与本仓库构建产物 dist/ 区分，05 §5.2.1 约定为 dist） */
  outDir?: string;
  /** 站点标题（<title> 与顶栏） */
  title?: string;
  /** 站点描述（缺省用 doclight.json description） */
  description?: string;
  /** 站点绝对 URL（canonical/sitemap/OG 用）；缺省不输出绝对链接 SEO 文件 */
  siteUrl?: string;
  /** 子路径基址（GitHub Pages 项目页等），如 "/docs"；缺省根部署 */
  base?: string;
  /** 全局作者（JSON-LD author，缺省用 frontmatter.author） */
  author?: string;
  /** 展示层 bundle 路径（缺省 process.cwd()/dist/display.js，与 dev server 一致） */
  displayBundle?: string;
}

export interface BuildResult {
  /** 渲染页面数（含首页） */
  pages: number;
  /** 拷贝的静态资源文件数 */
  assets: number;
  /** 输出目录 */
  outDir: string;
  /** 输出总字节 */
  bytes: number;
  /** 构建耗时（ms） */
  ms: number;
}

/** 递归拷贝静态资源（跳过 .md：已渲染为 .html） */
function copyStaticAssets(docsDir: string, outDir: string): number {
  let count = 0;
  const copyDir = (dir: string, base: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = base ? `${base}/${entry}` : entry;
      if (statSync(full).isDirectory()) {
        copyDir(full, rel);
      } else if (!entry.endsWith(".md")) {
        const dest = join(outDir, rel);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, readFileSync(full));
        count++;
      }
    }
  };
  copyDir(docsDir, "");
  return count;
}

/** 逐文件统计字节数（构建报告用） */
function countBytes(outDir: string): number {
  let total = 0;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else total += statSync(full).size;
    }
  };
  walk(outDir);
  return total;
}

/** 页面标题：frontmatter.title 优先，缺省取文件名主干 */
function docTitle(frontmatter: Record<string, unknown>, rel: string): string {
  if (typeof frontmatter.title === "string" && frontmatter.title) return frontmatter.title;
  return rel.slice(rel.lastIndexOf("/") + 1).replace(/\.md$/, "");
}

/** 页面描述（SEO meta description）：frontmatter.description / summary */
function docDescription(frontmatter: Record<string, unknown>): string | undefined {
  for (const key of ["description", "summary"]) {
    const v = frontmatter[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** 页面更新时间（JSON-LD dateModified / sitemap lastmod）：frontmatter.date 优先，缺省文件 mtime */
function docUpdatedAt(frontmatter: Record<string, unknown>, filePath: string): string | undefined {
  const raw = frontmatter.date ?? frontmatter.updated;
  if (typeof raw === "string") {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  try {
    return statSync(filePath).mtime.toISOString();
  } catch {
    return undefined;
  }
}

/** sitemap.xml（05 §5.4.2）：siteUrl 提供时生成；每页含 <loc> + <lastmod>（日期） */
function writeSitemap(outDir: string, siteUrl: string, base: string, metas: Array<{ loc: string; lastmod?: string }>): void {
  const urls = metas
    .map(
      (m) =>
        `  <url><loc>${escapeXml(`${siteUrl}${base}${m.loc}`)}</loc>${m.lastmod ? `<lastmod>${m.lastmod}</lastmod>` : ""}</url>`
    )
    .join("\n");
  writeFileSync(
    join(outDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
}

/** XML 转义（复用 HTML 转义规则，覆盖 & < > " '） */
function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** robots.txt（05 §5.4.2）：全允许 + 指向 sitemap */
function writeRobots(outDir: string, siteUrl: string, base: string): void {
  writeFileSync(join(outDir, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}${base}/sitemap.xml\n`);
}

/** 执行 SSG 构建（供命令与测试复用）。outDir 先清空重建，避免残留旧文件。 */
export function buildSite(options: BuildOptions = {}): BuildResult {
  const start = Date.now();
  // 配置合并：CLI 选项 > doclight.json > 约定默认（02 §2.5）
  const cfg = loadConfig([join(process.cwd(), "doclight.json"), join(resolve(options.dir ?? "docs"), "doclight.json")]);
  const docsDir = resolve(options.dir ?? cfg.docsDir ?? "docs");
  const outDir = resolve(options.outDir ?? cfg.outputDir ?? "dist-site");
  const siteTitle = options.title ?? cfg.title ?? "DocLight";
  const siteDescription = options.description ?? cfg.description;
  const siteUrl = (options.siteUrl ?? cfg.siteUrl ?? "").trim().replace(/\/+$/, "");
  const base = normalizeBase(options.base ?? cfg.base);
  const displayBundle = options.displayBundle ?? displayBundlePath();

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const mdFiles = walkMd(docsDir);
  const navTree = buildNavTree(mdFiles);
  const navHtml = renderNav(navTree, ".html", base);

  // 搜索索引预构建（SRCH-001：SSG 形态运行时直接加载；version=内容哈希，展示层持久化校验用）
  const searchData = buildSearchData(docsDir, mdFiles, { pathSuffix: ".html" });
  const searchVersion = searchData.version;

  /** sitemap 数据 + OG 卡收集 */
  const sitePages: Array<{ loc: string; lastmod?: string; ogSlug: string; title: string; description?: string }> = [];

  /** 渲染单篇文档并写入产物 */
  function writeDoc(rel: string, outRel: string): void {
    const source = readFileSync(join(docsDir, rel), "utf8");
    const { html, frontmatter } = render(source, { currentPath: rel, linkSuffix: ".html" });
    const title = docTitle(frontmatter, rel);
    const description = docDescription(frontmatter) ?? siteDescription;
    const canonicalPath = outRel === "index.html" ? "/" : `/${outRel}`;
    const ogSlug = outRel.replace(/\.html$/, "");
    const seo: SeoOptions = {
      base,
      ...(siteUrl ? { siteUrl, canonicalPath, ogImage: `${siteUrl}${base}/og/${ogSlug}.svg` } : {}),
      breadcrumb: breadcrumbFor(navTree, rel, ".html", base, title),
      wordCount: countWords(html),
      updatedAt: docUpdatedAt(frontmatter, join(docsDir, rel)),
      ...(typeof frontmatter.author === "string" ? { author: frontmatter.author } : options.author ? { author: options.author } : {}),
    };
    const outPath = join(outDir, outRel);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      renderPage({
        title,
        siteTitle,
        navHtml,
        contentHtml: html,
        description,
        form: "ssg",
        seo,
        searchVersion,
      })
    );
    sitePages.push({
      loc: canonicalPath,
      lastmod: seo.updatedAt?.slice(0, 10),
      ogSlug,
      title,
      description,
    });
  }

  // 首页源：根级 README/index 中 README 优先（与 buildNavTree 置顶规则一致）
  const rootIndexFiles = mdFiles.filter((rel) => isRootIndex(rel));
  const rootHome = rootIndexFiles.find((rel) => /^README\.md$/i.test(rel)) ?? rootIndexFiles[0];

  let pages = 0;
  for (const rel of mdFiles) {
    // 冗余根级 index.md（非首页源且与首页同名 index.html）跳过，避免覆盖首页
    if (rel !== rootHome && isRootIndex(rel) && rel.replace(/\.md$/, "") === "index") continue;
    writeDoc(rel, rel === rootHome ? "index.html" : rel.replace(/\.md$/, ".html"));
    pages++;
  }

  // 首页回退：无根级 README/index 时用首篇文档生成 index.html（与 dev server 首页逻辑一致）
  if (!rootHome && mdFiles.length > 0) {
    writeDoc(mdFiles[0]!, "index.html");
    pages++;
  }

  // SEO：OG 分享卡片图 + sitemap + robots（siteUrl 提供时——绝对 URL 是这些文件的前提）
  if (siteUrl) {
    for (const p of sitePages) {
      const ogPath = join(outDir, "og", `${p.ogSlug}.svg`);
      mkdirSync(dirname(ogPath), { recursive: true });
      writeFileSync(ogPath, ogCardSvg({ title: p.title, description: p.description, siteTitle }));
    }
    writeSitemap(outDir, siteUrl, base, sitePages.map((p) => ({ loc: p.loc, lastmod: p.lastmod })));
    writeRobots(outDir, siteUrl, base);
  }

  // 展示层 bundle（渐进式水合所需；缺失则提示先构建）
  try {
    const bundle = readFileSync(displayBundle);
    writeFileSync(join(outDir, "display.js"), bundle);
  } catch {
    throw new Error(
      `展示层 bundle 缺失：${displayBundle}（先运行 npm run build；SSG 页面已服务端直出，但交互需 display.js）`
    );
  }

  // 扩展 vendor：自包含产物（SSG-002 决策——拷贝 dist/vendor，离线可用）
  copyVendor(outDir);

  // 搜索索引 JSON 落盘
  writeFileSync(join(outDir, "search-index.json"), JSON.stringify(searchData));

  const assets = copyStaticAssets(docsDir, outDir);
  const bytes = countBytes(outDir);

  return { pages, assets, outDir, bytes, ms: Date.now() - start };
}
