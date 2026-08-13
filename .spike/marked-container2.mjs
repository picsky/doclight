// spike v2：tokenizer 内手动 this.lexer.blockTokens 解析内层
import { Marked } from "marked";

const marked = new Marked();
marked.use({
  extensions: [
    {
      name: "doclightContainer",
      level: "block",
      start(src) { return src.indexOf(":::"); },
      tokenizer(src) {
        const rule = /^:::(\w+)\s*\n([\s\S]*?)\n:::\s*/;
        const match = rule.exec(src);
        if (!match) return undefined;
        const [, kind, text] = match;
        const token = { type: "doclightContainer", raw: match[0], kind, text };
        token.tokens = this.lexer.blockTokens(text, []);
        return token;
      },
      renderer(token) {
        const inner = this.parser.parse(token.tokens);
        return `<div class="doclight-container doclight-${token.kind}">${inner}</div>`;
      },
    },
  ],
});

const md1 = ":::tip\n这是**加粗**提示\n- 列表项\n:::";
console.log("=== 用例1 容器 ===");
console.log(marked.parse(md1));

const md2 = ":::warning\n```js\nconst a = 1;\n```\n:::";
console.log("=== 用例2 容器内代码块 ===");
console.log(marked.parse(md2));

const md3 = "前置段落\n:::danger\n危险内容\n:::";
console.log("=== 用例3 无空行 ===");
console.log(marked.parse(md3));

// 用例4：仅支持三种类型，未知类型不识别（保持原样段落）
const md4 = ":::unknown\nx\n:::";
console.log("=== 用例4 未知类型 ===");
console.log(marked.parse(md4));
