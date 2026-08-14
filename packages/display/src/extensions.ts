/**
 * 扩展语法增强器（REND-002 客户端懒加载映射 + 复制/高亮/KaTeX）
 *
 * 职责：扫描渲染内核输出的 class 标记（packages/renderer extensions/registry），
 * 按注册表懒加载映射从 vendor 端点注入资源并增强：
 * - code-block：复制按钮（零依赖，同步注入）+ Prism 懒加载高亮
 * - katex：懒加载 katex.js/css → renderToString 替换
 *
 * PLUG-012（Mermaid 迁移）：Mermaid 容错渲染（REND-003）已迁出展示层，
 * 由 @doclight/plugin-mermaid 官方插件提供（运行时 init/onMount 钩子 + 自带
 * vendor/styles 声明）——启用插件后与内置时期行为一致。
 *
 * 体积门禁（ADR-0002）：vendor 资源全部按需注入（script/link 动态创建），不进
 * 展示层 bundle——dist/display.js 体积不因扩展而增长。
 * vendor 默认从 /__doclight/vendor/*（dev server 提供）；SSG/bundle 形态可通过
 * window.DOCLIGHT_VENDOR_BASE 覆盖（Phase 3 决策点）。
 * 路由变化后重新增强（bus: doclight:routechange，新 article 内容已注入）。
 */
import { bus } from "./event-bus.ts";

const DEFAULT_VENDOR = "/__doclight/vendor/";

/** 类型安全的 window 全局读取（vendor 库 / 覆盖基址）。
 *  导出供 index.ts 复用（build-display 拼接产物为同一作用域，顶层重复声明会 SyntaxError）。 */
export function winGlobal(key: string): unknown {
  return (window as unknown as Record<string, unknown>)[key];
}

function vendorBase(): string {
  // SSG/bundle 形态可覆盖 vendor 资源基址
  return (winGlobal("DOCLIGHT_VENDOR_BASE") as string | undefined) ?? DEFAULT_VENDOR;
}

/* ===== 懒加载（去重 + 内联跳过，C3 bundle --inline-vendor） ===== */

const loadedScripts = new Set<string>();
const loadedStyles = new Set<string>();

/** 脚本文件 → 其暴露的全局名：bundle 内联 vendor 后全局已存在，跳过 fetch（file:// 下无网络） */
const VENDOR_SCRIPT_GLOBALS: Array<[string, string]> = [
  ["prism.min.js", "Prism"],
  ["katex.min.js", "katex"],
];

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (loadedScripts.has(src)) return resolve();
    // 内联 vendor（C3）：对应库全局已就绪 → 无需再注入
    const vendorGlobal = VENDOR_SCRIPT_GLOBALS.find(([f]) => src.endsWith(f))?.[1];
    if (vendorGlobal && winGlobal(vendorGlobal) !== undefined) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    el.onerror = () => reject(new Error(`vendor 脚本加载失败：${src}`));
    document.head.appendChild(el);
  });
}

function loadStyle(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (loadedStyles.has(href)) return resolve();
    // 内联 vendor CSS（C3）：带 data-doclight-vendor 标记的 <style> 已注入 → 跳过
    const file = href.split("/").pop();
    if (file && document.querySelector(`style[data-doclight-vendor="${file}"]`)) return resolve();
    const el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = href;
    el.onload = () => {
      loadedStyles.add(href);
      resolve();
    };
    el.onerror = () => reject(new Error(`vendor 样式加载失败：${href}`));
    document.head.appendChild(el);
  });
}

/** 纯函数：从 code 元素 class 提取语言（如 "language-js" → "js"；无语言返回 null） */
export function extractLanguage(className: string): string | null {
  const m = /\blanguage-([\w-]+)/.exec(className);
  return m ? m[1]! : null;
}

/* ===== code-block：复制按钮（零依赖，同步） ===== */

/** 复制动作完成后的短暂反馈 */
function flashCopied(btn: HTMLButtonElement, original: string): void {
  btn.textContent = "✓ 已复制";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("copied");
  }, 1500);
}

/** 剪贴板 API 不可用时降级：选中源码（execCommand 兼容旧浏览器） */
function fallbackCopy(pre: HTMLPreElement, done: () => void): void {
  const code = pre.querySelector("code");
  if (!code) return;
  const range = document.createRange();
  range.selectNodeContents(code);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
  try {
    document.execCommand("copy");
  } catch {
    /* 复制失败静默（用户仍可手动 Ctrl+C 选中内容） */
  }
  done();
}

function addCopyButtons(scope: HTMLElement): void {
  scope.querySelectorAll<HTMLPreElement>("pre.doclight-code").forEach((pre) => {
    if (pre.dataset.copyAdded) return; // 防重复（dataset 标记）
    pre.dataset.copyAdded = "1";
    pre.classList.add("has-copy");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "doclight-copy";
    btn.setAttribute("aria-label", "复制代码");
    btn.textContent = "复制";
    btn.addEventListener("click", () => {
      const text = pre.querySelector("code")?.textContent ?? "";
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => flashCopied(btn, "复制")).catch(() => fallbackCopy(pre, () => flashCopied(btn, "复制")));
      } else {
        fallbackCopy(pre, () => flashCopied(btn, "复制"));
      }
    });
    pre.appendChild(btn);
    // VIS-002：语言标签（右上角小字，与复制按钮并存时让位）
    const code = pre.querySelector("code");
    const lang = code ? extractLanguage(code.className) : null;
    if (lang) {
      const tag = document.createElement("span");
      tag.className = "doclight-lang";
      tag.textContent = lang;
      pre.appendChild(tag);
    }
  });
}

/* ===== code-block：Prism 懒加载高亮 ===== */

async function highlightCode(scope: HTMLElement): Promise<void> {
  const codes = scope.querySelectorAll<HTMLElement>("pre.doclight-code code[class*='language-']");
  if (codes.length === 0) return;
  try {
    await loadScript(vendorBase() + "prism.min.js");
  } catch {
    return; // 降级：保留纯代码块（可读 + 可复制）
  }
  const Prism = winGlobal("Prism") as { highlightElement(el: HTMLElement): void } | undefined;
  if (!Prism) return;
  codes.forEach((el) => {
    try {
      Prism.highlightElement(el);
    } catch {
      /* 单块高亮失败不影响其他 */
    }
  });
}

/* ===== KaTeX 公式 ===== */

async function renderKatex(scope: HTMLElement): Promise<void> {
  const els = scope.querySelectorAll<HTMLElement>(".doclight-katex-inline, .doclight-katex-block");
  if (els.length === 0) return;
  try {
    await Promise.all([loadScript(vendorBase() + "katex.min.js"), loadStyle(vendorBase() + "katex.min.css")]);
  } catch {
    return; // 降级：TeX 源码可见
  }
  const katex = winGlobal("katex") as
    | { renderToString(tex: string, opts: { displayMode: boolean; throwOnError: boolean }): string }
    | undefined;
  if (!katex) return;
  els.forEach((el) => {
    const tex = el.textContent ?? "";
    const displayMode = el.classList.contains("doclight-katex-block");
    try {
      el.innerHTML = katex.renderToString(tex, { displayMode, throwOnError: false });
    } catch {
      /* 渲染失败保留 TeX 源码（降级） */
    }
  });
}

/* ===== 主入口 ===== */

export interface ExtensionsApi {
  /** 重新扫描并增强（路由切换后由外部调用；内部已订阅 routechange） */
  enhance(scope?: HTMLElement): void;
}

/** 初始化扩展增强器。扫描 root 内扩展标记，同步注入复制按钮、异步懒加载其余增强。 */
export function initExtensions(root?: HTMLElement): ExtensionsApi {
  const scopeRoot = root ?? document.body;

  function enhance(scope?: HTMLElement): void {
    const target = scope ?? scopeRoot;
    // 同步：复制按钮（零依赖）
    addCopyButtons(target);
    // 异步：懒加载增强（各扩展内部自判断是否有标记，无则零开销返回）
    void highlightCode(target);
    void renderKatex(target);
  }

  enhance();
  // 路由变化后重新增强（router 导航成功 → 总线事件 → 新内容已注入 article）
  bus.on("doclight:routechange", () => enhance());

  return { enhance };
}
