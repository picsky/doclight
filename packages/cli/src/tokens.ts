/**
 * token 估算（AEO-001，发布产物 Agent 友好：token 计数）
 *
 * Agent 读取文档的成本以 token 计（Cisco 单文档 193K tokens 威胁上下文窗口——
 * 「token 数是一级文档指标」，research/product-vision-validation.md §二）。
 * 发布产物（docs.json / llms.txt / 页面 meta）为每篇文档给出 token 估算，
 * Agent 读取前即可评估成本，选择只读摘要或按需分节。
 *
 * 估算方法（诚实声明：这是启发式，非真实分词器）：
 * - CJK 字符按 ~0.75 token/字（Claude/GPT 系列对中文的常见比例）
 * - 非 CJK 词按 ~1.3 token/词（英文词平均 ~4 字符 ≈ 1.3 token，含标点/代码稀释）
 * - 上取整，至少 1（空文档也算 1，避免除零/误导）
 * 如需精确值可换真实 tokenizer（tiktoken 等），本函数保持零依赖可替换。
 */
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const nonCjkWords = text
    .split(/\s+/)
    .filter((w) => w && !/[\u4e00-\u9fff]/.test(w)).length;
  return Math.max(1, Math.ceil(cjk * 0.75 + nonCjkWords * 1.3));
}

/** 多条文本合计 token（llms.txt / llms-full.txt 头部总览用） */
export function totalTokens(texts: Array<string | undefined>): number {
  return texts.reduce((sum, t) => sum + (t ? estimateTokens(t) : 0), 0);
}
