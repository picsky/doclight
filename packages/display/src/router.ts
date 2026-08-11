/**
 * 路由系统（03 §3.2，SPA 导航，最简骨架）
 *
 * 劫持站内链接点击 → fetch 目标页（dev server 首屏直出完整 HTML）→ 提取内容
 * 注入 <article> → history.pushState 更新 URL → 高亮当前导航项。
 * 浏览器只消费已渲染 HTML，不接触 Markdown（架构原则）。
 * DOM 只在函数内访问；纯函数可在 Node 中测试。
 */

/** 纯函数：判断链接是否为站内链接（同 origin 且非锚点） */
export function isInternalLink(href: string | null | undefined, base: string): boolean {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  try {
    return new URL(href, base).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/** 浏览器专用：从完整 HTML 提取 <article> 内容 */
function extractArticle(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.querySelector("article")?.innerHTML ?? null;
}

/** 提取 <title>（用于 SPA 导航后更新文档标题） */
function extractTitle(html: string): string | null {
  return /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? null;
}

/** 根据当前 URL 高亮导航中匹配项（data-path 与 URL 路径做 .md 归一比较） */
export function highlightActive(url: string, navSelector = "aside.sidebar"): void {
  const path = (() => {
    try {
      return new URL(url, location.href).pathname;
    } catch {
      return "/";
    }
  })();
  const norm = (p: string) => p.replace(/^\/+/, "").replace(/\.md$/, "").replace(/\/$/, "") || "/";
  const target = norm(path);
  document.querySelectorAll<HTMLAnchorElement>(`${navSelector} a[data-path]`).forEach((a) => {
    a.classList.toggle("active", norm(a.getAttribute("data-path") ?? "") === target);
  });
}

/** 导航到站内 URL：fetch → 注入内容 → 更新 URL */
async function navigate(url: string, replace = false): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) return;
  const html = await res.text();
  const content = document.querySelector<HTMLElement>("article");
  const article = extractArticle(html);
  if (content && article !== null) {
    content.innerHTML = article;
    const title = extractTitle(html);
    if (title) document.title = title;
  }
  if (replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  highlightActive(url);
}

/** 初始化：拦截站内链接点击 + popstate 前进后退 */
export function initRouter(options: { contentSelector?: string; navSelector?: string } = {}): void {
  const navSelector = options.navSelector ?? "aside.sidebar";

  document.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!target || target.target === "_blank") return;
    const href = target.getAttribute("href");
    if (!isInternalLink(href, location.href)) return;
    e.preventDefault();
    void navigate(href!);
  });

  window.addEventListener("popstate", () => void navigate(location.href, true));

  // 初次加载高亮（直出页）
  highlightActive(location.href, navSelector);
}
