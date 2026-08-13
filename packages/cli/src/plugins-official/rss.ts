/**
 * @doclight/plugin-rss —— RSS 订阅插件（PLUG-007 + PLUG-010，07 §7.6 官方插件）
 *
 * 机制：构建期 onBuild 钩子——所有文档渲染完成后产出 rss.xml（RSS 2.0）。
 * 站点级产物，与 per-page 钩子（beforeRender 等）正交。
 *
 * 配置（doclight.json plugins 数组项 config）：
 *   { "limit": 20 }      可选（最多条目数，默认 20）
 *   { "filename": "rss.xml" }  可选（产物文件名，默认 rss.xml）
 * 依赖：doclight.json 顶层 siteUrl（绝对 URL 是 RSS 硬要求）——
 * 未配置 siteUrl 时降级跳过（console 提示），不产出相对链接的无效订阅源。
 *
 * 降级策略（REND-003 精神）：siteUrl 缺失 → 不产出文件 + 一条提示，站点其余部分零影响。
 */
import type { BuildFile, PluginDef } from "../../../core/src/plugin.ts";

export interface RssConfig {
  limit?: number;
  filename?: string;
}

/** 工厂：创建 rss 插件 */
export function createRssPlugin(config?: Record<string, unknown>): PluginDef {
  const cfg = (config ?? {}) as RssConfig;
  const limit = typeof cfg.limit === "number" && cfg.limit > 0 ? Math.floor(cfg.limit) : 20;
  const filename = typeof cfg.filename === "string" && cfg.filename ? cfg.filename : "rss.xml";

  return {
    name: "rss",
    version: "0.1.0",
    config: config ?? {},
    onBuild(ctx): BuildFile[] {
      // RSS 需要绝对 URL；siteUrl 未配置时降级跳过（双读友好：提示而非静默失败）
      if (!ctx.siteUrl) {
        console.warn(`[doclight][plugin:rss] 未配置 siteUrl，跳过 rss.xml 生成（doclight.json 增加 "siteUrl" 后启用）`);
        return [];
      }
      const siteUrl = ctx.siteUrl.replace(/\/+$/, "");
      const base = ctx.base || "";
      const items = ctx.docs.slice(0, limit).map((d) => {
        const link = `${siteUrl}${base}/${d.path.replace(/index\.html$/, "")}`;
        const guid = `${siteUrl}${base}/${d.path}`;
        return [
          "    <item>",
          `      <title>${xml(d.title)}</title>`,
          `      <link>${xml(link)}</link>`,
          `      <guid isPermaLink="true">${xml(guid)}</guid>`,
          ...(d.updatedAt ? [`      <pubDate>${toRfc822(d.updatedAt)}</pubDate>`] : []),
          ...(d.summary ? [`      <description>${xml(d.summary)}</description>`] : []),
          "    </item>",
        ].join("\n");
      });
      const content = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0">',
        "  <channel>",
        `    <title>${xml(ctx.siteTitle)}</title>`,
        `    <link>${xml(`${siteUrl}${base}/`)}</link>`,
        `    <description>${xml(`${ctx.siteTitle} 最近更新（DocLight 生成）`)}</description>`,
        ...items,
        "  </channel>",
        "</rss>",
        "",
      ].join("\n");
      return [{ path: filename, content }];
    },
  };
}

/** XML 文本转义（& < > " '） */
function xml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** ISO 日期 → RFC 822（RSS pubDate）。无法解析时返回原值（宽松降级） */
function toRfc822(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getUTCDay()]}, ${pad(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT`;
}
