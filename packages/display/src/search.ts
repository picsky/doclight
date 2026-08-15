/**
 * 内置搜索（03 §3.5，SRCH-001；设计对齐 2026-08-16：演示页搜索弹层结构）
 *
 * 架构：dev server / SSG 提供预构建文档数据 search-index.json（path/title/headings/text/section），
 * 展示层首次打开搜索框时懒加载（索引懒加载，03 §3.5.3）→ 自研轻量检索内核
 * （倒排索引 + 字段加权）→ 即时出结果。
 *
 * UI（设计对齐演示页）：顶栏 #searchBtn 打开 #modalMask（服务端直出）——
 * 搜索行（图标 + 输入 + ESC 徽标）+ 结果列表（文件图标 + 标题 + 所属分组节标签）+ 快捷键脚注；
 * ↑↓ 选择、⏎ 打开、esc 关闭、Ctrl/Cmd+K 全局开合。
 *
 * 为什么自研而非 MiniSearch：展示层零外部依赖 + <25KB gzip 硬门禁（02 §2.3.4），
 * 拼接式构建（build-display.mjs）无裸包名解析；以 MiniSearch 同形状 API
 * （字段权重 / 索引 + search(query) → { id, score, terms }）落地，
 * Phase 3 构建工具链允许打包时，可一处文件替换为真实 MiniSearch（03 §3.5.4）。
 *
 * 中文支持：CJK 以「单字 + 二元组」建索引（bigram），无需分词库（03 §3.5.4 中文检测）。
 * 纯逻辑（tokenize/buildIndex/search/highlight）可 Node 测试；DOM 集中在 initSearch。
 */
import { bus } from "./event-bus.ts";

export interface SearchDoc {
  path: string;
  title: string;
  headings: string[];
  text: string;
  /** 设计对齐：文档所属顶层分组（结果「节」标签，演示页 ri-sec） */
  section?: string;
}

export interface SearchIndex {
  docs: SearchDoc[];
  /** 检索词 → 文档ID → 加权命中次数 */
  postings: Map<string, Map<number, number>>;
}

export interface SearchResult {
  path: string;
  title: string;
  score: number;
  snippet: string;
}

/** 纯函数：文本切词（拉丁按词；CJK 单字 + 二元组） */
export function tokenize(text: string): string[] {
  const tokens = new Set<string>();
  const lower = text.toLowerCase();
  for (const m of lower.matchAll(/[a-z0-9]+/g)) tokens.add(m[0]!);
  for (const run of lower.matchAll(/[㐀-鿿]+/g)) {
    const s = run[0]!;
    for (let i = 0; i < s.length; i++) {
      tokens.add(s[i]!);
      if (i + 1 < s.length) tokens.add(s.slice(i, i + 2));
    }
  }
  return [...tokens];
}

/** 字段权重（03 §3.5：标题 > 标题大纲 > 路径/正文） */
function fieldWeight(field: "title" | "headings" | "path" | "text"): number {
  return field === "title" ? 4 : field === "headings" ? 2 : 1;
}

/** 纯函数：构建倒排索引（path 也入索引，便于按文件名/路径搜索） */
export function buildIndex(docs: SearchDoc[]): SearchIndex {
  const postings = new Map<string, Map<number, number>>();
  docs.forEach((doc, docId) => {
    const fields: Array<["title" | "headings" | "path" | "text", string]> = [
      ["title", doc.title],
      ["headings", doc.headings.join(" ")],
      ["path", doc.path],
      ["text", doc.text],
    ];
    for (const [field, content] of fields) {
      for (const term of tokenize(content)) {
        let map = postings.get(term);
        if (!map) {
          map = new Map();
          postings.set(term, map);
        }
        map.set(docId, (map.get(docId) ?? 0) + fieldWeight(field));
      }
    }
  });
  return { docs, postings };
}

/** 生成命中摘要：取首个命中词附近窗口，无命中取开头 */
function makeSnippet(doc: SearchDoc, terms: string[], width = 60): string {
  const text = doc.text.replace(/\s+/g, " ").trim();
  if (!text) return "";
  let idx = -1;
  for (const t of terms) {
    const i = text.indexOf(t);
    if (i !== -1) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return text.length > width ? text.slice(0, width) + "…" : text;
  const start = Math.max(0, idx - 10);
  const end = start + width;
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

/**
 * 拉丁词前缀展开（2026-08-14 修复：搜 "eng" 应命中 "engine"）。
 * 索引为完整词倒排（tokenize 按 [a-z0-9]+ 整词切分），查询词可能只是前缀——
 * 扫描倒排词表做 startsWith 匹配（文档站词表规模下 O(词表) 可接受，零索引体积增量）。
 * 长度 <2 不展开（"e" 前缀爆炸）；仅拉丁词（CJK bigram 不受影响）。
 */
function expandLatinPrefix(index: SearchIndex, term: string): string[] {
  if (term.length < 2 || !/^[a-z0-9]+$/.test(term)) return [term];
  const out: string[] = [];
  for (const key of index.postings.keys()) {
    if (/^[a-z0-9]+$/.test(key) && key.startsWith(term)) out.push(key);
  }
  return out.length > 0 ? out : [term];
}

/** 纯函数：查询 → 按得分 Top N 结果（含命中摘要）。
 *  准确性修复（2026-08-14）：① CJK 单字 AND 约束——查询的每个中文字必须全部出现在文档中
 *  （修复"搜二字词被单字噪音淹没"）；② bigram/拉丁词加权 ×4——连续词命中显著优先；
 *  ③ 拉丁词前缀匹配——"eng" 命中 "engine"（精确 ×4，前缀 ×2）。 */
export function search(index: SearchIndex, query: string, limit = 10): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  // 分类：CJK 单字 = AND 门槛；多字符词（bigram/拉丁词）= 高权重命中
  const cjkSingles = tokens.filter((t) => /^[\u3400-\u9fff]$/.test(t));
  const scores = new Map<number, number>();
  const termHits = new Map<number, Set<string>>();
  for (const term of tokens) {
    for (const t of expandLatinPrefix(index, term)) {
      const postings = index.postings.get(t);
      if (!postings) continue;
      // 精确命中 ×4（bigram/拉丁完整词），前缀命中 ×2（匹配但非整词）
      const weight = t === term ? (term.length >= 2 ? 4 : 1) : 2;
      for (const [docId, w] of postings) {
        scores.set(docId, (scores.get(docId) ?? 0) + w * weight);
        let set = termHits.get(docId);
        if (!set) {
          set = new Set();
          termHits.set(docId, set);
        }
        set.add(t);
      }
    }
  }
  // AND：CJK 单字必须全部命中（拉丁词查询无此约束——保持 OR）
  if (cjkSingles.length > 0) {
    for (const [docId] of [...scores]) {
      const allHit = cjkSingles.every((c) => index.postings.get(c)?.has(docId));
      if (!allHit) scores.delete(docId);
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([docId, score]) => {
      const doc = index.docs[docId]!;
      return { path: doc.path, title: doc.title, score, snippet: makeSnippet(doc, [...(termHits.get(docId) ?? [])]) };
    });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 纯函数：为命中词包 <mark>（高亮，结果展示用） */
export function highlight(text: string, terms: string[]): string {
  const escaped = escapeHtml(text);
  if (terms.length === 0) return escaped;
  const re = new RegExp(`(${terms.map((t) => escapeRe(escapeHtml(t))).join("|")})`, "gi");
  return escaped.replace(re, "<mark>$1</mark>");
}

/* ======================= 搜索 UI（DOM 集中在 initSearch；模板服务端直出 modal）======================= */

/* ===== 搜索索引持久化（03 §3.8.5：localStorage + 版本校验）===== */

/** 缓存键 = 版本隔离：内容变化（构建哈希）→ 版本变化 → 旧缓存自动失效不误用 */
export function searchCacheKey(version: string): string {
  return `doclight-search-idx-${version}`;
}

/** 读取缓存文档（version 缺失 / 无缓存 / 解析失败 → null）。storage 抽象便于 Node 单测注入 mock。 */
export function readSearchCache(
  storage: Pick<Storage, "getItem">,
  version: string | undefined
): SearchDoc[] | null {
  if (!version) return null;
  try {
    const raw = storage.getItem(searchCacheKey(version));
    if (!raw) return null;
    const data = JSON.parse(raw) as { docs?: unknown };
    return Array.isArray(data.docs) ? (data.docs as SearchDoc[]) : null;
  } catch {
    return null;
  }
}

/** 写入缓存（不可用/超限时静默忽略，与最近搜索同策略） */
export function writeSearchCache(
  storage: Pick<Storage, "setItem">,
  version: string | undefined,
  docs: SearchDoc[]
): void {
  if (!version) return;
  try {
    storage.setItem(searchCacheKey(version), JSON.stringify({ docs }));
  } catch {
    /* 隐私模式 / 配额满等忽略持久化 */
  }
}

export interface SearchApi {
  open(): void;
  close(): void;
}

const DOC_ICON =
  '<svg class="ri-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';

/** 初始化搜索：Cmd/Ctrl+K 或顶栏搜索按钮打开，懒加载索引，实时出结果（演示页弹层结构） */
export function initSearch(options: { indexUrl?: string; toggleSelector?: string } = {}): SearchApi {
  // SSG 形态：页面内联 window.DOCLIGHT_SEARCH_INDEX 指向静态产物（与 DOCLIGHT_VENDOR_BASE 同模式）
  // 注：拼接式构建（build-display.mjs）所有文件合一作用域，不得与 extensions.ts 的 winGlobal 重名
  const win = window as unknown as Record<string, unknown>;
  const globalIndex = win["DOCLIGHT_SEARCH_INDEX"];
  const indexUrl =
    options.indexUrl ?? (typeof globalIndex === "string" ? globalIndex : undefined) ?? "/__doclight/search-index.json";
  const toggleSelector = options.toggleSelector ?? "#searchBtn";
  // 子路径部署（--base）：结果链接补基址前缀（2026-08 修复 H4——此前搜索点击 404）
  const base = (win["DOCLIGHT_BASE"] as string | undefined) ?? "";
  // bundle 形态（05 §5.3.4）：索引内嵌（__DOCLLIGHT_BUNDLE__.searchIndex），结果链接走 hash 路由
  const bundle = win["__DOCLLIGHT_BUNDLE__"] as { searchIndex?: { docs?: SearchDoc[] } } | undefined;
  const bundleMode = !!bundle;

  let index: SearchIndex | null = null;
  let indexLoading: Promise<void> | null = null;
  let selected = -1;
  let lastFocused: HTMLElement | null = null;

  const mask = document.querySelector<HTMLElement>("#modalMask");
  const input = document.querySelector<HTMLInputElement>("#searchInput");
  const resultsEl = document.querySelector<HTMLElement>("#results");
  const searchBtn = document.querySelector<HTMLButtonElement>(toggleSelector);
  if (!mask || !input || !resultsEl) {
    // 模板缺失（自定义页面）：静默降级，不中断其余展示层
    return { open: () => {}, close: () => {} };
  }
  // 显式非空别名：闭包内 const 收窄在 TS CFA 下不可靠（异步回调/事件处理器），别名保证类型安全
  const maskEl = mask;
  const inputEl = input;
  const resultsBox = resultsEl;
  maskEl.setAttribute("aria-modal", "true");
  const listId = "doclight-search-results";
  resultsBox.id = listId;
  resultsBox.setAttribute("role", "listbox");
  resultsBox.setAttribute("aria-label", "搜索结果");
  inputEl.setAttribute("aria-controls", listId);

  /** 懒加载索引（首次打开才构建，03 §3.5.3）；持久化：版本命中则跳过 fetch（03 §3.8.5） */
  function ensureIndex(): Promise<void> {
    if (index) return Promise.resolve();
    if (!indexLoading) {
      indexLoading = (async () => {
        try {
          // bundle 形态：索引内嵌（file:// 零网络），直接构建
          if (bundle?.searchIndex) {
            index = buildIndex(bundle.searchIndex.docs ?? []);
            return;
          }
          // 页面内联 window.DOCLIGHT_SEARCH_VERSION（内容哈希）：缓存命中则免网络请求
          const version = typeof win.DOCLIGHT_SEARCH_VERSION === "string" ? win.DOCLIGHT_SEARCH_VERSION : undefined;
          const cached = readSearchCache(localStorage, version);
          if (cached && cached.length > 0) {
            index = buildIndex(cached);
            return;
          }
          const res = await fetch(indexUrl);
          if (!res.ok) throw new Error(`索引加载失败（${res.status}）`);
          const data = (await res.json()) as { docs: SearchDoc[] };
          const docs = data.docs ?? [];
          index = buildIndex(docs);
          writeSearchCache(localStorage, version, docs);
        } catch (err) {
          // 索引不可用：输入时给出提示（不伪造成功）
          index = null;
          indexLoading = null;
          resultsBox.innerHTML = `<div style="padding:24px;text-align:center;font-size:13px;color:var(--text-3)">搜索不可用：${escapeHtml((err as Error).message)}</div>`;
        }
      })();
    }
    return indexLoading;
  }

  /** 渲染结果列表（设计对齐演示页：图标 + 标题 + 分组节标签；option 语义 + 序号 id；
   *  DP-006：错峰入场 stagger——每项 animation-delay 24ms 递增，≤300ms 封顶） */
  function renderResults(results: SearchResult[], query: string): void {
    const terms = tokenize(query);
    if (results.length === 0) {
      resultsBox.innerHTML = `<div style="padding:24px;text-align:center;font-size:13px;color:var(--text-3)">没有找到相关结果</div>`;
      inputEl.removeAttribute("aria-activedescendant");
      return;
    }
    resultsBox.innerHTML = results
      .map((r, i) => {
        const doc = index?.docs.find((d) => d.path === r.path);
        const section = doc?.section ? `<span class="ri-sec">${escapeHtml(doc.section)}</span>` : "";
        const delay = Math.min(i * 24, 288); // 错峰（reduced-motion 下 CSS 全局静止）
        return `<a class="result-item" id="doclight-opt-${i}" role="option" aria-selected="false" href="${bundleMode ? `#/${r.path}` : `${base}/${r.path}`}" data-path="${r.path}" style="animation-delay:${delay}ms">${DOC_ICON}<span class="ri-title">${highlight(r.title, terms)}</span>${section}</a>`;
      })
      .join("");
    selected = -1;
  }

  /** 渲染初始列表（输入为空：全部文档，演示页行为；大站点截断 20 条；DP-006 错峰入场） */
  function renderAllDocs(): void {
    if (!index) {
      resultsBox.innerHTML = `<div style="padding:24px;text-align:center;font-size:13px;color:var(--text-3)">输入关键词开始搜索</div>`;
      return;
    }
    const docs = index.docs.slice(0, 20);
    resultsBox.innerHTML = docs
      .map(
        (d, i) =>
          `<a class="result-item" id="doclight-opt-${i}" role="option" aria-selected="false" href="${bundleMode ? `#/${d.path}` : `${base}/${d.path}`}" data-path="${d.path}" style="animation-delay:${Math.min(i * 24, 288)}ms">${DOC_ICON}<span class="ri-title">${escapeHtml(d.title)}</span>${d.section ? `<span class="ri-sec">${escapeHtml(d.section)}</span>` : ""}</a>`
      )
      .join("");
    selected = -1;
  }

  async function runSearch(): Promise<void> {
    const q = inputEl.value.trim();
    if (!q) {
      renderAllDocs();
      return;
    }
    await ensureIndex();
    if (!index) return;
    renderResults(search(index, q), q);
  }

  function moveSelection(delta: number): void {
    const items = resultsBox.querySelectorAll<HTMLElement>(".result-item");
    if (items.length === 0) return;
    selected = (selected + delta + items.length) % items.length;
    items.forEach((el, i) => {
      const on = i === selected;
      el.classList.toggle("sel", on);
      el.setAttribute("aria-selected", String(on));
    });
    items[selected]?.scrollIntoView({ block: "nearest" });
    inputEl.setAttribute("aria-activedescendant", `doclight-opt-${selected}`);
  }

  /** 打开选中结果（SPA 导航由 router 文档级点击监听接管） */
  function openSelected(): void {
    const items = resultsBox.querySelectorAll<HTMLElement>(".result-item");
    const item = selected >= 0 && selected < items.length ? items[selected] : items[0];
    if (!item) return;
    item.click();
    close();
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  inputEl.addEventListener("input", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void runSearch(), 100); // 防抖（03 §3.8）
  });
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      openSelected();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  // 点击结果跳转（SPA 由 router 接管）；点击遮罩空白关闭（演示页行为）
  maskEl.addEventListener("click", (e) => {
    if (e.target === maskEl) close();
  });

  // 2026-08 无障碍补齐：焦点陷阱（Tab 在弹层内循环，不穿透到背景页）
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  maskEl.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !maskEl.classList.contains("open")) return;
    const focusables = [...maskEl.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === inputEl
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  function open(): void {
    if (maskEl.classList.contains("open")) return;
    lastFocused = document.activeElement as HTMLElement | null;
    maskEl.classList.add("open");
    inputEl.value = "";
    selected = -1;
    resultsBox.innerHTML = `<div style="padding:24px;text-align:center;font-size:13px;color:var(--text-3)">输入关键词开始搜索</div>`;
    void ensureIndex().then(() => {
      if (maskEl.classList.contains("open") && !inputEl.value.trim()) renderAllDocs();
    });
    setTimeout(() => inputEl.focus(), 30); // 演示页时序：等入场动画后聚焦
  }

  function close(): void {
    if (!maskEl.classList.contains("open")) return;
    maskEl.classList.remove("open");
    inputEl.removeAttribute("aria-activedescendant");
    inputEl.value = "";
    // 2026-08 无障碍补齐：关闭后焦点还原到触发按钮（此前焦点丢失回落到 body）
    if (document.activeElement === inputEl || maskEl.contains(document.activeElement)) {
      lastFocused?.focus();
    }
  }

  // 触发入口：顶栏搜索按钮 + Cmd/Ctrl+K（演示页行为）+ "/" 聚焦
  searchBtn?.addEventListener("click", open);
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (maskEl.classList.contains("open")) close();
      else open();
    } else if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement).tagName)) {
      e.preventDefault();
      open();
    } else if (e.key === "Escape" && maskEl.classList.contains("open")) {
      // 2026-08 无障碍补齐：document 级 Esc 兜底（焦点在结果链接上也能关闭）
      e.preventDefault();
      close();
    }
  });

  // SPA 导航后关闭搜索框（避免遮挡新页面）
  bus.on("doclight:routechange", () => close());

  return { open, close };
}
