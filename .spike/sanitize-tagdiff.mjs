import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
const { window } = new JSDOM("<!DOCTYPE html><body></body>");
const purify = DOMPurify(window);
const opt = { USE_PROFILES: { html: true }, ADD_ATTR: ["target", "loading"] };
const cases = {
  'div_data_foo':      `<div data-foo="x">x</div>`,
  'span_data_foo':     `<span data-foo="x">x</span>`,
  'div_data_diagram':  `<div data-diagram="x">x</div>`,
  'span_data_diagram': `<span data-diagram="x">x</span>`,
  'div_data_tex':      `<div data-tex="x">x</div>`,
  'p_data_diagram':    `<p data-diagram="x">x</p>`,
  'pre_data_diagram':  `<pre data-diagram="x">x</pre>`,
  'code_data_diagram': `<code data-diagram="x">x</code>`,
  'div_data_mermaid':  `<div data-mermaid="x">x</div>`,
  'div_data_chart':    `<div data-chart="x">x</div>`,
  'div_data_src':      `<div data-src="x">x</div>`,
  'div_data_code':     `<div data-code="x">x</div>`,
};
for (const [k, c] of Object.entries(cases)) {
  console.log(`${k}: ${JSON.stringify(purify.sanitize(c, opt))}`);
}
