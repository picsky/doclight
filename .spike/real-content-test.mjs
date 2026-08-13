// F 验证：真实内容压力测试
// 用 research-report.md（~27KB 复杂 markdown）测试 marked.js 渲染性能
import { marked } from 'marked';
import fs from 'node:fs';
import path from 'node:path';

const realContent = fs.readFileSync('../docs/research/research-report.md', 'utf-8');
console.log(`测试内容：research-report.md（${realContent.length} 字符）\n`);

const start = performance.now();
const html = marked.parse(realContent);
const elapsed = performance.now() - start;

console.log(`渲染耗时：${elapsed.toFixed(2)}ms`);
console.log(`输出 HTML 大小：${html.length} 字符`);
console.log(`性能评估：${elapsed < 50 ? '✅ 优秀（< 50ms）' : elapsed < 200 ? '⚠️ 可接受（< 200ms）' : '❌ 较慢（> 200ms）'}`);

// 检查渲染质量
const hasTable = html.includes('<table');
const hasCode = html.includes('<pre><code');
const hasHeading = (html.match(/<h[1-6]/g) || []).length;
console.log(`\n渲染质量：表格=${hasTable ? '✓' : '✗'} | 代码块=${hasCode ? '✓' : '✗'} | 标题数=${hasHeading}`);
