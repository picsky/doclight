/**
 * @doclight/plugin-plausible —— Plausible 站点统计插件（PLUG-007，07 §7.6 官方插件）
 *
 * 机制：构建时插槽注入 head:end 统计脚本（轻量隐私友好分析，无 cookie）。
 * 零运行时钩子。
 *
 * 配置（doclight.json plugins 数组项 config）：
 *   { "domain": "docs.example.com" }  必填（Plausible 后台登记的域名）
 *   { "src": "https://plausible.io/js/script.js" }  可选（自托管实例地址）
 * 配置缺失 domain → 插件禁用（返回 null 由加载器跳过）。
 */
import type { PluginDef } from "../../../core/src/plugin.ts";

export interface PlausibleConfig {
  domain?: string;
  src?: string;
}

/** 工厂：创建 plausible 插件（config 无效时返回 null，加载器跳过） */
export function createPlausiblePlugin(config?: Record<string, unknown>): PluginDef | null {
  const cfg = (config ?? {}) as PlausibleConfig;
  if (!cfg.domain) return null;

  const src = cfg.src ?? "https://plausible.io/js/script.js";
  return {
    name: "plausible",
    version: "0.1.0",
    config: config ?? {},
    slotContent: {
      "head:end": `<script defer data-domain="${escapeAttr(cfg.domain)}" src="${escapeAttr(src)}"></script>`,
    },
  };
}

/** HTML 属性转义（配置值注入属性，防引号破坏） */
function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
