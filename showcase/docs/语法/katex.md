---
title: KaTeX 数学公式
description: 行内与块级数学公式演示——$...$ 行内、$$...$$ 块级，KaTeX 按需加载，未加载时降级为 TeX 源码。
summary: KaTeX 行内/块级公式的渲染演示。
date: 2026-08-16
priority: medium
tags: [katex, math, 公式]
category: 渲染能力
difficulty: intermediate
author: DocLight 展示站
---

# KaTeX 数学公式

> 数学公式由 **KaTeX** 渲染（按需懒加载）：`$...$` 行内、`$$...$$` 块级。
> 未加载 KaTeX 时，公式降级为 TeX 源码——依然可读。

## 行内公式

质能方程 $E = mc^2$ 是物理学最著名的公式。

勾股定理：$a^2 + b^2 = c^2$。

欧拉恒等式：$e^{i\pi} + 1 = 0$。

## 块级公式

正态分布的概率密度函数：

$$
f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{(x-\mu)^2}{2\sigma^2}}
$$

泰勒展开：

$$
e^x = \sum_{n=0}^{\infty} \frac{x^n}{n!} = 1 + x + \frac{x^2}{2!} + \frac{x^3}{3!} + \cdots
$$

矩阵：

$$
\begin{pmatrix}
a_{11} & a_{12} \\
a_{21} & a_{22}
\end{pmatrix}
\begin{pmatrix}
x_1 \\
x_2
\end{pmatrix}
=
\begin{pmatrix}
b_1 \\
b_2
\end{pmatrix}
$$

## 与正文混排

:::tip
公式与中文混排时会自动处理中西文发丝空隙；行内公式不换行，块级公式居中独立成段。
:::

极限定义：$\lim_{x \to \infty} \frac{1}{x} = 0$，以及定积分 $\int_0^1 x^2 \, dx = \frac{1}{3}$。

## 源码形态

```md
行内：质能方程 $E = mc^2$

块级：
$$
f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{(x-\mu)^2}{2\sigma^2}}
$$
```
