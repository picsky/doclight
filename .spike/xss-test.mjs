// B 验证：marked.js XSS 安全基线
// 测试 marked 默认行为对恶意内容的处理
import { marked } from 'marked';

const maliciousInputs = [
  {
    name: 'script-injection',
    input: '# Hello\n\n<script>alert("XSS")</script>\n\nNormal text',
  },
  {
    name: 'onclick-attribute',
    input: '# Hello\n\n[Click me](javascript:alert("XSS"))\n\n<img src=x onerror=alert("XSS")>',
  },
  {
    name: 'html-entity-bypass',
    input: '# Hello\n\n<script\\x20type="text/javascript">javascript:alert("XSS");</script>',
  },
];

console.log('=== marked.js XSS 安全测试（默认配置） ===\n');

for (const test of maliciousInputs) {
  const html = marked.parse(test.input);
  console.log(`【${test.name}】`);
  console.log('输入:', test.input.replace(/\n/g, '\\n'));
  console.log('输出:', html);
  const hasScript = html.includes('<script');
  const hasEvent = html.includes('onerror=') || html.includes('onclick=');
  const hasJS = html.includes('javascript:');
  console.log('风险:', { hasScript, hasEvent, hasJS });
  console.log('---');
}

console.log('\n结论：marked 默认不 sanitize，需要配合 DOMPurify 等库');
