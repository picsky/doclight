/**
 * 1:1 机器核对（DESIGN-ALIGNMENT）：断言 DocLight 渲染页与演示页关键视觉值一致
 * （令牌/字体/布局/组件结构/交互结构），供无人工目视时的像素级等价证明。
 */
/* global window, document, getComputedStyle */
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const SITE_DIR = join(process.cwd(), "artifacts", "design-compare", "site");

// 静态服务（file:// 下 SSG 产物按设计跳过展示层——HTTP 才是完整形态）
const server = createServer((req, res) => {
  const rel = decodeURIComponent((req.url ?? "/").split("?")[0].replace(/^\/+/, ""));
  const file = join(SITE_DIR, rel === "" ? "index.html" : rel);
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error("not a file");
    res.writeHead(200, { "Content-Type": file.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8" });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const SITE = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(SITE, { waitUntil: "networkidle" });
await page.waitForTimeout(600);

const failures = [];
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "✓" : "✗"} ${label}${cond ? "" : ` —— ${detail}`}`);
  if (!cond) failures.push(label);
};

// —— 令牌（与宪法/演示页 1:1）——
const tokens = await page.evaluate(() => {
  const s = getComputedStyle(document.documentElement);
  const pick = (n) => s.getPropertyValue(n).trim();
  return {
    bg: pick("--bg"), text: pick("--text"), accent: pick("--accent"),
    accentInk: pick("--accent-ink"), surface: pick("--surface"),
    radius: pick("--radius"), fontSans: pick("--font-sans"),
  };
});
check("令牌 --bg = #ffffff", tokens.bg === "#ffffff", tokens.bg);
check("令牌 --text = #1b1b18", tokens.text === "#1b1b18", tokens.text);
check("令牌 --accent = #14714e（松绿 Pine）", tokens.accent === "#14714e", tokens.accent);
check("令牌 --radius = 10px", tokens.radius === "10px", tokens.radius);
check("字体栈含 Inter", tokens.fontSans.includes("Inter"), tokens.fontSans);

// —— 布局三栏（264/1fr/224 + topbar 60 + content 700）——
const layout = await page.evaluate(() => {
  const g = getComputedStyle(document.querySelector(".layout"));
  const tb = getComputedStyle(document.querySelector(".topbar"));
  const art = getComputedStyle(document.querySelector(".article"));
  return { cols: g.gridTemplateColumns, tbH: tb.height, artW: art.maxWidth };
});
check("三栏 264px/1fr/224px", /264px/.test(layout.cols) && /224px/.test(layout.cols), layout.cols);
check("topbar 高度 60px", layout.tbH === "60px", layout.tbH);
check("正文限宽 700px", layout.artW === "700px", layout.artW);

// —— 文章结构（crumb/eyebrow/h1/lede/meta/正文/下一步/分页）——
const struct = await page.evaluate(() => ({
  crumb: !!document.querySelector(".crumb"),
  eyebrow: document.querySelector(".eyebrow")?.textContent?.trim() ?? "",
  h1: document.querySelector("article h1")?.textContent?.trim() ?? "",
  lede: !!document.querySelector(".lede"),
  meta: document.querySelector(".meta")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 30) ?? "",
  toc: document.querySelectorAll("#tocList a").length,
  indicator: !!document.querySelector("#tocIndicator"),
  feedback: !!document.querySelector(".toc-card #fbYes"),
  next: document.querySelectorAll(".next-card").length,
  pager: !!document.querySelector(".pager"),
  status: document.querySelector(".status")?.textContent?.trim() ?? "",
  version: document.querySelector(".version-btn")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  github: !!document.querySelector('a[title="GitHub"]'),
  progress: !!document.querySelector("#progress"),
}));
check("面包屑存在（crumb）", struct.crumb);
check("eyebrow 省略（根页无分组，设计如此）", struct.eyebrow === "", struct.eyebrow);
check("h1 = frontmatter 标题", struct.h1 === "快速开始", struct.h1);
check("lede 衬线引言存在", struct.lede);
check("meta 含「最后更新于」", struct.meta.includes("最后更新于"), struct.meta);
check("目录链接数 = 5（安装/初始化/任务/配置选项/下一步）", struct.toc === 5, String(struct.toc));
check("目录指示条存在", struct.indicator);
check("反馈卡按钮存在", struct.feedback);
check("下一步卡片 ≥4 张", struct.next >= 4, String(struct.next));
check("上一页/下一页存在", struct.pager);
check("footer 状态「所有系统正常」", struct.status.includes("所有系统正常"), struct.status);
check("顶栏版本按钮 v2.4", struct.version.includes("v2.4"), struct.version);
check("GitHub 图标（配置驱动）", struct.github);
check("阅读进度条 #progress", struct.progress);

// —— 组件（tabs/steps/callout/代码文件名头/表格）——
const comp = await page.evaluate(() => ({
  tabs: document.querySelectorAll(".tab-btn").length,
  tabPanelActive: document.querySelectorAll(".tab-panel.active").length,
  steps: document.querySelectorAll(".steps li").length,
  stepTitles: document.querySelectorAll(".steps .step-title").length,
  callout: document.querySelectorAll(".doclight-container.doclight-tip").length,
  calloutIcon: !!document.querySelector(".doclight-container .icon svg"),
  fname: document.querySelector(".codeblock .fname")?.textContent ?? "",
  copyBtns: document.querySelectorAll(".copy-btn").length,
  tableFirstColMono: getComputedStyle(document.querySelector("td")).fontFamily.includes("JetBrains Mono"),
}));
check("Tabs 3 个按钮", comp.tabs === 3, String(comp.tabs));
check("首个 tab-panel 激活", comp.tabPanelActive === 1, String(comp.tabPanelActive));
check("步骤 3 项", comp.steps === 3, String(comp.steps));
check("步骤标题 3 个（首段加粗提升）", comp.stepTitles === 3, String(comp.stepTitles));
check("提示块含单色图标", comp.calloutIcon);
check("代码文件名头 lib/aster.ts", comp.fname.includes("lib/aster.ts"), comp.fname);
check("复制按钮（渲染直出）≥4", comp.copyBtns >= 4, String(comp.copyBtns));
check("表格首列等宽字体", comp.tableFirstColMono);

// —— 子页（分组内页面：eyebrow / 顶栏联动 / 侧边栏激活）——
await page.goto(`${SITE}guide/install.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const sub = await page.evaluate(() => ({
  eyebrow: document.querySelector(".eyebrow")?.textContent?.trim() ?? "",
  activeSide: document.querySelectorAll(".sidebar .side-item.active").length,
  topnavActive: document.querySelectorAll(".topnav a.active").length,
  h1: document.querySelector("article h1")?.textContent?.trim() ?? "",
}));
check("子页 eyebrow = guide（所属分组）", sub.eyebrow === "guide", sub.eyebrow);
check("子页侧边栏激活项 = 1", sub.activeSide === 1, String(sub.activeSide));
check("topnav 联动激活 = 1（guide）", sub.topnavActive === 1, String(sub.topnavActive));
check("子页 h1 = 安装与配置（frontmatter 标题）", sub.h1 === "安装与配置", sub.h1);

// —— 交互行为（展示层挂载）——
await page.goto(SITE, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const behavior = await page.evaluate(() => ({
  doclight: typeof window.doclight,
  topnav: document.querySelectorAll(".topnav a").length,
  activeSide: document.querySelectorAll(".sidebar .side-item.active").length,
  searchModal: !!document.querySelector("#modalMask"),
  progress: !!document.querySelector("#progress"),
}));
check("展示层挂载（window.doclight）", behavior.doclight === "object", behavior.doclight);
check("topnav 顶层分组（guide/core/api/examples）", behavior.topnav === 4, String(behavior.topnav));
check("侧边栏激活项（首页）", behavior.activeSide === 1, String(behavior.activeSide));
check("搜索弹层存在", behavior.searchModal);

// —— 主题切换（#themeBtn 翻转 + localStorage）——
const themeBefore = await page.getAttribute("html", "data-theme");
await page.click("#themeBtn");
const themeAfter = await page.getAttribute("html", "data-theme");
check("主题切换翻转（#themeBtn）", themeAfter !== themeBefore, `${themeBefore} → ${themeAfter}`);

// —— 搜索弹层开合（Ctrl+K）——
await page.keyboard.press("ControlOrMeta+k");
await page.waitForTimeout(400);
const searchOpen = await page.evaluate(() => document.querySelector("#modalMask")?.classList.contains("open") ?? false);
check("Ctrl+K 打开搜索弹层", searchOpen);
await page.keyboard.press("Escape");

await server.close();
await browser.close();
console.log(failures.length === 0 ? "\n全部通过 ✓ 1:1 机器核对完成" : `\n${failures.length} 项失败：${failures.join("、")}`);
process.exit(failures.length === 0 ? 0 : 1);
