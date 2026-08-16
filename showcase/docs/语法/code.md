---
title: 代码高亮与复制
description: 多语言代码块的语法高亮与一键复制演示——Prism 按需加载，无 Prism 时降级为纯代码块。
summary: 代码围栏 + 语言标签 + 高亮 + 复制按钮的完整演示。
date: 2026-08-16
priority: high
tags: [code, prism, 高亮]
category: 渲染能力
difficulty: beginner
author: DocLight 展示站
---

# 代码高亮与复制

> 代码围栏由 Prism 高亮（**按需懒加载**），每个代码块带语言标签与**一键复制**按钮。
> 未加载 Prism 时自动降级为纯代码块——依然可读、可复制。

## 行内代码与代码块

行内代码 `const x = 42` 与围栏代码块：

```js
// JavaScript：数组去重
const unique = (arr) => [...new Set(arr)];
console.log(unique([1, 2, 2, 3, 3, 3])); // [1, 2, 3]
```

## 多语言演示

TypeScript：

```ts
interface Doc {
  title: string;
  tags: string[];
  updated?: Date;
}

function newest(docs: Doc[]): Doc | undefined {
  return docs.sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))[0];
}
```

Python：

```python
from dataclasses import dataclass

@dataclass
class Page:
    title: str
    slug: str

    def route(self) -> str:
        return f"/{self.slug}.html"
```

Bash：

```bash
# 一行起一个文档站
doclight dev --port 3000
```

JSON：

```json
{
  "title": "DocLight",
  "plugins": [{ "name": "mermaid" }],
  "footer": { "status": "所有系统正常" }
}
```

CSS：

```css
:root {
  --accent: #14714e; /* 松绿 Pine —— 唯一强调色 */
  --radius: 10px;
}

@media (max-width: 860px) {
  .toc { display: none; }
}
```

## 无语言标注的代码块

```text
不指定语言的代码块：按纯文本渲染，仍可一键复制。
```

:::info
超长代码块会被渐进折叠（`.codeblock.collapsed`），点击「展开」查看全部；代码块右上角显示语言标签。
:::
