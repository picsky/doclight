/**
 * @doclight/plugin-ai-chat —— BYO-LLM 文档问答插件（PLUG-007，07 §7.6 官方插件）
 *
 * 机制：构建时插槽注入 content:after——问答面板（class 标记 + 内联脚本自引导）。
 * 零运行时 PluginDef 钩子、零外部依赖（原生 fetch + DOM，守体积门禁）。
 *
 * 安全设计（BYO-LLM）：
 * - 页面只持有「问答代理端点」URL，**绝不内联 API Key**（静态产物会被爬走）；
 *   密钥保存在用户自部署的代理（Cloudflare Worker / 自建服务）里。
 * - 回答按纯文本渲染（textContent 注入），不做 innerHTML——LLM 输出不进 DOM 解析器，
 *   与「扩展内容承载铁律」同一安全基线。
 *
 * 配置（doclight.json plugins 数组项 config）：
 *   { "endpoint": "https://your-proxy.example.com/ask" }  必填（POST {query, path} → {answer}）
 *   { "title": "问文档" }        可选（面板标题，默认「问文档」）
 *   { "placeholder": "…" }       可选（输入框占位文本）
 *   { "open": false }            可选（默认收起，点按钮展开）
 * 配置缺失 endpoint → 插件禁用（返回 null 由加载器跳过）。
 */
import type { PluginDef } from "../../../core/src/plugin.ts";

export interface AiChatConfig {
  endpoint?: string;
  title?: string;
  placeholder?: string;
  open?: boolean;
}

/** 工厂：创建 ai-chat 插件（config 无效时返回 null，加载器跳过） */
export function createAiChatPlugin(config?: Record<string, unknown>): PluginDef | null {
  const cfg = (config ?? {}) as AiChatConfig;
  if (!cfg.endpoint) return null;

  const title = cfg.title ?? "问文档";
  const placeholder = cfg.placeholder ?? "就当前文档提问…";
  const openClass = cfg.open ? " doclight-ai-chat-open" : "";

  const html = [
    `<div class="doclight-ai-chat${openClass}">`,
    `  <div class="doclight-ai-chat-head"><span>${escapeHtml(title)}</span><button type="button" class="doclight-ai-chat-toggle" aria-label="展开/收起">▾</button></div>`,
    `  <div class="doclight-ai-chat-body">`,
    `    <div class="doclight-ai-chat-log"></div>`,
    `    <form class="doclight-ai-chat-form">`,
    `      <input type="text" class="doclight-ai-chat-input" placeholder="${escapeHtml(placeholder)}" aria-label="提问">`,
    `      <button type="submit">发送</button>`,
    `    </form>`,
    `  </div>`,
    `</div>`,
    `<script>`,
    `(function () {`,
    `  var root = document.querySelector(".doclight-ai-chat");`,
    `  if (!root) return;`,
    `  var endpoint = ${JSON.stringify(cfg.endpoint)};`,
    `  var log = root.querySelector(".doclight-ai-chat-log");`,
    `  var form = root.querySelector(".doclight-ai-chat-form");`,
    `  var input = root.querySelector(".doclight-ai-chat-input");`,
    `  var toggle = root.querySelector(".doclight-ai-chat-toggle");`,
    `  toggle.addEventListener("click", function () { root.classList.toggle("doclight-ai-chat-open"); });`,
    `  function addBubble(text, from) {`,
    `    var d = document.createElement("div");`,
    `    d.className = "doclight-ai-chat-msg " + from;`,
    `    d.textContent = text;`, // 纯文本注入：LLM 输出不进 innerHTML（安全基线）
    `    log.appendChild(d); log.scrollTop = log.scrollHeight;`,
    `  }`,
    `  form.addEventListener("submit", function (e) {`,
    `    e.preventDefault();`,
    `    var q = input.value.trim();`,
    `    if (!q) return;`,
    `    input.value = "";`,
    `    addBubble(q, "user");`,
    `    var path = (window.DOCLIGHT_PATH || location.pathname);`,
    `    var loading = document.createElement("div");`,
    `    loading.className = "doclight-ai-chat-msg bot";`,
    `    loading.textContent = "…";`,
    `    log.appendChild(loading);`,
    `    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q, path: path }) })`,
    `      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })`,
    `      .then(function (data) { loading.remove(); addBubble(data && typeof data.answer === "string" ? data.answer : "（无回答）", "bot"); })`,
    `      .catch(function () { loading.remove(); addBubble("请求失败，请检查问答代理端点。", "bot"); });`,
    `  });`,
    `})();`,
    `</script>`,
  ].join("\n");

  return {
    name: "ai-chat",
    version: "0.1.0",
    config: config ?? {},
    capabilities: ["ai-chat"],
    slotContent: { "content:after": html },
  };
}

/** HTML 文本转义（配置文本注入模板） */
function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
