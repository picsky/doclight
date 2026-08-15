/**
 * 自定义容器扩展（:::tip / :::warning / :::danger / :::info）
 *
 * 白名单式：仅识别四种类型，未知类型不识别（由 marked 按普通段落处理）。
 * 内层内容用 this.lexer.blockTokens 手动解析（marked 的 childTokens 仅用于
 * walkTokens 遍历、不会自动 tokenize 内层——spike 实测，见 .spike/marked-container2.mjs）。
 *
 * 渲染产物（class 标记 + 单色图标 span + 内层已 sanitize）：
 *   <div class="doclight-container doclight-tip"><span class="icon">[svg]</span><p>…</p></div>
 * 设计对齐（宪法 §4.4）：左侧 2.5px 语义色竖线 + 极浅同色系底色 + 单色线性图标——
 * 不加彩色徽章（图标颜色 = 强调色，语义由竖线承载）；纯 CSS 标记，无 JS 依赖，降级即普通 div。
 */
import type { TokenizerAndRendererExtension, Tokens } from "marked";

/** 白名单容器类型 */
const KINDS = ["tip", "warning", "danger", "info"] as const;
export type ContainerKind = (typeof KINDS)[number];

const KIND_RE = `(?:${KINDS.join("|")})`;

/** 单色线性图标（stroke 1.5-2px、圆角端点——宪法 §4.7；currentColor 随强调色） */
const ICONS: Record<ContainerKind, string> = {
  tip: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
  warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L2.5 20h19L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>',
  danger: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
};

export const containerExtension: TokenizerAndRendererExtension = {
  name: "doclightContainer",
  level: "block",
  start(src: string) {
    return src.indexOf(":::");
  },
  tokenizer(src: string) {
    const rule = new RegExp(`^:::(${KIND_RE})\\s*\\n([\\s\\S]*?)\\n:::\\s*`);
    const match = rule.exec(src);
    if (!match) return undefined;
    const kind = match[1]! as ContainerKind;
    const text = match[2]!;
    const token = {
      type: "doclightContainer",
      raw: match[0],
      kind,
      text,
      tokens: [] as Tokens.Generic[],
    };
    // 手动解析内层（含代码块/列表等块级内容）
    token.tokens = this.lexer.blockTokens(text, []);
    return token;
  },
  renderer(token: Tokens.Generic) {
    // token.tokens 由 tokenizer 显式赋值（blockTokens 产物）
    const inner = this.parser.parse(token.tokens!);
    const kind = (token as Tokens.Generic & { kind?: ContainerKind }).kind ?? "info";
    return `<div class="doclight-container doclight-${kind}"><span class="icon">${ICONS[kind]}</span>${inner}</div>`;
  },
};
