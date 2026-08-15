/**
 * 阅读状态感（DP-003，18-design-polish §3.3）
 *
 * - 阅读位置持久化：每篇文档记住滚动比例（localStorage + 路径键），跨会话回来时
 *   给一条安静的「继续阅读」提示（pill，可关闭、几秒自动淡出、reduced-motion 静默）
 * - 新鲜度可视化：SSR 直出的 <time class="doc-updated"> 改写为相对时间
 *   （「3 天前更新」，hover/title 保留绝对日期；SEO 直出绝对日期不受影响）
 * - 阅读完成度：meta 行尾部动态追加「已读 62% · 约剩 3 分钟」（一行文字，非仪表盘；
 *   读数来自阅读时长（meta「约 X 分钟阅读」）与滚动进度）
 *
 * 纯逻辑（relativeTimeText / readStatusText / resumeText / parseReadingTime / readingKey）
 * 可 Node 测试；DOM 集中在 initReadingState。三形态同构：路径键 dev/ssg 用 pathname、
 * bundle 用 hash（bundlePageKey 同源逻辑）。
 * 明确不做（用户已判定伪需求）：专注模式、字号调节。
 */
import { bus } from "./event-bus.ts";

/** 相对时间文案（<1h 分钟级 → <24h 小时级 → <30d 天级 → 超 30 天保留绝对日期） */
export function relativeTimeText(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = now.getTime() - t;
  if (diff < 0) return "";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚更新";
  if (min < 60) return `${min} 分钟前更新`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前更新`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前更新`;
  return "";
}

/** 阅读完成度文案（一行文字；剩余 ≥1 分钟才显示「约剩」） */
export function readStatusText(pct: number, readingMinutes: number): string {
  const p = Math.min(100, Math.max(0, Math.round(pct)));
  const rest = Math.round(readingMinutes * (1 - p / 100));
  return rest >= 1 ? `已读 ${p}% · 约剩 ${rest} 分钟` : `已读 ${p}%`;
}

/** 继续阅读提示文案 */
export function resumeText(pct: number): string {
  return `继续阅读 · 上次读到 ${Math.min(100, Math.max(0, Math.round(pct)))}%`;
}

/** 从 meta 文本「约 X 分钟阅读」解析分钟数；无则 0 */
export function parseReadingTime(metaText: string): number {
  const m = /约\s*(\d+)\s*分钟阅读/.exec(metaText);
  return m ? Number(m[1]) : 0;
}

/** 阅读位置持久化键（路径归一：去查询/锚点；bundle hash 路由复用同一键空间） */
export function readingKey(path: string): string {
  const p = path.split("#")[0]!.split("?")[0]!.replace(/\/+$/, "");
  return `doclight-pos-${p === "" ? "/" : p}`;
}

/** 当前文档路径（dev/ssg = pathname；bundle = hash 路由键） */
function currentDocPath(): string {
  const win = window as unknown as Record<string, unknown>;
  if (win["__DOCLLIGHT_BUNDLE__"]) {
    const h = location.hash;
    return h.startsWith("#/") ? h.slice(1) : "/";
  }
  return location.pathname;
}

/** 初始化阅读状态感（挂载 + SPA 导航重建） */
export function initReadingState(): void {
  const meta = document.querySelector<HTMLElement>(".meta");
  const readingMinutes = meta ? parseReadingTime(meta.textContent ?? "") : 0;

  /* ===== 新鲜度：绝对日期 → 相对时间（title 保留绝对日期，SEO 不变） ===== */
  document.querySelectorAll<HTMLElement>("time.doc-updated").forEach((el) => {
    if (el.dataset.relativeDone) return;
    el.dataset.relativeDone = "1";
    const iso = el.getAttribute("datetime") ?? "";
    const rel = relativeTimeText(iso);
    if (rel) {
      el.title = `最后更新于 ${el.textContent?.trim() ?? ""}`;
      el.textContent = rel;
    }
  });

  /* ===== 阅读完成度：meta 行尾部动态一行文字 ===== */
  let statusEl: HTMLElement | null = null;
  if (meta && readingMinutes > 0) {
    const sep = document.createElement("span");
    sep.className = "sep";
    statusEl = document.createElement("span");
    statusEl.id = "readStatus";
    statusEl.className = "read-status";
    meta.append(sep, statusEl);
  }
  const updateStatus = () => {
    if (!statusEl) return;
    const doc = document.documentElement;
    const total = doc.scrollHeight - doc.clientHeight;
    const pct = total > 0 ? (doc.scrollTop / total) * 100 : 0;
    statusEl.textContent = readStatusText(pct, readingMinutes);
  };

  /* ===== 阅读位置持久化 + 继续阅读提示 ===== */
  const save = (): void => {
    try {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      const ratio = total > 0 ? doc.scrollTop / total : 0;
      const pct = Math.round(ratio * 100);
      if (pct > 2 && pct < 98) {
        localStorage.setItem(readingKey(currentDocPath()), String(pct));
      } else {
        localStorage.removeItem(readingKey(currentDocPath()));
      }
    } catch {
      /* 隐私模式降级 */
    }
  };
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener(
    "scroll",
    () => {
      updateStatus();
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 400); // 防抖（滚动停止后写）
    },
    { passive: true }
  );

  /* 继续阅读 pill：上次会话在此页读到中途 → 安静提示，点击跳转，可关闭 */
  function offerResume(): void {
    document.querySelector(".resume-pill")?.remove(); // 旧提示清理（SPA 换页重offer）
    let pct = -1;
    try {
      const raw = localStorage.getItem(readingKey(currentDocPath()));
      if (raw !== null) pct = Number(raw);
    } catch {
      return;
    }
    if (pct <= 2 || pct >= 98) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const pill = document.createElement("div");
    pill.className = "resume-pill";
    pill.setAttribute("role", "status");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "resume-go";
    btn.textContent = resumeText(pct);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "resume-close";
    close.setAttribute("aria-label", "关闭继续阅读提示");
    close.textContent = "×";
    const dismiss = (): void => {
      pill.classList.add("resume-out");
      setTimeout(() => pill.remove(), 300);
    };
    btn.addEventListener("click", () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      if (total > 0) window.scrollTo({ top: (total * pct) / 100, behavior: reduced ? "auto" : "smooth" });
      dismiss();
    });
    close.addEventListener("click", dismiss);
    if (!reduced) {
      setTimeout(dismiss, 8000); // 8 秒不操作自动淡出（安静，不打断阅读）
    }
    pill.append(btn, close);
    document.body.appendChild(pill);
  }
  offerResume();

  /* SPA 导航：内容已换 → 重建（位置提示按新路径重判断；完成度读数重算） */
  bus.on("doclight:routechange", () => {
    updateStatus();
    offerResume();
  });

  updateStatus();
}
