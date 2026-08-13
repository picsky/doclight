/**
 * 官方插件注册表（PLUG-007，07 §7.6）
 *
 * 内置官方插件：短名（"giscus"）与包名（"@doclight/plugin-giscus"）均可解析，
 * 工厂函数 (config) => PluginDef | null——返回 null 表示配置无效（如缺必填项），
 * 加载器跳过且不报错（插件按需启用，缺配置 = 禁用，零侵入）。
 *
 * 各插件实现见同目录文件（每个插件含配置说明 + 降级策略，Agent/人双读）。
 */
import type { PluginDef } from "../../../core/src/plugin.ts";
import { createAiChatPlugin } from "./ai-chat.ts";
import { createGiscusPlugin } from "./giscus.ts";
import { createMermaidPlugin } from "./mermaid.ts";
import { createPlausiblePlugin } from "./plausible.ts";
import { createPwaPlugin } from "./pwa.ts";
import { createRssPlugin } from "./rss.ts";

/** 官方插件工厂表（键：插件名；值：工厂函数，返回 null 表示配置无效应跳过） */
export const OFFICIAL_PLUGINS: Record<string, (config?: Record<string, unknown>) => PluginDef | null> = {
  giscus: createGiscusPlugin,
  "@doclight/plugin-giscus": createGiscusPlugin,
  plausible: createPlausiblePlugin,
  "@doclight/plugin-plausible": createPlausiblePlugin,
  rss: createRssPlugin,
  "@doclight/plugin-rss": createRssPlugin,
  pwa: createPwaPlugin,
  "@doclight/plugin-pwa": createPwaPlugin,
  "ai-chat": createAiChatPlugin,
  "@doclight/plugin-ai-chat": createAiChatPlugin,
  mermaid: createMermaidPlugin,
  "@doclight/plugin-mermaid": createMermaidPlugin,
};

/** 官方插件短名清单（help / 文档展示用） */
export const OFFICIAL_PLUGIN_NAMES = ["giscus", "plausible", "rss", "pwa", "ai-chat", "mermaid"] as const;
