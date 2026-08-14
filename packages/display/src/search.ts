/**
 * 内置搜索（03 §3.5，SRCH-001）
 *
 * 架构：dev server / SSG 提供预构建文档数据 search-index.json（path/title/headings/text），
 * 展示层首次打开搜索框时懒加载（索引懒加载，03 §3.5.3）→ 自研轻量检索内核
 * （倒排索引 + 字段加权）→ 即时出结果。
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

/** 纯函数：查询 → 按得分 Top N 结果（含命中摘要）。
 *  准确性修复（2026-08-14）：① CJK 单字 AND 约束——查询的每个中文字必须全部出现在文档中
 *  （修复"搜二字词被单字噪音淹没"）；② bigram/拉丁词加权 ×4——连续词命中显著优先
 *  （修复"快速"被只含"速"的文档抢位）。 */
export function search(index: SearchIndex, query: string, limit = 10): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  // 分类：CJK 单字 = AND 门槛；多字符词（bigram/拉丁词）= 高权重命中
  const cjkSingles = tokens.filter((t) => /^[\u3400-\u9fff]$/.test(t));
  const scores = new Map<number, number>();
  const termHits = new Map<number, Set<string>>();
  for (const term of tokens) {
    const postings = index.postings.get(term);
    if (!postings) continue;
    const weight = term.length >= 2 ? 4 : 1; // bigram/拉丁词 ×4
    for (const [docId, w] of postings) {
      scores.set(docId, (scores.get(docId) ?? 0) + w * weight);
      let set = termHits.get(docId);
      if (!set) {
        set = new Set();
        termHits.set(docId, set);
      }
      set.add(term);
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

/* ======================= 搜索 UI（DOM 集中在 initSearch）======================= */

const RECENT_KEY = "doclight-search-recent";
const RECENT_MAX = 5;

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

function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* 隐私模式等忽略持久化 */
  }
}

export interface SearchApi {
  open(): void;
  close(): void;
}

/** 初始化搜索：Cmd/Ctrl+K 或顶栏搜索按钮打开，懒加载索引，实时出结果 */
export function initSearch(options: { indexUrl?: string; toggleSelector?: string } = {}): SearchApi {
  // SSG 形态：页面内联 window.DOCLIGHT_SEARCH_INDEX 指向静态产物（与 DOCLIGHT_VENDOR_BASE 同模式）
  // 注：拼接式构建（build-display.mjs）所有文件合一作用域，不得与 extensions.ts 的 winGlobal 重名
  const win = window as unknown as Record<string, unknown>;
  const globalIndex = win["DOCLIGHT_SEARCH_INDEX"];
  const indexUrl =
    options.indexUrl ?? (typeof globalIndex === "string" ? globalIndex : undefined) ?? "/__doclight/search-index.json";
  const toggleSelector = options.toggleSelector ?? "#search-toggle";
  // bundle 形态（05 §5.3.4）：索引内嵌（__DOCLLIGHT_BUNDLE__.searchIndex），结果链接走 hash 路由
  const bundle = win["__DOCLLIGHT_BUNDLE__"] as { searchIndex?: { docs?: SearchDoc[] } } | undefined;
  const bundleMode = !!bundle;

  let index: SearchIndex | null = null;
  let indexLoading: Promise<void> | null = null;
  let recent = loadRecent();
  let selected = -1;

  const overlay = document.createElement("div");
  overlay.className = "search-overlay";
  overlay.innerHTML = `
    <div class="search-box" role="dialog" aria-label="搜索">
      <div class="search-input-wrap">
        <svg class="search-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input class="search-input" type="search" placeholder="搜索文档…" aria-label="搜索文档" autocomplete="off" spellcheck="false" />
        <span class="search-esc-kbd" aria-hidden="true">Esc</span>
      </div>
      <div class="search-status"></div>
      <div class="search-results" role="listbox"></div>
    </div>`;
  overlay.style.display = "none";
  document.body.appendChild(overlay);

  const input = overlay.querySelector<HTMLInputElement>(".search-input")!;
  const status = overlay.querySelector<HTMLElement>(".search-status")!;
  const resultsEl = overlay.querySelector<HTMLElement>(".search-results")!;

  /** 懒加载索引（首次打开才构建，03 §3.5.3）；持久化：版本命中则跳过 fetch（03 §3.8.5） */
  function ensureIndex(): Promise<void> {
    if (index) return Promise.resolve();
    if (!indexLoading) {
      indexLoading = (async () => {
        status.textContent = "正在构建索引…";
        try {
          // bundle 形态：索引内嵌（file:// 零网络），直接构建
          if (bundle?.searchIndex) {
            index = buildIndex(bundle.searchIndex.docs ?? []);
            status.textContent = "";
            return;
          }
          // 页面内联 window.DOCLIGHT_SEARCH_VERSION（内容哈希）：缓存命中则免网络请求
          const version = typeof win.DOCLIGHT_SEARCH_VERSION === "string" ? win.DOCLIGHT_SEARCH_VERSION : undefined;
          const cached = readSearchCache(localStorage, version);
          if (cached && cached.length > 0) {
            index = buildIndex(cached);
            status.textContent = "";
            return;
          }
          const res = await fetch(indexUrl);
          if (!res.ok) throw new Error(`索引加载失败（${res.status}）`);
          const data = (await res.json()) as { docs: SearchDoc[] };
          const docs = data.docs ?? [];
          index = buildIndex(docs);
          writeSearchCache(localStorage, version, docs);
          status.textContent = "";
        } catch (err) {
          status.textContent = `搜索不可用：${(err as Error).message}`;
        }
      })();
    }
    return indexLoading;
  }

  /** 渲染结果列表（标题高亮 + 路径面包屑 + 命中摘要） */
  function renderResults(results: SearchResult[], query: string): void {
    const terms = tokenize(query);
    if (results.length === 0) {
      resultsEl.innerHTML = `<div class="search-empty">无匹配结果</div>`;
      return;
    }
    resultsEl.innerHTML = results
      .map(
        (r) => `
      <a class="search-result" href="${bundleMode ? `#/${r.path}` : `/${r.path}`}" data-path="${r.path}">
        <span class="search-result-title">${highlight(r.title, terms)}</span>
        <span class="search-result-path">${r.path}</span>
        <span class="search-result-snippet">${highlight(r.snippet, terms)}</span>
      </a>`
      )
      .join("");
    selected = -1;
  }

  /** 渲染最近搜索（输入为空时） */
  function renderRecent(): void {
    if (recent.length === 0) {
      resultsEl.innerHTML = `<div class="search-empty">输入关键词开始搜索</div>`;
      return;
    }
    resultsEl.innerHTML =
      `<div class="search-recent-label">最近搜索</div>` +
      recent
        .map((q) => `<button class="search-recent-item" data-q="${escapeHtml(q)}">↺ ${escapeHtml(q)}</button>`)
        .join("");
    resultsEl.querySelectorAll<HTMLButtonElement>(".search-recent-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        input.value = btn.dataset.q!;
        void runSearch();
      });
    });
  }

  async function runSearch(): Promise<void> {
    const q = input.value.trim();
    if (!q) {
      renderRecent();
      return;
    }
    await ensureIndex();
    if (!index) return;
    const results = search(index, q);
    renderResults(results, q);
  }

  function moveSelection(delta: number): void {
    const links = resultsEl.querySelectorAll<HTMLAnchorElement>(".search-result");
    if (links.length === 0) return;
    selected = (selected + delta + links.length) % links.length;
    links.forEach((l, i) => l.classList.toggle("active", i === selected));
    links[selected]?.scrollIntoView({ block: "nearest" });
  }

  /** 记录最近搜索并跳转（SPA 导航由 router 文档级点击监听接管） */
  function openSelected(): void {
    const links = resultsEl.querySelectorAll<HTMLAnchorElement>(".search-result");
    const link = selected >= 0 && selected < links.length ? links[selected] : links[0];
    if (!link) return;
    const q = input.value.trim();
    if (q && !recent.includes(q)) {
      recent = [q, ...recent].slice(0, RECENT_MAX);
      saveRecent(recent);
    }
    link.click();
    close();
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  input.addEventListener("input", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void runSearch(), 100); // 防抖（03 §3.8）
  });
  input.addEventListener("keydown", (e) => {
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

  // 点击结果跳转（SPA 由 router 接管）；点击框外关闭
  overlay.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest(".search-result")) return; // 交回 router 文档级监听
    if (target.closest(".search-box")) return;
    close();
  });

  function open(): void {
    overlay.style.display = "";
    input.value = "";
    renderRecent();
    void ensureIndex().then(() => {
      if (input.value.trim()) void runSearch();
    });
    setTimeout(() => input.focus(), 0);
  }

  function close(): void {
    overlay.style.display = "none";
    document.querySelector(".search-result.active")?.classList.remove("active");
  }

  // 触发入口：顶栏搜索按钮 + Cmd/Ctrl+K + "/" 聚焦
  document.querySelector<HTMLButtonElement>(toggleSelector)?.addEventListener("click", open);
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (overlay.style.display === "none") open();
      else close();
    } else if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement).tagName)) {
      e.preventDefault();
      open();
    }
  });

  // SPA 导航后关闭搜索框（避免遮挡新页面）
  bus.on("doclight:routechange", () => close());

  return { open, close };
}
