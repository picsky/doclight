/**
 * TOC 系统（03 §3.7，TOC-001）
 *
 * - 标题提取：article 内 h2/h3（03 §3.7.3：不含 h1，也不往下到 h4+，避免太细）
 * - PC 右侧导轨：常态细线 + 章节指示点，hover 展开完整目录面板（03 §3.7.1）
 * - 移动端底部面板：右下角浮动按钮 → 弹出底部面板（03 §3.7.2）
 * - 滚动监听：IntersectionObserver 高亮当前章节
 * - 点击跳转：平滑滚动到标题（CSS scroll-margin-top 防顶栏遮挡，04 §4.5.1）
 *
 * 路由变化后自动重建：router 导航成功向总线发 doclight:routechange，initToc 订阅之。
 * 纯逻辑（parseHeadings / renderTocHtml）可 Node 测试；DOM 访问集中在 initToc 内。
 */
import { bus } from "./event-bus.ts";

export interface TocHeading {
  level: 2 | 3;
  id: string;
  text: string;
}

/** 解码常见 HTML 实体（标题文本来自已渲染 HTML） */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** 纯函数：从文章 HTML 提取 h2/h3 大纲（渲染内核已注入 id，03 §3.3.2） */
export function parseHeadings(html: string): TocHeading[] {
  const out: TocHeading[] = [];
  const re = /<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const level = m[1] === "3" ? 3 : 2;
    const id = /id=["']([^"']*)["']/.exec(m[2]!)?.[1] ?? "";
    const text = decodeEntities(stripTags(m[3]!)).trim();
    if (id && text) out.push({ level, id, text });
  }
  return out;
}

/** 纯函数：渲染 TOC 链接列表（h3 缩进） */
export function renderTocHtml(headings: TocHeading[]): string {
  return headings
    .map(
      (h) =>
        `<a class="toc-link${h.level === 3 ? " toc-link-l3" : ""}" href="#${h.id}" data-toc-id="${h.id}">${escapeAttr(h.text)}</a>`
    )
    .join("");
}

/** 纯函数：渲染导轨指示点（每个标题一个圆点，PC 常态细线态） */
export function renderRailDots(headings: TocHeading[]): string {
  return headings
    .map(
      (h, i) =>
        `<span class="toc-dot${h.level === 3 ? " toc-dot-l3" : ""}" data-toc-id="${h.id}" title="${escapeAttr(h.text)}" style="--dot-i:${i}"></span>`
    )
    .join("");
}

export interface TocApi {
  /** 依据当前 article 内容重建 TOC（路由变化后调用） */
  refresh(): void;
}

/** 初始化 TOC（桌面导轨 + 移动端底部面板 + 滚动监听）。无 h2/h3 时静默隐藏。 */
export function initToc(options: { articleSelector?: string } = {}): TocApi {
  const articleSel = options.articleSelector ?? "article";
  const article = document.querySelector<HTMLElement>(articleSel);
  let observer: IntersectionObserver | null = null;

  const rail = document.querySelector<HTMLElement>(".toc-rail");
  const panel = document.querySelector<HTMLElement>(".toc-panel");
  const dots = document.querySelector<HTMLElement>(".toc-dots");
  const fab = document.querySelector<HTMLButtonElement>(".toc-fab");
  const sheet = document.querySelector<HTMLElement>(".toc-sheet");
  const sheetNav = document.querySelector<HTMLElement>(".toc-sheet-nav");

  /** 点击跳转：平滑滚动到标题 + 更新锚点 URL（replaceState 不追加历史） */
  function scrollToHeading(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // file://（bundle 形态）replaceState 可能抛错：降级为仅滚动
    try {
      history.replaceState(null, "", `#${id}`);
    } catch {
      /* bundle/file:// 锚点更新失败不影响滚动 */
    }
    closeSheet();
  }

  function wireClicks(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>("[data-toc-id]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        scrollToHeading(el.dataset.tocId!);
      });
    });
  }

  /** 全部内容无 h2/h3 时隐藏 TOC UI */
  function setVisible(visible: boolean): void {
    const display = visible ? "" : "none";
    if (rail) rail.style.display = display;
    if (fab) fab.style.display = display;
    if (sheet) sheet.classList.toggle("has-content", visible);
  }

  function startSpy(): void {
    observer?.disconnect();
    observer = null;
    const targets = headings.map((h) => document.getElementById(h.id)).filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;

    const setActive = (id: string | null): void => {
      document.querySelectorAll<HTMLElement>(".toc-link, .toc-dot").forEach((el) => {
        el.classList.toggle("active", el.dataset.tocId === id);
      });
    };

    observer = new IntersectionObserver(
      (entries) => {
        // 取当前位于视口上沿附近的标题为「当前章节」
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const current = visible[0]?.target as HTMLElement | undefined;
        if (current?.id) setActive(current.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    targets.forEach((el) => observer!.observe(el));
  }

  function closeSheet(): void {
    sheet?.classList.remove("open");
  }

  let headings: TocHeading[] = [];
  function refresh(): void {
    if (!article) return;
    headings = parseHeadings(article.innerHTML);
    if (headings.length === 0) {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (panel) panel.innerHTML = renderTocHtml(headings);
    if (sheetNav) sheetNav.innerHTML = renderTocHtml(headings);
    if (dots) dots.innerHTML = renderRailDots(headings);
    if (panel) wireClicks(panel);
    if (sheetNav) wireClicks(sheetNav);
    if (dots) wireClicks(dots);
    startSpy();
  }

  // 移动端：浮动按钮开合底部面板
  fab?.addEventListener("click", () => sheet?.classList.toggle("open"));
  sheet?.querySelector<HTMLButtonElement>(".toc-sheet-close")?.addEventListener("click", closeSheet);
  // 点击面板外遮罩关闭（sheet 自身点击不关闭）
  sheet?.addEventListener("click", (e) => {
    if (e.target === sheet) closeSheet();
  });

  // 路由变化后重建（router 导航成功 → 总线事件 → 内容已注入）
  bus.on("doclight:routechange", () => refresh());

  refresh();
  return { refresh };
}
