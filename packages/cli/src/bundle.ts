/**
 * doclight bundle —— 单文件便携包（05-ssg-build §5.3.4，CLI-002，形态③）
 *
 * 复用 SSG 渲染内核，输出单个自包含 doclight.html：
 * - 所有页面 HTML 打包为内嵌数据块（__DOCLLIGHT_BUNDLE__.pages，hash 路由）
 * - 内嵌搜索索引（searchIndex）+ docs.json（nav）+ 每页标题（titles）
 * - 展示层运行时内联（display.js），零外部请求
 * - 扩展 vendor（Prism/Mermaid/KaTeX）不内联：file:// 下加载失败自动降级
 *   （代码块纯文本可读可复制 / Mermaid 保留源码 / KaTeX 保留 TeX 源码，REND-003 容错）
 *
 * 产物特征（05 §5.3.4）：零依赖（file:// 三引擎可用）/ 跨浏览器 / 离线可用 / 可分发 / AI 就绪。
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildNavTree, render } from "doclight-renderer";
import { toFile as qrToFile } from "qrcode";
import { loadConfig } from "./config.ts";
import { buildSearchData, displayBundlePath, nodeModulesBase, renderNav, renderPage, VENDOR_FILES, walkMd } from "./site.ts";

export interface BundleOptions {
  /** 文档根目录，默认 ./docs */
  dir?: string;
  /** 输出目录（doclight.html 所在），默认 ./dist-bundle */
  outDir?: string;
  /** 站点标题 */
  title?: string;
  /** 展示层 bundle 源码路径（缺省 process.cwd()/dist/display.js） */
  displayBundle?: string;
  /** 输出文件名，默认 doclight.html */
  filename?: string;
  /** 下载二维码内容 URL（13 §3.2 分发四触点④）：提供则生成 bundle-qr.png（手机扫码打开/下载） */
  qrUrl?: string;
  /** 内联扩展库（C3）：Prism/Mermaid/KaTeX JS+CSS 内联进单文件，file:// 下扩展可用；
   *  默认不内联（保持体积小，扩展走 REND-003 容错降级）——体积换离线能力，opt-in。 */
  inlineVendor?: boolean;
}

export interface BundleResult {
  /** 产物完整路径 */
  file: string;
  /** 产物字节数 */
  bytes: number;
  /** 打包页数 */
  pages: number;
  /** 二维码文件路径（提供 qrUrl 时） */
  qrFile?: string;
  /** 耗时（ms） */
  ms: number;
}

/** 页面内容键：根级置顶页 → "/"，其余 → "/{outRel}" */
function pageKey(outRel: string): string {
  return outRel === "index.html" ? "/" : `/${outRel}`;
}

/** 内联扩展库 HTML（C3）：CSS 先于 JS；带 data-doclight-vendor 标记供展示层懒加载跳过 fetch */
export function inlineVendorHtml(): string {
  const css: string[] = [];
  const js: string[] = [];
  for (const [file, { pkg, rel }] of Object.entries(VENDOR_FILES)) {
    const content = readFileSync(join(nodeModulesBase(pkg), rel), "utf8");
    if (file.endsWith(".css")) css.push(`<style data-doclight-vendor="${file}">${content}</style>`);
    else js.push(`<script data-doclight-vendor="${file}">${content}</script>`);
  }
  return [...css, ...js].join("\n");
}

/** 执行 bundle 构建（供命令与测试复用）。outDir 先清空重建。 */
export async function bundleSite(options: BundleOptions = {}): Promise<BundleResult> {
  const start = Date.now();
  const cfg = loadConfig([join(process.cwd(), "doclight.json"), join(resolve(options.dir ?? "docs"), "doclight.json")]);
  const docsDir = resolve(options.dir ?? cfg.docsDir ?? "docs");
  const outDir = resolve(options.outDir ?? "dist-bundle");
  const siteTitle = options.title ?? cfg.title ?? "DocLight";
  const displayBundle = options.displayBundle ?? displayBundlePath();

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const mdFiles = walkMd(docsDir);
  const navTree = buildNavTree(mdFiles);
  // hash 路由：导航链接 #/xxx（file:// 无法 pushState）
  const navHtml = renderNav(navTree, ".html", "", true);

  const pages: Record<string, string> = {};
  const titles: Record<string, string> = {};
  let homeTitle = siteTitle;
  let homeContent = "";

  const rootIndexFiles = mdFiles.filter((rel) => /^README\.md$/i.test(rel) || /^index\.md$/i.test(rel));
  const rootHome = rootIndexFiles.find((rel) => /^README\.md$/i.test(rel)) ?? rootIndexFiles[0];

  let count = 0;
  for (const rel of mdFiles) {
    const outRel = rel === rootHome ? "index.html" : rel.replace(/\.md$/, ".html");
    const source = readFileSync(join(docsDir, rel), "utf8");
    const { html, frontmatter } = render(source, { currentPath: rel, linkSuffix: ".html" });
    const title = typeof frontmatter.title === "string" && frontmatter.title ? frontmatter.title : rel.replace(/\.md$/, "").split("/").pop()!;
    const key = pageKey(outRel);
    pages[key] = html;
    titles[key] = `${title} · ${siteTitle}`;
    if (key === "/") {
      homeTitle = title;
      homeContent = html;
    }
    count++;
  }

  // 首页回退：无根级置顶页用首篇文档（与 build 一致）
  if (!pages["/"] && mdFiles.length > 0) {
    const firstKey = pageKey(mdFiles[0]!.replace(/\.md$/, ".html"));
    homeContent = pages[firstKey] ?? "";
    homeTitle = mdFiles[0]!.replace(/\.md$/, "").split("/").pop()!;
    pages["/"] = homeContent;
    titles["/"] = `${homeTitle} · ${siteTitle}`;
  }

  // 内嵌搜索索引（pathSuffix=".html"，展示层直接构建，零网络）
  const searchData = buildSearchData(docsDir, mdFiles, { pathSuffix: ".html" });
  const bundleData = { version: 1, pages, titles, nav: navTree, searchIndex: searchData };

  const displayScript = readFileSync(displayBundle, "utf8");

  const html = renderPage({
    title: homeTitle,
    siteTitle,
    navHtml,
    contentHtml: homeContent,
    form: "bundle",
    displayScript,
    bundleData,
    extraHead: options.inlineVendor ? inlineVendorHtml() : "",
  });

  const file = join(outDir, options.filename ?? "doclight.html");
  writeFileSync(file, html);
  const result: BundleResult = { file, bytes: Buffer.byteLength(html, "utf8"), pages: count, ms: Date.now() - start };

  // C2 下载二维码（13 §3.2 分发四触点④）：--qr <url> 生成 bundle-qr.png，手机扫码打开/下载
  if (options.qrUrl) {
    const qrFile = join(outDir, "bundle-qr.png");
    await qrToFile(qrFile, options.qrUrl, { width: 480, margin: 2 });
    result.qrFile = qrFile;
  }
  return result;
}
