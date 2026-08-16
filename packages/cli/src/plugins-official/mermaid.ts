/**
 * @doclight/plugin-mermaid —— Mermaid 图表插件（PLUG-012：从内置扩展迁移为官方插件）
 *
 * 迁移语义：Mermaid 是重 vendor 依赖扩展（mermaid.min.js ≈ 2.4MB），不再内置默认
 * 启用——doclight.json 配置 plugins: ["mermaid"] 后按需启用（围栏渲染 + vendor
 * 服务 + 运行时容错，与迁移前行为一致）。
 *
 * 三职责（插件自包含，07 §7.6 官方插件规范）：
 * 1. extendMarked：mermaid 围栏 → .doclight-mermaid fallback 结构（class 标记 +
 *    源码 fallback 子元素——内容承载铁律，不依赖 data-*；渲染失败/未加载时源码
 *    天然可见，降级不白屏，REND-003）。三形态（dev/SSG/bundle）经 PLUG-006
 *    extraMarkedExtensions 通道统一生效。
 * 2. vendor 声明：mermaid.min.js 按需服务（dev 端点 / SSG 拷贝 / bundle --inline-vendor）。
 * 3. styles + 运行时脚本（slotContent content:after 注入）：懒加载 mermaid.min.js →
 *    渲染 SVG；错误降级保留源码 + 提示。主题跟随 data-theme（dark → mermaid dark）。
 *    脚本经 doclight.use 注册 init/onMount 钩子——init 负责首屏渲染（app 就绪时
 *    DOM 已注入），onMount 负责路由切换后重渲染（SPA 导航）。
 * 2026-08-16 修复（展示站实测发现）：
 * - 错误残留：mermaid.render 不传 container 时会在 body 末尾自建 #d{id} 容器，
 *   失败路径不会清理 → 页面底部残留 mermaid 大红错误图。修复 = 显式隐藏容器 +
 *   suppressErrorRendering（失败时 mermaid 自清临时元素），降级完全由本插件接管。
 * - 主题跟随：监听展示层 doclight:themechange 事件（theme.ts applyTheme 派发），
 *   已渲染图表换主题重渲（注册表按节点保留源码，无需 data-*）。
 *
 * 配置（doclight.json plugins 数组项 config）：
 *   { } 无必填配置（空配置即启用）；theme/securityLevel 等为预留扩展点。
 */
import type { PluginDef } from "../../../core/src/plugin.ts";

/**
 * marked 扩展最小形状（CLI 零 marked 依赖——类型本地定义，对象由渲染内核
 * @doclight/renderer 的 marked 实例消费：extendMarked 返回 → collectMarkedExtensions
 * 收集 → render(extraMarkedExtensions) 统一挂载，PLUG-006 通道）。
 */
export interface MermaidMarkedExtension {
  name: string;
  level: "block";
  start?(src: string): number | undefined;
  tokenizer?(this: unknown, src: string): { type: string; raw: string; text: string } | undefined;
  renderer?(token: { text: string }): string;
}

/** HTML 文本转义（图表源码注入 <code>，防标签逃逸） */
function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * mermaid 围栏 marked 扩展（PLUG-006 收集器形态：extendMarked 返回扩展数组）。
 * 匹配 ```mermaid 或 ~~~mermaid 围栏（≥3 字符，与 marked 围栏规则一致），
 * 输出 .doclight-mermaid fallback——源码经转义后入 <code>，展示层/运行时读
 * textContent 还原（纯文本，无注入面）。
 */
export const mermaidExtension: MermaidMarkedExtension = {
  name: "doclightMermaid",
  level: "block",
  start(src: string) {
    return /^(`{3,}|~{3,})mermaid[ \t]*\n/.test(src) ? 0 : undefined;
  },
  tokenizer(src: string) {
    const rule = /^(`{3,}|~{3,})mermaid[ \t]*\n([\s\S]*?)\n\1[ \t]*(?:\n|$)/;
    const match = rule.exec(src);
    if (!match) return undefined;
    return { type: "doclightMermaid", raw: match[0], text: match[2] ?? "" };
  },
  renderer(token: { text: string }) {
    return `<div class="doclight-mermaid"><pre class="doclight-mermaid-src"><code>${escapeHtml(token.text)}</code></pre></div>`;
  },
};

/**
 * 插件 CSS（注入页面 <style data-doclight-plugin-css>；设计对齐 2026-08-16：
 * 输出 SVG 令牌化——节点/连线/标注复用 design token，随亮暗主题自动切换，宪法 §4.5）
 */
export const mermaidStyles = [
  ".doclight-mermaid { margin: 20px 0 24px; text-align: center; }",
  ".doclight-mermaid .doclight-mermaid-src { text-align: left; margin: 0 auto; max-width: 100%; display: inline-block; }",
  ".doclight-mermaid-rendered svg { max-width: 100%; height: auto; }",
  ".doclight-mermaid-error { color: var(--error); font-size: var(--font-size-sm); margin: 0 0 var(--space-2); }",
  /* 节点 = 白底发丝边框圆角矩形；连线 = 1.2px 次级色 + 小箭头；标注 = 等宽小字（宪法 §4.5） */
  ".doclight-mermaid .node rect, .doclight-mermaid .cluster rect, .doclight-mermaid .actor, .doclight-mermaid .messageBox, .doclight-mermaid .note, .doclight-mermaid .loopLine { fill: var(--bg); stroke: var(--line-strong); stroke-width: 1; }",
  ".doclight-mermaid .edgePath .path, .doclight-mermaid .flowchart-link { stroke: var(--text-3); stroke-width: 1.2; }",
  ".doclight-mermaid .arrowheadPath { fill: var(--text-3); }",
  ".doclight-mermaid .edgeLabel, .doclight-mermaid .nodeLabel, .doclight-mermaid .label { color: var(--text); font-family: var(--font-mono); font-size: 12px; }",
  ".doclight-mermaid .edgeLabel { background: var(--bg); }",
  ".doclight-mermaid .messageText { fill: var(--text-2); }",
  ".doclight-mermaid .marker { fill: var(--text-3); }",
].join("\n");

/**
 * 运行时增强脚本（slotContent content:after 注入，同步执行早于展示层 module）：
 * 1. PLUG-014：定义挂 window.DOCLIGHT_PLUGINS["mermaid"]——展示层 mount 时按
 *    window.DOCLIGHT_PLUGIN_CONFIGS 自动注册（doclight.json → init/onMount 接线）；
 * 2. 兼容兜底：轮询等待 window.doclight 就绪后 doclight.use 自注册（旧产物 / 无
 *    配置注入形态；PluginManager.use 按 name 防重复，双路径幂等）。
 */
function runtimeScript(): string {
  return [
    "<script>",
    "(function () {",
    "  var loaded = false;",
    "  function vendorBase() {",
    "    return window.DOCLIGHT_VENDOR_BASE || '/__doclight/vendor/';",
    "  }",
    "  function loadMermaid() {",
    "    return new Promise(function (resolve) {",
    "      if (loaded) return resolve();",
    "      // C3 bundle --inline-vendor：mermaid 全局已内联就绪 → 跳过 fetch（file:// 下无网络）",
    "      if (window.mermaid) { loaded = true; return resolve(); }",
    "      var el = document.createElement('script');",
    "      el.src = vendorBase() + 'mermaid.min.js';",
    "      el.async = true;",
    "      el.onload = function () { loaded = true; resolve(); };",
    "      el.onerror = function () { resolve(); }; // 降级：保留源码（REND-003 不白屏）",
    "      document.head.appendChild(el);",
    "    });",
    "  }",
    "  var seq = 0;",
    "  // 已渲染节点注册表（node → 源码）：主题重渲复用；不依赖 data-*（内容承载铁律）",
    "  var registry = [];",
    "  function themeName() {",
    "    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';",
    "  }",
    "  function initMermaid() {",
    "    // suppressErrorRendering（2026-08 修复）：失败时 mermaid 自清临时元素、不画错误大图",
    "    try { mermaid.initialize({ startOnLoad: false, theme: themeName(), securityLevel: 'strict', suppressErrorRendering: true }); } catch (e) {}",
    "  }",
    "  function renderNode(node, src) {",
    "    // 2026-08 修复：错误不残留 body——suppressErrorRendering 让 mermaid 失败路径自清",
    "    // 临时元素（不画错误大图）；catch 再兜底清理 #d{id}，页面零污染。",
    "    // 注意：不能传隐藏容器——display:none 容器无尺寸，mermaid 布局得负值 →",
    "    // \"rect width negative\" 渲染失败（实测 flowchart/er 全挂，仅 sequence 等碰巧成功）。",
    "    var id = 'doclight-mermaid-' + (++seq);",
    "    mermaid.render(id, src).then(function (r) {",
    "      node.innerHTML = r.svg;",
    "      node.classList.add('doclight-mermaid-rendered');",
    "    }).catch(function () {",
    "      // 兜底清理：失败路径 mermaid 应已自清（suppressErrorRendering）；版本差异时主动移除",
    "      var residual = document.getElementById('d' + id);",
    "      if (residual && residual.parentNode) residual.parentNode.removeChild(residual);",
    "      if (!node.querySelector('.doclight-mermaid-error')) {",
    "        var hint = document.createElement('p');",
    "        hint.className = 'doclight-mermaid-error';",
    "        hint.textContent = '图表渲染失败（可能是 Mermaid 语法错误），以下为图表源码：';",
    "        // 主题重渲路径节点已被清空：恢复源码 fallback（源码入 <code>，纯文本无注入面）",
    "        if (!node.querySelector('.doclight-mermaid-src')) {",
    "          var pre = document.createElement('pre');",
    "          pre.className = 'doclight-mermaid-src';",
    "          var code = document.createElement('code');",
    "          code.textContent = src;",
    "          pre.appendChild(code);",
    "          node.appendChild(pre);",
    "        }",
    "        node.insertBefore(hint, node.querySelector('.doclight-mermaid-src'));",
    "      }",
    "    });",
    "  }",
    "  function renderAll() {",
    "    var nodes = document.querySelectorAll('.doclight-mermaid');",
    "    if (!nodes.length) return;",
    "    loadMermaid().then(function () {",
    "      var mermaid = window.mermaid;",
    "      if (!mermaid) return;",
    "      initMermaid();",
    "      for (var i = 0; i < nodes.length; i++) {",
    "        (function (node) {",
    "          if (node.classList.contains('doclight-mermaid-rendered')) return; // 主题重渲走 rerenderForTheme",
    "          var srcEl = node.querySelector('.doclight-mermaid-src code') || node.querySelector('code');",
    "          var src = srcEl ? srcEl.textContent : '';",
    "          if (!src.trim()) return;",
    "          registry.push({ node: node, src: src });",
    "          renderNode(node, src);",
    "        })(nodes[i]);",
    "      }",
    "    });",
    "  }",
    "  // 主题跟随（2026-08 一并修复）：展示层 theme.ts applyTheme 派发 doclight:themechange",
    "  function rerenderForTheme() {",
    "    if (!registry.length) return;",
    "    loadMermaid().then(function () {",
    "      var mermaid = window.mermaid;",
    "      if (!mermaid) return;",
    "      initMermaid();",
    "      for (var i = 0; i < registry.length; i++) {",
    "        var entry = registry[i];",
    "        var node = entry.node;",
    "        if (!node.isConnected) continue; // SPA 导航已移除旧节点",
    "        if (!node.classList.contains('doclight-mermaid-rendered')) continue; // 失败的保持降级形态",
    "        node.classList.remove('doclight-mermaid-rendered');",
    "        node.innerHTML = ''; // 清旧 SVG（源码在 registry，无需恢复 pre）",
    "        renderNode(node, entry.src);",
    "      }",
    "    });",
    "  }",
    "  document.addEventListener('doclight:themechange', rerenderForTheme);",
    "  var def = {",
    "    name: 'mermaid',",
    "    init: function () { renderAll(); },", // 首屏（app 就绪时 DOM 已注入）
    "    onMount: function () { renderAll(); }", // 路由切换后新内容
    "  };",
    "  // PLUG-014：挂定义表（展示层按 DOCLIGHT_PLUGIN_CONFIGS 自动注册）",
    "  window.DOCLIGHT_PLUGINS = window.DOCLIGHT_PLUGINS || {};",
    "  window.DOCLIGHT_PLUGINS['mermaid'] = def;",
    "  // 兼容兜底：等展示层就绪后自注册（module script 延迟执行，slotContent 同步脚本先行——轮询兜底）",
    "  var tries = 0;",
    "  (function tryUse() {",
    "    if (window.doclight && window.doclight.use) { window.doclight.use(def); return; }",
    "    if (++tries < 100) setTimeout(tryUse, 100);",
    "  })();",
    "})();",
    "</script>",
  ].join("\n");
}

/** 工厂：创建 mermaid 插件（无必填配置，空配置即启用） */
export function createMermaidPlugin(config?: Record<string, unknown>): PluginDef | null {
  return {
    name: "mermaid",
    version: "0.1.0",
    config: config ?? {},
    capabilities: ["mermaid"],
    vendor: [{ file: "mermaid.min.js", pkg: "mermaid", rel: "dist/mermaid.min.js" }],
    styles: mermaidStyles,
    extendMarked() {
      return [mermaidExtension];
    },
    slotContent: { "content:after": runtimeScript() },
  };
}
