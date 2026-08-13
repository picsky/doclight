// spike：DOMPurify 对扩展标记（data-* / class）的默认放行
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const { window } = new JSDOM("<!DOCTYPE html><body></body>");
const purify = DOMPurify(window);

const cases = [
  `<div class="doclight-mermaid" data-diagram="graph TD; A-->B&quot;x">fallback</div>`,
  `<pre class="code-block" data-lang="js"><code class="language-js">const a=1;</code></pre>`,
  `<div class="doclight-container doclight-tip"><p>hi</p></div>`,
  `<span class="doclight-katex" data-tex="e^{i\pi}+1=0">e^{i\pi}+1=0</span>`,
  // XSS 尝试注入到 data-diagram
  `<div data-diagram="<img src=x onerror=alert(1)>">x</div>`,
  `<div class="doclight-mermaid" data-diagram="graph TD\nA-->B">x</div>`,
];
for (const c of cases) {
  const out = purify.sanitize(c, { USE_PROFILES: { html: true }, ADD_ATTR: ["target", "loading"] });
  console.log(JSON.stringify(out));
}
