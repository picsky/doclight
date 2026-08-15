/**
 * Tabs 容器扩展（:::tabs / :::tab，设计对齐 2026-08-16：演示页 tabs 跨组联动）
 *
 * 语法：
 *   :::tabs
 *   :::tab npm
 *   npm install @aster/sdk
 *   :::
 *   :::tab pnpm
 *   pnpm add @aster/sdk
 *   :::
 *   :::
 *
 * 渲染产物（class 标记 + data-tab/data-panel 名关联——名即键，跨组联动依据）：
 *   <div class="tabs" data-tabs>
 *     <div class="tab-bar"><button class="tab-btn active" data-tab="npm">npm</button>…</div>
 *     <div class="tab-panel active" data-panel="npm">…</div>…
 *   </div>
 *
 * 联动语义（演示页一致）：同名 tab 全局联动——点击任一组的 npm，
 * 所有组的 npm 面板同时激活；故 tab 名在站点内建议唯一。
 * 无 JS 时：首个面板可见（.active 服务端直出），其余降级隐藏（可接受——纯 CSS 标记）。
 */
import type { TokenizerAndRendererExtension, Tokens } from "marked";

// 语法：:::tabs → 若干「:::tab <名>\n…\n:::」小节 → 收尾 :::（块收尾行可选——
// 若用户省略最后小节的独立收尾，则块收尾行兼任）
const TABS_RE = /^:::tabs[ \t]*\n([\s\S]*?)\n:::[ \t]*(?=\n|$)(?!\s*:::tab[ \t])(?:\n:::[ \t]*(?=\n|$))?/;
const TAB_RE = /^:::tab[ \t]+([^\n]+?)[ \t]*\n([\s\S]*?)(?=\n:::tab|\n:::|$)/;

export const tabsExtension: TokenizerAndRendererExtension = {
  name: "doclightTabs",
  level: "block",
  start(src: string) {
    return src.indexOf(":::tabs");
  },
  tokenizer(src: string) {
    const match = TABS_RE.exec(src);
    if (!match) return undefined;
    const body = match[1] ?? "";
    // 切分 tab 段：:::tab <name>\n…（直到下一个 :::tab 或收尾 :::）
    const tabs: Array<{ name: string; text: string }> = [];
    let rest = body;
    while (rest.trim()) {
      const t = TAB_RE.exec(rest);
      if (!t) break;
      tabs.push({ name: t[1]!.trim(), text: t[2] ?? "" });
      // 上一段结束后残留的换行与其收尾 ::: 行先清掉，否则 ^ 锚点匹配失败
      rest = rest
        .slice(t.index + t[0].length)
        .replace(/^[ \t]*\n/, "")
        .replace(/^:::[^\n]*\n?/, "");
    }
    if (tabs.length === 0) return undefined;
    const token = {
      type: "doclightTabs",
      raw: match[0],
      tabs: tabs.map((t) => ({ ...t, tokens: [] as Tokens.Generic[] })),
    };
    for (const tab of token.tabs) {
      tab.tokens = this.lexer.blockTokens(tab.text, []);
    }
    return token;
  },
  renderer(token: Tokens.Generic & { tabs?: Array<{ name: string; tokens: Tokens.Generic[] }> }) {
    const tabs = token.tabs ?? [];
    const bar = tabs
      .map(
        (t, i) =>
          `<button class="tab-btn${i === 0 ? " active" : ""}" type="button" data-tab="${escapeAttr(t.name)}">${escapeHtml(t.name)}</button>`
      )
      .join("");
    const panels = tabs
      .map(
        (t, i) =>
          `<div class="tab-panel${i === 0 ? " active" : ""}" data-panel="${escapeAttr(t.name)}">${this.parser.parse(t.tokens)}</div>`
      )
      .join("");
    return `<div class="tabs" data-tabs><div class="tab-bar">${bar}</div>${panels}</div>`;
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
