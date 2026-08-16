/**
 * 图片加载失败优雅降级（2026-08）
 *
 * 场景：<img> 加载失败（src 404 / 网络断 / 格式不支持）时浏览器默认显示破图图标，
 * 观感差且对读者无信息。本模块在展示层挂载后注册 capture 阶段 document 级 error
 * 监听——img 的 error 事件不冒泡但会走捕获阶段——把失败的 <img> 替换为
 * .doclight-img-error 占位（class 标记 + 文本承载，符合扩展内容承载铁律）：
 *   alt 保留为 aria-label（读屏可读），可见 hint 文本「图片加载失败：<alt>」。
 *
 * 无 JS 降级 = 浏览器默认破图（可接受的最小声学状态，不引入额外依赖）。
 */
/** 失败占位的可见提示文本（纯函数，可单测） */
export function imageErrorHint(alt: string): string {
  return alt ? `图片加载失败：${alt}` : "图片加载失败";
}

/** 已处理的图片集合（WeakSet 防泄漏；幂等：同一 img 只替换一次） */
const handled = new WeakSet<HTMLImageElement>();

/** 将失败的 <img> 替换为错误占位（幂等） */
export function handleImageError(img: HTMLImageElement): void {
  if (handled.has(img)) return;
  handled.add(img);
  const alt = img.getAttribute("alt") ?? "";
  const box = document.createElement("span");
  box.className = "doclight-img-error";
  box.setAttribute("role", "img");
  if (alt) box.setAttribute("aria-label", alt);
  const hint = document.createElement("span");
  hint.className = "doclight-img-error-hint";
  hint.textContent = imageErrorHint(alt);
  box.appendChild(hint);
  img.replaceWith(box);
}

/** 注册全局图片失败监听（mount 时调用一次；capture 捕获 img 的 error） */
export function initImageErrorFallback(): void {
  document.addEventListener(
    "error",
    (e) => {
      if (e.target instanceof HTMLImageElement) handleImageError(e.target);
    },
    true,
  );
}
