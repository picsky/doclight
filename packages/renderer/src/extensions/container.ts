/**
 * 自定义容器扩展（:::tip / :::warning / :::danger / :::info）
 *
 * 白名单式：仅识别四种类型，未知类型不识别（由 marked 按普通段落处理）。
 * 内层内容用 this.lexer.blockTokens 手动解析（marked 的 childTokens 仅用于
 * walkTokens 遍历、不会自动 tokenize 内层——spike 实测，见 .spike/marked-container2.mjs）。
 *
 * 渲染产物（class 标记 + 内层已 sanitize）：
 *   <div class="doclight-container doclight-tip"><p>…</p></div>
 * 纯 CSS 标记（dev server 样式提供配色/图标），无 JS 依赖，降级即普通 div。
 */
import type { TokenizerAndRendererExtension, Tokens } from "marked";

/** 白名单容器类型 */
const KINDS = ["tip", "warning", "danger", "info"] as const;
export type ContainerKind = (typeof KINDS)[number];

const KIND_RE = `(?:${KINDS.join("|")})`;

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
    const kind = match[1]!;
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
    return `<div class="doclight-container doclight-${token.kind}">${inner}</div>`;
  },
};
