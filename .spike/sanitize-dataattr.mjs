// 精确 spike：定位 data-diagram 被剥离的原因（引号/换行/特定前缀）
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const { window } = new JSDOM("<!DOCTYPE html><body></body>");
const purify = DOMPurify(window);
const opt = { USE_PROFILES: { html: true }, ADD_ATTR: ["target", "loading"] };

const cases = {
  'a_data_diagram_plain':   `<div data-diagram="graph TD; A-->B">x</div>`,
  'b_data_diagram_quote':   `<div data-diagram="graph TD; A-->B&quot;x">x</div>`,
  'c_data_diagram_newline': `<div data-diagram="graph TD\nA-->B">x</div>`,
  'd_data_tex_plain':       `<span data-tex="e^{i\pi}+1=0">x</span>`,
  'e_data_tex_newline':     `<span data-tex="a\nb">x</span>`,
  'f_data_diagram_named':   `<div data-mermaid="graph TD; A-->B">x</div>`,
  'g_data_src':             `<div data-src="graph TD; A-->B&quot;x">x</div>`,
  'h_class_only':           `<div class="mermaid">x</div>`,
  'i_aria':                 `<div aria-label="graph TD; A-->B&quot;x">x</div>`,
};
for (const [k, c] of Object.entries(cases)) {
  const out = purify.sanitize(c, opt);
  console.log(`${k}: ${JSON.stringify(out)}`);
}
