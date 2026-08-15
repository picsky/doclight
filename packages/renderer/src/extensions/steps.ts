/**
 * 步骤容器扩展（:::steps，设计对齐 2026-08-16：演示页 steps 组件）
 *
 * 语法（markdown 有序列表，每项首个 **加粗** 提升为步骤标题）：
 *   :::steps
 *   1. **定义任务处理函数**：处理函数是一个普通的异步函数，接收类型安全的载荷。
 *   2. **启动 Worker**：Worker 可以在你的应用进程内运行，也可以作为独立服务部署。
 *   :::
 *
 * 渲染产物（class 标记，纯 CSS 计数——无 JS 依赖）：
 *   <ol class="steps">
 *     <li><span class="step-title">定义任务处理函数</span><p>处理函数是…</p></li>
 *     …
 *   </ol>
 *
 * 提升规则：列表项内首个 <p><strong>…</strong>其余…</p> → span.step-title + <p>其余</p>
 * （标题与正文分行展示，与演示页一致）；无 **加粗** 的项原样保留。
 */
import type { TokenizerAndRendererExtension, Tokens } from "marked";

const STEPS_RE = /^:::steps[ \t]*\n([\s\S]*?)\n:::[ \t]*(?=\n|$)(?!\s*:::tab[ \t])/;

export const stepsExtension: TokenizerAndRendererExtension = {
  name: "doclightSteps",
  level: "block",
  start(src: string) {
    return src.indexOf(":::steps");
  },
  tokenizer(src: string) {
    const match = STEPS_RE.exec(src);
    if (!match) return undefined;
    const token = {
      type: "doclightSteps",
      raw: match[0],
      text: match[1] ?? "",
      tokens: [] as Tokens.Generic[],
    };
    token.tokens = this.lexer.blockTokens(token.text, []);
    return token;
  },
  renderer(token: Tokens.Generic) {
    const inner = this.parser.parse(token.tokens!);
    // 列表模型：<ol> → <ol class="steps">；非列表内容回退为逐块 li
    let html: string;
    if (/^<ol>/.test(inner)) {
      html = inner.replace(/^<ol>/, '<ol class="steps">');
    } else {
      const items = inner
        .split(/(?=<p>|<h[1-6]>|<pre|<ul>|<blockquote>|<div)/)
        .map((b) => b.trim())
        .filter(Boolean)
        .map((b) => `<li>${b}</li>`)
        .join("");
      html = `<ol class="steps">${items}</ol>`;
    }
    // 提升每项内首个 <p><strong>…</strong>其余…</p> → span.step-title + <p>其余</p>
    return html.replace(
      /<li>((?:[\s\S]*?))<\/li>/g,
      (whole, body: string) => `<li>${hoistTitle(body)}</li>`
    );
  },
};

/** 提升 li 内首个「以 <strong> 开头的段落」为 step-title（标题块 + 正文块分行）。
 *  兼容两种 marked 输出：紧凑列表（<li><strong>…）与松散列表（<li><p><strong>…）。 */
function hoistTitle(liBody: string): string {
  // 松散列表：<p><strong>标题</strong>正文</p>
  const pRe = /<p><strong>([\s\S]*?)<\/strong>([\s\S]*?)<\/p>/;
  const pm = pRe.exec(liBody);
  if (pm) {
    const rest = pm[2]!.trim();
    return `<span class="step-title">${pm[1]}</span>${rest ? `<p>${rest}</p>` : ""}${liBody.slice(pm.index + pm[0]!.length)}`;
  }
  // 紧凑列表：<strong>标题</strong>正文
  const bareRe = /^<strong>([\s\S]*?)<\/strong>([\s\S]*)$/;
  const bm = bareRe.exec(liBody);
  if (bm) {
    const rest = bm[2]!.trim();
    return `<span class="step-title">${bm[1]}</span>${rest ? `<p>${rest}</p>` : ""}`;
  }
  return liBody;
}
