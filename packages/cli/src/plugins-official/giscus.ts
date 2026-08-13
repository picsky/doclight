/**
 * @doclight/plugin-giscus —— Giscus 评论插件（PLUG-007，07 §7.6 官方插件）
 *
 * 机制：构建时插槽注入（content:after 评论容器 + head:end Giscus 客户端脚本）。
 * Giscus 脚本自引导（读取 data-* 配置 → iframe 嵌入 GitHub Discussions），
 * 无运行时 PluginDef 钩子需求。
 *
 * 配置（doclight.json plugins 数组项 config）：
 *   { "repo": "owner/repo" }                    必填（GitHub 公开仓库）
 *   { "repoId": "R_xxx", "categoryId": "D_xxx" } 推荐（giscus.app 生成，固定讨论串）
 *   { "category": "Announcements" }              可选
 *   { "mapping": "pathname" }                    可选（默认 pathname：按路径映射讨论）
 *   { "lang": "zh-CN" }                          可选（默认 zh-CN）
 * 配置缺失 repo → 插件禁用（返回 null 由加载器跳过），不注入无效脚本。
 *
 * 主题跟随：data-theme="preferred_color_scheme" 随站点亮/暗自动切换（THEME-001）。
 */
import type { PluginDef } from "../../../core/src/plugin.ts";

export interface GiscusConfig {
  repo?: string;
  repoId?: string;
  categoryId?: string;
  category?: string;
  mapping?: string;
  lang?: string;
}

/** 工厂：创建 giscus 插件（config 无效时返回 null，加载器跳过） */
export function createGiscusPlugin(config?: Record<string, unknown>): PluginDef | null {
  const cfg = (config ?? {}) as GiscusConfig;
  if (!cfg.repo || !cfg.repo.includes("/")) return null;

  const attrs = [
    `data-repo="${escapeAttr(cfg.repo)}"`,
    cfg.repoId ? `data-repo-id="${escapeAttr(cfg.repoId)}"` : "",
    cfg.categoryId ? `data-category-id="${escapeAttr(cfg.categoryId)}"` : "",
    `data-category="${escapeAttr(cfg.category ?? "Announcements")}"`,
    `data-mapping="${escapeAttr(cfg.mapping ?? "pathname")}"`,
    'data-strict="0"',
    'data-reactions-enabled="1"',
    'data-emit-metadata="0"',
    'data-input-position="bottom"',
    'data-theme="preferred_color_scheme"',
    `data-lang="${escapeAttr(cfg.lang ?? "zh-CN")}"`,
    'crossorigin="anonymous"',
    "async",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    name: "giscus",
    version: "0.1.0",
    config: config ?? {},
    slotContent: {
      // 评论容器 + 客户端脚本（Giscus 自引导，内容承载：div 挂载点 + script，class 标记）
      "content:after": `<div class="doclight-giscus"></div>\n<script src="https://giscus.app/client.js" ${attrs}></script>`,
    },
  };
}

/** HTML 属性转义（配置值注入属性，防引号破坏） */
function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
