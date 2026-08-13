/**
 * doclight embed —— 嵌入分发（13-deployment-distribution §3.1，CLI-007，分发四触点③）
 *
 * 分发四触点中「嵌入分发」：一键生成可嵌入语雀/飞书/博客/官网的代码。
 * 两种形态：
 * - snippet.js：自包含脚本，从自身 <script src> 推导站点基址，自动注入响应式 iframe。
 *   与站点产物（dist-site/）同目录部署，宿主页只需一行 <script src="...snippet.js">。
 * - iframeHtml：可直接复制粘贴的 <iframe> 代码块（带尺寸自适应）。
 *
 * 设计要点：
 * - 零依赖（纯 Node 写文本）；snippet.js 由渲染内核无关的纯函数生成（可单测）。
 * - 站点基址不硬编码进 snippet.js——从自身 src 推导，站点搬迁/换域名不失效。
 * - 自适应：width 100% + 同源时按内容高度撑开，异源降级为 minHeight（13 §3.1）。
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BuildResult } from "./build.ts";
import { buildSite } from "./build.ts";

export interface EmbedOptions {
  /** 文档根目录（转交 buildSite） */
  dir?: string;
  /** 构建输出目录（snippet.js 写入处），默认 ./dist-site */
  outDir?: string;
  /** 站点标题 */
  title?: string;
  /** 站点绝对 URL（iframe 片段用；缺省给相对引用占位） */
  siteUrl?: string;
  /** 跳过构建（复用既有产物，测试用） */
  skipBuild?: boolean;
  /** snippet 输出文件名，默认 snippet.js */
  filename?: string;
}

export interface EmbedResult {
  /** 构建输出目录 */
  outDir: string;
  /** snippet.js 完整路径 */
  snippetFile: string;
  /** 可复制的 <iframe> 代码块 */
  iframeHtml: string;
  /** 嵌入站点 URL（siteUrl 或相对占位） */
  url: string;
  /** 构建统计（skipBuild 时为空） */
  build?: BuildResult;
}

/** 生成 snippet.js 内容（纯函数，可单测）。零依赖、自推导基址、响应式注入 iframe。 */
export function embedSnippet(): string {
  return `/* DocLight embed（CLI-007，13 §3.1）——从自身 <script src> 推导站点基址，自动注入响应式 iframe */
(function () {
  var src = "";
  var scripts = document.getElementsByTagName("script");
  for (var i = 0; i < scripts.length; i++) {
    if (/snippet\\.js/.test(scripts[i].src || "")) { src = scripts[i].src; break; }
  }
  if (!src) return;
  var base = src.replace(/[^/]*$/, ""); /* 去掉文件名，保留站点目录 */
  var frame = document.createElement("iframe");
  frame.src = base + "index.html";
  frame.title = "DocLight 文档";
  frame.setAttribute("loading", "lazy");
  frame.style.width = "100%";
  frame.style.border = "0";
  frame.style.display = "block";
  frame.style.minHeight = "480px";
  /* 同源时按内容高度撑开；跨域无法读取则保留 minHeight */
  frame.addEventListener("load", function () {
    try {
      var h = frame.contentWindow.document.documentElement.scrollHeight;
      if (h > 200) frame.style.height = h + "px";
    } catch (e) { /* 异源降级 */ }
  });
  var script = document.currentScript;
  if (script && script.parentNode) script.parentNode.insertBefore(frame, script.nextSibling);
  else document.body.appendChild(frame);
})();
`;
}

/** 生成可复制的 <iframe> 代码块（带响应式尺寸；siteUrl 缺省给相对占位） */
export function embedIframe(url: string): string {
  return [
    `<!-- DocLight 嵌入（13 §3.1）：替换 src 为你的站点地址 -->`,
    `<iframe src="${url}" loading="lazy" title="DocLight 文档" style="width:100%;border:0;min-height:480px;"></iframe>`,
  ].join("\n");
}

/** 执行嵌入分发：构建（可选）→ 生成 snippet.js + iframe 片段。供命令与测试复用。 */
export function embedSite(options: EmbedOptions = {}): EmbedResult {
  const outDir = resolve(options.outDir ?? "dist-site");
  const build = options.skipBuild ? undefined : buildSite({ dir: options.dir, outDir, title: options.title });

  const url = options.siteUrl ?? "./index.html";
  const snippetFile = resolve(outDir, options.filename ?? "snippet.js");
  writeFileSync(snippetFile, embedSnippet());

  return { outDir, snippetFile, iframeHtml: embedIframe(url), url, build };
}
