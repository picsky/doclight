/**
 * TOC 系统（03 §3.7；设计对齐 2026-08-16：演示页右侧目录——文本链接 + 滑动指示条）
 *
 * - 标题提取：article 内 h2/h3（03 §3.7.3：不含 h1，也不往下到 h4+，避免太细）
 * - 桌面目录（设计对齐）：.toc-list 内链接列表 + .toc-indicator 滑动指示条
 *   （IntersectionObserver 驱动：滚动点亮当前章节，指示条 translateY 跟随）
 * - 移动端底部面板：右下角浮动按钮 → 弹出底部面板（保留既有能力，新设计语言）
 * - 点击跳转：平滑滚动到标题 + 标题闪烁反馈（演示页 flash 动效）+ URL hash
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

/** 纯函数：渲染 TOC 链接列表（设计对齐演示页；h3 加 l3 缩进；文字面板与移动端 sheet 用） */
export function renderTocHtml(headings: TocHeading[]): string {
  return headings
    .map(
      (h) =>
        `<a href="#${h.id}" data-toc-id="${h.id}"${h.level === 3 ? ' class="l3"' : ""}>${escapeAttr(h.text)}</a>`
    )
    .join("");
}

export interface TocApi {
  /** 依据当前 article 内容重建 TOC（路由变化后调用） */
  refresh(): void;
}

/** 初始化 TOC（桌面右侧目录 + 指示条 + 移动端底部面板 + 滚动监听）。无 h2/h3 时静默隐藏。 */
export function initToc(options: { articleSelector?: string } = {}): TocApi {
  const articleSel = options.articleSelector ?? "article";
  const article = document.querySelector<HTMLElement>(articleSel);
  let observer: IntersectionObserver | null = null;

  const rail = document.querySelector<HTMLElement>(".toc");
  const list = document.querySelector<HTMLElement>("#tocList");
  const indicator = document.querySelector<HTMLElement>("#tocIndicator");
  const fab = document.querySelector<HTMLButtonElement>(".toc-fab");
  const sheet = document.querySelector<HTMLElement>(".toc-sheet");
  const sheetNav = document.querySelector<HTMLElement>(".toc-sheet-nav");

  /** 点击跳转：平滑滚动到标题 + 闪烁反馈 + 更新锚点 URL（replaceState 不追加历史） */
  function scrollToHeading(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    flashHeading(id);
    // file://（bundle 形态）replaceState 可能抛错：降级为仅滚动
    try {
      history.replaceState(null, "", `#${id}`);
    } catch {
      /* bundle/file:// 锚点更新失败不影响滚动 */
    }
    closeSheet();
  }

  /** 锚点跳转闪烁反馈（演示页 flash 动效：章节标题短暂高亮） */
  function flashHeading(id: string): void {
    const el = document.getElementById(id);
    if (!el || el.tagName !== "H2" && el.tagName !== "H3") return;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
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
  }

  function startSpy(): void {
    observer?.disconnect();
    observer = null;
    const targets = headings.map((h) => document.getElementById(h.id)).filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;

    const setActive = (id: string | null): void => {
      document.querySelectorAll<HTMLElement>("#tocList a[data-toc-id]").forEach((el) => {
        const active = el.dataset.tocId === id;
        el.classList.toggle("active", active);
        // 2026-08 补齐：激活项 aria-current（读屏当前位置感知）
        if (active) el.setAttribute("aria-current", "location");
        else el.removeAttribute("aria-current");
      });
      // 指示条：位移到激活链接（演示页 toc-indicator 逻辑）
      if (indicator && id) {
        const link = list?.querySelector<HTMLElement>(`[data-toc-id="${CSS.escape ? CSS.escape(id) : id}"]`);
        if (link) {
          indicator.style.opacity = "1";
          indicator.style.transform = `translateY(${link.offsetTop + 2}px)`;
        }
      } else if (indicator) {
        indicator.style.opacity = "0";
      }
    };

    observer = new IntersectionObserver(
      (entries) => {
        // 取当前位于视口上沿附近的标题为「当前章节」（演示页 rootMargin 策略）
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const current = visible[0]?.target as HTMLElement | undefined;
        if (current?.id) setActive(current.id);
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 }
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
    // 重建链接（保留指示条元素；SSR 已直出链接，此处幂等重建）
    const links = renderTocHtml(headings);
    if (list) {
      const indicatorEl = list.querySelector(".toc-indicator");
      list.innerHTML = "";
      if (indicatorEl) list.appendChild(indicatorEl);
      const temp = document.createElement("div");
      temp.innerHTML = links;
      while (temp.firstChild) list.appendChild(temp.firstChild);
      wireClicks(list);
    }
    if (sheetNav) {
      sheetNav.innerHTML = links;
      wireClicks(sheetNav);
    }
    if (indicator) {
      indicator.style.opacity = "0";
      indicator.style.transform = "translateY(0)";
    }
    startSpy();
    // 首项点亮（演示页 setActive(0)）
    const first = list?.querySelector<HTMLElement>("a[data-toc-id]");
    if (first) {
      first.classList.add("active");
      first.setAttribute("aria-current", "location");
      if (indicator) {
        indicator.style.opacity = "1";
        indicator.style.transform = `translateY(${first.offsetTop + 2}px)`;
      }
    }
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
